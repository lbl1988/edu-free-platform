export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok } from '@/lib/api-response';
import { Role } from '@prisma/client';

// GET /api/v1/exams/analytics/trend — 教师查看考试成绩趋势（按月聚合）
export async function GET(request: NextRequest) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const months = Math.min(12, Math.max(1, Number(searchParams.get('months') ?? 6)));

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const where: Record<string, unknown> = {
    submitTime: { gte: startDate },
  };
  if (subjectId) {
    where.exam = { subjectId: Number(subjectId) };
  }
  if (user!.role !== Role.ADMIN) {
    where.exam = { ...(where.exam as object), creatorId: user!.id };
  }

  const results = await prisma.examResult.findMany({
    where,
    select: {
      score: true,
      status: true,
      submitTime: true,
      exam: {
        select: {
          id: true,
          title: true,
          totalScore: true,
          subjectId: true,
          subject: { select: { name: true } },
        },
      },
    },
    orderBy: { submitTime: 'asc' },
  });

  // 按月聚合
  const monthlyMap: Record<string, {
    month: string;
    totalResults: number;
    scoredResults: number;
    scoreSum: number;
    passedCount: number;
    violationCount: number;
  }> = {};

  results.forEach((r) => {
    const d = r.submitTime ?? new Date();
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: monthKey,
        totalResults: 0,
        scoredResults: 0,
        scoreSum: 0,
        passedCount: 0,
        violationCount: 0,
      };
    }
    const m = monthlyMap[monthKey];
    m.totalResults++;
    if (r.score != null) {
      m.scoredResults++;
      m.scoreSum += r.score;
      const passLine = (r.exam.totalScore ?? 100) * 0.6;
      if (r.score >= passLine) m.passedCount++;
    }
    if (r.status === 'VIOLATION_SUBMIT') m.violationCount++;
  });

  const trend = Object.values(monthlyMap).map((m) => ({
    ...m,
    avgScore: m.scoredResults > 0 ? Math.round((m.scoreSum / m.scoredResults) * 100) / 100 : 0,
    passRate: m.scoredResults > 0 ? Math.round((m.passedCount / m.scoredResults) * 10000) / 10000 : 0,
  }));

  // 按学科分组（仅管理员）
  let bySubject: Array<{ subjectId: number; subjectName: string; count: number; avgScore: number }> = [];
  if (user!.role === Role.ADMIN) {
    const subjMap: Record<number, { subjectId: number; subjectName: string; count: number; scoreSum: number }> = {};
    results.forEach((r) => {
      if (r.score == null) return;
      const sid = r.exam.subjectId;
      if (!subjMap[sid]) {
        subjMap[sid] = { subjectId: sid, subjectName: r.exam.subject.name, count: 0, scoreSum: 0 };
      }
      subjMap[sid].count++;
      subjMap[sid].scoreSum += r.score;
    });
    bySubject = Object.values(subjMap).map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      count: s.count,
      avgScore: s.count > 0 ? Math.round((s.scoreSum / s.count) * 100) / 100 : 0,
    }));
  }

  return ok({
    range: { months, startDate, endDate: now },
    trend,
    bySubject,
    summary: {
      totalResults: results.length,
      overallAvg: trend.length > 0
        ? Math.round((trend.reduce((s, m) => s + m.scoreSum, 0) / Math.max(1, trend.reduce((s, m) => s + m.scoredResults, 0))) * 100) / 100
        : 0,
    },
  });
}
