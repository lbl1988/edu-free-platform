export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { submissionId: string } },
) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { submissionId } = params;
  const submission = await prisma.contestSubmission.findUnique({
    where: { id: submissionId },
    include: {
      problem: { select: { id: true, problemCode: true, title: true, contestId: true } },
      contest: { select: { id: true, title: true } },
      student: { select: { id: true, nickname: true } },
    },
  });

  if (!submission) return notFound('提交记录不存在');

  if (user!.role !== Role.ADMIN && submission.studentId !== user!.id) {
    return forbidden('无权查看该提交记录');
  }

  return ok({ submission });
}
