export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Role, ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest } from '@/lib/api-response';

const RebuildSchema = z.object({
  title: z.string().min(2).max(100).optional(),
  subjectId: z.number().int().optional(),
  // 最多取多少道错题组卷
  limit: z.number().int().min(1).max(100).default(20),
  // 筛选：true 只组"今日到期复习"的错题；false 组全部未掌握错题
  dueOnly: z.boolean().default(true),
  perScore: z.number().int().min(1).max(100).default(5),
});

// POST /api/v1/wrong/rebuild-paper — 错题重组为练习卷（P0-1，举一反三 + 集中复盘）
// 复用 PracticePaper 体系，组卷后可直接进入 /practice 答题
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = RebuildSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  const where: Record<string, unknown> = { studentId: user!.id, mastered: false };
  if (p.dueOnly) {
    where.nextReviewAt = { lte: new Date() };
  }
  if (p.subjectId) where.question = { subjectId: p.subjectId };

  const wrongs = await prisma.wrongRecord.findMany({
    where,
    orderBy: { nextReviewAt: 'asc' },
    take: p.limit,
    select: {
      questionId: true,
      question: {
        select: {
          id: true, subjectId: true, grade: true, difficulty: true, reviewStatus: true,
        },
      },
    },
  });

  if (wrongs.length === 0) return badRequest('暂无可重组的错题');

  // 仅保留审核通过的题（与 papers/generate 一致）
  const validStatuses: ReviewStatus[] = [
    ReviewStatus.AI_PASSED,
    ReviewStatus.EXPERT_PASSED,
    ReviewStatus.REVIEWER_PASSED,
  ];
  const valid = wrongs.filter((w) => validStatuses.includes(w.question.reviewStatus));
  if (valid.length === 0) return badRequest('错题均未通过审核，无法组卷');

  const subjectId = p.subjectId ?? valid[0].question.subjectId;
  const grade = valid.find((w) => w.question.grade)?.question.grade ?? null;
  const totalScore = valid.length * p.perScore;

  const paper = await prisma.$transaction(async (tx) => {
    const created = await tx.practicePaper.create({
      data: {
        title: p.title ?? `错题重组练习卷（${valid.length}题）`,
        creatorId: user!.role !== Role.STUDENT ? user!.id : null,
        subjectId,
        grade,
        mode: 'MANUAL',
        params: { source: 'wrong_rebuild', count: valid.length } as object,
        totalScore,
        published: true,
      },
    });
    await tx.paperQuestion.createMany({
      data: valid.map((w, i) => ({
        paperId: created.id,
        questionId: w.questionId,
        sortOrder: i,
        score: p.perScore,
      })),
    });
    return created;
  });

  return ok({ paper, totalQuestions: valid.length, totalScore }, 201);
}
