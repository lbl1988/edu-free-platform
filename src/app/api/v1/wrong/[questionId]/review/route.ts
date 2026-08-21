export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, badRequest } from '@/lib/api-response';
import { applyReviewResult, ERROR_TAGS } from '@/lib/spaced-repetition';

type Ctx = { params: { questionId: string } };

const ReviewSchema = z.object({
  correct: z.boolean(),
  // 可选：复习时更新错误原因（仅在答错时有意义）
  errorTag: z.enum([
    ERROR_TAGS.CALCULATION,
    ERROR_TAGS.CONCEPT,
    ERROR_TAGS.MISREAD,
    ERROR_TAGS.FORGOTTEN,
    ERROR_TAGS.OTHER,
  ]).optional(),
  errorReason: z.string().max(500).optional(),
});

// POST /api/v1/wrong/{questionId}/review — 提交一次复习结果（P0-1）
// 答对：推进艾宾浩斯下一档；达到阈值自动标记 mastered
// 答错：重置复习周期，记录错误原因
export async function POST(request: NextRequest, ctx: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体必须为 JSON');
  }
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { correct, errorTag, errorReason } = parsed.data;

  const existing = await prisma.wrongRecord.findUnique({
    where: {
      studentId_questionId: { studentId: user!.id, questionId: ctx.params.questionId },
    },
  });
  if (!existing) return notFound('错题记录不存在');

  const result = applyReviewResult(existing.reviewCount, correct);
  const now = new Date();

  const updated = await prisma.wrongRecord.update({
    where: { id: existing.id },
    data: {
      reviewCount: result.reviewCount,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: now,
      ...(correct
        ? {
            // 答对：若建议掌握则彻底标记 mastered 并清空排程
            mastered: result.suggestMastered,
            masteredAt: result.suggestMastered ? now : null,
            nextReviewAt: result.suggestMastered ? null : result.nextReviewAt,
          }
        : {
            // 答错：再次出错，重置周期并记录原因
            wrongCount: { increment: 1 },
            lastWrongAt: now,
            ...(errorTag ? { errorTag } : {}),
            ...(errorReason ? { errorReason } : {}),
          }),
    },
  });

  return ok({
    reviewCount: updated.reviewCount,
    nextReviewAt: updated.nextReviewAt,
    mastered: updated.mastered,
    suggestMastered: result.suggestMastered,
  });
}
