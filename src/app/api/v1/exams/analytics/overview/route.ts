export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok } from '@/lib/api-response';
import { Role, ExamStatus } from '@prisma/client';

type TimeRange = 'this_month' | 'last_30d' | 'this_semester';

function getTimeRange(range: TimeRange | null): Date | undefined {
  const now = new Date();
  if (!range) return undefined;
  if (range === 'this_month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (range === 'last_30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (range === 'this_semester') {
    const month = now.getMonth();
    const year = month < 8 ? now.getFullYear() - 1 : now.getFullYear();
    const startMonth = month < 8 ? 1 : 8;
    return new Date(year, startMonth - 1, 1);
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const grade = searchParams.get('grade');
  const timeRange = searchParams.get('timeRange') as TimeRange | null;

  const startTime = getTimeRange(timeRange);

  const examWhere: Record<string, unknown> = {};
  if (user!.role !== Role.ADMIN) {
    examWhere.creatorId = user!.id;
  }
  if (subjectId) examWhere.subjectId = Number(subjectId);
  if (grade) examWhere.grade = Number(grade);
  if (startTime) examWhere.createdAt = { gte: startTime };

  const exams = await prisma.exam.findMany({
    where: examWhere,
    select: {
      id: true, totalScore: true, passScore: true, subjectId: true,
      subject: { select: { name: true } },
      results: {
        select: {
          status: true, score: true,
          violations: { select: { type: true } },
        },
      },
    },
  });

  const resultStatusCount: Record<string, number> = {
    NOT_STARTED: 0, IN_PROGRESS: 0, SUBMITTED: 0, GRADED: 0, VIOLATION_SUBMIT: 0,
  };
  let totalResults = 0;
  let scoredResults = 0;
  let totalScoreSum = 0;
  let passedCount = 0;

  const bySubject: Record<number, { subjectId: number; name: string; total: number; count: number }> = {};
  const byViolation: Record<string, number> = {};

  exams.forEach((exam) => {
    const passScore = exam.passScore ?? exam.totalScore * 0.6;
    const subj = exam.subjectId;
    const subjName = exam.subject.name;

    if (!bySubject[subj]) {
      bySubject[subj] = { subjectId: subj, name: subjName, total: 0, count: 0 };
    }

    exam.results.forEach((r) => {
      totalResults++;
      if (r.status in resultStatusCount) resultStatusCount[r.status]++;
      if (r.score != null) {
        scoredResults++;
        totalScoreSum += r.score;
        if (r.score >= passScore) passedCount++;
        bySubject[subj].total += r.score;
        bySubject[subj].count++;
      }
      r.violations.forEach((v) => {
        byViolation[v.type] = (byViolation[v.type] ?? 0) + 1;
      });
    });
  });

  const avgScore = scoredResults > 0 ? Math.round((totalScoreSum / scoredResults) * 100) / 100 : 0;
  const passRate = scoredResults > 0 ? Math.round((passedCount / scoredResults) * 10000) / 10000 : 0;

  const bySubjectList = Object.values(bySubject)
    .filter((s) => s.count > 0)
    .map((s) => ({
      subjectId: s.subjectId,
      name: s.name,
      avgScore: Math.round((s.total / s.count) * 100) / 100,
      n: s.count,
    }));

  const byStatusList = Object.entries(resultStatusCount).map(([status, count]) => ({ status, count }));
  const byViolationList = Object.entries(byViolation).map(([type, count]) => ({ type, count }));

  return ok({
    summary: {
      examCount: exams.length,
      resultCount: totalResults,
      scoredResultCount: scoredResults,
      avgScore,
      passRate,
    },
    bySubject: bySubjectList,
    byViolation: byViolationList,
    byStatus: byStatusList,
  });
}
