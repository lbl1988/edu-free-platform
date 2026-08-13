import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';

type Ctx = { params: { questionId: string } };

// DELETE /api/v1/favorites/{questionId} — 取消收藏
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(_request);
  if (err) return err;
  await prisma.favorite.deleteMany({
    where: { studentId: user!.id, questionId: params.questionId },
  });
  return ok({ favorited: false });
}
