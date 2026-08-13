export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { badRequest, notFound, forbidden, ok } from '@/lib/api-response';
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

const ChatSchema = z.object({
  q: z.string().min(1, '查询内容不能为空').max(1000, '查询内容过长（≤1000字符）'),
  workspace: z.string().optional(),
  stream: z.boolean().optional(),
  sources: z.enum(['personal', 'course', 'all']).optional(),
});

async function appendToSession(
  courseId: string,
  studentId: string,
  userMsg: { role: 'user'; content: string; ts: string },
  assistantMsg: { role: 'assistant'; content: string; citations?: unknown[] | undefined; ts: string },
) {
  try {
    const normalized = {
      role: 'assistant' as const,
      content: assistantMsg.content,
      citations: assistantMsg.citations ?? [],
      ts: assistantMsg.ts,
    } as any;
    const pair = JSON.stringify([userMsg, normalized]);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CourseChatSession" ("courseId", "studentId", "messages", "messageCount", "lastMessageAt", "createdAt", "updatedAt") ` +
      `VALUES ($1, $2, $3::jsonb, 2, NOW(), NOW(), NOW()) ` +
      `ON CONFLICT ("courseId", "studentId") DO UPDATE SET ` +
      `"messages" = "CourseChatSession"."messages" || EXCLUDED."messages", ` +
      `"messageCount" = "CourseChatSession"."messageCount" + 2, ` +
      `"lastMessageAt" = NOW(), "updatedAt" = NOW()`,
      courseId,
      studentId,
      pair,
    );
    return true;
  } catch (e) {
    console.warn('[chat] Failed to append session:', e);
    return null;
  }
}

export async function POST(request: NextRequest, { params }: Ctx): Promise<Response> {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体必须为 JSON') as unknown as Response;
  }

  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message) as unknown as Response;
  }
  const { q, workspace, sources, stream } = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, teacherId: true, status: true },
  });
  if (!course) return notFound('课程不存在') as unknown as Response;

  const isTeacherOrAdmin = user!.role === Role.TEACHER || user!.role === Role.ADMIN;
  const isCourseTeacher = course.teacherId === user!.id;

  if (!isTeacherOrAdmin && !isCourseTeacher) {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) return forbidden('需要选课学生、任课教师或管理员权限') as unknown as Response;
  }
  if (user!.role === Role.STUDENT && course.status !== CourseStatus.PUBLISHED) {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) return forbidden('课程未发布') as unknown as Response;
  }

  const workspaceId = workspace ?? `course-${params.id}`;
  const workspaceParam = sources ? `${workspaceId}?sources=${sources}` : workspaceId;

  const accept = request.headers.get('accept') ?? '';
  const shouldStream = accept.includes('text/event-stream') || stream === true;

  const userMsg = { role: 'user' as const, content: q, ts: new Date().toISOString() };

  if (!shouldStream) {
    try {
      const result = await lightrag.query({ workspaceId, query: q, stream: false });
      const answerContent = typeof result === 'string'
        ? result
        : (result as { answer?: string }).answer ?? JSON.stringify(result);
      const citations = Array.isArray((result as any)?.citations) ? (result as any).citations : [];
      const assistantMsg = {
        role: 'assistant' as const,
        content: answerContent,
        citations,
        ts: new Date().toISOString(),
      };
      if (user!.role === Role.STUDENT) {
        await appendToSession(params.id, user!.id, userMsg, assistantMsg);
      }
      return ok({ answer: answerContent, citations, workspaceId }) as unknown as Response;
    } catch (e) {
      if (e instanceof LightRAGUnavailableError) {
        return (await import('@/lib/api-response')).fail(
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
  let fullAnswer = '';
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const responseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      pump(controller);
    },
  });

  async function pump(ctrl: ReadableStreamDefaultController<Uint8Array>) {
    const send = (raw: string) => { try { ctrl.enqueue(encoder.encode(raw)); } catch {} };

    try {
      const gen = await lightrag.query({ workspaceId, query: q, stream: true });
      for await (const chunk of gen) {
        if (typeof chunk === 'string' && chunk) {
          fullAnswer += chunk;
          send(sseMessage(chunk, 'text'));
        } else if (chunk !== null && typeof chunk === 'object') {
          send(sseMessage(JSON.stringify(chunk), 'citation'));
        }
      }

      const assistantMsg = {
        role: 'assistant' as const,
        content: fullAnswer,
        ts: new Date().toISOString(),
      };
      if (user!.role === Role.STUDENT && fullAnswer) {
        await appendToSession(params.id, user!.id, userMsg, assistantMsg);
      }

      const session = await prisma.courseChatSession.findUnique({
        where: { courseId_studentId: { courseId: params.id, studentId: user!.id } },
        select: { id: true },
      });
      const donePayload = JSON.stringify({
        session_id: session?.id ?? null,
        message_count: session ? undefined : undefined,
      });
      send(sseMessage(donePayload, 'done'));
    } catch (e) {
      if (e instanceof LightRAGUnavailableError) {
        send(`data: ${JSON.stringify({ error: 'RAG_SERVICE_UNAVAILABLE', tip: '请先部署 LightRAG Worker' })}\n\n`);
      } else {
        send(`data: ${JSON.stringify({ error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : String(e) })}\n\n`);
      }
    } finally {
      try { ctrl.close(); } catch {}
      streamController = null;
    }
  }

  return new Response(responseStream, { status: 200, headers: SSE_HEADERS });
}
