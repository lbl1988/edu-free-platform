export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

type CtxExam = { params: { id: string } };

export async function GET(request: NextRequest, { params }: CtxExam) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, totalScore: true, passScore: true,
      duration: true, subjectId: true, creatorId: true,
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, content: true, perScore: true, sortOrder: true,
          answers: {
            select: { finalScore: true, perScore: true, isCorrect: true },
          },
        },
      },
      results: {
        select: {
          id: true, status: true, score: true, studentId: true, graded: true,
          student: { select: { nickname: true, grade: true } },
          violations: { select: { type: true } },
        },
      },
    },
  });
  if (!exam) return notFound('考试不存在');
  if (exam.creatorId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅考试创建者或管理员可查看分析');
  }

  const totalScore = exam.totalScore;
  const passScore = exam.passScore ?? totalScore * 0.6;
  const participants = exam.results.length;
  const gradedCount = exam.results.filter((r) => r.graded || r.status === 'GRADED' || r.score != null).length;

  const scoreBuckets = {
    '<60': 0, '60-70': 0, '70-80': 0, '80-90': 0, '>=90': 0,
  };
  let scoredTotal = 0;
  let scoredCount = 0;

  exam.results.forEach((r) => {
    if (r.score != null) {
      scoredCount++;
      scoredTotal += r.score;
      const pct = (r.score / totalScore) * 100;
      if (pct < 60) scoreBuckets['<60']++;
      else if (pct < 70) scoreBuckets['60-70']++;
      else if (pct < 80) scoreBuckets['70-80']++;
      else if (pct < 90) scoreBuckets['80-90']++;
      else scoreBuckets['>=90']++;
    }
  });

  const avgExamScore = scoredCount > 0 ? Math.round((scoredTotal / scoredCount) * 100) / 100 : 0;

  const questionStats = exam.questions.map((q) => {
    const totalAnswers = q.answers.length;
    let totalFinal = 0;
    let correctCount = 0;
    let validAnswers = 0;
    q.answers.forEach((a) => {
      if (a.finalScore != null) {
        totalFinal += a.finalScore;
        validAnswers++;
      }
      if (a.isCorrect) correctCount++;
    });
    const avgFinal = validAnswers > 0 ? Math.round((totalFinal / validAnswers) * 100) / 100 : 0;
    const rateRaw = q.perScore > 0 ? (validAnswers > 0 ? totalFinal / (q.perScore * validAnswers) : 0) :
      (totalAnswers > 0 ? correctCount / totalAnswers : 0);
    const rate = Math.round(rateRaw * 10000) / 10000;
    return {
      id: q.id,
      sortOrder: q.sortOrder,
      contentPreview: q.content.slice(0, 50),
      perScore: q.perScore,
      avgFinalScore: avgFinal,
      answerCount: totalAnswers,
      scoreRate: rate,
    };
  });

  const violationTypeMap: Record<string, number> = {};
  exam.results.forEach((r) => {
    r.violations.forEach((v) => {
      violationTypeMap[v.type] = (violationTypeMap[v.type] ?? 0) + 1;
    });
  });
  const violationStats = Object.entries(violationTypeMap).map(([type, count]) => ({ type, count }));

  const topStudents = exam.results
    .filter((r) => r.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)
    .map((r) => ({
      studentId: r.studentId,
      nickname: r.student.nickname ?? '未知',
      grade: r.student.grade,
      score: r.score,
      status: r.status,
    }));

  return ok({
    basic: {
      id: exam.id,
      title: exam.title,
      totalScore,
      passScore,
      avgScore: avgExamScore,
      duration: exam.duration,
      participants,
      gradedCount,
      scoredCount,
    },
    scoreDistribution: scoreBuckets,
    questionStats,
    violationStats,
    topStudents,
  });
}
