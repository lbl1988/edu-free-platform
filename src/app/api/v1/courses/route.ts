export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin, requireTeacher } from '@/lib/guards';
import { getCurrentUser } from '@/lib/auth-context';
import { ok, okPaginated, badRequest } from '@/lib/api-response';
import { isValidGrade } from '@/lib/utils';
import { BoardType, CourseStatus } from '@prisma/client';

// GET /api/v1/courses — 课程列表（分页+筛选）
// 匿名/学生：查看已发布课程；教师：查看自己创建的全部课程；管理员：全部
export async function GET(request: NextRequest) {
  // 允许匿名访问，登录用户按角色区分权限
  const maybeUser = await getCurrentUser(request);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const grade = searchParams.get('grade');
  const subjectId = searchParams.get('subjectId');
  const boardType = searchParams.get('boardType') as BoardType | null;
  const keyword = searchParams.get('keyword')?.trim();

  const where: Record<string, unknown> = {};
  if (!maybeUser || maybeUser.role === 'STUDENT') {
    // 匿名用户和学生只能看已发布
    where.status = CourseStatus.PUBLISHED;
  } else if (maybeUser.role === 'TEACHER') {
    where.teacherId = maybeUser.id;
  }
  // ADMIN 看全部，不设置 status 过滤
  if (grade) where.grade = Number(grade);
  if (subjectId) where.subjectId = Number(subjectId);
  if (boardType) where.boardType = boardType;
  if (keyword) where.title = { contains: keyword, mode: 'insensitive' };

  try {
    const [total, items] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, nickname: true } },
          _count: { select: { enrollments: true, lessons: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return okPaginated(items, { page, limit, total });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: `服务器错误: ${e.message || '数据库查询失败'}`,
          details: process.env.NODE_ENV === 'development' ? e.stack : undefined,
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// POST /api/v1/courses — 创建课程（仅教师/管理员）
const CreateSchema = z.object({
  title: z.string().min(2).max(100),
  grade: z.number().int(),
  subjectId: z.number().int(),
  boardType: z.nativeEnum(BoardType),
  intro: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional(),
  textbookId: z.string().optional(),
  status: z.nativeEnum(CourseStatus).default(CourseStatus.DRAFT),
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const data = parsed.data;

  if (!isValidGrade(data.grade)) return badRequest('年级需为 1-12');

  // 校验学科存在
  const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
  if (!subject) return badRequest('学科不存在');

  // 校验教材版本（若提供）
  if (data.textbookId) {
    const tb = await prisma.textbook.findUnique({ where: { id: data.textbookId } });
    if (!tb) return badRequest('教材版本不存在');
  }

  const course = await prisma.course.create({
    data: {
      ...data,
      teacherId: user!.id,
    },
    include: {
      subject: { select: { id: true, name: true } },
    },
  });

  return ok(course, 201);
}
