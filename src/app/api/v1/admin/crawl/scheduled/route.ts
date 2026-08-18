import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, serverError, fail } from '@/lib/api-response';
import {
  runScheduledCrawl,
  getScheduleConfig,
  saveScheduleConfig,
  calcNextRunAt,
} from '@/lib/crawler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel: 5 min timeout

/**
 * POST /api/v1/admin/crawl/scheduled
 *
 * 定时自动采集端点，支持两种调用方式：
 *
 * 1. Vercel Cron Job（推荐）
 *    - 在 vercel.json 中配置 crons（当前每天 UTC 2:00 触发一次）
 *    - Vercel 自动发送 Authorization: Bearer <CRON_SECRET>
 *    - 设置环境变量 CRON_SECRET
 *
 * 2. 外部 cron 服务（cron-job.org 等，支持更短间隔）
 *    - 手动调用 POST，带 X-Internal-Api-Key 头
 *    - 设置环境变量 INTERNAL_API_KEY
 *
 * 执行策略（配置从数据库读取，保存后立即生效）：
 * - enabled=false  → 直接跳过（返回 DISABLED）
 * - 距上次执行未满 intervalHours → 跳过（返回 NOT_DUE，附下次执行时间）
 * - 到期 → 执行 runScheduledCrawl，并更新 lastRunAt
 */
export async function POST(request: NextRequest) {
  // 1. 鉴权：优先检查 Vercel Cron 的 Bearer token
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const internalKey = request.headers.get('x-internal-api-key');
  const expectedInternalKey = process.env.INTERNAL_API_KEY;

  let authorized = false;

  // 方式一：Vercel Cron Bearer token
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  }

  // 方式二：内部 API Key（外部 cron 服务）
  if (!authorized && expectedInternalKey && internalKey === expectedInternalKey) {
    authorized = true;
  }

  if (!authorized) {
    // Vercel Cron 调用时如果 CRON_SECRET 未配置，也允许通过（Vercel 内部调用）
    if (process.env.VERCEL === '1' && !cronSecret && !expectedInternalKey) {
      authorized = true;
    } else {
      return unauthorized('Invalid authentication. Configure CRON_SECRET or INTERNAL_API_KEY.');
    }
  }

  // 2. 读取全局调度配置：开关 + 间隔（数据库持久化，环境变量仅兜底）
  const cfg = await getScheduleConfig();

  // 2.1 全局开关关闭 → 跳过
  if (!cfg.enabled) {
    return ok({
      skipped: true,
      reason: 'DISABLED',
      message: '定时采集已关闭，本次跳过',
      timestamp: new Date().toISOString(),
    });
  }

  // 2.2 间隔到期判断（从未执行过则立即执行）
  const now = new Date();
  if (cfg.lastRunAt) {
    const hoursSince = (now.getTime() - new Date(cfg.lastRunAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < cfg.intervalHours) {
      return ok({
        skipped: true,
        reason: 'NOT_DUE',
        intervalHours: cfg.intervalHours,
        lastRunAt: cfg.lastRunAt,
        nextRunAt: calcNextRunAt(cfg, now).toISOString(),
        message: `距上次采集不足 ${cfg.intervalHours} 小时，本次跳过`,
        timestamp: now.toISOString(),
      });
    }
  }

  // 3. 查找管理员账号作为课程归属
  const systemTeacher = await prisma.user.findFirst({
    where: { role: 'ADMIN', deletedAt: null },
  });
  if (!systemTeacher) {
    return serverError('未找到管理员账号，请先运行种子数据');
  }

  // 4. 执行定时采集并记录执行时间
  const result = await runScheduledCrawl(systemTeacher.id);
  await saveScheduleConfig({
    enabled: cfg.enabled,
    intervalHours: cfg.intervalHours,
    lastRunAt: now.toISOString(),
  });

  return ok({
    message: `定时采集完成: 处理 ${result.processed} 个源, 成功 ${result.succeeded}, 失败 ${result.failed}`,
    ...result,
    intervalHours: cfg.intervalHours,
    lastRunAt: now.toISOString(),
    nextRunAt: calcNextRunAt({ ...cfg, lastRunAt: now.toISOString() }, now).toISOString(),
    timestamp: now.toISOString(),
  });
}

// GET 也支持（方便浏览器直接触发测试）
export async function GET(request: NextRequest) {
  return POST(request);
}
