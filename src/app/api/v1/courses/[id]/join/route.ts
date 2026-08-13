export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound, conflict } from '@/lib/api-response';
import { CourseStatus, Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// POST /api/v1/courses/{id}/join — 学生加入已发布课程
export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  if (user!.role !== Role.STUDENT) {
    return badRequest('仅学生可加入课程');
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, title: true },
  });
  if (!course) return notFound('课程不存在');
  if (course.status !== CourseStatus.PUBLISHED) {
    return badRequest('课程未发布，无法加入');
  }

  // 幂等：已选课则返回已存在记录
  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
  });
  if (existing) return conflict('已加入该课程');

  const enrollment = await prisma.courseEnrollment.create({
    data: { courseId: course.id, studentId: user!.id },
  });

  return ok({ enrollment, message: `已加入课程：${course.title}` }, 201);
}
