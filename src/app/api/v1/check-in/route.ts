export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, forbidden, conflict } from '@/lib/api-response';
import { Role } from '@prisma/client';

// POST /api/v1/check-in — 每日学习打卡（P1-2）
// 参考方向：国内平台打卡日历 + 连续学习奖励机制
// 逻辑：同一天仅可打卡一次；连续打卡累加 streak，断签重置为 1
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;
  if (user!.role !== Role.STUDENT) {
    return forbidden('仅学生可进行学习打卡') as unknown as Response;
  }

  const studentId = user!.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);

  // 检查今日是否已打卡
  const existing = await prisma.learningCheckIn.findUnique({
    where: { studentId_checkInDate: { studentId, checkInDate: todayDate } },
    select: { id: true },
  });
  if (existing) {
    return conflict('今日已打卡，明天再来吧') as unknown as Response;
  }

  // 查昨日打卡以计算连续天数
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayCheck = await prisma.learningCheckIn.findUnique({
    where: { studentId_checkInDate: { studentId, checkInDate: yesterday } },
    select: { streakDays: true },
  });

  // 连续天数：昨日有打卡则 +1，否则重置为 1
  const newStreak = yesterdayCheck ? yesterdayCheck.streakDays + 1 : 1;

  // 积分计算：基础 10 分 + 连续 7 天额外奖励
  const streakBonus = Math.floor(newStreak / 7) * 5;
  const pointsEarned = 10 + streakBonus;

  // 事务：创建打卡记录 + 更新学习画像
  const result = await prisma.$transaction(async (tx) => {
    const checkIn = await tx.learningCheckIn.create({
      data: {
        studentId,
        checkInDate: todayDate,
        streakDays: newStreak,
        pointsEarned,
      },
    });

    await tx.learningProfile.upsert({
      where: { studentId },
      update: {
        streakDays: newStreak,
        totalPoints: { increment: pointsEarned },
        lastActiveAt: new Date(),
      },
      create: {
        studentId,
        streakDays: newStreak,
        totalPoints: pointsEarned,
        lastActiveAt: new Date(),
      },
    });

    return checkIn;
  });

  return ok({
    checkInDate: todayDate,
    streakDays: newStreak,
    pointsEarned,
    message: newStreak >= 7
      ? `连续打卡 ${newStreak} 天！获得 ${pointsEarned} 积分（含连续奖励 ${streakBonus}）`
      : `打卡成功！获得 ${pointsEarned} 积分，已连续 ${newStreak} 天`,
  }, 201);
}
