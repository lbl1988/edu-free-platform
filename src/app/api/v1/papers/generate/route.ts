import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest } from '@/lib/api-response';
import { QuestionType, ReviewStatus, Role } from '@prisma/client';

// ===================== 组卷逻辑 =====================
// 支持三种 mode：RANDOM 随机 / SMART 智能（按难度加权抽样）/ MANUAL 手动选题

const GenSchema = z.object({
  title: z.string().min(2).max(100),
  subjectId: z.number().int(),
  grade: z.number().int().min(1).max(12).optional(),
  chapterId: z.string().optional(),
  mode: z.enum(['RANDOM', 'SMART', 'MANUAL']).default('RANDOM'),
  // 按题型分配题数
  questionCount: z
    .object({
      SINGLE_CHOICE: z.number().int().min(0).default(0),
      MULTI_CHOICE: z.number().int().min(0).default(0),
      FILL_BLANK: z.number().int().min(0).default(0),
      ESSAY: z.number().int().min(0).default(0),
    })
    .default({ SINGLE_CHOICE: 10 }),
  // SMART 模式下难度分布（合计应为 100%）
  difficultyDist: z
    .object({
      easy: z.number().min(0).max(100).default(40),    // 难度 1-2
      medium: z.number().min(0).max(100).default(40),  // 难度 3
      hard: z.number().min(0).max(100).default(20),    // 难度 4-5
    })
    .default({ easy: 40, medium: 40, hard: 20 }),
  // MANUAL 模式直接传题目数组
  questionIds: z.array(z.string()).optional(),
  perScore: z.number().int().min(1).max(100).default(5),
  durationMin: z.number().int().min(0).optional(),
});

// POST /api/v1/papers/generate — 智能组卷
export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = GenSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  // 校验学科
  const subject = await prisma.subject.findUnique({ where: { id: p.subjectId } });
  if (!subject) return badRequest('学科不存在');

  let selectedIds: string[] = [];

  if (p.mode === 'MANUAL') {
    if (!p.questionIds || p.questionIds.length === 0) {
      return badRequest('MANUAL 模式需提供 questionIds');
    }
    // 校验题目存在并审核通过
    const qs = await prisma.question.findMany({
      where: {
        id: { in: p.questionIds },
        reviewStatus: { in: [ReviewStatus.AI_PASSED, ReviewStatus.EXPERT_PASSED, ReviewStatus.REVIEWER_PASSED] },
      },
      select: { id: true },
    });
    if (qs.length !== p.questionIds.length) {
      return badRequest(`有 ${p.questionIds.length - qs.length} 道题不存在或未通过审核`);
    }
    selectedIds = qs.map((q) => q.id);
  } else {
    // 构建 where 公共条件
    const baseWhere: Record<string, unknown> = {
      subjectId: p.subjectId,
      reviewStatus: { in: [ReviewStatus.AI_PASSED, ReviewStatus.EXPERT_PASSED, ReviewStatus.REVIEWER_PASSED] },
    };
    if (p.grade) baseWhere.grade = p.grade;
    if (p.chapterId) baseWhere.chapterId = p.chapterId;

    // 按题型分组抽样
    const types: QuestionType[] = [];
    if (p.questionCount.SINGLE_CHOICE > 0) types.push('SINGLE_CHOICE');
    if (p.questionCount.MULTI_CHOICE > 0) types.push('MULTI_CHOICE');
    if (p.questionCount.FILL_BLANK > 0) types.push('FILL_BLANK');
    if (p.questionCount.ESSAY > 0) types.push('ESSAY');

    for (const t of types) {
      const count = p.questionCount[t];
      if (count <= 0) continue;
      const wh = { ...baseWhere, questionType: t };

      if (p.mode === 'RANDOM') {
        // 随机抽 count 道
        const qs = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Question"
          WHERE "subjectId" = ${p.subjectId}::int
          ${p.grade ? `AND "grade" = ${p.grade}` : prisma.empty}
          ${p.chapterId ? `AND "chapterId" = ${p.chapterId}` : prisma.empty}
          AND "questionType" = ${t}::"QuestionType"
          AND "reviewStatus" IN (${ReviewStatus.AI_PASSED},${ReviewStatus.EXPERT_PASSED},${ReviewStatus.REVIEWER_PASSED})::"ReviewStatus"[]
          ORDER BY random()
          LIMIT ${count}
        `;
        selectedIds.push(...qs.map((x) => x.id));
      } else {
        // SMART：按难度分层抽样
        const buckets = [
          { difficultyRange: [1, 2], ratio: p.difficultyDist.easy / 100 },
          { difficultyRange: [3, 3], ratio: p.difficultyDist.medium / 100 },
          { difficultyRange: [4, 5], ratio: p.difficultyDist.hard / 100 },
        ];
        for (const [idx, bucket] of buckets.entries()) {
          const bucketCount =
            idx === buckets.length - 1
              ? count - Math.round(count * (p.difficultyDist.easy + p.difficultyDist.medium) / 100)
              : Math.round(count * bucket.ratio);
          if (bucketCount <= 0) continue;
          const qs = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Question"
            WHERE "subjectId" = ${p.subjectId}::int
            ${p.grade ? `AND "grade" = ${p.grade}` : prisma.empty}
            ${p.chapterId ? `AND "chapterId" = ${p.chapterId}` : prisma.empty}
            AND "questionType" = ${t}::"QuestionType"
            AND "reviewStatus" IN (${ReviewStatus.AI_PASSED},${ReviewStatus.EXPERT_PASSED},${ReviewStatus.REVIEWER_PASSED})::"ReviewStatus"[]
            AND "difficulty" BETWEEN ${bucket.difficultyRange[0]} AND ${bucket.difficultyRange[1]}
            ORDER BY random()
            LIMIT ${bucketCount}
          `;
          selectedIds.push(...qs.map((x) => x.id));
        }
      }
    }
  }

  if (selectedIds.length === 0) {
    return badRequest('未找到符合条件的题目');
  }

  // 事务：创建试卷 + 批量插入卷题关联
  const totalScore = selectedIds.length * p.perScore;
  const paper = await prisma.$transaction(async (tx) => {
    const created = await tx.practicePaper.create({
      data: {
        title: p.title,
        creatorId: user!.role !== Role.STUDENT ? user!.id : null,
        subjectId: p.subjectId,
        grade: p.grade ?? null,
        mode: p.mode,
        params: p.mode !== 'MANUAL' ? (p as unknown as object) : undefined,
        totalScore,
        durationMin: p.durationMin,
        published: true,
      },
    });
    await tx.paperQuestion.createMany({
      data: selectedIds.map((qid, i) => ({
        paperId: created.id,
        questionId: qid,
        sortOrder: i,
        score: p.perScore,
      })),
    });
    return created;
  });

  return ok({ paper, totalQuestions: selectedIds.length, totalScore }, 201);
}
