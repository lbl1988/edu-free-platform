import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, serverError, fail } from '@/lib/api-response';
import { runScheduledCrawl } from '@/lib/crawler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel: 5 min timeout

/**
 * POST /api/v1/admin/crawl/scheduled
 *
 * 定时自动采集端点，支持两种调用方式：
 *
 * 1. Vercel Cron Job（推荐）
 *    - 在 vercel.json 中配置 crons
 *    - Vercel 自动发送 Authorization: Bearer <CRON_SECRET>
 *    - 设置环境变量 CRON_SECRET
 *
 * 2. 外部 cron 服务（cron-job.org 等）
 *    - 手动调用 POST，带 X-Internal-Api-Key 头
 *    - 设置环境变量 INTERNAL_API_KEY 和 CRAWL_SCHEDULED_ENABLED=true
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
    // 检查定时采集开关
    if (process.env.CRAWL_SCHEDULED_ENABLED !== 'true') {
      return fail('FORBIDDEN', '定时采集未启用。请在 Vercel 环境变量中设置 CRAWL_SCHEDULED_ENABLED=true', 403);
    }
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

  // 2. 查找管理员账号作为课程归属
  const systemTeacher = await prisma.user.findFirst({
    where: { role: 'ADMIN', deletedAt: null },
  });
  if (!systemTeacher) {
    return serverError('未找到管理员账号，请先运行种子数据');
  }

  // 3. 执行定时采集
  const result = await runScheduledCrawl(systemTeacher.id);

  return ok({
    message: `定时采集完成: 处理 ${result.processed} 个源, 成功 ${result.succeeded}, 失败 ${result.failed}`,
    ...result,
    timestamp: new Date().toISOString(),
  });
}

// GET 也支持（方便浏览器直接触发测试）
export async function GET(request: NextRequest) {
  return POST(request);
}
