export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { ReviewStatus, Role } from '@prisma/client';

const articleDetailSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  content: true,
  coverUrl: true,
  category: true,
  tags: true,
  viewCount: true,
  likeCount: true,
  publishedAt: true,
  reviewStatus: true,
  boardType: true,
  author: { select: { id: true, nickname: true, avatarUrl: true } },
  subject: { select: { id: true, name: true } },
  grade: true,
  source: true,
  sourceUrl: true,
  chapter: { select: { id: true, title: true } },
  createdAt: true,
  updatedAt: true,
} as const;

const relatedSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  coverUrl: true,
  category: true,
  viewCount: true,
  publishedAt: true,
} as const;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const article = await prisma.article.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
    },
    select: articleDetailSelect,
  });

  if (!article) return notFound('文章不存在');

  if (article.reviewStatus !== ReviewStatus.REVIEWER_PASSED && article.reviewStatus !== ReviewStatus.EXPERT_PASSED) {
    const [user, err] = await requireLogin(request);
    if (err) return forbidden('文章未通过审核');
    if (user!.role !== Role.ADMIN && article.author?.id !== user!.id) {
      return forbidden('文章未通过审核');
    }
  }

  const [, relatedArticles] = await Promise.all([
    prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    }),
    prisma.article.findMany({
      where: {
        category: article.category,
        reviewStatus: ReviewStatus.REVIEWER_PASSED,
        publishedAt: { not: null },
        id: { not: article.id },
      },
      select: relatedSelect,
      take: 5,
    }),
  ]);

  return ok({ article: { ...article, viewCount: (article.viewCount ?? 0) + 1 }, relatedArticles });
}
