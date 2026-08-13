export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin, requireTeacher } from '@/lib/guards';
import { getCurrentUser } from '@/lib/auth-context';
import { ok, okPaginated, badRequest, notFound, forbidden } from '@/lib/api-response';
import { ExamType, CourseStatus, Role } from '@prisma/client';

// GET /api/v1/exams — 考试列表
// 匿名/学生：仅看已发布考试；教师：自己创建的全部 + 他人已发布；管理员：全部
export async function GET(request: NextRequest) {
  const maybeUser = await getCurrentUser(request);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const subjectId = searchParams.get('subjectId');
  const grade = searchParams.get('grade');
  const examType = searchParams.get('examType') as ExamType | null;

  const where: Record<string, unknown> = {};
  if (subjectId) where.subjectId = Number(subjectId);
  if (grade) where.grade = Number(grade);
  if (examType) where.examType = examType;

  if (!maybeUser || maybeUser.role === Role.STUDENT) {
    // 匿名用户和学生：仅看已发布考试
    where.status = CourseStatus.PUBLISHED;
  } else if (maybeUser.role === Role.TEACHER) {
    // 教师：自己创建的全部 + 他人已发布
    where.OR = [{ status: CourseStatus.PUBLISHED }, { creatorId: maybeUser.id }];
  }
  // ADMIN 看全部，不追加过滤

  const [total, rawItems] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true } },
        creator: { select: { id: true, nickname: true } },
        _count: { select: { questions: true, results: true } },
      },
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // 已登录学生：附带自己的 result 状态
  let items = rawItems as any[];
  if (maybeUser && maybeUser.role === Role.STUDENT && rawItems.length > 0) {
    const examIds = rawItems.map((e) => e.id);
    const myResults = await prisma.examResult.findMany({
      where: { examId: { in: examIds }, studentId: maybeUser.id },
      select: {
        id: true, examId: true, status: true, submitTime: true,
        score: true, cheatingCount: true, graded: true,
      },
    });
    const map = new Map(myResults.map((r) => [r.examId, r]));
    items = rawItems.map((e) => ({ ...e, myResult: map.get(e.id) ?? null }));
  } else {
    // 匿名/教师/管理员：统一 myResult 为 null
    items = rawItems.map((e) => ({ ...e, myResult: null }));
  }

  return okPaginated({ exams: items }, { page, limit, total });
}

// POST /api/v1/exams — 创建考试（仅教师/管理员）
// 支持两种来源：fromQuestionIds (直接指定题库题数组) / fromPaperId (从试卷复制)
const CreateSchema = z.object({
  title: z.string().min(2).max(120),
  examType: z.nativeEnum(ExamType).default(ExamType.MOCK),
  subjectId: z.number().int(),
  grade: z.number().int().min(1).max(12),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  duration: z.number().int().min(1).max(600), // 分钟
  maxCheating: z.number().int().min(0).default(3),
  status: z.nativeEnum(CourseStatus).default(CourseStatus.DRAFT),
  aiAutoGrade: z.boolean().default(true),
  passScore: z.number().min(0).optional(),
  retryAllowed: z.number().int().min(0).default(0),
  perScore: z.number().int().min(1).max(100).default(5),
  // 题目来源（三选一）
  fromPaperId: z.string().optional(),
  fromQuestionIds: z.array(z.string()).optional(),
  // or 空：允许手动选题，但禁止 totally empty（至少选一种来源）
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  // 时间校验
  const start = new Date(p.startTime);
  const end = new Date(p.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return badRequest('时间格式错误');
  if (end <= start) return badRequest('结束时间需晚于开始时间');
  // duration 必须不超过 [start, end] 窗口
  if (p.duration * 60 * 1000 > (end.getTime() - start.getTime())) {
    return badRequest('考试时长不可超过允许进入的时间窗口');
  }

  // 必须有题目来源
  if (!p.fromPaperId && (!p.fromQuestionIds || p.fromQuestionIds.length === 0)) {
    return badRequest('必须指定 fromPaperId 或 fromQuestionIds 题目来源');
  }

  // 按经验：抽取 include/select 常量；此处先批量拉取题目数据，再一次性 create
  const includeQuestions = {
    select: { id: true, content: true, options: true, questionType: true, difficulty: true, answer: true, analysis: true },
  } as const;

  let qList: Array<{ id: string; content: string; options: unknown | null; questionType: any; difficulty: number; answer: string | null; analysis: string | null }> = [];

  if (p.fromPaperId) {
    const paper = await prisma.practicePaper.findUnique({
      where: { id: p.fromPaperId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: includeQuestions },
        },
      },
    });
    if (!paper) return notFound('来源练习卷不存在');
    qList = paper.questions
      .map((pq) => pq.question)
      .filter((q): q is NonNullable<typeof q> => !!q);
  } else if (p.fromQuestionIds) {
    const qs = await prisma.question.findMany({
      where: { id: { in: p.fromQuestionIds } },
      ...includeQuestions,
    });
    if (qs.length !== p.fromQuestionIds.length) {
      return badRequest(`有 ${p.fromQuestionIds.length - qs.length} 道题不存在`);
    }
    qList = qs;
  }

  const totalScore = qList.length * p.perScore;

  // 事务：创建考试 + 批量插入 ExamQuestion 快照
  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        title: p.title,
        examType: p.examType,
        subjectId: p.subjectId,
        grade: p.grade,
        startTime: start,
        endTime: end,
        duration: p.duration,
        maxCheating: p.maxCheating,
        creatorId: user!.id,
        sourcePaperId: p.fromPaperId,
        totalScore,
        status: p.status,
        retryAllowed: p.retryAllowed,
        aiAutoGrade: p.aiAutoGrade,
        passScore: p.passScore,
      },
    });
    if (qList.length > 0) {
      await tx.examQuestion.createMany({
        data: qList.map((q, i) => ({
          examId: created.id,
          srcQuestionId: q.id,
          content: q.content,
          options: q.options as any,
          questionType: q.questionType,
          difficulty: q.difficulty,
          answer: q.answer,
          analysis: q.analysis,
          sortOrder: i,
          perScore: p.perScore,
        })),
      });
    }
    return created;
  });

  return ok({ exam, totalQuestions: qList.length, totalScore }, 201);
}
