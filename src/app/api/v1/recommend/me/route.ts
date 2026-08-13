export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest } from '@/lib/api-response';
import { Role, CourseStatus, ReviewStatus } from '@prisma/client';

type Scene = 'dashboard' | 'course_detail' | 'after_exam' | 'extracurricular';

async function enrichItem(item: {
  id: string; itemType: string; itemId: string;
  score: number; source: string; rank: number;
  scene: string; studentId: string; createdAt: Date;
}) {
  let resource: Record<string, unknown> = {};
  try {
    if (item.itemType === 'course') {
      resource = await prisma.course.findUnique({
        where: { id: item.itemId },
        select: {
          id: true, title: true, coverUrl: true, intro: true, grade: true,
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, nickname: true } },
        },
      }) ?? {};
    } else if (item.itemType === 'question') {
      resource = await prisma.question.findUnique({
        where: { id: item.itemId },
        select: {
          id: true, content: true, difficulty: true, questionType: true,
          subject: { select: { id: true, name: true } },
        },
      }) ?? {};
    } else if (item.itemType === 'article') {
      resource = await prisma.article.findUnique({
        where: { id: item.itemId },
        select: {
          id: true, title: true, summary: true, coverUrl: true, category: true,
          tags: true,
        },
      }) ?? {};
    } else if (item.itemType === 'contest') {
      resource = await prisma.contest.findUnique({
        where: { id: item.itemId },
        select: {
          id: true, title: true, shortTitle: true, year: true, stage: true,
          subject: { select: { id: true, name: true } },
        },
      }) ?? {};
    } else if (item.itemType === 'exam') {
      resource = await prisma.exam.findUnique({
        where: { id: item.itemId },
        select: {
          id: true, title: true, totalScore: true, duration: true,
          subject: { select: { id: true, name: true } },
        },
      }) ?? {};
    }
  } catch {
    resource = {};
  }
  return { ...item, resource };
}

// Fallback：当 RecallItem 表为空时，返回热门内容作为推荐
async function fallbackHotContent(studentId: string, scene: Scene, limit: number) {
  const fallback: Array<{
    itemType: string; itemId: string; score: number; source: string;
  }> = [];

  const [hotCourses, hotArticles, hotQuestions] = await Promise.all([
    prisma.course.findMany({
      where: { status: CourseStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: Math.ceil(limit / 2),
      select: { id: true },
    }),
    prisma.article.findMany({
      where: { reviewStatus: ReviewStatus.REVIEWER_PASSED, publishedAt: { not: null } },
      orderBy: { viewCount: 'desc' },
      take: Math.ceil(limit / 3),
      select: { id: true },
    }),
    prisma.question.findMany({
      where: { reviewStatus: ReviewStatus.REVIEWER_PASSED },
      orderBy: { attemptCount: 'desc' },
      take: Math.ceil(limit / 4),
      select: { id: true },
    }),
  ]);

  hotCourses.forEach((c, idx) => {
    fallback.push({ itemType: 'course', itemId: c.id, score: 1.0 / (idx + 1), source: 'hot_fallback' });
  });
  hotArticles.forEach((a, idx) => {
    fallback.push({ itemType: 'article', itemId: a.id, score: 0.7 / (idx + 1), source: 'hot_fallback' });
  });
  if (scene === 'after_exam' || scene === 'dashboard') {
    hotQuestions.forEach((q, idx) => {
      fallback.push({ itemType: 'question', itemId: q.id, score: 0.5 / (idx + 1), source: 'hot_fallback' });
    });
  }

  fallback.sort((a, b) => b.score - a.score);
  return fallback.slice(0, limit).map((item, idx) => ({
    id: `fallback-${idx}`,
    studentId,
    scene,
    itemType: item.itemType,
    itemId: item.itemId,
    score: item.score,
    source: item.source,
    rank: idx + 1,
    createdAt: new Date(),
  }));
}

export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return badRequest('仅学生可获取个性化推荐');

  const { searchParams } = new URL(request.url);
  const scene: Scene = (searchParams.get('scene') as Scene) ?? 'dashboard';
  const rawLimit = Number(searchParams.get('limit') ?? 20);
  const limit = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit));

  let items = await prisma.recallItem.findMany({
    where: { studentId: user!.id, scene },
    orderBy: { rank: 'asc' },
    take: limit,
  });

  // Fallback：无推荐数据时返回热门内容
  if (items.length === 0) {
    items = await fallbackHotContent(user!.id, scene, limit);
  }

  const enriched = await Promise.all(items.map(enrichItem));

  return ok({ items: enriched, fallback: items[0]?.source === 'hot_fallback' });
}
