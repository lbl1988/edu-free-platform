import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/guards';
import { ok, fail } from '@/lib/api-response';
import { z } from 'zod';
import {
  getScheduleConfig,
  saveScheduleConfig,
  calcNextRunAt,
} from '@/lib/crawler';

export const dynamic = 'force-dynamic';

/**
 * 定时采集配置
 *
 * 配置项：
 * - enabled: boolean — 是否启用定时采集
 * - intervalHours: number — 采集间隔（小时）
 * - lastRunAt: string | null — 上次执行时间
 *
 * 持久化：ContentSource 表中 name='__SCHEDULE_CONFIG__' 的内部记录（parseConfig 存 JSON）。
 * 环境变量仅作为数据库无记录时的默认值兜底；保存后立即生效，无需再配置环境变量。
 */

// GET: 读取当前定时采集配置
export async function GET(request: NextRequest) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  const cfg = await getScheduleConfig();
  const now = new Date();
  const nextRunAt = cfg.lastRunAt ? calcNextRunAt(cfg, now) : now;
  const isVercelCron = !!process.env.CRON_SECRET;
  const isExternalCron = !!process.env.INTERNAL_API_KEY;

  return ok({
    enabled: cfg.enabled,
    intervalHours: cfg.intervalHours,
    lastRunAt: cfg.lastRunAt,
    nextRunAt: cfg.enabled ? nextRunAt.toISOString() : null,
    apiKeyConfigured: isVercelCron || isExternalCron,
    authType: isVercelCron ? 'VERCEL_CRON' : isExternalCron ? 'INTERNAL_KEY' : 'NONE',
    cronUrl: `${request.nextUrl.origin}/api/v1/admin/crawl/scheduled`,
    // 说明：Vercel Cron 最细粒度为每天；间隔小于 24h 时需外部 cron（如 cron-job.org）
    // 以更高频率调用上述端点，端点内部会按 intervalHours 判断是否到期，未到期自动跳过。
    triggerNote:
      cfg.intervalHours < 24
        ? 'Vercel Cron 每天触发一次；如需按更短间隔执行，请用外部 cron 服务定时调用端点（未到期会自动跳过）。'
        : 'Vercel Cron 每天触发，按间隔自动判断是否到期执行。',
  });
}

// PUT: 更新定时采集配置（立即持久化生效）
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

  const saved = await saveScheduleConfig({
    enabled: parsed.data.enabled,
    intervalHours: parsed.data.intervalHours,
  });

  const nextRunAt = saved.lastRunAt ? calcNextRunAt(saved) : new Date();

  return ok({
    ...saved,
    nextRunAt: saved.enabled ? nextRunAt.toISOString() : null,
    message: saved.enabled
      ? `定时采集已启用，间隔 ${saved.intervalHours} 小时，配置已保存并立即生效`
      : '定时采集已关闭，配置已保存并立即生效',
  });
}
