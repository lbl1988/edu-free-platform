export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';

// GET /api/v1/analytics/error-causes — 错因分析看板（P1-3）
// 聚合学生错题本中的 errorTag 分布，帮助学生理解错误模式
// 参考方向：精准学情诊断（国内平台核心差异化能力）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const studentId = user!.id;

  const { searchParams } = new URL(request.url);
  const mastered = searchParams.get('mastered'); // 'false' = 仅未掌握, 'true' = 仅已掌握, 不传 = 全部
  const days = Math.min(365, Math.max(7, Number(searchParams.get('days') ?? 90)));

  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Record<string, unknown> = {
    studentId,
    firstWrongAt: { gte: since },
  };
  if (mastered === 'false') where.mastered = false;
  else if (mastered === 'true') where.mastered = true;

  // 按 errorTag 分组统计
  const byTag = await prisma.wrongRecord.groupBy({
    by: ['errorTag'],
    where,
    _count: { errorTag: true },
    orderBy: { _count: { errorTag: 'desc' } },
  });

  // 按 subject 分组（通过 question 关联）
  const bySubject = await prisma.wrongRecord.groupBy({
    by: ['questionId'],
    where,
    _count: { questionId: true },
  });

  // 获取这些题目对应的学科
  const questionIds = bySubject.map((b) => b.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, subjectId: true, subject: { select: { name: true } } },
  });
  const subjectMap = new Map(questions.map((q) => [q.id, q.subject.name]));
  const subjectCountMap = new Map<string, number>();
  for (const b of bySubject) {
    const subjName = subjectMap.get(b.questionId) ?? '未知';
    subjectCountMap.set(subjName, (subjectCountMap.get(subjName) ?? 0) + b._count.questionId);
  }

  const total = byTag.reduce((s, b) => s + b._count.errorTag, 0);

  // 标签分布（含"未标记"归组）
  const tagDistribution = byTag.map((b) => ({
    tag: b.errorTag ?? '未标记',
    count: b._count.errorTag,
    percentage: total > 0 ? Math.round((b._count.errorTag / total) * 10000) / 100 : 0,
  }));

  // 学科分布
  const subjectDistribution = Array.from(subjectCountMap.entries())
    .map(([name, count]) => ({
      subject: name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 按 errorReason 分组（更细粒度）
  const byReason = await prisma.wrongRecord.groupBy({
    by: ['errorReason'],
    where,
    _count: { errorReason: true },
    orderBy: { _count: { errorReason: 'desc' } },
    take: 10,
  });
  const reasonDistribution = byReason
    .filter((b) => b.errorReason)
    .map((b) => ({
      reason: b.errorReason!,
      count: b._count.errorReason,
      percentage: total > 0 ? Math.round((b._count.errorReason / total) * 10000) / 100 : 0,
    }));

  return ok({
    totalWrong: total,
    days,
    tagDistribution,
    subjectDistribution,
    reasonDistribution,
  });
}
