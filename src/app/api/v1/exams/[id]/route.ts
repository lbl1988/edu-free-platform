import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden, badRequest } from '@/lib/api-response';
import { CourseStatus, Role } from '@prisma/client';

type Ctx = { params: { id: string } };

const EXAM_INCLUDE = {
  subject: { select: { id: true, name: true } },
  creator: { select: { id: true, nickname: true } },
  questions: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true, sortOrder: true, perScore: true,
      // 考试发布后：学生进入前不展示答案与解析（开始考试接口才下发，防泄漏）
      questionType: true, content: true, options: true, difficulty: true,
    },
  },
  _count: { select: { questions: true, results: true } },
} as const;

// GET /api/v1/exams/{id} — 考试详情（含题目列表。学生端仅进入考试后下发答案；此处默认不下发答案）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: EXAM_INCLUDE,
  });
  if (!exam) return notFound('考试不存在');

  // 权限：草稿仅创建者或管理员可见；归档不可见
  if (exam.status === CourseStatus.DRAFT && exam.creatorId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('考试未发布');
  }

  // 学生获取自己的 result 状态
  let myResult: unknown = null;
  if (user!.role === Role.STUDENT) {
    myResult = await prisma.examResult.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: user!.id } },
      select: {
        id: true, status: true, startTime: true, submitTime: true,
        score: true, objectiveScore: true, subjectiveScore: true,
        cheatingCount: true, graded: true,
      },
    });
  }

  return ok({ exam, myResult });
}

// PATCH /api/v1/exams/{id} — 修改考试（草稿发布 / 标题 / 时间等；仅创建者或管理员）
const UpdateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  status: z.nativeEnum(CourseStatus).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  duration: z.number().int().min(1).max(600).optional(),
  maxCheating: z.number().int().min(0).optional(),
  aiAutoGrade: z.boolean().optional(),
  retryAllowed: z.number().int().min(0).optional(),
  passScore: z.number().min(0).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.ADMIN && user!.role !== Role.TEACHER) {
    return forbidden('仅教师或管理员可修改考试');
  }

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return notFound('考试不存在');
  if (exam.creatorId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅创建者或管理员可修改该考试');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  const data: Record<string, unknown> = {};
  if (p.title) data.title = p.title;
  if (p.status) data.status = p.status;
  if (p.duration !== undefined) data.duration = p.duration;
  if (p.maxCheating !== undefined) data.maxCheating = p.maxCheating;
  if (p.aiAutoGrade !== undefined) data.aiAutoGrade = p.aiAutoGrade;
  if (p.retryAllowed !== undefined) data.retryAllowed = p.retryAllowed;
  if (p.passScore !== undefined) data.passScore = p.passScore;
  if (p.startTime) data.startTime = new Date(p.startTime);
  if (p.endTime) data.endTime = new Date(p.endTime);

  // 发布校验：从草稿发布时，进入时段必须尚未结束
  if (p.status === CourseStatus.PUBLISHED && exam.status !== CourseStatus.PUBLISHED) {
    const end = p.endTime ? new Date(p.endTime) : exam.endTime;
    if (end.getTime() <= Date.now()) {
      return badRequest('考试进入时段已结束，无法发布');
    }
  }

  const updated = await prisma.exam.update({ where: { id: params.id }, data });
  return ok({ exam: updated });
}

export const dynamic = 'force-dynamic';

