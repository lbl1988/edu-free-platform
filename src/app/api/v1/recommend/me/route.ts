export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest } from '@/lib/api-response';
import { Role } from '@prisma/client';

type Scene = 'dashboard' | 'course_detail' | 'after_exam' | 'extracurricular';

export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return badRequest('仅学生可获取个性化推荐');

  const { searchParams } = new URL(request.url);
  const scene: Scene = (searchParams.get('scene') as Scene) ?? 'dashboard';
  const rawLimit = Number(searchParams.get('limit') ?? 20);
  const limit = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit));

  const items = await prisma.recallItem.findMany({
    where: { studentId: user!.id, scene },
    orderBy: { rank: 'asc' },
    take: limit,
  });

  const enriched = await Promise.all(
    items.map(async (item: { id: string; itemType: string; itemId: string; score: number; source: string; rank: number; scene: string; studentId: string; createdAt: Date }) => {
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
    }),
  );

  return ok({ items: enriched });
}
