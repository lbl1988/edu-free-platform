export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';

// GET /api/v1/analytics/weekly-report — 学情周报（P2-3）
// 汇总最近 7 天学习数据，与前 7 天对比，生成趋势报告
// 参考方向：学情周报（精准学情反馈闭环）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const studentId = user!.id;
  const now = new Date();

  // 本周 vs 上周
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);

  // 获取本周数据
  const [
    thisWeekAnswers,
    thisWeekWrong,
    thisWeekMastered,
    thisWeekCheckIns,
    thisWeekExams,
    profile,
  ] = await Promise.all([
    prisma.questionAnswer.findMany({
      where: { studentId, createdAt: { gte: thisWeekStart } },
      select: { isCorrect: true, createdAt: true },
    }),
    prisma.wrongRecord.count({
      where: { studentId, firstWrongAt: { gte: thisWeekStart } },
    }),
    prisma.wrongRecord.count({
      where: { studentId, mastered: true, lastReviewedAt: { gte: thisWeekStart } },
    }),
    prisma.learningCheckIn.findMany({
      where: { studentId, checkInDate: { gte: thisWeekStart } },
      select: { checkInDate: true, pointsEarned: true, streakDays: true },
      orderBy: { checkInDate: 'asc' },
    }),
    prisma.examResult.findMany({
      where: { studentId, submitTime: { gte: thisWeekStart } },
      select: { id: true, score: true, exam: { select: { title: true, totalScore: true, subject: { select: { name: true } } } } },
    }),
    prisma.learningProfile.findUnique({
      where: { studentId },
      select: { streakDays: true, totalPoints: true, totalStudyMinutes: true },
    }),
  ]);

  // 上周数据（对比用）
  const [lastWeekAnswerCount, lastWeekWrongCount] = await Promise.all([
    prisma.questionAnswer.count({
      where: { studentId, createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
    }),
    prisma.wrongRecord.count({
      where: { studentId, firstWrongAt: { gte: lastWeekStart, lt: lastWeekEnd } },
    }),
  ]);

  // 计算本周统计
  const thisWeekAnswerCount = thisWeekAnswers.length;
  const thisWeekCorrect = thisWeekAnswers.filter((a) => a.isCorrect).length;
  const correctRate = thisWeekAnswerCount > 0 ? thisWeekCorrect / thisWeekAnswerCount : 0;

  // 按天分组答题
  const dailyAnswers: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(thisWeekStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyAnswers[key] = 0;
  }
  for (const a of thisWeekAnswers) {
    const key = a.createdAt.toISOString().slice(0, 10);
    if (key in dailyAnswers) dailyAnswers[key]++;
  }

  // 趋势对比
  const answerTrend = lastWeekAnswerCount > 0
    ? Math.round(((thisWeekAnswerCount - lastWeekAnswerCount) / lastWeekAnswerCount) * 100)
    : thisWeekAnswerCount > 0 ? 100 : 0;
  const wrongTrend = lastWeekWrongCount > 0
    ? Math.round(((thisWeekWrong - lastWeekWrongCount) / lastWeekWrongCount) * 100)
    : thisWeekWrong > 0 ? 100 : 0;

  return ok({
    period: {
      start: thisWeekStart.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    },
    summary: {
      questionsAnswered: thisWeekAnswerCount,
      correctRate: Math.round(correctRate * 10000) / 100,
      correctCount: thisWeekCorrect,
      wrongAdded: thisWeekWrong,
      wrongMastered: thisWeekMastered,
      checkInDays: thisWeekCheckIns.length,
      examCount: thisWeekExams.length,
      streakDays: profile?.streakDays ?? 0,
      totalPoints: profile?.totalPoints ?? 0,
    },
    trends: {
      answerChange: answerTrend,
      wrongChange: wrongTrend,
      answerTrendLabel: answerTrend > 0 ? `↑${answerTrend}%` : answerTrend < 0 ? `↓${Math.abs(answerTrend)}%` : '持平',
      wrongTrendLabel: wrongTrend > 0 ? `↑${wrongTrend}%` : wrongTrend < 0 ? `↓${Math.abs(wrongTrend)}%` : '持平',
    },
    dailyActivity: Object.entries(dailyAnswers).map(([date, count]) => ({
      date,
      count,
      weekday: ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()],
    })),
    recentExams: thisWeekExams.map((e) => ({
      id: e.id,
      title: e.exam.title,
      subject: e.exam.subject.name,
      score: e.score,
      totalScore: e.exam.totalScore,
      passed: e.score != null && e.score >= (e.exam.totalScore ?? 100) * 0.6,
    })),
    checkInCalendar: thisWeekCheckIns.map((c) => ({
      date: c.checkInDate.toISOString().slice(0, 10),
      points: c.pointsEarned,
      streak: c.streakDays,
    })),
  });
}
