export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';

// GET /api/v1/me/qa-logs/export — 导出当前用户QA日志（GDPR）
// 目前 CourseChatSession 即保存聊天历史，直接从会话表导出为 NDJSON 流
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const sessions = await prisma.courseChatSession.findMany({
    where: { studentId: user!.id },
    orderBy: { lastMessageAt: 'asc' },
    select: {
      id: true,
      courseId: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
      messages: true,
    },
  });

  // 生成 NDJSON，便于下游导入分析
  const encoder = new TextEncoder();
  let first = true;
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const header = `# QA log export for user ${user!.id}\n# Generated at: ${new Date().toISOString()}\n`;
      ctrl.enqueue(encoder.encode(header));
      for (const session of sessions) {
        const lines: string[] = [];
        const messages = Array.isArray(session.messages) ? session.messages : [];
        for (const msg of messages as any[]) {
          lines.push(JSON.stringify({
            session_id: session.id,
            course_id: session.courseId,
            role: msg?.role ?? 'unknown',
            content: String(msg?.content ?? ''),
            ts: msg?.ts ?? null,
            export_at: new Date().toISOString(),
          }));
        }
        if (lines.length === 0) continue;
        const chunk = lines.join('\n') + '\n';
        ctrl.enqueue(encoder.encode(chunk));
      }
      try { ctrl.close(); } catch {}
    },
  });

  const safeTs = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `qa-logs-${user!.id}-${safeTs}.ndjson`;

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
