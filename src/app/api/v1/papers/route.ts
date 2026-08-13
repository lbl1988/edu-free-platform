export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { okPaginated, ok, notFound } from '@/lib/api-response';

// GET /api/v1/papers — 试卷列表
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const subjectId = searchParams.get('subjectId');
  const grade = searchParams.get('grade');
  const mode = searchParams.get('mode');

  const where: Record<string, unknown> = { published: true };
  if (subjectId) where.subjectId = Number(subjectId);
  if (grade) where.grade = Number(grade);
  if (mode) where.mode = mode;
  if (user!.role === 'TEACHER' || user!.role === 'ADMIN') {
    if (!searchParams.get('all')) {
      delete where.published;
      where.OR = [{ published: true }, { creatorId: user!.id }];
    }
  }

  const [total, items] = await Promise.all([
    prisma.practicePaper.count({ where }),
    prisma.practicePaper.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true } },
        creator: { select: { id: true, nickname: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(items, { page, limit, total });
}
