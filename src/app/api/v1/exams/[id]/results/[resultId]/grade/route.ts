export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok, notFound, forbidden, badRequest } from '@/lib/api-response';
import { ExamStatus } from '@prisma/client';

type Ctx = { params: { id: string; resultId: string } };

const GradeSchema = z.object({
  // key: examQuestionId → 分数
  scores: z.record(z.string(), z.number().min(0)),
  remark: z.string().max(500).optional(),
});

// POST /api/v1/exams/{id}/results/{resultId}/grade — 教师/管理员手动批改主观题得分
export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest('请求体格式错误'); }
  const parsed = GradeSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const { scores } = parsed.data;

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true },
  });
  if (!exam) return notFound('考试不存在');
  if (exam.creatorId !== user!.id && user!.role !== 'ADMIN') return forbidden('无权批改');

  const result = await prisma.examResult.findUnique({
    where: { id: params.resultId },
    include: {
      answers: { include: { examQuestion: { select: { id: true, questionType: true, perScore: true } } } },
    },
  });
  if (!result || result.examId !== params.id) return notFound('答题记录不存在');
  if (result.status === ExamStatus.NOT_STARTED || result.status === ExamStatus.IN_PROGRESS) {
    return badRequest('学生尚未交卷');
  }

  const objectiveTypes = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'FILL_BLANK'];
  const answerMap = new Map(result.answers.map((a) => [a.examQuestionId, a]));

  // 输入校验
  for (const [qid, score] of Object.entries(scores)) {
    const a = answerMap.get(qid);
    if (!a) return badRequest(`未知题目 ${qid}`);
    if (score > a.examQuestion.perScore) {
      return badRequest(`题目 ${qid} 分数超过满分 ${a.examQuestion.perScore}`);
    }
    if (objectiveTypes.includes(a.examQuestion.questionType)) {
      return badRequest(`客观题 ${qid}（${a.examQuestion.questionType}）不可手动修改`);
    }
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    let subjectiveTotal = 0;
    // 逐题更新 finalScore
    for (const a of result.answers) {
      const manual = scores[a.examQuestionId];
      if (typeof manual === 'number') {
        subjectiveTotal += manual;
        await tx.examAnswer.update({
          where: { id: a.id },
          data: {
            finalScore: manual,
            isCorrect: manual === a.examQuestion.perScore ? true : manual === 0 ? false : a.isCorrect,
          },
        });
      } else {
        subjectiveTotal += typeof a.finalScore === 'number' ? a.finalScore : 0;
      }
    }
    const objectiveTotal = typeof result.objectiveScore === 'number' ? result.objectiveScore : 0;
    const total = objectiveTotal + subjectiveTotal;
    return tx.examResult.update({
      where: { id: result.id },
      data: {
        subjectiveScore: subjectiveTotal,
        score: total,
        graded: true,
        gradedBy: user!.id,
        gradedAt: now,
        status: ExamStatus.GRADED,
      },
    });
  });

  return ok({
    resultId: updated.id,
    score: updated.score,
    objectiveScore: updated.objectiveScore,
    subjectiveScore: updated.subjectiveScore,
    graded: updated.graded,
    status: updated.status,
  });
}
