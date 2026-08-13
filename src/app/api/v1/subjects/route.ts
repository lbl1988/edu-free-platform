export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/api-response';
import { CourseStatus, ReviewStatus } from '@prisma/client';

export async function GET(_request: NextRequest) {
  const subjects = await prisma.subject.findMany({
    orderBy: { id: 'asc' },
    include: {
      _count: {
        select: {
          courses: {
            where: { status: CourseStatus.PUBLISHED },
          },
        },
      },
    },
  });

  const subjectIds = subjects.map((s) => s.id);
  const questionCounts = await prisma.question.groupBy({
    by: ['subjectId'],
    where: {
      subjectId: { in: subjectIds },
      reviewStatus: ReviewStatus.REVIEWER_PASSED,
    },
    _count: { subjectId: true },
  });

  const countMap = new Map<number, number>();
  for (const qc of questionCounts) {
    countMap.set(qc.subjectId, qc._count.subjectId);
  }

  const result = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    stage: s.stage,
    courseCount: s._count.courses,
    publishedQuestionCount: countMap.get(s.id) ?? 0,
  }));

  return ok({ subjects: result });
}
