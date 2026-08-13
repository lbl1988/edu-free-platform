export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, forbidden, badRequest, conflict } from '@/lib/api-response';
import { Role } from '@prisma/client';
import { getRedisAsync } from '@/lib/redis';
import { memoryBindStore, hashBindCode, cleanupExpiredMemory, BIND_CODE_TTL_SECONDS } from '@/lib/bind-code';

// POST /api/v1/user/bind-code/confirm — 家长凭码绑定学生
const BindConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, '绑定码为6位数字'),
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  if (user!.role !== Role.PARENT) {
    return forbidden('仅家长可凭码绑定学生');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = BindConfirmSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const { code } = parsed.data;

  let studentId: string | null = null;

  try {
    const redis = await getRedisAsync();
    studentId = await redis.get(`bind:${code}`);
    if (studentId) {
      await redis.del(`bind:${code}`);
    }
  } catch {
    studentId = null;
  }

  if (!studentId) {
    cleanupExpiredMemory();
    const memEntry = memoryBindStore.get(code);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      studentId = memEntry.studentId;
      memoryBindStore.delete(code);
    }
  }

  if (!studentId) {
    const codeHash = hashBindCode(code);
    const now = new Date();
    const windowStart = new Date(now.getTime() - BIND_CODE_TTL_SECONDS * 1000);
    const tempBinding = await prisma.parentBinding.findFirst({
      where: {
        bindCodeHash: codeHash,
        verified: false,
        createdAt: { gte: windowStart },
      },
    });
    if (tempBinding) {
      studentId = tempBinding.studentId;
      await prisma.parentBinding.delete({ where: { id: tempBinding.id } }).catch(() => {});
    }
  }

  if (!studentId) {
    return badRequest('绑定码无效或已过期');
  }

  try {
    const binding = await prisma.parentBinding.create({
      data: {
        parentId: user!.id,
        studentId,
        verified: true,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        parentId: true,
        studentId: true,
        verified: true,
        verifiedAt: true,
        createdAt: true,
      },
    });
    return ok({ binding });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return conflict('已绑定过此学生');
    }
    return badRequest('绑定失败');
  }
}
