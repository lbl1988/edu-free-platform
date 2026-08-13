import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { BoardType, CourseStatus, Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// GET /api/v1/courses/{id} — 课程详情（含课时列表）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, nickname: true, avatarUrl: true } },
      textbook: { select: { id: true, name: true } },
      lessons: {
        orderBy: { sortOrder: 'asc' },
        include: { video: { select: { durationSec: true, transcodeStatus: true } } },
      },
      _count: { select: { enrollments: true, materials: true } },
    },
  });
  if (!course) return notFound('课程不存在');

  // 学生只能看已发布课程（或已选课）
  if (user!.role === Role.STUDENT && course.status !== CourseStatus.PUBLISHED) {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) return forbidden('课程未发布');
  }

  return ok(course);
}

const UpdateSchema = z.object({
  title: z.string().min(2).max(100).optional(),
  intro: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional(),
  textbookId: z.string().nullable().optional(),
  status: z.nativeEnum(CourseStatus).optional(),
  boardType: z.nativeEnum(BoardType).optional(),
});

// PUT /api/v1/courses/{id} — 更新课程（仅创建者或管理员）
export async function PUT(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const course = await prisma.course.findUnique({ where: { id: params.id }, select: { teacherId: true } });
  if (!course) return notFound('课程不存在');
  if (course.teacherId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅课程创建者或管理员可修改');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());

  const updated = await prisma.course.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return ok(updated);
}

// DELETE /api/v1/courses/{id} — 删除课程（仅创建者或管理员，软删/级联）
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const course = await prisma.course.findUnique({ where: { id: params.id }, select: { teacherId: true } });
  if (!course) return notFound('课程不存在');
  if (course.teacherId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅课程创建者或管理员可删除');
  }

  // 级联删除课时/课件/选课记录（schema 已配 onDelete: Cascade）
  await prisma.course.delete({ where: { id: params.id } });
  return ok({ message: '课程已删除' });
}
