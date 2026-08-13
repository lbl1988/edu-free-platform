export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden, fail } from '@/lib/api-response';
import { Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// GET /api/v1/ai-gen/tasks/{id} — 查询AI生成任务状态与结果
export async function GET(_request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(_request);
  if (err) return err as unknown as Response;

  if (user!.role !== Role.ADMIN && user!.role !== Role.TEACHER) {
    return forbidden('需要教师或管理员权限') as unknown as Response;
  }

  const taskId = params.id;
  if (!taskId) return fail('BAD_REQUEST', '缺少任务ID参数', 400) as unknown as Response;

  const task = await prisma.aIGenTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      genType: true,
      params: true,
      status: true,
      result: true,
      errorMessage: true,
      createdAt: true,
      processedAt: true,
    },
  });

  if (!task) return notFound('任务不存在') as unknown as Response;

  return ok({ task }) as unknown as Response;
}
