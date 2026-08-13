export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { badRequest, notFound, forbidden } from '@/lib/api-response';
import { LightRAGUnavailableError, lightrag } from '@/lib/lightrag';
import { Role, CourseStatus } from '@prisma/client';

type Ctx = { params: { id: string } };

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

function sseMessage(data: string, event = 'message'): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export async function GET(request: NextRequest, { params }: Ctx): Promise<Response> {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const workspaceOpt = searchParams.get('workspace') ?? undefined;

  if (!q.trim()) {
    return badRequest('缺少查询参数 q') as unknown as Response;
  }
  if (q.length > 1000) {
    return badRequest('查询内容过长（≤1000字符）') as unknown as Response;
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, teacherId: true, status: true },
  });
  if (!course) {
    return notFound('课程不存在') as unknown as Response;
  }

  const isTeacherOrAdmin = user!.role === Role.TEACHER || user!.role === Role.ADMIN;
  const isCourseTeacher = course.teacherId === user!.id;

  if (!isTeacherOrAdmin && !isCourseTeacher) {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) {
      return forbidden('需要选课学生、任课教师或管理员权限') as unknown as Response;
    }
  }

  if (user!.role === Role.STUDENT && course.status !== CourseStatus.PUBLISHED) {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) {
      return forbidden('课程未发布') as unknown as Response;
    }
  }

  const workspaceId = workspaceOpt ?? `course-${params.id}`;

  console.log('[chat-log]', {
    userId: user!.id,
    courseId: params.id,
    workspaceId,
    query: q,
    at: new Date().toISOString(),
  });
  // TODO: schema 加 ChatLog 表后持久化；当前仅打印

  const accept = request.headers.get('accept') ?? '';
  const streamParam = searchParams.get('stream');
  const shouldStream = accept.includes('text/event-stream') || streamParam === '1' || streamParam === 'true';

  if (!shouldStream) {
    try {
      const result = await lightrag.query({
        workspaceId,
        query: q,
        stream: false,
      });
      const { ok } = await import('@/lib/api-response');
      return ok(result) as unknown as Response;
    } catch (e) {
      if (e instanceof LightRAGUnavailableError) {
        const { fail } = await import('@/lib/api-response');
        return fail(
          'RAG_SERVICE_UNAVAILABLE',
          '服务暂未部署，请稍后再试',
          503,
          { tip: '请先部署 LightRAG Worker' },
        ) as unknown as Response;
      }
      throw e;
    }
  }

  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      pump(controller);
    },
  });

  async function pump(ctrl: ReadableStreamDefaultController<Uint8Array>) {
    const send = (raw: string) => {
      try {
        ctrl.enqueue(encoder.encode(raw));
      } catch {}
    };

    try {
      const gen = await lightrag.query({
        workspaceId,
        query: q,
        stream: true,
      });

      for await (const chunk of gen) {
        if (typeof chunk === 'string' && chunk) {
          send(sseMessage(chunk, 'message'));
        }
      }

      send(sseMessage('[DONE]', 'done'));
    } catch (e) {
      if (e instanceof LightRAGUnavailableError) {
        const payload = JSON.stringify({
          error: 'RAG_SERVICE_UNAVAILABLE',
          tip: '请先部署 LightRAG Worker',
        });
        send(`data: ${payload}\n\n`);
      } else {
        const payload = JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: e instanceof Error ? e.message : String(e),
        });
        send(`data: ${payload}\n\n`);
      }
    } finally {
      try {
        ctrl.close();
      } catch {}
      streamController = null;
    }
  }

  return new Response(stream, {
    status: 200,
    headers: SSE_HEADERS,
  });
}
