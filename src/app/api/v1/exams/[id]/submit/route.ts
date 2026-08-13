import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, badRequest, forbidden } from '@/lib/api-response';
import { ExamStatus, Role, QuestionType } from '@prisma/client';
import { getClientIp } from '@/lib/utils';

type Ctx = { params: { id: string } };

const SubmitSchema = z.object({
  resultId: z.string(),
  // key: examQuestionId, value: 作答内容
  answers: z.record(z.string(), z.string()),
  // 可选：前端记录的每道题耗时（秒），用于检测秒答
  questionUsedSec: z.record(z.string(), z.number().int()).optional(),
});

// ============ 判分逻辑（与 practice 类似，但题目来自 ExamQuestion 快照）============
function gradeObjective(
  questionType: QuestionType,
  options: unknown | null,
  correctAnswer: string | null,
  userAnswer: string,
): { isCorrect: boolean; message?: string } {
  if (!correctAnswer) return { isCorrect: false, message: '无参考答案（主观题需手动批改）' };
  switch (questionType) {
    case 'SINGLE_CHOICE': {
      const isCorrect = userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
      return { isCorrect };
    }
    case 'MULTI_CHOICE': {
      let correctArr: string[] = [];
      let userArr: string[] = [];
      try { correctArr = JSON.parse(correctAnswer); } catch { correctArr = [correctAnswer]; }
      try { userArr = JSON.parse(userAnswer); } catch { userArr = [userAnswer]; }
      const norm = (a: string[]) => a.map((s) => s.trim().toUpperCase()).sort().join(',');
      return { isCorrect: norm(correctArr) === norm(userArr) };
    }
    case 'FILL_BLANK': {
      const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
      return { isCorrect: norm(userAnswer) === norm(correctAnswer) };
    }
    default:
      return { isCorrect: false, message: '主观题，待教师手动批改' };
  }
}

