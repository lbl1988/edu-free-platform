export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';
import { getRedisAsync } from '@/lib/redis';
import {
  memoryBindStore,
  genBindCode,
  hashBindCode,
  cleanupExpiredMemory,
  BIND_CODE_TTL_SECONDS,
} from '@/lib/bind-code';

const BIND_CODE_TTL = BIND_CODE_TTL_SECONDS;

// GET /api/v1/user/bind-code — 学生生成一次性家长绑定码
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  if (user!.role !== Role.STUDENT) {
    return forbidden('仅学生可生成家长绑定码');
  }

  const code = genBindCode();
  const expiresAt = new Date(Date.now() + BIND_CODE_TTL * 1000);

  let redisOk = false;
  try {
    const redis = await getRedisAsync();
    await redis.setex(`bind:${code}`, BIND_CODE_TTL, user!.id);
    redisOk = true;
  } catch {
    redisOk = false;
  }

  if (!redisOk) {
    cleanupExpiredMemory();
    const codeHash = hashBindCode(code);
    memoryBindStore.set(code, {
      studentId: user!.id,
      expiresAt: expiresAt.getTime(),
    });
    await prisma.parentBinding.create({
      data: {
        parentId: 'temp-bind-placeholder',
        studentId: user!.id,
        bindCodeHash: codeHash,
        verified: false,
        verifiedAt: null,
      },
    }).catch(() => {});
  }

  return ok({ code, expiresAt });
}
