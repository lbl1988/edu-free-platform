export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, badRequest } from '@/lib/api-response';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { id } = params;
  const article = await prisma.article.findUnique({ where: { id }, select: { id: true } });
  if (!article) return notFound('文章不存在');

  const updated = await prisma.article.update({
    where: { id },
    data: { likeCount: { increment: 1 } },
    select: { id: true, likeCount: true },
  });

  return ok({ liked: true, likeCount: updated.likeCount });
}
