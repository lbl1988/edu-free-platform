export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { okPaginated } from '@/lib/api-response';

// GET /api/v1/wrong/review-due — 今日到期复习列表（艾宾浩斯遗忘曲线，P0-1）
// 返回 nextReviewAt <= now 且未掌握的错题；按到期时间升序
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const subjectId = searchParams.get('subjectId');
  const now = new Date();

  const where: Record<string, unknown> = {
    studentId: user!.id,
    mastered: false,
    nextReviewAt: { lte: now },
  };
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
      orderBy: { nextReviewAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(items, { page, limit, total });
}
