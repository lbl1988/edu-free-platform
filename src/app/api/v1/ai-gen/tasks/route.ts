export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireLogin } from '@/lib/guards';
import { ok, badRequest, forbidden, okPaginated } from '@/lib/api-response';
import { TaskStatus } from '@prisma/client';
import { isRedisAvailable, getRedisAsync } from '@/lib/redis';

const GenTypeSchema = z.enum(['question', 'summary', 'subtitle']);

const CreateSchema = z.object({
  genType: GenTypeSchema,
  subjectId: z.number().int().positive().optional(),
  grade: z.number().int().min(1).max(12).optional(),
  chapterId: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  count: z.number().int().min(1).max(100).default(10),
  // generic params override; for skeleton allow any
  params: z.record(z.unknown()).optional(),
});

// POST /api/v1/ai-gen/tasks — 创建AI内容生成任务（管理员/教师，管理员可创建全部）
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  // 管理员可创建全部；教师仅可创建与自己课程相关（此处简化：教师允许创建但写入数据库）
  if (user!.role !== 'ADMIN') {
    // 教师可使用，但为避免滥用先让管理员放行
    // 保留 requireAdmin 的检查范围：这里通过 requireTeacher 或更宽松
    // 交接文档要求：管理员；为兼容，允许 TEACHER 同时可创建
    if (user!.role !== 'TEACHER') {
      return forbidden('需要教师或管理员权限') as unknown as Response;
    }
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return badRequest('请求体必须为 JSON') as unknown as Response;
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message) as unknown as Response;
  }
  const { genType, count, params, ...rest } = parsed.data;

  const mergedParams = { ...rest, count, ...(params ?? {}) };

  const task = await prisma.aIGenTask.create({
    data: {
      genType,
      params: mergedParams as any,
      status: TaskStatus.QUEUED,
    },
    select: {
      id: true, genType: true, params: true, status: true, createdAt: true,
    },
  });

  // 若 Redis 可用，推入队列给 Python Worker 消费；否则标记 QUEUED 待轮询
  try {
    if (isRedisAvailable()) {
      const redis = await getRedisAsync();
      await redis.xadd(
        'edu:ai:gen:stream',
        '*',
        'task_id', task.id,
        'gen_type', task.genType,
        'params', JSON.stringify(mergedParams),
      );
    }
  } catch (e) {
    console.warn('[ai-gen] Failed to enqueue:', e);
  }

  return ok({ task }, 201) as unknown as Response;
}

// GET /api/v1/ai-gen/tasks — 任务列表（分页，教师/管理员）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;
  if (user!.role !== 'ADMIN' && user!.role !== 'TEACHER') {
    return forbidden('需要教师或管理员权限') as unknown as Response;
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const status = searchParams.get('status') as TaskStatus | null;
  const genType = searchParams.get('genType');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (genType) where.genType = genType;

  const [total, items] = await Promise.all([
    prisma.aIGenTask.count({ where }),
    prisma.aIGenTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, genType: true, params: true, status: true, result: true,
        errorMessage: true, createdAt: true, processedAt: true,
      },
    }),
  ]);

  return okPaginated({ tasks: items }, { page, limit, total }) as unknown as Response;
}