// POST /api/v1/exams/{id}/submit — 学生交卷
// 按经验拆分：先纯计算判分 → 事务一次性写入；避免事务内循环查询
export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return badRequest('仅学生可交卷');

  let body: unknown;
  try { body = await request.json(); }
  catch { return badRequest('请求体格式错误'); }
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const { resultId, answers, questionUsedSec } = parsed.data;

  // 1. 拉取考试配置 + 学生结果 + 全部考试题目快照（一次性）
  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: {
      id: true, aiAutoGrade: true, totalScore: true,
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, questionType: true, options: true, answer: true, perScore: true },
      },
    },
  });
  if (!exam) return notFound('考试不存在');

  const result = await prisma.examResult.findUnique({
    where: { id: resultId },
    select: { id: true, examId: true, studentId: true, status: true, deadline: true, startTime: true, cheatingCount: true, totalCount: true },
  });
  if (!result) return notFound('答题记录不存在');
  if (result.studentId !== user!.id) return forbidden('不是你的试卷');
  if (result.examId !== params.id) return badRequest('考试ID不匹配');
  if (result.status === ExamStatus.SUBMITTED || result.status === ExamStatus.GRADED || result.status === ExamStatus.VIOLATION_SUBMIT) {
    return badRequest('已交卷，不可重复提交');
  }
  if (result.status !== ExamStatus.IN_PROGRESS) return badRequest('请先开始考试');

  // 2. 判分（纯计算）
  const graded = exam.questions.map((q) => {
    const userAns = answers[q.id] ?? '';
    const r = exam.aiAutoGrade
      ? gradeObjective(q.questionType, q.options, q.answer, userAns)
      : { isCorrect: false, message: '已关闭自动评分' };
    const perScore = q.perScore;
    const isObjective = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'FILL_BLANK'].includes(q.questionType);
    const objScore = r.isCorrect && isObjective ? perScore : 0;
    const used = questionUsedSec?.[q.id];
    const fast = typeof used === 'number' && used < 3;
    return {
      examQuestionId: q.id,
      perScore,
      questionType: q.questionType,
      userAns: userAns || null,
      isObjective,
      isCorrect: r.isCorrect,
      objectiveScore: objScore,
      fast,
      message: r.message,
    };
  });

  const objectiveTotal = graded.reduce((s, g) => s + g.objectiveScore, 0);
  const correctCount = graded.filter((g) => g.isCorrect).length;
  const now = new Date();
  const ip = getClientIp(request);

  // 3. 逾期检查 + 快速答题作弊收集
  let overdue = false;
  if (result.deadline && now > result.deadline) overdue = true;
  const fastAnswers = graded.filter((g) => g.fast);

  // 4. 事务写入（按经验：createMany/批量答案 + 更新 result + 违规事件）
  const finalScore = exam.aiAutoGrade ? objectiveTotal : null;
  const finalStatus = overdue
    ? ExamStatus.SUBMITTED // 逾期也收卷
    : result.cheatingCount >= exam.maxCheating && exam.questions.length > 0
      ? ExamStatus.VIOLATION_SUBMIT
      : ExamStatus.SUBMITTED;

  const summary = await prisma.$transaction(async (tx) => {
    // 4.1 批量写入答案
    await tx.examAnswer.createMany({
      data: graded.map((g) => ({
        resultId,
        examQuestionId: g.examQuestionId,
        answer: g.userAns,
        isCorrect: g.isObjective ? g.isCorrect : undefined,
        aiScore: g.isObjective ? g.objectiveScore : undefined,
        finalScore: g.isObjective ? g.objectiveScore : undefined,
        perScore: g.perScore,
        answeredFast: g.fast,
      })),
    });

    // 4.2 批量新增 fast_answer 违规
    if (fastAnswers.length > 0) {
      await tx.examViolation.createMany({
        data: fastAnswers.map((g) => ({
          resultId,
          type: 'fast_answer',
          detail: `examQuestionId=${g.examQuestionId}`,
        })),
      });
    }
    // 4.3 逾期违规
    let newCheating = result.cheatingCount + fastAnswers.length + (overdue ? 1 : 0);
    if (overdue) {
      await tx.examViolation.create({
        data: { resultId, type: 'overdue', detail: `提交超截止时间 ${Math.round((now.getTime() - (result.deadline?.getTime() ?? now.getTime())) / 1000)}s` },
      });
    }

    // 4.4 更新 result 得分/状态/时间线
    const totalSubjective = graded.filter((g) => !g.isObjective).reduce((s, g) => s + g.perScore, 0);
    const updated = await tx.examResult.update({
      where: { id: resultId },
      data: {
        status: newCheating >= exam.maxCheating && exam.questions.length > 0 ? ExamStatus.VIOLATION_SUBMIT : finalStatus,
        submitTime: now,
        endIp: ip,
        score: finalScore,
        objectiveScore: objectiveTotal,
        subjectiveScore: exam.aiAutoGrade ? totalSubjective : null, // 主观题默认未批改=全失；或null表示未判
        correctCount,
        totalCount: graded.length,
        cheatingCount: newCheating,
        graded: exam.aiAutoGrade && totalSubjective === 0, // 纯客观题=已批改
      },
    });
    return updated;
  });

  return ok({
    resultId: summary.id,
    status: summary.status,
    score: summary.score,
    totalScore: summary.totalScore,
    objectiveScore: summary.objectiveScore,
    subjectiveScore: summary.subjectiveScore,
    correctCount,
    totalCount: summary.totalCount,
    correctRate: summary.totalCount === 0 ? 0 : Math.round((correctCount / summary.totalCount) * 1000) / 10,
    graded: summary.graded,
    cheatingCount: summary.cheatingCount,
    overdue,
    details: graded.map((g) => ({
      examQuestionId: g.examQuestionId,
      questionType: g.questionType,
      isCorrect: g.isCorrect,
      objectiveScore: g.objectiveScore,
      perScore: g.perScore,
      fast: g.fast,
      message: g.message,
    })),
  });
}
