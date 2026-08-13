export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; code: string } },
) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { id, code } = params;

  const contest = await prisma.contest.findUnique({
    where: { id },
    select: { id: true, published: true, startTime: true },
  });
  if (!contest || !contest.published) return notFound('竞赛不存在');

  const now = new Date();
  const hasStarted = now >= new Date(contest.startTime);

  let allowed = user!.role === Role.ADMIN || user!.role === Role.TEACHER;

  if (!allowed && user!.role === Role.STUDENT && hasStarted) {
    const enrolled = await prisma.contestEnrollment.findUnique({
      where: { contestId_studentId: { contestId: id, studentId: user!.id } },
      select: { id: true },
    });
    if (enrolled) allowed = true;
  }

  if (!allowed) return forbidden('无权访问该题目');

  const problem = await prisma.contestProblem.findUnique({
    where: { contestId_problemCode: { contestId: id, problemCode: code } },
  });
  if (!problem) return notFound('题目不存在');

  let myLastSubmission = null;
  if (user!.role === Role.STUDENT) {
    myLastSubmission = await prisma.contestSubmission.findFirst({
      where: { problemId: problem.id, studentId: user!.id },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
  }

  return ok({ problem, myLastSubmission });
}
