export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, forbidden, notFound } from '@/lib/api-response';
import { Role } from '@prisma/client';

// GET /api/v1/courses/[id]/discussions — 获取课程讨论区帖子（P3-2）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const courseId = request.nextUrl.pathname.split('/')[4];
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get('pageSize') ?? 20)));

  const [total, posts] = await Promise.all([
    prisma.courseDiscussion.count({
      where: { courseId, parentId: null },
    }),
    prisma.courseDiscussion.findMany({
      where: { courseId, parentId: null },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: {
          select: { id: true, nickname: true, avatarUrl: true, role: true, grade: true },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, nickname: true, avatarUrl: true, role: true, grade: true },
            },
          },
        },
      },
    }),
  ]);

  return ok({
    posts,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// POST /api/v1/courses/[id]/discussions — 发布讨论帖/回复（P3-2）
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const courseId = request.nextUrl.pathname.split('/')[4];
  if (user!.role === Role.ADMIN) {
    return forbidden('管理员不参与讨论') as unknown as Response;
  }

  // 验证课程存在
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true },
  });
  if (!course) {
    return notFound('课程不存在') as unknown as Response;
  }

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('请求体格式错误') as unknown as Response;

  const { content, parentId } = body as { content: string; parentId?: string };
  if (!content || content.trim().length === 0) {
    return badRequest('内容不能为空') as unknown as Response;
  }
  if (content.length > 2000) {
    return badRequest('内容不能超过 2000 字') as unknown as Response;
  }

  // 如果有 parentId，验证父帖存在且属于同一课程
  if (parentId) {
    const parent = await prisma.courseDiscussion.findUnique({
      where: { id: parentId },
      select: { id: true, courseId: true },
    });
    if (!parent || parent.courseId !== courseId) {
      return badRequest('回复的帖子不存在') as unknown as Response;
    }
  }

  const post = await prisma.courseDiscussion.create({
    data: {
      courseId,
      authorId: user!.id,
      content: content.trim(),
      parentId: parentId ?? null,
    },
    include: {
      author: {
        select: { id: true, nickname: true, avatarUrl: true, role: true, grade: true },
      },
    },
  });

  return ok({ post }, 201);
}
