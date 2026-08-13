export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, badRequest } from '@/lib/api-response';
import { ExamStatus, Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// POST /api/v1/exams/{id}/violation — 学生端前端回调上报作弊事件
// 由浏览器 visibilitychange/copy/fullscreenchange 等事件触发
export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return badRequest('仅学生端');

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, maxCheating: true },
  });
  if (!exam) return notFound('考试不存在');

  const result = await prisma.examResult.findUnique({
    where: { examId_studentId: { examId: params.id, studentId: user!.id } },
    select: { id: true, status: true, cheatingCount: true },
  });
  if (!result) return notFound('尚未开始考试');
  if (result.status !== ExamStatus.IN_PROGRESS) return badRequest('当前状态不允许上报');

  let body: { type?: string; detail?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  if (!body.type) return badRequest('缺少 type 字段');

  const newCount = result.cheatingCount + 1;
  const overLimit = exam.maxCheating > 0 && newCount >= exam.maxCheating;

  const txResult = await prisma.$transaction(async (tx) => {
    const v = await tx.examViolation.create({
      data: { resultId: result.id, type: body.type as string, detail: body.detail },
    });
    let status = result.status;
    const now = new Date();
    let submitTime: Date | undefined;
    if (overLimit) {
      status = ExamStatus.VIOLATION_SUBMIT;
      submitTime = now;
    }
    await tx.examResult.update({
      where: { id: result.id },
      data: { cheatingCount: newCount, status, submitTime },
    });
    return {
      violationId: v.id,
      overLimit,
      newCount,
      maxAllowed: exam.maxCheating,
      remaining: Math.max(0, exam.maxCheating - newCount),
      status,
    };
  });

  if (overLimit) {
    return ok({ ...txResult, message: '违规次数超限，本次考试已自动标记为违规提交' });
  }
  return ok(txResult);
}
