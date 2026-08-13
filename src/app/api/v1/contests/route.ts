export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { okPaginated } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const whitelist = searchParams.get('whitelist');
  const subjectId = searchParams.get('subjectId');
  const year = searchParams.get('year');
  const stage = searchParams.get('stage');
  const keyword = searchParams.get('keyword')?.trim();

  const where: Record<string, unknown> = {
    published: true,
  };

  if (whitelist !== null && whitelist !== undefined) {
    where.whitelist = whitelist === 'true' || whitelist === '1';
  }
  if (subjectId) where.subjectId = Number(subjectId);
  if (year) where.year = Number(year);
  if (stage) where.stage = stage;
  if (keyword) where.title = { contains: keyword, mode: 'insensitive' };

  const [total, rawItems] = await Promise.all([
    prisma.contest.count({ where }),
    prisma.contest.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true } },
        creator: { select: { id: true, nickname: true } },
        _count: { select: { enrollments: true, problems: true } },
      },
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const contests = rawItems.map((c) => ({
    ...c,
    enrollmentsCount: c._count.enrollments,
    problemsCount: c._count.problems,
    _count: undefined,
  }));

  return okPaginated({ contests }, { page, limit, total });
}
