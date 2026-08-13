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

// 根据年级范围生成过滤条件：优先同年级，然后扩展到 ±1 年级
function gradeRangeFilter(grade: number | null | undefined): { grade?: number } | { grade?: { in: number[] } } | {} {
  if (grade == null) return {};
  const g = Math.max(1, Math.min(12, Number(grade)));
  const grades = [g - 1, g, g + 1].filter((x) => x >= 1 && x <= 12);
  return { grade: { in: grades } };
}

// Fallback：当 RecallItem 表为空时，返回热门内容作为推荐
// 若学生有 grade 信息，则按年级个性化推荐（同年级优先 → 相邻年级补充 → 全量兜底）
async function fallbackHotContent(
  studentId: string,
  scene: Scene,
  limit: number,
  studentGrade: number | null | undefined,
) {
  const fallback: Array<{
    itemType: string; itemId: string; score: number; source: string;
  }> = [];

  const gradeFilter = gradeRangeFilter(studentGrade);
  const exactGradeFilter = studentGrade != null ? { grade: Number(studentGrade) } : {};
  const courseTarget = Math.ceil(limit / 2);
  const articleTarget = Math.ceil(limit / 3);
  const questionTarget = Math.ceil(limit / 4);

  type IdRow = { id: string };
  let courses: IdRow[] = [];
  let articles: IdRow[] = [];
  let questions: IdRow[] = [];

  // 阶段一：同年级精确匹配（仅当学生有年级信息时）
  if (studentGrade != null) {
    const [exactCourses, exactArticles, exactQuestions] = await Promise.all([
      prisma.course.findMany({
        where: { status: CourseStatus.PUBLISHED, ...exactGradeFilter },
        orderBy: { createdAt: 'desc' },
        take: courseTarget,
        select: { id: true },
      }),
      prisma.article.findMany({
        where: {
          reviewStatus: ReviewStatus.REVIEWER_PASSED,
          publishedAt: { not: null },
          ...exactGradeFilter,
        },
        orderBy: { viewCount: 'desc' },
        take: articleTarget,
        select: { id: true },
      }),
      prisma.question.findMany({
        where: { reviewStatus: ReviewStatus.REVIEWER_PASSED, ...exactGradeFilter },
        orderBy: { attemptCount: 'desc' },
        take: questionTarget,
        select: { id: true },
      }),
    ]);
    courses = exactCourses;
    articles = exactArticles;
    questions = exactQuestions;
  }

  // 阶段二：同年级 ±1 范围补充
  const needCourses2 = courseTarget - courses.length;
  const needArticles2 = articleTarget - articles.length;
  const needQuestions2 = questionTarget - questions.length;
  const excludeIds = (rows: IdRow[]) => rows.map((r) => r.id);
  if (needCourses2 > 0 || needArticles2 > 0 || needQuestions2 > 0) {
    const [rangeCourses, rangeArticles, rangeQuestions] = await Promise.all([
      needCourses2 > 0
        ? prisma.course.findMany({
            where: {
              status: CourseStatus.PUBLISHED,
              ...(studentGrade != null ? gradeFilter : {}),
              id: { notIn: excludeIds(courses) },
            },
            orderBy: { createdAt: 'desc' },
            take: needCourses2,
            select: { id: true },
          })
        : Promise.resolve<IdRow[]>([]),
      needArticles2 > 0
        ? prisma.article.findMany({
            where: {
              reviewStatus: ReviewStatus.REVIEWER_PASSED,
              publishedAt: { not: null },
              ...(studentGrade != null ? gradeFilter : {}),
              id: { notIn: excludeIds(articles) },
            },
            orderBy: { viewCount: 'desc' },
            take: needArticles2,
            select: { id: true },
          })
        : Promise.resolve<IdRow[]>([]),
      needQuestions2 > 0
        ? prisma.question.findMany({
            where: {
              reviewStatus: ReviewStatus.REVIEWER_PASSED,
              ...(studentGrade != null ? gradeFilter : {}),
              id: { notIn: excludeIds(questions) },
            },
            orderBy: { attemptCount: 'desc' },
            take: needQuestions2,
            select: { id: true },
          })
        : Promise.resolve<IdRow[]>([]),
    ]);
    courses = [...courses, ...rangeCourses];
    articles = [...articles, ...rangeArticles];
    questions = [...questions, ...rangeQuestions];
  }

  // 阶段三：全量兜底（不限年级，扣除前两阶段结果）
  const needCourses3 = courseTarget - courses.length;
  const needArticles3 = articleTarget - articles.length;
  const needQuestions3 = questionTarget - questions.length;
  if (needCourses3 > 0 || needArticles3 > 0 || needQuestions3 > 0) {
    const [allCourses, allArticles, allQuestions] = await Promise.all([
      needCourses3 > 0
        ? prisma.course.findMany({
            where: {
              status: CourseStatus.PUBLISHED,
              id: { notIn: excludeIds(courses) },
            },
            orderBy: { createdAt: 'desc' },
            take: needCourses3,
            select: { id: true },
          })
        : Promise.resolve<IdRow[]>([]),
      needArticles3 > 0
        ? prisma.article.findMany({
            where: {
              reviewStatus: ReviewStatus.REVIEWER_PASSED,
              publishedAt: { not: null },
              id: { notIn: excludeIds(articles) },
            },
            orderBy: { viewCount: 'desc' },
            take: needArticles3,
            select: { id: true },
          })
        : Promise.resolve<IdRow[]>([]),
      needQuestions3 > 0
        ? prisma.question.findMany({
            where: {
              reviewStatus: ReviewStatus.REVIEWER_PASSED,
              id: { notIn: excludeIds(questions) },
            },
            orderBy: { attemptCount: 'desc' },
            take: needQuestions3,
            select: { id: true },
          })
        : Promise.resolve<IdRow[]>([]),
    ]);
    courses = [...courses, ...allCourses];
    articles = [...articles, ...allArticles];
    questions = [...questions, ...allQuestions];
  }

  const source = studentGrade != null ? 'grade_fallback' : 'hot_fallback';
  courses.forEach((c, idx) => {
    fallback.push({ itemType: 'course', itemId: c.id, score: 1.0 / (idx + 1), source });
  });
  articles.forEach((a, idx) => {
    fallback.push({ itemType: 'article', itemId: a.id, score: 0.7 / (idx + 1), source });
  });
  if (scene === 'after_exam' || scene === 'dashboard') {
    questions.forEach((q, idx) => {
      fallback.push({ itemType: 'question', itemId: q.id, score: 0.5 / (idx + 1), source });
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

  // Fallback：无推荐数据时返回热门内容（根据学生年级个性化推荐）
  if (items.length === 0) {
    items = await fallbackHotContent(user!.id, scene, limit, user!.grade);
  }

  const enriched = await Promise.all(items.map(enrichItem));

  const fallbackSrc = items[0]?.source;
  return ok({
    items: enriched,
    fallback: fallbackSrc === 'hot_fallback' || fallbackSrc === 'grade_fallback',
    gradeMatched: fallbackSrc === 'grade_fallback',
  });
}
