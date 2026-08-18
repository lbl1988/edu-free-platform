import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, serverError, fail } from '@/lib/api-response';
import { runScheduledCrawl } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/crawl/scheduled
 *
 * 定时自动采集端点，由外部 cron 服务（如 cron-job.org / Render Cron Job）定期调用。
 *
 * 鉴权：X-Internal-Api-Key 请求头，值需与环境变量 INTERNAL_API_KEY 一致。
 * 开关：CRAWL_SCHEDULED_ENABLED=true 时允许执行，false 时拒绝。
 * 间隔：CRAWL_SCHEDULED_INTERVAL_HOURS 控制最小间隔（内部按各采集源 crawlIntervalHours 判断到期）。
 */
export async function POST(request: NextRequest) {
  // 1. 检查定时采集是否启用
  if (process.env.CRAWL_SCHEDULED_ENABLED !== 'true') {
    return fail('FORBIDDEN', '定时采集未启用。请在 Render 环境变量中设置 CRAWL_SCHEDULED_ENABLED=true', 403);
  }

  // 2. 内部 API Key 鉴权
  const apiKey = request.headers.get('x-internal-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    return serverError('INTERNAL_API_KEY 环境变量未配置，无法启用定时采集');
  }
  if (apiKey !== expectedKey) {
    return unauthorized('Invalid internal API key');
  }

  // 3. 查找管理员账号作为课程归属
  const systemTeacher = await prisma.user.findFirst({
    where: { role: 'ADMIN', deletedAt: null },
  });
  if (!systemTeacher) {
    return serverError('未找到管理员账号');
  }

  // 4. 执行定时采集
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
