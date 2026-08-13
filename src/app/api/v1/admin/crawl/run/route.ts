import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';
import { ok, fail, notFound, serverError } from '@/lib/api-response';
import { executeCrawlJob } from '@/lib/crawler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// POST: 手动触发采集
// body: { sourceId?: string, all?: boolean }
const RunSchema = z.object({
  sourceId: z.string().optional(),
  all: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  const body = await request.json().catch(() => ({}));
  const parsed = RunSchema.safeParse(body);
  if (!parsed.success) {
    return fail('BAD_REQUEST', '参数校验失败', 400, parsed.error.flatten());
  }

  // 查找系统教师账号（爬虫课程归属）
  const systemTeacher = await prisma.user.findFirst({
    where: {
      role: 'ADMIN',
      deletedAt: null,
    },
  });
  if (!systemTeacher) {
    return fail('SERVER_ERROR', '未找到管理员账号作为课程归属', 500);
  }

  // 单个采集源
  if (parsed.data.sourceId && !parsed.data.all) {
    const source = await prisma.contentSource.findUnique({
      where: { id: parsed.data.sourceId },
    });
    if (!source) return notFound('采集源不存在');

    try {
      const job = await executeCrawlJob(source, systemTeacher.id, 'MANUAL');
      return ok(job);
    } catch (e: any) {
      return serverError(`采集失败: ${e.message}`);
    }
  }

  // 全部活跃采集源
  if (parsed.data.all || !parsed.data.sourceId) {
    const sources = await prisma.contentSource.findMany({
      where: { status: { in: ['ACTIVE', 'ERROR'] } },
    });

    const results = [];
    for (const source of sources) {
      try {
        const job = await executeCrawlJob(source, systemTeacher.id, 'MANUAL');
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: job.status,
          itemsFound: job.itemsFound,
          itemsAdded: job.itemsAdded,
          itemsUpdated: job.itemsUpdated,
        });
      } catch (e: any) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'FAILED',
          error: e.message,
        });
      }
    }

    return ok({
      total: sources.length,
      results,
    });
  }

  return fail('BAD_REQUEST', '请指定 sourceId 或 all=true');
}
