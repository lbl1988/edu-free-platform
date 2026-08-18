import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';
import { ok, fail, okPaginated } from '@/lib/api-response';
import { z } from 'zod';
import { SCHEDULE_CONFIG_SOURCE_NAME } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

// GET: 列出所有采集源（排除内部调度配置记录）
export async function GET(request: NextRequest) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') || 1);
  const limit = Number(url.searchParams.get('limit') || 50);
  const status = url.searchParams.get('status');

  const where = {
    ...(status ? { status: status as any } : {}),
    name: { not: SCHEDULE_CONFIG_SOURCE_NAME },
  };

  const [sources, total] = await Promise.all([
    prisma.contentSource.findMany({
      where,
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contentSource.count({ where }),
  ]);

  return okPaginated(sources, { page, limit, total });
}

// POST: 创建采集源
const CreateSourceSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  sourceType: z.enum(['RSS', 'JSON_API', 'HTML_SCRAPING']),
  subjectId: z.number().int().optional(),
  gradeLevel: z.string().optional(),
  grade: z.number().int().min(1).max(12).optional(),
  parseConfig: z.record(z.any()).optional(),
  crawlIntervalHours: z.number().int().min(1).max(168).default(24),
  respectRobots: z.boolean().default(true),
  rateLimitMs: z.number().int().min(100).max(60000).default(1000),
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  const body = await request.json().catch(() => null);
  const parsed = CreateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return fail('BAD_REQUEST', '参数校验失败', 400, parsed.error.flatten());
  }

  // 检查 URL 唯一性
  const existing = await prisma.contentSource.findFirst({
    where: { url: parsed.data.url },
  });
  if (existing) {
    return fail('CONFLICT', '该 URL 已存在采集源', 409);
  }

  const source = await prisma.contentSource.create({
    data: {
      ...parsed.data,
      parseConfig: parsed.data.parseConfig || undefined,
    },
  });

  return ok(source, 201);
}
