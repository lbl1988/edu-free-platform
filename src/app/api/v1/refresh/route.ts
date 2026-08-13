export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  signAccessToken,
  issueRefreshToken,
  consumeRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  getRefreshCookie,
} from '@/lib/auth.server';
import { ok, unauthorized } from '@/lib/api-response';
import { getUserAgent, getClientIp } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const plain = getRefreshCookie(request);
  if (!plain) return unauthorized('缺少刷新令牌');

  // 事务化消费旧 refresh token（单次消费，防重放）
  const { userId, ok: consumed } = await consumeRefreshToken(plain);
  if (!consumed || !userId) {
    const cookieStore = cookies();
    clearAuthCookies(cookieStore);
    return unauthorized('刷新令牌无效或已过期');
  }

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) return unauthorized('用户不存在');

  // 签发新的 access + refresh（refresh 轮换）
  const access = await signAccessToken({
    sub: user.id,
    role: user.role,
    grade: user.grade,
  });
  const refresh = await issueRefreshToken(user.id, {
    ua: getUserAgent(request),
    ip: getClientIp(request),
  });

  const cookieStore = cookies();
  setAuthCookies(cookieStore, access, refresh);

  return ok({ token: access, refresh_token: refresh.plain });
}
