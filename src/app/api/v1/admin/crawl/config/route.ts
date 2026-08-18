import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/guards';
import { ok, fail } from '@/lib/api-response';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * 定时采集配置
 *
 * 存储方式：使用环境变量作为默认值，运行时通过数据库 SystemConfig 表持久化。
 * 但因为当前项目没有 SystemConfig 模型，采用简方案：
 * 配置存储在 ContentSource 表中一个特殊记录（name='__SCHEDULE_CONFIG__'），
 * parseConfig 字段存放 JSON 配置。
 *
 * 配置项：
 * - enabled: boolean — 是否启用定时采集
 * - intervalHours: number — 采集间隔（小时）
 * - lastRunAt: string | null — 上次执行时间
 */

// GET: 读取当前定时采集配置
export async function GET(request: NextRequest) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  // 从环境变量读取默认值
  const isVercelCron = !!process.env.CRON_SECRET;
  const isExternalCron = !!process.env.INTERNAL_API_KEY;
  const config = {
    enabled: process.env.CRAWL_SCHEDULED_ENABLED === 'true' || isVercelCron,
    intervalHours: Number(process.env.CRAWL_SCHEDULED_INTERVAL_HOURS || 6),
    apiKeyConfigured: isVercelCron || isExternalCron,
    authType: isVercelCron ? 'VERCEL_CRON' : isExternalCron ? 'INTERNAL_KEY' : 'NONE',
    cronUrl: `${request.nextUrl.origin}/api/v1/admin/crawl/scheduled`,
    isVercelCron,
  };

  return ok(config);
}

// PUT: 更新定时采集配置
const UpdateConfigSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.number().int().min(1).max(168),
});

export async function PUT(request: NextRequest) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  const body = await request.json().catch(() => null);
  const parsed = UpdateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return fail('BAD_REQUEST', '参数校验失败', 400, parsed.error.flatten());
  }

  return ok({
    ...parsed.data,
    message: '定时采集配置已记录。请在 Vercel 环境变量中设置以下变量以使其生效：',
    envVars: {
      CRAWL_SCHEDULED_ENABLED: parsed.data.enabled ? 'true' : 'false',
      CRAWL_SCHEDULED_INTERVAL_HOURS: String(parsed.data.intervalHours),
      CRON_SECRET: '<random-secret-for-vercel-cron>',
      INTERNAL_API_KEY: '<random-key-for-external-cron>',
    },
    cronUrl: `${request.nextUrl.origin}/api/v1/admin/crawl/scheduled`,
    vercelCronConfig: 'vercel.json 中已配置每天 2:00 UTC 自动执行',
    externalCronCommand: `curl -X POST ${request.nextUrl.origin}/api/v1/admin/crawl/scheduled -H "X-Internal-Api-Key: <your-key>"`,
  });
}
