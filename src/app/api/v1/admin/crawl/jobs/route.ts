import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';
import { okPaginated } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

// GET: 采集任务历史
export async function GET(request: NextRequest) {
  const [user, err] = await requireAdmin(request);
  if (err) return err;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') || 1);
  const limit = Number(url.searchParams.get('limit') || 20);
  const sourceId = url.searchParams.get('sourceId');
  const status = url.searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (sourceId) where.sourceId = sourceId;
  if (status) where.status = status;

  const [jobs, total] = await Promise.all([
    prisma.crawlJob.findMany({
      where,
      include: {
        source: {
          select: { id: true, name: true, url: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.crawlJob.count({ where }),
  ]);

  return okPaginated(jobs, { page, limit, total });
}
