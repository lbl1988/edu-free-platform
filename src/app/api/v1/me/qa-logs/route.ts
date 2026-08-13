export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';

// DELETE /api/v1/me/qa-logs — 软删当前用户全部QA日志（GDPR）
// 实现策略：清空该用户 CourseChatSession 的 messages 数组，记录删除元信息
// （课程聊天记录不属于题目答题记录，按 GDPR "被遗忘权"处理）
export async function DELETE(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const now = new Date();
  const tombstone: unknown[] = [{
    role: 'system',
    content: '[已删除] 用户申请删除QA日志',
    deletedAt: now.toISOString(),
  }];

  const result = await prisma.courseChatSession.updateMany({
    where: { studentId: user!.id },
    data: {
      messages: tombstone as any,
      messageCount: 1,
      lastMessageAt: now,
      updatedAt: now,
    },
  });

  // 同时清理用户层面的采集开关：若用户明确要求删除，可将采集开关一并关闭
  await prisma.user.update({
    where: { id: user!.id },
    data: {
      qaCollectionEnabled: false,
      updatedAt: now,
    },
  });

  return ok({
    deletedSessionCount: result.count,
    qaCollectionEnabled: false,
    performedAt: now,
  }) as unknown as Response;
}
