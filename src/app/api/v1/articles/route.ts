export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin, requireTeacher } from '@/lib/guards';
import { ok, okPaginated, badRequest, notFound, forbidden } from '@/lib/api-response';
import { BoardType, ReviewStatus, Role } from '@prisma/client';

const articleSelectBase = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  coverUrl: true,
  category: true,
  tags: true,
  viewCount: true,
  likeCount: true,
  publishedAt: true,
  author: { select: { id: true, nickname: true } },
  subject: { select: { id: true, name: true } },
} as const;

function cuidLike(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const boardType = (searchParams.get('boardType') as BoardType | null) ?? BoardType.EXTRACURRICULAR;
  const category = searchParams.get('category');
  const subjectId = searchParams.get('subjectId');
  const grade = searchParams.get('grade');
  const keyword = searchParams.get('keyword')?.trim();

  const where: Record<string, unknown> = {
    boardType,
    reviewStatus: ReviewStatus.REVIEWER_PASSED,
    publishedAt: { not: null },
  };

  if (category) where.category = category;
  if (subjectId) where.subjectId = Number(subjectId);
  if (grade) where.grade = Number(grade);
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { summary: { contains: keyword, mode: 'insensitive' } },
      { tags: { has: keyword } },
    ];
  }

  const [total, articles, rawAggregates] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      select: articleSelectBase,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.article.groupBy({
      by: ['category'],
      where,
      _count: { category: true },
    }),
  ]);

  const categoryAggregates = rawAggregates.map((g) => ({
    category: g.category,
    count: g._count.category,
  }));

  return okPaginated({ articles, categoryAggregates }, { page, limit, total });
}

const CreateSchema = z.object({
  title: z.string().min(2).max(200),
  summary: z.string().max(500).optional(),
  content: z.string().min(1),
  coverUrl: z.string().optional(),
  boardType: z.nativeEnum(BoardType).default(BoardType.EXTRACURRICULAR),
  category: z.string().min(1).max(50),
  tags: z.array(z.string()).default([]),
  subjectId: z.number().int().optional(),
  grade: z.number().int().optional(),
  chapterId: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  reviewStatus: z.nativeEnum(ReviewStatus).default(ReviewStatus.REVIEWER_PASSED),
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  if (p.subjectId !== undefined) {
    const subject = await prisma.subject.findUnique({ where: { id: p.subjectId } });
    if (!subject) return badRequest('学科不存在');
  }

  if (p.chapterId) {
    const chapter = await prisma.chapter.findUnique({ where: { id: p.chapterId } });
    if (!chapter) return badRequest('章节不存在');
  }

  let slug: string | null = null;
  for (let i = 0; i < 3; i++) {
    const candidate = 'art-' + cuidLike();
    const exists = await prisma.article.findUnique({ where: { slug: candidate } });
    if (!exists) {
      slug = candidate;
      break;
    }
  }
  if (!slug) return badRequest('生成 slug 失败，请重试');

  const publishedAt =
    p.reviewStatus === ReviewStatus.REVIEWER_PASSED || p.reviewStatus === ReviewStatus.EXPERT_PASSED
      ? new Date()
      : null;

  const article = await prisma.article.create({
    data: {
      title: p.title,
      slug,
      summary: p.summary,
      content: p.content,
      coverUrl: p.coverUrl,
      boardType: p.boardType,
      category: p.category,
      tags: p.tags,
      subjectId: p.subjectId,
      grade: p.grade,
      chapterId: p.chapterId,
      source: p.source,
      sourceUrl: p.sourceUrl,
      authorId: user!.id,
      reviewStatus: p.reviewStatus,
      publishedAt,
    },
    select: {
      ...articleSelectBase,
      content: true,
      reviewStatus: true,
      source: true,
      sourceUrl: true,
      chapter: { select: { id: true, title: true } },
    },
  });

  return ok({ article }, 201);
}
