export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { ReviewStatus, Role } from '@prisma/client';

type Ctx = { params: { lessonId: string } };

const QuerySchema = z.object({
  count: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'count 必须是整数'),
});

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  if (user!.role !== Role.STUDENT && user!.role !== Role.TEACHER && user!.role !== Role.ADMIN) {
    return forbidden('无权访问');
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    count: searchParams.get('count') ?? undefined,
  });
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());

  const rawCount = parsed.data.count ? Number(parsed.data.count) : 10;
  const count = Math.min(30, Math.max(1, rawCount));

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: {
      id: true,
      chapterId: true,
      course: { select: { id: true, subjectId: true, grade: true, status: true, teacherId: true } },
    },
  });
  if (!lesson) return notFound('课时不存在');

  const { course } = lesson;
  if (user!.role === Role.STUDENT && course.status !== 'PUBLISHED') {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) return forbidden('无权访问');
  }

  const where: Record<string, unknown> = {
    reviewStatus: ReviewStatus.REVIEWER_PASSED,
  };
  if (lesson.chapterId) {
    where.chapterId = lesson.chapterId;
  } else {
    where.subjectId = course.subjectId;
    if (course.grade) where.grade = course.grade;
  }

  const allQuestions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      content: true,
      options: true,
      difficulty: true,
      questionType: true,
      subjectId: true,
      grade: true,
      chapterId: true,
      source: true,
      sourceYear: true,
    },
  });

  const shuffled = shuffle(allQuestions);
  const questions = shuffled.slice(0, count);

  return ok({ questions, total: questions.length });
}
