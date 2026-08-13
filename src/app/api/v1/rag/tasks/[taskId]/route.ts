export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { requireTeacher } from '@/lib/guards';
import { ok, fail } from '@/lib/api-response';
import { LightRAGUnavailableError, lightrag } from '@/lib/lightrag';

type Ctx = { params: { taskId: string } };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireTeacher(_request);
  if (err) return err;

  const taskId = params.taskId;
  if (!taskId) {
    return fail('BAD_REQUEST', '缺少 taskId 参数', 400);
  }

  try {
    const result = await lightrag.getTaskStatus(taskId);
    return ok({
      taskId,
      status: result.status,
      progress: result.progress,
      message: result.message,
    });
  } catch (e) {
    if (e instanceof LightRAGUnavailableError) {
      return fail(
        'RAG_SERVICE_UNAVAILABLE',
        '服务暂未部署，请稍后再试',
        503,
        { tip: '请先部署 LightRAG Worker', raw: e.message },
      );
    }
    return fail(
      'INTERNAL_ERROR',
      e instanceof Error ? e.message : String(e),
      500,
    );
  }
}
