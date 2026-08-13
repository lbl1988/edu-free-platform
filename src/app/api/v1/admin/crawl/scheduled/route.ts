import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, serverError } from '@/lib/api-response';
import { runScheduledCrawl } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/crawl/scheduled
 *
 * 定时自动采集端点，由外部 cron 服务（如 cron-job.org / Render Cron Job）定期调用。
 * 鉴权方式：X-Internal-Api-Key 请求头，值需与环境变量 INTERNAL_API_KEY 一致。
 *
 * 推荐配置：每小时调用一次，端点内部会自动判断哪些采集源到期。
 */
export async function POST(request: NextRequest) {
  // 内部 API Key 鉴权
  const apiKey = request.headers.get('x-internal-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    return serverError('INTERNAL_API_KEY 环境变量未配置，无法启用定时采集');
  }
  if (apiKey !== expectedKey) {
    return unauthorized('Invalid internal API key');
  }

  // 查找管理员账号作为课程归属
  const systemTeacher = await prisma.user.findFirst({
    where: { role: 'ADMIN', deletedAt: null },
  });
  if (!systemTeacher) {
    return serverError('未找到管理员账号');
  }

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
