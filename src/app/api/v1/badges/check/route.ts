export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';

// POST /api/v1/badges/check — 自动检查并颁发徽章（P2-2）
// 读取用户实时数据，判断是否达成徽章条件，颁发未获得的徽章
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const userId = user!.id;

  // 获取用户实时数据
  const [profile, examPassCount, wrongMasteredCount, allBadges, earnedBadges] = await Promise.all([
    prisma.learningProfile.findUnique({
      where: { studentId: userId },
      select: { streakDays: true, totalQuestions: true, correctRate: true },
    }),
    prisma.examResult.count({
      where: { studentId: userId, score: { gte: 60 } },
    }),
    prisma.wrongRecord.count({
      where: { studentId: userId, mastered: true },
    }),
    prisma.badge.findMany(),
    prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, badge: { select: { code: true } } },
    }),
  ]);

  const earnedCodes = new Set(earnedBadges.map((e) => e.badge.code));
  const newlyAwarded: string[] = [];

  for (const badge of allBadges) {
    if (earnedCodes.has(badge.code)) continue;

    const criteria = badge.criteria as { type: string; threshold: number };
    let shouldAward = false;

    switch (criteria.type) {
      case 'streak':
        shouldAward = (profile?.streakDays ?? 0) >= criteria.threshold;
        break;
      case 'totalQuestions':
        shouldAward = (profile?.totalQuestions ?? 0) >= criteria.threshold;
        break;
      case 'correctRate':
        shouldAward = (profile?.correctRate ?? 0) >= criteria.threshold;
        break;
      case 'examPass':
        shouldAward = examPassCount >= criteria.threshold;
        break;
      case 'wrongMastered':
        shouldAward = wrongMasteredCount >= criteria.threshold;
        break;
    }

    if (shouldAward) {
      try {
        await prisma.userBadge.create({
          data: { userId, badgeId: badge.id },
        });
        newlyAwarded.push(badge.name);
      } catch {
        // 已获得（并发安全），跳过
      }
    }
  }

  return ok({
    newlyAwarded,
    count: newlyAwarded.length,
    message: newlyAwarded.length > 0
      ? `恭喜获得新徽章：${newlyAwarded.join('、')}`
      : '暂无新徽章，继续努力！',
  });
}
