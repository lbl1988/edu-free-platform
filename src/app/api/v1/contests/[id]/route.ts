export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

const problemShallowSelect = {
  id: true,
  problemCode: true,
  title: true,
  difficulty: true,
  timeLimitMs: true,
  memoryLimitMB: true,
  totalSubmit: true,
  totalAccept: true,
  sortOrder: true,
} as const;

const problemFullSelect = {
  ...problemShallowSelect,
  description: true,
  inputFormat: true,
  outputFormat: true,
  samples: true,
  testdataKey: true,
} as const;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      course: { select: { id: true, title: true } },
      exam: { select: { id: true, title: true } },
      creator: { select: { id: true, nickname: true } },
      _count: { select: { enrollments: true, problems: true } },
      problems: {
        select: problemShallowSelect,
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!contest) return notFound('竞赛不存在');
  if (!contest.published) return notFound('竞赛不存在');

  const now = new Date();
  const hasStarted = now >= new Date(contest.startTime);

  let problems = contest.problems;
  let canSeeFull = false;

  if (hasStarted) {
    const [user, _err] = await requireLogin(request);
    if (user) {
      if (user.role === Role.ADMIN || user.role === Role.TEACHER) {
        canSeeFull = true;
      } else if (user.role === Role.STUDENT) {
        const enrolled = await prisma.contestEnrollment.findUnique({
          where: { contestId_studentId: { contestId: id, studentId: user.id } },
          select: { id: true },
        });
        if (enrolled) canSeeFull = true;
      }
    }
  } else {
    problems = [];
  }

  if (canSeeFull) {
    const fullProblems = await prisma.contestProblem.findMany({
      where: { contestId: id },
      select: problemFullSelect,
      orderBy: { sortOrder: 'asc' },
    });
    problems = fullProblems as any;
  }

  const result = {
    ...contest,
    enrollmentsCount: contest._count.enrollments,
    problemsCount: contest._count.problems,
    problems,
    _count: undefined,
  };

  return ok({ contest: result });
}
