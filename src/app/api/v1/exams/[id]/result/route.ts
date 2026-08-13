import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, badRequest } from '@/lib/api-response';
import { Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// GET /api/v1/exams/{id}/result — 学生查看自己本次考试的结果（含答案、得分、解析）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return badRequest('仅学生可查看自己的结果');

  const result = await prisma.examResult.findUnique({
    where: { examId_studentId: { examId: params.id, studentId: user!.id } },
    include: {
      exam: { select: { id: true, title: true, duration: true, totalScore: true, aiAutoGrade: true, maxCheating: true, creator: { select: { nickname: true } } } },
      answers: {
        orderBy: { examQuestion: { sortOrder: 'asc' } },
        include: {
          examQuestion: {
            select: { id: true, sortOrder: true, perScore: true, questionType: true, content: true, options: true, answer: true, analysis: true },
          },
        },
      },
      violations: { orderBy: { occurredAt: 'asc' }, select: { id: true, type: true, detail: true, occurredAt: true } },
    },
  });
  if (!result) return notFound('未找到考试结果，请先开始/提交考试');

  return ok({ result });
}
