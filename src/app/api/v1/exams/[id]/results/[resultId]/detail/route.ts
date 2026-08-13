import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

type Ctx = { params: { id: string; resultId: string } };

// GET /api/v1/exams/{id}/results/{resultId}/detail — 教师/管理员查看某学生答题详情（用于批改）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true, title: true },
  });
  if (!exam) return notFound('考试不存在');
  if (exam.creatorId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('无权查看');
  }

  const result = await prisma.examResult.findUnique({
    where: { id: params.resultId },
    include: {
      student: { select: { id: true, nickname: true, grade: true } },
      answers: {
        orderBy: { examQuestion: { sortOrder: 'asc' } },
        include: {
          examQuestion: {
            select: {
              id: true, sortOrder: true, perScore: true, questionType: true,
              content: true, options: true, answer: true, analysis: true,
            },
          },
        },
      },
      violations: { orderBy: { occurredAt: 'asc' }, select: { id: true, type: true, detail: true, occurredAt: true } },
    },
  });
  if (!result || result.examId !== params.id) return notFound('答题记录不存在');

  return ok({ result });
}
