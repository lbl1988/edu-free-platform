export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// GET /api/v1/courses/{id}/lessons — 课时列表
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, teacherId: true },
  });
  if (!course) return notFound('课程不存在');

  // 学生：仅已发布或已选课可查看课时
  if (user!.role === Role.STUDENT && course.status !== 'PUBLISHED') {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) return forbidden('无权查看未发布课程');
  }

  const lessons = await prisma.lesson.findMany({
    where: { courseId: params.id },
    orderBy: { sortOrder: 'asc' },
    include: {
      video: { select: { id: true, durationSec: true, transcodeStatus: true } },
      _count: { select: { notes: true } },
    },
  });

  return ok(lessons);
}

const CreateLessonSchema = z.object({
  title: z.string().min(1).max(100),
  intro: z.string().max(2000).optional(),
  chapterId: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

// POST /api/v1/courses/{id}/lessons — 创建课时（教师/管理员）
export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { teacherId: true },
  });
  if (!course) return notFound('课程不存在');
  if (course.teacherId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅课程创建者可添加课时');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = CreateLessonSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());

  const lesson = await prisma.lesson.create({
    data: { ...parsed.data, courseId: params.id },
  });
  return ok(lesson, 201);
}
