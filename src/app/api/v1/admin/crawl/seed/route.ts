import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, unauthorized } from '@/lib/api-response';
import { requireAdmin } from '@/lib/guards';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/v1/admin/crawl/seed
 *
 * 通过 API 触发预置采集源种子数据（Vercel 无 Shell 访问，用此端点替代 npm run db:seed:crawl）
 *
 * 需要 ADMIN 权限
 */
export async function POST(request: NextRequest) {
  const [adminUser, err] = await requireAdmin(request);
  if (err) return err;
  if (!adminUser) return fail('UNAUTHORIZED', '未登录', 401);

  // 升级当前管理员（确保有权限）
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { role: 'ADMIN' },
  });

  // 复用 seed-crawl-sources.ts 中的源定义
  const { SEED_SOURCES } = await import('./sources-data');

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const src of SEED_SOURCES) {
    try {
      const existing = await prisma.contentSource.findFirst({
        where: { url: src.url },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.contentSource.create({
        data: {
          name: src.name,
          url: src.url,
          sourceType: src.sourceType,
          status: 'ACTIVE',
          subjectId: src.subjectId || null,
          gradeLevel: src.gradeLevel || null,
          grade: src.grade || null,
          parseConfig: src.parseConfig ? JSON.parse(JSON.stringify(src.parseConfig)) : undefined,
          crawlIntervalHours: src.crawlIntervalHours || 24,
          rateLimitMs: src.rateLimitMs || 1000,
          respectRobots: true,
        },
      });
      created++;
    } catch (e) {
      errors.push(`${src.name}: ${(e as Error).message}`);
    }
  }

  return ok({
    message: `种子数据完成: 新增 ${created} 个采集源, 跳过 ${skipped} 个已存在${errors.length ? `, ${errors.length} 个失败` : ''}`,
    created,
    skipped,
    errors: errors.length ? errors : undefined,
    total: await prisma.contentSource.count(),
  });
}

// GET 也支持（管理员浏览器直接访问触发）
export async function GET(request: NextRequest) {
  const [, err] = await requireAdmin(request);
  if (err) return err;

  const total = await prisma.contentSource.count();
  return ok({
    message: 'POST 请求此端点可预置全部采集源',
    currentSources: total,
    availableToSeed: 53,
  });
}
