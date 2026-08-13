import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok, notFound, forbidden, okPaginated } from '@/lib/api-response';
import { Role } from '@prisma/client';

type CtxExam = { params: { id: string } };

// ============== 考试结果列表（教师/管理员视角）==============
// GET /api/v1/exams/{id}/results — 查看一场考试的全部学生成绩
export async function GET(request: NextRequest, { params }: CtxExam) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true, title: true },
  });
  if (!exam) return notFound('考试不存在');
  if (exam.creatorId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅考试创建者或管理员可查成绩');
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const status = searchParams.get('status');

  const where: Record<string, unknown> = { examId: params.id };
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    prisma.examResult.count({ where }),
    prisma.examResult.findMany({
      where,
      include: {
        student: { select: { id: true, nickname: true, grade: true } },
        violations: { orderBy: { occurredAt: 'desc' }, select: { id: true, type: true, occurredAt: true } },
      },
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { submitTime: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(
    { exam, results: items },
    { page, limit, total },
  );
}

