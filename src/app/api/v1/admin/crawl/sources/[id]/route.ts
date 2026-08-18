import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';
import { ok, fail, notFound, forbidden } from '@/lib/api-response';
import { z } from 'zod';
import { SCHEDULE_CONFIG_SOURCE_NAME } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

// 拒绝操作内部调度配置记录
async function guardInternalSource(id: string): Promise<boolean> {
  const rec = await prisma.contentSource.findUnique({
    where: { id },
    select: { name: true },
  });
  if (rec?.name === SCHEDULE_CONFIG_SOURCE_NAME) return false;
  return true;
}

// GET: 单个采集源详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  if (!(await guardInternalSource(params.id))) return notFound('采集源不存在');

  const source = await prisma.contentSource.findUnique({
    where: { id: params.id },
    include: {
      subject: true,
      crawlJobs: {
        orderBy: { startedAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!source) return notFound('采集源不存在');
  return ok(source);
}

// PUT: 更新采集源
const UpdateSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  sourceType: z.enum(['RSS', 'JSON_API', 'HTML_SCRAPING']).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ERROR']).optional(),
  subjectId: z.number().int().optional(),
  gradeLevel: z.string().optional(),
  grade: z.number().int().min(1).max(12).optional(),
  parseConfig: z.record(z.any()).optional(),
  crawlIntervalHours: z.number().int().min(1).max(168).optional(),
  respectRobots: z.boolean().optional(),
  rateLimitMs: z.number().int().min(100).max(60000).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  if (!(await guardInternalSource(params.id))) return forbidden('不允许修改系统内部记录');

  const body = await request.json().catch(() => null);
  const parsed = UpdateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return fail('BAD_REQUEST', '参数校验失败', 400, parsed.error.flatten());
  }

  const source = await prisma.contentSource.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return ok(source);
}

// DELETE: 删除采集源
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  if (!(await guardInternalSource(params.id))) return forbidden('不允许删除系统内部记录');

  await prisma.contentSource.delete({
    where: { id: params.id },
  });

  return ok({ deleted: true });
}
