import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
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

export const dynamic = 'force-dynamic';

