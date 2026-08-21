export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

type GoalType = 'STUDY_MINUTES' | 'QUESTION_COUNT' | 'ACCURACY' | 'EXAM_PASS';

// 计算周期起止日期
function getPeriodDates(period: 'WEEKLY' | 'MONTHLY'): { start: Date; end: Date } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'WEEKLY') {
    // 本周一到周日
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    end.setDate(start.getDate() + 6);
  } else {
    // 本月1号到月末
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  }
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// GET /api/v1/goals — 获取当前周期目标列表
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;
  if (user!.role !== Role.STUDENT) {
    return forbidden('仅学生可管理学习目标') as unknown as Response;
  }

  const { start } = getPeriodDates('WEEKLY');

  const goals = await prisma.studyGoal.findMany({
    where: {
      studentId: user!.id,
      periodEnd: { gte: start },
    },
    orderBy: { periodEnd: 'desc' },
  });

  return ok({ goals });
}

// POST /api/v1/goals — 创建学习目标
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;
  if (user!.role !== Role.STUDENT) {
    return forbidden('仅学生可创建学习目标') as unknown as Response;
  }

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('请求体格式错误') as unknown as Response;

  const { goalType, targetValue, period = 'WEEKLY' } = body as {
    goalType: GoalType;
    targetValue: number;
    period?: 'WEEKLY' | 'MONTHLY';
  };

  const validTypes: GoalType[] = ['STUDY_MINUTES', 'QUESTION_COUNT', 'ACCURACY', 'EXAM_PASS'];
  if (!validTypes.includes(goalType)) {
    return badRequest('目标类型无效') as unknown as Response;
  }
  if (!targetValue || targetValue <= 0) {
    return badRequest('目标值必须大于 0') as unknown as Response;
  }
  if (goalType === 'ACCURACY' && targetValue > 1) {
    return badRequest('正确率目标值应为 0-1（如 0.8 表示 80%）') as unknown as Response;
  }

  const { start, end } = getPeriodDates(period);

  // 同周期同类型目标不可重复
  const existing = await prisma.studyGoal.findFirst({
    where: { studentId: user!.id, goalType, periodStart: start },
    select: { id: true },
  });
  if (existing) {
    return badRequest('本周期已存在同类型目标') as unknown as Response;
  }

  const goal = await prisma.studyGoal.create({
    data: {
      studentId: user!.id,
      goalType,
      targetValue: Number(targetValue),
      period: period as string,
      periodStart: start,
      periodEnd: end,
    },
  });

  return ok({ goal }, 201);
}
