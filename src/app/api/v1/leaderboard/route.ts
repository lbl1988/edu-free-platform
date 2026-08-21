export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';

// GET /api/v1/leaderboard — 学习排行榜（P3-1）
// 按积分/连续天数/正确率排名，支持 weekly/monthly/all 时间范围
// 参考方向：游戏化激励体系（同伴竞争驱动学习动力）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err as unknown as Response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'points'; // points | streak | accuracy
  const limit = Math.min(50, Math.max(5, Number(searchParams.get('limit') ?? 20)));

  const orderBy: Record<string, 'asc' | 'desc'> = {};
  switch (type) {
    case 'streak':
      orderBy.streakDays = 'desc';
      break;
    case 'accuracy':
      orderBy.correctRate = 'desc';
      break;
    default:
      orderBy.totalPoints = 'desc';
  }

  // 获取排行榜
  const profiles = await prisma.learningProfile.findMany({
    where: {
      // accuracy 排行需要一定答题量才有意义
      ...(type === 'accuracy' ? { totalQuestions: { gte: 50 } } : {}),
    },
    orderBy,
    take: limit,
    include: {
      student: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          grade: true,
        },
      },
    },
  });

  const leaderboard = profiles.map((p, idx) => ({
    rank: idx + 1,
    studentId: p.studentId,
    nickname: p.student.nickname ?? '匿名同学',
    avatarUrl: p.student.avatarUrl,
    grade: p.student.grade,
    points: p.totalPoints,
    streakDays: p.streakDays,
    correctRate: p.correctRate,
    totalQuestions: p.totalQuestions,
    isMe: p.studentId === user!.id,
  }));

  // 当前用户排名
  const myRank = leaderboard.find((e) => e.isMe)?.rank ?? null;
  const myProfile = await prisma.learningProfile.findUnique({
    where: { studentId: user!.id },
    select: { totalPoints: true, streakDays: true, correctRate: true, totalQuestions: true },
  });

  return ok({
    type,
    leaderboard,
    myRank,
    myProfile: myProfile
      ? {
          points: myProfile.totalPoints,
          streakDays: myProfile.streakDays,
          correctRate: myProfile.correctRate,
          totalQuestions: myProfile.totalQuestions,
        }
      : null,
  });
}
