export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, forbidden, notFound } from '@/lib/api-response';
import { Role } from '@prisma/client';
// ExamStatus removed - not directly used

type Ctx = { params: { studentId: string } };

// GET /api/v1/user/family/[studentId]/report — 家长查看子女学习详情报告
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  if (user!.role !== Role.PARENT) {
    return forbidden('仅家长可查看子女学习报告');
  }

  // 校验绑定关系
  const binding = await prisma.parentBinding.findUnique({
    where: {
      parentId_studentId: {
        parentId: user!.id,
        studentId: params.studentId,
      },
    },
    select: { id: true, verified: true },
  });
  if (!binding || !binding.verified) {
    return forbidden('未绑定该学生或绑定未验证');
  }

  const studentId = params.studentId;

  // 并行获取各项学习数据
  const [
    student,
    learningProfile,
    recentExams,
    wrongCount,
    courseEnrollments,
    recentWrongRecords,
    paperAttempts,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, nickname: true, grade: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.learningProfile.findUnique({
      where: { studentId },
      select: {
        totalStudyMinutes: true,
        correctRate: true,
        streakDays: true,
        lastActiveAt: true,
        weakPoints: true,
        preferences: true,
      },
    }),
    // 最近5次考试结果
    prisma.examResult.findMany({
      where: { studentId },
      orderBy: { submitTime: 'desc' },
      take: 5,
      select: {
        id: true,
        score: true,
        status: true,
        submitTime: true,
        exam: {
          select: {
            id: true,
            title: true,
            totalScore: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
    // 未掌握错题总数
    prisma.wrongRecord.count({
      where: { studentId, mastered: false },
    }),
    // 课程报名
    prisma.courseEnrollment.findMany({
      where: { studentId },
      orderBy: { joinedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        joinedAt: true,
        course: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
    // 最近10条错题
    prisma.wrongRecord.findMany({
      where: { studentId },
      orderBy: { lastWrongAt: 'desc' },
      take: 10,
      select: {
        id: true,
        mastered: true,
        wrongCount: true,
        lastWrongAt: true,
        question: {
          select: {
            id: true,
            content: true,
            difficulty: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
    // 最近练习记录
    prisma.paperAttempt.findMany({
      where: { studentId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        correctCount: true,
        totalCount: true,
        submittedAt: true,
        paper: { select: { title: true } },
      },
    }),
  ]);

  if (!student) return notFound('学生不存在');

  // 考试统计
  const scoredExams = recentExams.filter((e) => e.score != null);
  const examStats = {
    total: recentExams.length,
    avgScore: scoredExams.length > 0
      ? Math.round((scoredExams.reduce((sum, e) => sum + (e.score ?? 0), 0) / scoredExams.length) * 100) / 100
      : 0,
    passed: scoredExams.filter((e) => {
      const passLine = (e.exam.totalScore ?? 100) * 0.6;
      return (e.score ?? 0) >= passLine;
    }).length,
  };

  // 练习统计
  const practiceStats = {
    totalAttempts: paperAttempts.length,
    avgCorrectRate: paperAttempts.length > 0
      ? Math.round(
          (paperAttempts.reduce((sum, p) => {
            if (p.totalCount && p.totalCount > 0) {
              return sum + (p.correctCount ?? 0) / p.totalCount;
            }
            return sum;
          }, 0) / paperAttempts.length) * 10000,
        ) / 10000
      : 0,
  };

  // 薄弱知识点
  const weakPoints = Array.isArray(learningProfile?.weakPoints)
    ? (learningProfile!.weakPoints as Array<{ chapterId?: string; chapterTitle?: string; mastery?: number }>)
        .filter((w) => (w.mastery ?? 1) < 0.6)
        .slice(0, 5)
    : [];

  return ok({
    student: {
      id: student.id,
      nickname: student.nickname,
      grade: student.grade,
      lastLoginAt: student.lastLoginAt,
    },
    learningProfile: learningProfile
      ? {
          totalStudyMinutes: learningProfile.totalStudyMinutes,
          correctRate: learningProfile.correctRate,
          streakDays: learningProfile.streakDays,
          lastActiveAt: learningProfile.lastActiveAt,
          preferences: learningProfile.preferences,
        }
      : null,
    examStats: {
      ...examStats,
      recentExams: recentExams.map((e) => ({
        id: e.id,
        title: e.exam.title,
        subject: e.exam.subject.name,
        score: e.score,
        totalScore: e.exam.totalScore,
        status: e.status,
        submitTime: e.submitTime,
      })),
    },
    practiceStats: {
      ...practiceStats,
      recentPractices: paperAttempts.map((p) => ({
        id: p.id,
        title: p.paper.title,
        correctCount: p.correctCount,
        totalCount: p.totalCount,
        submittedAt: p.submittedAt,
      })),
    },
    wrongStats: {
      unresolvedCount: wrongCount,
      recentWrong: recentWrongRecords.map((w) => ({
        id: w.id,
        mastered: w.mastered,
        wrongCount: w.wrongCount,
        lastWrongAt: w.lastWrongAt,
        contentPreview: w.question.content.slice(0, 80),
        difficulty: w.question.difficulty,
        subject: w.question.subject.name,
      })),
    },
    courses: courseEnrollments.map((c) => ({
      id: c.id,
      title: c.course.title,
      subject: c.course.subject.name,
      coverUrl: c.course.coverUrl,
      enrolledAt: c.joinedAt,
    })),
    weakPoints,
  });
}
