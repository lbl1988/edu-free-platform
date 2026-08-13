export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, notFound, forbidden } from '@/lib/api-response';
import { CourseStatus, Role } from '@prisma/client';

type Ctx = { params: { lessonId: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      course: {
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, nickname: true, avatarUrl: true } },
        },
      },
      chapter: { select: { id: true, title: true, parentId: true, textbookId: true } },
      video: {
        select: {
          id: true,
          objectKey: true,
          hlsKey: true,
          durationSec: true,
          transcodeStatus: true,
          subtitleUrl: true,
        },
      },
    },
  });
  if (!lesson) return notFound('课时不存在');

  const { course } = lesson;
  if (user!.role === Role.STUDENT && course.status !== CourseStatus.PUBLISHED) {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_studentId: { courseId: course.id, studentId: user!.id },
      },
    });
    if (!enrolled) return forbidden('无权查看该课时');
  }

  const note = await prisma.note.findUnique({
    where: {
      lessonId_studentId: { lessonId: params.lessonId, studentId: user!.id },
    },
  });

  // TODO: 签名 URL 生成（前端暂通过 /api/v1/materials/[id]/download 代理，此处先返回 objectKey）
  return ok({
    lesson: {
      id: lesson.id,
      title: lesson.title,
      intro: lesson.intro,
      sortOrder: lesson.sortOrder,
      durationSec: lesson.durationSec,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    },
    course: {
      id: course.id,
      title: course.title,
      grade: course.grade,
      subjectId: course.subjectId,
      subject: course.subject,
      teacher: {
        id: course.teacher.id,
        nickname: course.teacher.nickname,
        avatarUrl: course.teacher.avatarUrl,
      },
    },
    chapter: lesson.chapter,
    video: lesson.video,
    note,
  });
}
