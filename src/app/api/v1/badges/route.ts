export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';

// GET /api/v1/badges — 获取全部徽章 + 用户已获得状态（P2-2）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const [badges, earned] = await Promise.all([
    prisma.badge.findMany({ orderBy: { tier: 'asc' } }),
    prisma.userBadge.findMany({
      where: { userId: user!.id },
      select: { badgeId: true, earnedAt: true },
    }),
  ]);

  const earnedMap = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));

  const result = badges.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    description: b.description,
    tier: b.tier,
    icon: b.icon,
    earned: earnedMap.has(b.id),
    earnedAt: earnedMap.get(b.id) ?? null,
  }));

  return ok({ badges: result, earnedCount: earned.length });
}
