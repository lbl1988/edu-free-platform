export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { JudgeVerdict } from '@prisma/client';

const CallbackSchema = z.object({
  judgeTaskId: z.string().optional(),
  submissionId: z.string().min(1),
  verdict: z.nativeEnum(JudgeVerdict),
  score: z.number().int().min(0).max(100).optional(),
  runTimeMs: z.number().int().min(0).optional(),
  runMemoryKB: z.number().int().min(0).optional(),
  message: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Internal-Api-Key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    return forbidden('非法调用');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = CallbackSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  let submission = await prisma.contestSubmission.findUnique({
    where: { id: p.submissionId },
    select: { id: true, problemId: true, verdict: true },
  });
  if (!submission) return notFound('提交记录不存在');

  const problemId = submission.problemId;

  submission = await prisma.$transaction(async (tx) => {
    const updated = await tx.contestSubmission.update({
      where: { id: p.submissionId },
      data: {
        verdict: p.verdict,
        score: p.score,
        runTimeMs: p.runTimeMs,
        runMemoryKB: p.runMemoryKB,
        message: p.message,
        judgeTaskId: p.judgeTaskId,
        judgedAt: new Date(),
      },
    });

    await tx.contestProblem.update({
      where: { id: problemId },
      data: {
        totalSubmit: { increment: 1 },
        totalAccept: p.verdict === JudgeVerdict.ACCEPTED ? { increment: 1 } : undefined,
      },
    });

    return updated;
  });

  return ok({ submission });
}
