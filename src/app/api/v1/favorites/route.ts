export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, okPaginated, conflict } from '@/lib/api-response';

// GET /api/v1/favorites — 收藏列表
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 20)));

  const [total, items] = await Promise.all([
    prisma.favorite.count({ where: { studentId: user!.id } }),
    prisma.favorite.findMany({
      where: { studentId: user!.id },
      include: {
        question: {
          include: {
            subject: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(items, { page, limit, total });
}

// POST /api/v1/favorites — 新增收藏（body: { questionId }）
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  let body: { questionId?: string };
  try {
    body = await request.json();
  } catch {
    return ok({ favorited: false }, 400) as any;
  }
  const questionId = body.questionId;
  if (!questionId) {
    return ok({ favorited: false }, 400) as any;
  }
  const existing = await prisma.favorite.findUnique({
    where: { studentId_questionId: { studentId: user!.id, questionId } },
  });
  if (existing) return conflict('已收藏该题');
  const fav = await prisma.favorite.create({
    data: { studentId: user!.id, questionId },
  });
  return ok({ favorited: true, id: fav.id }, 201);
}

// DELETE 逻辑在 favorites/[questionId]/route.ts
