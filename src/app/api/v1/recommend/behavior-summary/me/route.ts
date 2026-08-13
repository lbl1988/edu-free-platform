export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) {
    return ok({ behaviorSummary: null, derived30dMinutes: 0, derivedCorrectRate: 0 });
  }

  const summary = await prisma.userBehaviorSummary.findUnique({
    where: { studentId: user!.id },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [paperAttempts, examResults] = await Promise.all([
    prisma.paperAttempt.findMany({
      where: {
        studentId: user!.id,
        status: 'SUBMITTED',
        submittedAt: { gte: thirtyDaysAgo },
      },
      select: { startedAt: true, submittedAt: true, correctCount: true, totalCount: true },
    }),
    prisma.examResult.findMany({
      where: {
        studentId: user!.id,
        submitTime: { gte: thirtyDaysAgo },
      },
      select: { startTime: true, submitTime: true, correctCount: true, totalCount: true },
    }),
  ]);

  let derivedMinutes = summary?.minutesLast30d ?? 0;
  if (derivedMinutes === 0) {
    let totalMs = 0;
    paperAttempts.forEach((p) => {
      if (p.startedAt && p.submittedAt) {
        totalMs += p.submittedAt.getTime() - p.startedAt.getTime();
      }
    });
    examResults.forEach((e) => {
      if (e.startTime && e.submitTime) {
        totalMs += e.submitTime.getTime() - e.startTime.getTime();
      }
    });
    derivedMinutes = Math.round(totalMs / 60000);
  }

  let derivedCorrectRate = summary?.correctLast30d ?? 0;
  if (derivedCorrectRate === 0) {
    const totalQ = paperAttempts.reduce((s, p) => s + (p.totalCount ?? 0), 0) +
      examResults.reduce((s, e) => s + (e.totalCount ?? 0), 0);
    const correctQ = paperAttempts.reduce((s, p) => s + (p.correctCount ?? 0), 0) +
      examResults.reduce((s, e) => s + (e.correctCount ?? 0), 0);
    if (totalQ > 0) derivedCorrectRate = Math.round((correctQ / totalQ) * 10000) / 10000;
  }

  const questionsLast30d = summary?.questionsLast30d ??
    paperAttempts.reduce((s, p) => s + (p.totalCount ?? 0), 0) +
    examResults.reduce((s, e) => s + (e.totalCount ?? 0), 0);

  return ok({
    behaviorSummary: summary ? { ...summary, questionsLast30d } : null,
    derived30dMinutes: derivedMinutes,
    derivedCorrectRate,
  });
}
