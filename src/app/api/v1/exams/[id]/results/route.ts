import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin, requireTeacher } from '@/lib/guards';
import { ok, notFound, forbidden, badRequest, okPaginated } from '@/lib/api-response';
import { Role } from '@prisma/client';

type CtxExam = { params: { id: string } };
type CtxResult = { params: { id: string; resultId: string } };

// ============== 考试结果列表（教师/管理员视角）==============
// GET /api/v1/exams/{id}/results — 查看一场考试的全部学生成绩
export async function GET_results(request: NextRequest, { params }: CtxExam) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true, title: true },
  });
  if (!exam) return notFound('考试不存在');
  if (exam.creatorId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅考试创建者或管理员可查成绩');
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const status = searchParams.get('status');

  const where: Record<string, unknown> = { examId: params.id };
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    prisma.examResult.count({ where }),
    prisma.examResult.findMany({
      where,
      include: {
        student: { select: { id: true, nickname: true, grade: true } },
        violations: { orderBy: { occurredAt: 'desc' }, select: { id: true, type: true, occurredAt: true } },
      },
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { submitTime: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(
    { exam, results: items },
    { page, limit, total },
  );
}

// ============== 学生视角：我的考试结果 ==============
// GET /api/v1/exams/{id}/result — 学生查看自己本次考试的结果（含答案、得分）
export async function GET_mine(request: NextRequest, { params }: CtxExam) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return badRequest('仅学生可查看自己的结果');

  const result = await prisma.examResult.findUnique({
    where: { examId_studentId: { examId: params.id, studentId: user!.id } },
    include: {
      exam: { select: { id: true, title: true, duration: true, totalScore: true, aiAutoGrade: true, maxCheating: true, creator: { select: { nickname: true } } } },
      answers: {
        orderBy: { answeredAt: 'asc' },
        include: {
          examQuestion: {
            select: { id: true, sortOrder: true, perScore: true, questionType: true, content: true, options: true, answer: true, analysis: true },
          },
        },
      },
      violations: { orderBy: { occurredAt: 'asc' }, select: { id: true, type: true, detail: true, occurredAt: true } },
    },
  });
  if (!result) return notFound('未找到考试结果，请先开始考试');

  return ok({ result });
}

// ============== 教师批改主观题 ==============
const GradeSchema = z.object({
  // key: examQuestionId (主观题), value: 分数（0..perScore）
  scores: z.record(z.string(), z.number().min(0)),
  remark: z.string().max(500).optional(),
});

// POST /api/v1/exams/{id}/results/{resultId}/grade — 教师/管理员手动给主观题打分
export async function POST_grade(request: NextRequest, { params }: CtxResult) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  let body: unknown;
  try { body = await request.json(); } catch { return badRequest('请求体格式错误'); }
  const parsed = GradeSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const { scores } = parsed.data;

  // 校验考试创建者或管理员
  const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { creatorId: true } });
  if (!exam) return notFound('考试不存在');
  if (exam.creatorId !== user!.id && user!.role !== Role.ADMIN) return forbidden('无权批改');

  // 取 result 及其 answers
  const result = await prisma.examResult.findUnique({
    where: { id: params.resultId },
    include: {
      answers: { include: { examQuestion: { select: { id: true, questionType: true, perScore: true } } } },
    },
  });
  if (!result || result.examId !== params.id) return notFound('答题记录不存在');

  // 校验：每道题分数不超过 perScore，且只改主观题（ESSAY/CODING/FILL_BLANK未存答案的）
  const objectiveTypes = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'FILL_BLANK'];
  const answerMap = new Map(result.answers.map((a) => [a.examQuestionId, a]));
  for (const [qid, s] of Object.entries(scores)) {
    const a = answerMap.get(qid);
    if (!a) return badRequest(`未知题目 ${qid}`);
    if (s > a.examQuestion.perScore) {
      return badRequest(`题目 ${qid} 分数超过满分 ${a.examQuestion.perScore}`);
    }
    if (objectiveTypes.includes(a.examQuestion.questionType) && a.isCorrect !== null) {
      // 客观题已自动判分，不允许教师篡改
      return badRequest(`客观题 ${qid} 已自动评分，不可手动修改`);
    }
  }

  const now = new Date();
  // 事务：逐题更新答案分数 → 汇总 → 更新 result
  const summary = await prisma.$transaction(async (tx) => {
    let subjectiveTotal = 0;
    let newTotal = 0;
    for (const ans of result.answers) {
      const manual = scores[ans.examQuestionId];
      if (typeof manual === 'number') {
        subjectiveTotal += manual;
        await tx.examAnswer.update({
          where: { id: ans.id },
          data: {
            finalScore: manual,
            aiScore: typeof ans.aiScore === 'number' ? ans.aiScore : undefined,
            isCorrect: manual === ans.examQuestion.perScore ? true : manual === 0 ? false : ans.isCorrect,
          },
        });
      } else {
        subjectiveTotal += typeof ans.finalScore === 'number' ? ans.finalScore : 0;
      }
      newTotal += typeof ans.finalScore === 'number'
        ? ans.finalScore
        : (typeof ans.aiScore === 'number' ? ans.aiScore : 0) + (scores[ans.examQuestionId] ?? 0);
    }
    const objective = typeof result.objectiveScore === 'number' ? result.objectiveScore : 0;
    const total = objective + subjectiveTotal;
    const updated = await tx.examResult.update({
      where: { id: result.id },
      data: {
        subjectiveScore: subjectiveTotal,
        score: total,
        graded: true,
        gradedBy: user!.id,
        gradedAt: now,
        status: 'GRADED' as any,
      },
    });
    return { ...updated, computedTotal: total };
  });

  return ok({ resultId: summary.id, score: summary.score, subjectiveScore: summary.subjectiveScore, graded: summary.graded });
}

// 两个不同路径分开导出：Next.js 需要目录层级区分
// ——本文件仅实现 /exams/{id}/results 列表 ——
export { GET_results as GET };

// —— /exams/{id}/result（单数，学生自己的结果）放在同级 route 单独文件 ——
void GET_mine;
// —— /exams/{id}/results/{resultId}/grade 放在独立目录 ——
void POST_grade;
