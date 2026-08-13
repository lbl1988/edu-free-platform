export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { CourseStatus, Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// GET /api/v1/courses/{id}/chat/history — 聊天历史（分页，学生仅本人）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)));

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, teacherId: true, status: true },
  });
  if (!course) return notFound('课程不存在') as unknown as Response;

  const isTeacherOrAdmin = user!.role === Role.TEACHER || user!.role === Role.ADMIN;
  const isCourseTeacher = course.teacherId === user!.id;

  // 学生：必须已选课且课程已发布
  if (!isTeacherOrAdmin && !isCourseTeacher) {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) return forbidden('需要选课学生、任课教师或管理员权限') as unknown as Response;
    if (course.status !== CourseStatus.PUBLISHED) return forbidden('课程未发布') as unknown as Response;
  }

  // 教师/管理员：可查询自己会话，或查看任意学生（可选 studentId 参数过滤）
  const filterStudentId = (isTeacherOrAdmin && searchParams.get('studentId')) || user!.id;

  const session = await prisma.courseChatSession.findUnique({
    where: { courseId_studentId: { courseId: params.id, studentId: filterStudentId } },
    select: {
      id: true,
      courseId: true,
      studentId: true,
      messages: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!session) {
    return ok({
      session: null,
      messages: [],
      pagination: { page, limit, total: 0 },
    }) as unknown as Response;
  }

  // messages 数组倒序分页（最新消息优先，但返回时仍按时间顺序）
  const messages = (session.messages as unknown[] | null) ?? [];
  const total = messages.length;
  const startIdx = Math.max(0, total - page * limit);
  const endIdx = startIdx + limit;
  const pagedMessages = messages.slice(startIdx, endIdx);

  return ok({
    session: {
      id: session.id,
      courseId: session.courseId,
      studentId: session.studentId,
      messageCount: session.messageCount,
      lastMessageAt: session.lastMessageAt,
    },
    messages: pagedMessages,
    pagination: { page, limit, total },
  }) as unknown as Response;
}
