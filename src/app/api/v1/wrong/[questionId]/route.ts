export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, badRequest } from '@/lib/api-response';
import { ERROR_TAGS } from '@/lib/spaced-repetition';

type Ctx = { params: { questionId: string } };

const TagSchema = z.object({
  errorTag: z.enum([
    ERROR_TAGS.CALCULATION,
    ERROR_TAGS.CONCEPT,
    ERROR_TAGS.MISREAD,
    ERROR_TAGS.FORGOTTEN,
    ERROR_TAGS.OTHER,
  ]).nullable().optional(),
  errorReason: z.string().max(500).nullable().optional(),
});

// POST /api/v1/wrong/{questionId}/mastered — 标记错题已掌握
export async function POST(request: NextRequest, ctx: Ctx) {
  return await updateMastered(request, ctx.params, true);
}

// PUT /api/v1/wrong/{questionId} — 标记未掌握
export async function PUT(request: NextRequest, ctx: Ctx) {
  return await updateMastered(request, ctx.params, false);
}

// DELETE /api/v1/wrong/{questionId} — 从错题本移除
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const params = ctx.params;
  const [user, err] = await requireLogin(_request);
  if (err) return err;
  await prisma.wrongRecord.deleteMany({
    where: { studentId: user!.id, questionId: params.questionId },
  });
  return ok({ message: '已从错题本移除' });
}

async function updateMastered(request: NextRequest, params: { questionId: string }, mastered: boolean) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  const updated = await prisma.wrongRecord.updateMany({
    where: { studentId: user!.id, questionId: params.questionId },
    data: {
      mastered,
      masteredAt: mastered ? new Date() : null,
    },
  });
  if (updated.count === 0) return notFound('错题记录不存在');
  return ok({ mastered });
}

// PATCH /api/v1/wrong/{questionId} — 更新错误原因（不影响复习周期，P0-1）
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体必须为 JSON');
  }
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const updated = await prisma.wrongRecord.updateMany({
    where: { studentId: user!.id, questionId: ctx.params.questionId },
    data: {
      ...(parsed.data.errorTag !== undefined ? { errorTag: parsed.data.errorTag } : {}),
      ...(parsed.data.errorReason !== undefined ? { errorReason: parsed.data.errorReason } : {}),
    },
  });
  if (updated.count === 0) return notFound('错题记录不存在');
  return ok({ errorTag: parsed.data.errorTag ?? null, errorReason: parsed.data.errorReason ?? null });
}
