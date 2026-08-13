import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden, badRequest } from '@/lib/api-response';
import { CourseStatus, ExamStatus, Role } from '@prisma/client';
import { getClientIp } from '@/lib/utils';

type Ctx = { params: { id: string } };

// POST /api/v1/exams/{id}/start — 学生进入考试（锁定试卷+返回答案可见版题目）
export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return badRequest('仅学生可开始考试');

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, sortOrder: true, perScore: true,
          questionType: true, content: true, options: true, difficulty: true,
          answer: true, analysis: true,
        },
      },
    },
  });
  if (!exam) return notFound('考试不存在');
  if (exam.status !== CourseStatus.PUBLISHED) return forbidden('考试未开放');

  const now = new Date();
  if (now < exam.startTime) return badRequest('考试尚未开始');
  if (now > exam.endTime) return badRequest('考试已结束');
  if (Number(user!.grade) !== exam.grade) return forbidden('年级不符');

  let result = await prisma.examResult.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId: user!.id } },
  });

  if (result && result.status === ExamStatus.NOT_STARTED) {
    result = await prisma.examResult.update({
      where: { id: result.id },
      data: {
        status: ExamStatus.IN_PROGRESS,
        startTime: now,
        deadline: new Date(now.getTime() + exam.duration * 60 * 1000),
        startIp: getClientIp(request),
        totalCount: exam.questions.length,
        totalScore: exam.totalScore,
      },
    });
  } else if (!result) {
    result = await prisma.examResult.create({
      data: {
        examId: exam.id,
        studentId: user!.id,
        status: ExamStatus.IN_PROGRESS,
        startTime: now,
        deadline: new Date(now.getTime() + exam.duration * 60 * 1000),
        startIp: getClientIp(request),
        totalCount: exam.questions.length,
        totalScore: exam.totalScore,
      },
    });
  }

  // 已交卷/违规/已评分 的，不再下发答案与解析
  const s: string = result.status;
  const lockDown = [ExamStatus.SUBMITTED, ExamStatus.VIOLATION_SUBMIT, ExamStatus.GRADED].includes(s as any);
  return ok({
    resultId: result.id,
    status: result.status,
    startTime: result.startTime,
    deadline: result.deadline,
    submitTime: result.submitTime,
    cheatingLimit: exam.maxCheating,
    cheatingCount: result.cheatingCount,
    questions: exam.questions.map(({ answer, analysis, ...rest }) =>
      lockDown ? rest : { ...rest, answer, analysis },
    ),
  });
}
