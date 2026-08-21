export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound } from '@/lib/api-response';

// GET /api/v1/wrong/similar?questionId=xxx — 举一反三：相似题推荐（P0-1）
// 优先取同章节题；不足则取同学科同难度题；排除当前题本身
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get('questionId');
  if (!questionId) return badRequest('缺少 questionId 参数');
  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? 5)));

  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true, subjectId: true, chapterId: true, difficulty: true, grade: true,
    },
  });
  if (!q) return notFound('题目不存在');

  const validStatuses = [
    ReviewStatus.AI_PASSED,
    ReviewStatus.EXPERT_PASSED,
    ReviewStatus.REVIEWER_PASSED,
  ];
  const select = {
    id: true, content: true, questionType: true, difficulty: true,
    answer: true, analysis: true,
  } as const;

  let candidates: Array<{ id: string; content: string; questionType: string; difficulty: number; answer: string | null; analysis: string | null }> = [];

  // 1) 同章节优先
  if (q.chapterId) {
    candidates = await prisma.question.findMany({
      where: {
        id: { not: q.id },
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        reviewStatus: { in: validStatuses },
      },
      select,
      take: limit * 2,
    }) as typeof candidates;
  }

  // 2) 不足则补同学科同难度（排除已选）
  if (candidates.length < limit) {
    const excludeIds = [q.id, ...candidates.map((c) => c.id)];
    const more = await prisma.question.findMany({
      where: {
        id: { notIn: excludeIds },
        subjectId: q.subjectId,
        difficulty: q.difficulty,
        reviewStatus: { in: validStatuses },
        ...(q.grade ? { grade: q.grade } : {}),
      },
      select,
      take: (limit - candidates.length) * 2,
    }) as typeof candidates;
    candidates = candidates.concat(more);
  }

  // 随机洗牌后取 limit 道，避免每次都给同样几道
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, limit);
  return ok({ items: shuffled, total: shuffled.length });
}
