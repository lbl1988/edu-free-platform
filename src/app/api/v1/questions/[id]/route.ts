import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { QuestionType, ReviewStatus } from '@prisma/client';

const QUESTION_INCLUDE = {
  subject: { select: { id: true, name: true } },
  chapter: { select: { id: true, title: true, parentId: true } },
} as const;

type Ctx = { params: { id: string } };

// GET /api/v1/questions/{id} — 题目详情（含作答记录/收藏/错题标记，便于前端渲染状态）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: QUESTION_INCLUDE,
  });
  if (!question) return notFound('题目不存在');

  // 查询当前用户相关状态（错题/收藏/最近一次答题）
  const [wrongRecord, favorite, lastAnswer] = await Promise.all([
    prisma.wrongRecord.findUnique({
      where: { studentId_questionId: { studentId: user!.id, questionId: params.id } },
      select: { mastered: true, wrongCount: true },
    }),
    prisma.favorite.findUnique({
      where: { studentId_questionId: { studentId: user!.id, questionId: params.id } },
      select: { id: true },
    }),
    prisma.questionAnswer.findFirst({
      where: { questionId: params.id, studentId: user!.id },
      orderBy: { createdAt: 'desc' },
      select: { answer: true, isCorrect: true, score: true, createdAt: true },
    }),
  ]);

  return ok({ question, wrongRecord, favorited: !!favorite, lastAnswer });
}

const UpdateSchema = z.object({
  content: z.string().min(2).max(10000).optional(),
  options: z.array(z.string()).optional(),
  answer: z.string().max(4000).optional().nullable(),
  analysis: z.string().max(4000).optional().nullable(),
  difficulty: z.number().int().min(1).max(5).optional(),
  chapterId: z.string().nullable().optional(),
  questionType: z.nativeEnum(QuestionType).optional(),
  reviewStatus: z.nativeEnum(ReviewStatus).optional(),
});

// PUT /api/v1/questions/{id} — 更新题目（仅创建者可修改？简化：教师/管理员均可，权限体系后续细化）
export async function PUT(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== 'TEACHER' && user!.role !== 'ADMIN') {
    return forbidden('需要教师或管理员权限');
  }

  const q = await prisma.question.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!q) return notFound('题目不存在');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const data = parsed.data;

  const updated = await prisma.question.update({
    where: { id: params.id },
    data: {
      ...data,
      options: data.options ? (data.options as unknown as any[]) : data.options,
    },
  });

  return ok(updated);
}
