import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { okPaginated } from '@/lib/api-response';

// GET /api/v1/wrong — 错题本列表（支持 mastered 筛选，默认未掌握）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const mastered = searchParams.get('mastered'); // 'true' / 不传 = false
  const subjectId = searchParams.get('subjectId');

  const where: Record<string, unknown> = { studentId: user!.id };
  if (mastered === 'true') where.mastered = true;
  else if (mastered === 'false') where.mastered = false;
  if (subjectId) where.question = { subjectId: Number(subjectId) };

  const [total, items] = await Promise.all([
    prisma.wrongRecord.count({ where }),
    prisma.wrongRecord.findMany({
      where,
      include: {
        question: {
          include: {
            subject: { select: { id: true, name: true } },
            chapter: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { lastWrongAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(items, { page, limit, total });
}
