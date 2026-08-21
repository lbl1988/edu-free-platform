export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound } from '@/lib/api-response';

// POST /api/v1/courses/[id]/discussions/[postId]/like — 点赞讨论帖（P3-2）
export async function POST(request: NextRequest) {
  const [_user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const segments = request.nextUrl.pathname.split('/');
  const postId = segments[6];

  const post = await prisma.courseDiscussion.findUnique({
    where: { id: postId },
    select: { id: true, likeCount: true },
  });
  if (!post) {
    return notFound('帖子不存在') as unknown as Response;
  }

  const updated = await prisma.courseDiscussion.update({
    where: { id: postId },
    data: { likeCount: { increment: 1 } },
    select: { id: true, likeCount: true },
  });

  return ok({ likeCount: updated.likeCount });
}
