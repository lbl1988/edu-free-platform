export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

// GET /api/v1/check-in/status — 获取当前打卡状态（P1-2）
// 返回：今日是否已打卡、连续天数、累计积分、最近 30 天打卡日历
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;
  if (user!.role !== Role.STUDENT) {
    return forbidden('仅学生可查看打卡状态') as unknown as Response;
  }

  const studentId = user!.id;

  // 今日日期（按天截断）
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  // 30 天前
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const [todayCheck, profile, recentCheckIns] = await Promise.all([
    prisma.learningCheckIn.findUnique({
      where: { studentId_checkInDate: { studentId, checkInDate: today } },
      select: { id: true, pointsEarned: true, streakDays: true, createdAt: true },
    }),
    prisma.learningProfile.findUnique({
      where: { studentId },
      select: { streakDays: true, totalPoints: true, lastActiveAt: true },
    }),
    prisma.learningCheckIn.findMany({
      where: {
        studentId,
        checkInDate: { gte: thirtyDaysAgo, lte: today },
      },
      orderBy: { checkInDate: 'asc' },
      select: { checkInDate: true, pointsEarned: true, streakDays: true },
    }),
  ]);

  // 判断连续天数是否已断（昨天没打卡且今天也没打卡 → streak 归零显示）
  let effectiveStreak = profile?.streakDays ?? 0;
  if (!todayCheck && effectiveStreak > 0) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayCheck = recentCheckIns.find(
      (c) => c.checkInDate.getTime() === yesterday.getTime(),
    );
    if (!yesterdayCheck) {
      effectiveStreak = 0;
    }
  }

  // 构建打卡日历（Set of ISO date strings）
  const checkInDates = recentCheckIns.map((c) => ({
    date: c.checkInDate.toISOString().slice(0, 10),
    points: c.pointsEarned,
    streak: c.streakDays,
  }));

  return ok({
    checkedInToday: !!todayCheck,
    todayPoints: todayCheck?.pointsEarned ?? null,
    streakDays: effectiveStreak,
    totalPoints: profile?.totalPoints ?? 0,
    lastActiveAt: profile?.lastActiveAt,
    calendar: checkInDates,
    totalCheckIns30d: recentCheckIns.length,
  });
}
