export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';
import { ExamStatus } from '@prisma/client';

// GET /api/v1/calendar — 学习日历（P3-3）
// 返回指定月份的学习事件：考试/打卡/目标/练习
// 参考方向：学习路径规划与排期可视化
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const studentId = user!.id;
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month'); // YYYY-MM

  let year: number, month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number);
    year = y;
    month = m - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [examResults, checkIns, studyGoals, paperAttempts] = await Promise.all([
    // 考试：提交时间在当月
    prisma.examResult.findMany({
      where: {
        studentId,
        submitTime: { gte: monthStart, lte: monthEnd },
      },
      select: {
        id: true,
        submitTime: true,
        status: true,
        score: true,
        exam: { select: { id: true, title: true, totalScore: true, subject: { select: { name: true } } } },
      },
      orderBy: { submitTime: 'asc' },
    }),
    // 打卡：当月打卡记录
    prisma.learningCheckIn.findMany({
      where: {
        studentId,
        checkInDate: { gte: monthStart, lte: monthEnd },
      },
      select: { checkInDate: true, pointsEarned: true, streakDays: true },
      orderBy: { checkInDate: 'asc' },
    }),
    // 目标：当月内有效目标
    prisma.studyGoal.findMany({
      where: {
        studentId,
        OR: [
          { periodStart: { gte: monthStart, lte: monthEnd } },
          { periodEnd: { gte: monthStart, lte: monthEnd } },
        ],
      },
      select: { id: true, goalType: true, targetValue: true, currentValue: true, achieved: true, periodStart: true, periodEnd: true },
    }),
    // 练习卷提交
    prisma.paperAttempt.findMany({
      where: {
        studentId,
        submittedAt: { gte: monthStart, lte: monthEnd },
      },
      select: {
        id: true,
        submittedAt: true,
        score: true,
        paper: { select: { id: true, title: true, totalScore: true } },
      },
      orderBy: { submittedAt: 'asc' },
    }),
  ]);

  // 构建按天分组的事件
  const eventsByDate: Record<string, Array<{ type: string; title: string; detail?: string }>> = {};

  function addEvent(date: Date, type: string, title: string, detail?: string) {
    const key = date.toISOString().slice(0, 10);
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push({ type, title, detail });
  }

  for (const e of examResults) {
    if (e.submitTime) addEvent(e.submitTime, 'exam', `考试: ${e.exam.title}`, e.exam.subject.name);
  }
  for (const c of checkIns) {
    addEvent(c.checkInDate, 'checkin', `打卡 (连续${c.streakDays}天)`, `+${c.pointsEarned}积分`);
  }
  for (const p of paperAttempts) {
    if (p.submittedAt) addEvent(p.submittedAt, 'practice', `练习: ${p.paper.title}`, `得分 ${p.score ?? '—'}/${p.paper.totalScore}`);
  }
  for (const g of studyGoals) {
    if (g.periodEnd >= monthStart && g.periodEnd <= monthEnd) {
      addEvent(g.periodEnd, 'goal', `目标截止`, `${g.goalType} ${g.achieved ? '已达成' : '未达成'}`);
    }
  }

  return ok({
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    monthStart: monthStart.toISOString().slice(0, 10),
    monthEnd: monthEnd.toISOString().slice(0, 10),
    summary: {
      examCount: examResults.length,
      checkInDays: checkIns.length,
      practiceCount: paperAttempts.length,
      activeGoals: studyGoals.length,
    },
    events: Object.entries(eventsByDate).map(([date, events]) => ({ date, events })),
  });
}
