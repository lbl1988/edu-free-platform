export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound } from '@/lib/api-response';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { id } = params;
  const contest = await prisma.contest.findUnique({ where: { id }, select: { id: true } });
  if (!contest) return notFound('竞赛不存在');

  const enrollment = await prisma.contestEnrollment.findUnique({
    where: { contestId_studentId: { contestId: id, studentId: user!.id } },
  });

  return ok({ enrollment, enrolled: !!enrollment });
}
