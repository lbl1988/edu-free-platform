import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound } from '@/lib/api-response';

type Ctx = { params: { lessonId: string } };

// GET /api/v1/lessons/{lessonId}/note — 当前学生在该课时的笔记（唯一）
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const note = await prisma.note.findUnique({
    where: { lessonId_studentId: { lessonId: params.lessonId, studentId: user!.id } },
  });
  return ok(note); // 可能为 null（未记笔记）
}

const UpsertSchema = z.object({
  content: z.string().max(10000),
  anchorSec: z.number().int().min(0).optional(),
});

// PUT /api/v1/lessons/{lessonId}/note — 创建或更新笔记（upsert）
export async function PUT(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  // 校验课时存在
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { id: true, courseId: true },
  });
  if (!lesson) return notFound('课时不存在');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());

  const note = await prisma.note.upsert({
    where: { lessonId_studentId: { lessonId: params.lessonId, studentId: user!.id } },
    create: { ...parsed.data, lessonId: params.lessonId, studentId: user!.id },
    update: { content: parsed.data.content, anchorSec: parsed.data.anchorSec },
  });

  return ok(note);
}

// DELETE /api/v1/lessons/{lessonId}/note — 删除笔记
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  await prisma.note.deleteMany({
    where: { lessonId: params.lessonId, studentId: user!.id },
  });
  return ok({ message: '笔记已删除' });
}
