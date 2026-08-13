export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, forbidden, fail, notFound } from '@/lib/api-response';

function checkInternalKey(request: NextRequest): boolean {
  const headerKey = request.headers.get('X-Internal-Api-Key')
    ?? request.headers.get('X-Internal-Key');
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    console.warn('[internal] INTERNAL_API_KEY not set in env');
    return false;
  }
  return !!headerKey && headerKey === expected;
}

// GET /api/v1/internal/course-rag-access — 内部接口：校验课程RAG访问权
// 需要请求头 X-Internal-Api-Key: {INTERNAL_API_KEY}
// Query 参数：courseId, userId
export async function GET(request: NextRequest) {
  if (!checkInternalKey(request)) {
    return forbidden('仅内部服务可调用（X-Internal-Api-Key 缺失或不匹配）') as unknown as Response;
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const userId = searchParams.get('userId');
  if (!courseId || !userId) {
    return fail('BAD_REQUEST', '缺少 courseId 或 userId 参数', 400) as unknown as Response;
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, teacherId: true, status: true, boardType: true },
  });
  if (!course) return notFound('课程不存在') as unknown as Response;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) return notFound('用户不存在') as unknown as Response;

  let accessGranted = false;
  let reason = '';

  if (user.role === 'ADMIN') {
    accessGranted = true;
    reason = 'ADMIN';
  } else if (course.teacherId === user.id) {
    accessGranted = true;
    reason = 'TEACHER_OWNER';
  } else {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: userId } },
      select: { studentId: true },
    });
    if (enrolled) {
      accessGranted = true;
      reason = 'ENROLLED_STUDENT';
    } else {
      reason = 'NOT_ENROLLED';
    }
  }

  return ok({
    accessGranted,
    reason,
    workspaceId: `course-${courseId}`,
    courseStatus: course.status,
    boardType: course.boardType,
  }) as unknown as Response;
}
