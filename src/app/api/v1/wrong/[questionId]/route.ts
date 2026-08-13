import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound } from '@/lib/api-response';

type Ctx = { params: { questionId: string } };

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
