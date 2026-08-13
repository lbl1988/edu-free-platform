export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound } from '@/lib/api-response';

type Ctx = { params: { id: string } };

const PAPER_INCLUDE = {
  subject: { select: { id: true, name: true } },
  creator: { select: { id: true, nickname: true } },
  questions: {
    orderBy: { sortOrder: 'asc' },
    include: {
      question: {
        select: {
          id: true, content: true, options: true, questionType: true, difficulty: true,
          analysis: true, answer: true, correctCount: true, attemptCount: true,
        },
      },
    },
  },
} as const;

// GET /api/v1/papers/{id} — 试卷详情（含题目）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const paper = await prisma.practicePaper.findUnique({ where: { id: params.id }, include: PAPER_INCLUDE });
  if (!paper) return notFound('试卷不存在');

  // 查询最近一次自己的作答
  const lastAttempt = await prisma.paperAttempt.findFirst({
    where: { paperId: params.id, studentId: user!.id },
    orderBy: { submittedAt: { sort: 'desc', nulls: 'first' } },
    select: { id: true, status: true, score: true, correctCount: true, totalCount: true, submittedAt: true },
  });

  return ok({ paper, lastAttempt });
}
