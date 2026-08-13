export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireTeacher } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

type Ctx = { params: { lessonId: string } };

const TranscodeStatusEnum = z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']);

const UpdateSchema = z.object({
  durationSec: z.number().int().min(0).optional(),
  hlsKey: z.string().optional(),
  subtitleUrl: z.string().optional(),
  transcodeStatus: TranscodeStatusEnum.optional(),
});

export async function PUT(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireTeacher(request);
  if (err) return err;

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: {
      id: true,
      course: { select: { id: true, teacherId: true } },
    },
  });
  if (!lesson) return notFound('课时不存在');
  if (lesson.course.teacherId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅课程创建者或管理员可修改');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const data = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (data.durationSec !== undefined) updateData.durationSec = data.durationSec;
  if (data.hlsKey !== undefined) updateData.hlsKey = data.hlsKey;
  if (data.subtitleUrl !== undefined) updateData.subtitleUrl = data.subtitleUrl;
  if (data.transcodeStatus !== undefined) updateData.transcodeStatus = data.transcodeStatus;

  const video = await prisma.video.upsert({
    where: { lessonId: params.lessonId },
    update: updateData,
    create: {
      lessonId: params.lessonId,
      objectKey: '',
      ...updateData,
    },
  });

  if (data.durationSec !== undefined) {
    await prisma.lesson.update({
      where: { id: params.lessonId },
      data: { durationSec: data.durationSec },
    });
  }

  return ok({ video });
}
