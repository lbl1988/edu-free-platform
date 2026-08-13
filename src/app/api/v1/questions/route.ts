export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin, requireTeacher } from '@/lib/guards';
import { ok, okPaginated, badRequest, notFound } from '@/lib/api-response';
import { QuestionType, ReviewStatus } from '@prisma/client';

// —— 查询常量（按经验：集中维护 include，避免字段名与 schema 不一致）——
const QUESTION_INCLUDE = {
  subject: { select: { id: true, name: true } },
  chapter: { select: { id: true, title: true, parentId: true } },
} as const;

// GET /api/v1/questions — 题目列表（分页+多维度筛选）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const subjectId = searchParams.get('subjectId');
  const grade = searchParams.get('grade');
  const chapterId = searchParams.get('chapterId');
  const difficulty = searchParams.get('difficulty');
  const questionType = searchParams.get('questionType') as QuestionType | null;
  const source = searchParams.get('source');
  const keyword = searchParams.get('keyword')?.trim();
  // 学生仅看已审核；教师/管理员看全部
  const reviewStatus = searchParams.get('reviewStatus') as ReviewStatus | null;

  const where: Record<string, unknown> = {};
  if (subjectId) where.subjectId = Number(subjectId);
  if (grade) where.grade = Number(grade);
  if (chapterId) where.chapterId = chapterId;
  if (difficulty) where.difficulty = Number(difficulty);
  if (questionType) where.questionType = questionType;
  if (source) where.source = source;
  if (keyword) where.content = { contains: keyword, mode: 'insensitive' };

  if (user!.role === 'STUDENT') {
    where.reviewStatus = ReviewStatus.AI_PASSED; // 学生看 AI 通过的（含管理员/专家通过更好，后续按需扩展）
  } else if (reviewStatus) {
    where.reviewStatus = reviewStatus;
  }

  const [total, items] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: QUESTION_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(items, { page, limit, total });
}

const CreateSchema = z.object({
  content: z.string().min(2).max(10000),
  options: z.array(z.string()).optional(),
  answer: z.string().max(4000).optional(),
  analysis: z.string().max(4000).optional(),
  videoUrl: z.string().url().optional(),
  difficulty: z.number().int().min(1).max(5),
  subjectId: z.number().int(),
  grade: z.number().int().min(1).max(12).optional(),
  chapterId: z.string().optional(),
  questionType: z.nativeEnum(QuestionType),
  source: z.string().optional(),
  sourceYear: z.number().int().optional(),
  aiGenerated: z.boolean().default(false),
});

// POST /api/v1/questions — 创建题目（教师/管理员）
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

  const subject = await prisma.subject.findUnique({ where: { id: parsed.data.subjectId } });
  if (!subject) return badRequest('学科不存在');

  const question = await prisma.question.create({
    data: {
      ...parsed.data,
      options: parsed.data.options ? (parsed.data.options as unknown as any[]) : undefined,
    },
    include: QUESTION_INCLUDE,
  });

  return ok(question, 201);
}
