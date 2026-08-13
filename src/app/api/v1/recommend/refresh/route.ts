export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, forbidden } from '@/lib/api-response';
import { Role, CourseStatus, ReviewStatus } from '@prisma/client';

type Scene = 'dashboard' | 'course_detail' | 'after_exam' | 'extracurricular';

export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.ADMIN) return forbidden('需要管理员权限');

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体必须是 JSON');
  }

  const scene: Scene = (body.scene as Scene) ?? 'dashboard';
  const limitPerStudent = Math.min(200, Math.max(1, Number(body.limitPerStudent ?? 50)));
  const maxStudents = Math.min(500, Math.max(1, Number(body.maxStudents ?? 50)));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let studentIds: string[] = [];

  const summaries = await prisma.userBehaviorSummary.findMany({
    where: { lastSessionAt: { gte: thirtyDaysAgo } },
    orderBy: { lastSessionAt: 'desc' },
    take: maxStudents,
    select: { studentId: true, lastSessionAt: true },
  });

  const recentUsers = await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      deletedAt: null,
      lastLoginAt: { gte: thirtyDaysAgo },
    },
    orderBy: { lastLoginAt: 'desc' },
    take: maxStudents,
    select: { id: true, lastLoginAt: true },
  });

  const idSet = new Map<string, Date>();
  summaries.forEach((s: any) => idSet.set(s.studentId, s.lastSessionAt ?? new Date(0)));
  recentUsers.forEach((u: any) => {
    const dt = u.lastLoginAt ?? new Date(0);
    if (!idSet.has(u.id) || idSet.get(u.id)! < dt) {
      idSet.set(u.id, dt);
    }
  });

  studentIds = Array.from(idSet.entries())
    .sort((a, b) => b[1].getTime() - a[1].getTime())
    .slice(0, maxStudents)
    .map(([id]) => id);

  if (studentIds.length === 0) {
    const fallbackUsers = await prisma.user.findMany({
      where: { role: Role.STUDENT, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: Math.min(maxStudents, 20),
      select: { id: true },
    });
    studentIds = fallbackUsers.map((u) => u.id);
  }

  const MAX_BATCH = 50;
  const batchIds = studentIds.slice(0, MAX_BATCH);
  let processed = 0;

  for (const studentId of batchIds) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.recallItem.deleteMany({
          where: { studentId, scene },
        });

        const recallCandidates: Array<{
          itemType: string;
          itemId: string;
          score: number;
          source: string;
        }> = [];

        const summary = await tx.userBehaviorSummary.findUnique({
          where: { studentId },
          select: { subjectWeights: true },
        });

        const profile = await tx.learningProfile.findUnique({
          where: { studentId },
          select: { weakPoints: true },
        });

        if (summary?.subjectWeights && typeof summary.subjectWeights === 'object') {
          const weights = summary.subjectWeights as Record<string, number>;
          const topSubjects = Object.entries(weights)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([sid]) => Number(sid))
            .filter((n) => !Number.isNaN(n));

          if (topSubjects.length > 0) {
            const courseCount = await tx.course.count({
              where: {
                subjectId: { in: topSubjects },
                status: CourseStatus.PUBLISHED,
              },
            });

            if (courseCount > 0) {
              const enrollments = await tx.courseEnrollment.groupBy({
                by: ['courseId'],
                _count: { courseId: true },
              });
              const enrollMap = new Map(enrollments.map((e) => [e.courseId, e._count.courseId]));

              const courses = await tx.course.findMany({
                where: {
                  subjectId: { in: topSubjects },
                  status: CourseStatus.PUBLISHED,
                },
                select: { id: true },
                take: 10,
              });

              courses.sort(
                (a, b) => (enrollMap.get(b.id) ?? 0) - (enrollMap.get(a.id) ?? 0),
              );

              courses.slice(0, 10).forEach((c, idx) => {
                recallCandidates.push({
                  itemType: 'course',
                  itemId: c.id,
                  score: 1.0 / (idx + 1),
                  source: 'popular',
                });
              });
            }
          }
        }

        if (profile?.weakPoints && Array.isArray(profile.weakPoints)) {
          const weakChapters = (profile.weakPoints as Array<{ chapterId?: string; mastery?: number }>)
            .filter((w) => (w.mastery ?? 1) < 0.5 && w.chapterId)
            .map((w) => w.chapterId as string);

          if (weakChapters.length > 0) {
            const questions = await tx.question.findMany({
              where: {
                chapterId: { in: weakChapters },
                reviewStatus: ReviewStatus.REVIEWER_PASSED,
              },
              select: { id: true },
              take: 10,
            });

            questions.forEach((q, idx) => {
              recallCandidates.push({
                itemType: 'question',
                itemId: q.id,
                score: 0.9 / (idx + 1),
                source: 'weakness',
              });
            });
          }
        }

        if (scene === 'dashboard' || scene === 'extracurricular') {
          const articles = await tx.article.findMany({
            where: { reviewStatus: ReviewStatus.REVIEWER_PASSED },
            select: { id: true },
            take: 10,
            orderBy: { viewCount: 'desc' },
          });

          articles.forEach((a: { id: string }, idx: number) => {
            recallCandidates.push({
              itemType: 'article',
              itemId: a.id,
              score: 0.8 / (idx + 1),
              source: 'extracurricular',
            });
          });
        }

        recallCandidates.sort((a, b) => b.score - a.score);

        const limited = recallCandidates.slice(0, limitPerStudent).map((item, idx) => ({
          studentId,
          scene,
          itemType: item.itemType,
          itemId: item.itemId,
          score: item.score,
          source: item.source,
          rank: idx + 1,
        }));

        if (limited.length > 0) {
          await tx.recallItem.createMany({ data: limited });
        }
      });
      processed++;
    } catch (e) {
      console.error(`[recommend/refresh] 学生 ${studentId} 失败:`, e);
    }
  }

  return ok({ processed, scene });
}
