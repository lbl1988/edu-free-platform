export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, badRequest } from '@/lib/api-response';
import { z } from 'zod';

type Ctx = { params: { id: string } };

// GET /api/v1/papers/{id} — 试卷详情（含题目列表）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const paper = await prisma.practicePaper.findUnique({
    where: { id: params.id },
    include: {
      subject: { select: { id: true, name: true } },
      creator: { select: { id: true, nickname: true } },
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          question: {
            select: {
              id: true, content: true, options: true, questionType: true, difficulty: true,
              analysis: true, // 学生也可先看到解析（练习卷场景非正式考试）
              answer: true,
              correctCount: true, attemptCount: true,
            },
          },
        },
      },
    },
  });
  if (!paper) return notFound('试卷不存在');

  // 查询最近一次用户自己的作答
  const lastAttempt = await prisma.paperAttempt.findFirst({
    where: { paperId: params.id, studentId: user!.id },
    orderBy: { submittedAt: { sort: 'desc', nulls: 'first' } },
    select: { id: true, status: true, score: true, correctCount: true, totalCount: true, submittedAt: true },
  });

  return ok({ paper, lastAttempt });
}

// ====== 判分逻辑（客观题）======
import type { QuestionType } from '@prisma/client';

function gradeObjective(
  questionType: QuestionType,
  options: unknown | null,
  correctAnswer: string | null,
  userAnswer: string,
): { isCorrect: boolean; score: number; maxScore: number; message?: string } {
  if (!correctAnswer) {
    return { isCorrect: false, score: 0, maxScore: 0, message: '无参考答案（主观题需AI判分，第二期）' };
  }
  const maxScore = 1; // 单题客观题 1 分
  switch (questionType) {
    case 'SINGLE_CHOICE': {
      const isCorrect = userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
      return { isCorrect, score: isCorrect ? maxScore : 0, maxScore };
    }
    case 'MULTI_CHOICE': {
      // 正确答案为 JSON 数组字符串；用户答案也按数组比较（排序后）
      let correctArr: string[] = [];
      let userArr: string[] = [];
      try { correctArr = JSON.parse(correctAnswer); } catch { correctArr = [correctAnswer]; }
      try { userArr = JSON.parse(userAnswer); } catch { userArr = [userAnswer]; }
      const norm = (a: string[]) => [...a].map((s) => s.trim().toUpperCase()).sort().join(',');
      const isCorrect = norm(correctArr) === norm(userArr);
      return { isCorrect, score: isCorrect ? maxScore : 0, maxScore };
    }
    case 'FILL_BLANK': {
      const norm = (s: string) => s.replace(/\s+/g, '').trim().toLowerCase();
      const isCorrect = norm(userAnswer) === norm(correctAnswer);
      return { isCorrect, score: isCorrect ? maxScore : 0, maxScore };
    }
    default:
      return { isCorrect: false, score: 0, maxScore: 0, message: '主观题暂不支持自动判分' };
  }
}

// POST /api/v1/papers/{id}/submit — 提交整张试卷作答（事务：逐题判分 + 写入记录 + 更新错题本 + 题目统计）
const SubmitSchema = z.object({
  answers: z.record(z.string(), z.string()), // questionId -> answer
  attemptId: z.string().optional(),
  usedSec: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const { answers, attemptId, usedSec } = parsed.data;

  // 校验试卷 + 拉取题目
  const paper = await prisma.practicePaper.findUnique({
    where: { id: params.id },
    select: { id: true, totalScore: true, questions: { orderBy: { sortOrder: 'asc' }, select: { questionId: true, score: true, question: { select: { questionType: true, answer: true, options: true } } } } },
  });
  if (!paper) return notFound('试卷不存在');

  // 按经验：拆分长事务。先做纯计算，再一次性写入；避免事务内循环查询
  type GradeOne = { qid: string; qtype: QuestionType; answer: string | null; options: unknown | null; perScore: number; userAns: string };
  const list: GradeOne[] = paper.questions.map((pq) => ({
    qid: pq.questionId,
    qtype: pq.question.questionType,
    answer: pq.question.answer,
    options: pq.question.options,
    perScore: pq.score,
    userAns: answers[pq.questionId] ?? '',
  }));

  const graded = list.map((g) => {
    const r = gradeObjective(g.qtype, g.options, g.answer, g.userAns);
    const actualScore = r.score * g.perScore; // 按单题分值换算
    return { ...g, isCorrect: !!r.isCorrect, objectiveScore: actualScore, maxScore: g.perScore, message: r.message };
  });

  const totalCount = graded.length;
  const correctCount = graded.filter((g) => g.isCorrect).length;
  const totalUserScore = graded.reduce((s, g) => s + g.objectiveScore, 0);

  const result = await prisma.$transaction(async (tx) => {
    // 1. 创建/更新答题尝试
    let attempt: { id: string };
    if (attemptId) {
      attempt = await tx.paperAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          score: totalUserScore,
          correctCount,
          totalCount,
        },
        select: { id: true },
      });
    } else {
      attempt = await tx.paperAttempt.create({
        data: {
          paperId: paper.id,
          studentId: user!.id,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          score: totalUserScore,
          totalScore: paper.totalScore,
          correctCount,
          totalCount,
        },
        select: { id: true },
      });
    }

    // 2. 批量写入单题答案记录
    await tx.questionAnswer.createMany({
      data: graded.map((g) => ({
        questionId: g.qid,
        studentId: user!.id,
        answer: g.userAns || null,
        score: g.objectiveScore,
        isCorrect: g.isCorrect,
        usedSec,
        attemptId: attempt.id,
      })),
    });

    // 3. 更新题目答题统计（attemptCount / correctCount）——原子 increment
    for (const g of graded) {
      await tx.question.update({
        where: { id: g.qid },
        data: {
          attemptCount: { increment: 1 },
          correctCount: { increment: g.isCorrect ? 1 : 0 },
        },
      });
    }

    // 4. 答错题目加入错题本
    for (const g of graded) {
      if (!g.isCorrect) {
        await tx.wrongRecord.upsert({
          where: { studentId_questionId: { studentId: user!.id, questionId: g.qid } },
          create: {
            studentId: user!.id,
            questionId: g.qid,
            lastWrongAnswer: g.userAns || null,
            mastered: false,
          },
          update: {
            wrongCount: { increment: 1 },
            mastered: false,
            masteredAt: null,
            lastWrongAt: new Date(),
            lastWrongAnswer: g.userAns || null,
          },
        });
      } else {
        // 答对则把错题本中的 mastered 标记为 true
        await tx.wrongRecord.updateMany({
          where: { studentId: user!.id, questionId: g.qid, mastered: false },
          data: { mastered: true, masteredAt: new Date() },
        });
      }
    }

    return attempt.id;
  });

  return ok({
    attemptId: result,
    score: totalUserScore,
    totalScore: paper.totalScore,
    correctCount,
    totalCount,
    correctRate: totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 1000) / 10,
    details: graded.map((g) => ({
      questionId: g.qid,
      questionType: g.qtype,
      userAnswer: g.userAns,
      correctAnswer: g.answer,
      isCorrect: g.isCorrect,
      score: g.objectiveScore,
      maxScore: g.maxScore,
      message: g.message,
    })),
  });
}
