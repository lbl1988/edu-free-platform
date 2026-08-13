export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { LightRAGUnavailableError, lightrag } from '@/lib/lightrag';
import { Role } from '@prisma/client';

const TriggerSchema = z.object({
  courseId: z.string().min(1),
  materialIds: z.array(z.string().min(1)).optional(),
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
  const parsed = TriggerSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('参数校验失败', parsed.error.flatten());
  }
  const { courseId, materialIds } = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, teacherId: true },
  });
  if (!course) {
    return notFound('课程不存在');
  }
  if (course.teacherId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅课程创建者或管理员可触发索引');
  }

  let materials: { id: string; objectKey: string; fileType: string }[];
  if (materialIds && materialIds.length > 0) {
    materials = await prisma.material.findMany({
      where: {
        courseId,
        id: { in: materialIds },
      },
      select: { id: true, objectKey: true, fileType: true },
    });
  } else {
    materials = await prisma.material.findMany({
      where: { courseId },
      select: { id: true, objectKey: true, fileType: true },
    });
  }

  const workspaceId = `course-${courseId}`;
  const tasks: Array<{
    materialId: string;
    taskId?: string;
    status: string;
    error?: string;
  }> = [];
  const errors: Array<{ materialId: string; message: string }> = [];

  for (const m of materials) {
    try {
      const result = await lightrag.insertDocument({
        workspaceId,
        objectKey: m.objectKey,
        docType: m.fileType,
      });
      tasks.push({
        materialId: m.id,
        taskId: result.taskId,
        status: result.status,
      });
    } catch (e) {
      const message =
        e instanceof LightRAGUnavailableError
          ? 'RAG_SERVICE_UNAVAILABLE'
          : e instanceof Error
            ? e.message
            : String(e);
      tasks.push({
        materialId: m.id,
        status: 'FAILED',
        error: message,
      });
      errors.push({ materialId: m.id, message });
    }
  }

  const data: any = {
    courseId,
    workspaceId,
    total: materials.length,
    tasks,
  };
  if (errors.length > 0) {
    data.errors = errors;
  }

  return ok(data);
}
