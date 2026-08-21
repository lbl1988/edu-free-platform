export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

// POST /api/v1/goals/refresh — 刷新当前周期目标的进度（P2-1）
// 根据实际数据计算各目标的 currentValue 并标记达成
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;
  if (user!.role !== Role.STUDENT) {
    return forbidden('仅学生可刷新学习目标') as unknown as Response;
  }

  const studentId = user!.id;
  const now = new Date();

  // 获取当前有效目标
  const goals = await prisma.studyGoal.findMany({
    where: { studentId, achieved: false, periodEnd: { gte: now } },
  });

  if (goals.length === 0) {
    return ok({ refreshed: 0, goals: [] });
  }

  // 汇总本周数据
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [behavior, questionCount, examPassCount, wrongMasteredCount] = await Promise.all([
    prisma.learningProfile.findUnique({
      where: { studentId },
      select: { totalStudyMinutes: true, correctRate: true, totalQuestions: true },
    }),
    prisma.questionAnswer.count({
      where: { studentId, createdAt: { gte: weekAgo } },
    }),
    prisma.examResult.count({
      where: { studentId, score: { gte: 60 } },
    }),
    prisma.wrongRecord.count({
      where: { studentId, mastered: true },
    }),
  ]);

  // 还需要获取最近7天学习时长（从 checkIn + paperAttempt 估算）
  const recentCheckIns = await prisma.learningCheckIn.aggregate({
    where: { studentId, checkInDate: { gte: weekAgo } },
    _sum: { studyMinutes: true },
  });
  const weekStudyMinutes = recentCheckIns._sum.studyMinutes ?? 0;

  const updatedGoals = [];
  for (const goal of goals) {
    let currentValue = 0;
    switch (goal.goalType) {
      case 'STUDY_MINUTES':
        currentValue = weekStudyMinutes;
        break;
      case 'QUESTION_COUNT':
        currentValue = questionCount;
        break;
      case 'ACCURACY':
        currentValue = behavior?.correctRate ?? 0;
        break;
      case 'EXAM_PASS':
        currentValue = examPassCount;
        break;
    }

    const achieved = currentValue >= goal.targetValue;
    updatedGoals.push({
      id: goal.id,
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      currentValue,
      progress: goal.targetValue > 0 ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100)) : 0,
      achieved,
    });

    await prisma.studyGoal.update({
      where: { id: goal.id },
      data: {
        currentValue,
        achieved,
        achievedAt: achieved && !goal.achieved ? new Date() : goal.achievedAt,
      },
    });
  }

  return ok({ refreshed: updatedGoals.length, goals: updatedGoals });
}
