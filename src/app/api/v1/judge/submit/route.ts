export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { Role, JudgeVerdict } from '@prisma/client';
import { getRedisAsync } from '@/lib/redis';

const ALLOWED_LANGUAGES = ['C', 'C++', 'Java', 'Python', 'JavaScript', 'Go', 'Rust'] as const;

const SubmitSchema = z.object({
  contestId: z.string().min(1),
  problemCode: z.string().min(1),
  language: z.enum(ALLOWED_LANGUAGES),
  sourceCode: z.string().min(1).max(65536),
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return forbidden('仅学生可提交代码');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  const contest = await prisma.contest.findUnique({
    where: { id: p.contestId },
    select: { id: true, published: true, startTime: true },
  });
  if (!contest || !contest.published) return notFound('竞赛不存在');

  const now = new Date();
  if (now < new Date(contest.startTime)) return forbidden('竞赛未开始');

  const enrolled = await prisma.contestEnrollment.findUnique({
    where: { contestId_studentId: { contestId: p.contestId, studentId: user!.id } },
    select: { id: true },
  });
  if (!enrolled) return forbidden('未报名竞赛');

  const problem = await prisma.contestProblem.findUnique({
    where: { contestId_problemCode: { contestId: p.contestId, problemCode: p.problemCode } },
    select: {
      id: true,
      timeLimitMs: true,
      memoryLimitMB: true,
      testdataKey: true,
    },
  });
  if (!problem) return notFound('题目不存在');

  const submission = await prisma.contestSubmission.create({
    data: {
      contestId: p.contestId,
      problemId: problem.id,
      studentId: user!.id,
      language: p.language,
      sourceCode: p.sourceCode,
      codeLength: p.sourceCode.length,
      verdict: JudgeVerdict.PENDING,
    },
  });

  const judgeTaskId = 'judge-local-' + submission.id;

  try {
    const redis = await getRedisAsync();
    await redis.xadd(
      'judge:queue',
      '*',
      'submissionId',
      submission.id,
      'problemId',
      problem.id,
      'testdataKey',
      problem.testdataKey ?? '',
      'language',
      p.language,
      'sourceCode',
      p.sourceCode,
      'timeLimitMs',
      String(problem.timeLimitMs),
      'memoryLimitMB',
      String(problem.memoryLimitMB),
    );
  } catch (e) {
    console.log('[Judge] Redis unavailable, fallback to local judgeTaskId. Waiting for worker to pull.', e);
  }

  await prisma.contestSubmission.update({
    where: { id: submission.id },
    data: { judgeTaskId },
  });

  return ok({ submissionId: submission.id, verdict: JudgeVerdict.PENDING, judgeTaskId }, 201);
}
