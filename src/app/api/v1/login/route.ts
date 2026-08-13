export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signAccessToken, issueRefreshToken, setAuthCookies } from '@/lib/auth.server';
import { ok, badRequest, tooMany, unauthorized, serviceUnavailable } from '@/lib/api-response';
import { isPhone, getClientIp, getUserAgent } from '@/lib/utils';
import { rateLimit } from '@/lib/redis';

export async function POST(request: NextRequest) {
  // 限流：同 IP 每分钟 10 次登录
  const ip = getClientIp(request);
  const rl = await rateLimit(`login:${ip}`, 10, 60);
  if (!rl.allowed) return tooMany();

  let body: { phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const { phone, password } = body;
  if (!phone || !password) return badRequest('手机号与密码必填');
  if (!isPhone(phone)) return badRequest('手机号格式不正确');

  try {
    const user = await prisma.user.findFirst({ where: { phone, deletedAt: null } });
    // 统一错误信息，避免账号枚举
    if (!user) return unauthorized('手机号或密码错误');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return unauthorized('手机号或密码错误');

    // 签发 access + refresh
    const access = await signAccessToken({
      sub: user.id,
      role: user.role,
      grade: user.grade,
    });
    const refresh = await issueRefreshToken(user.id, {
      ua: getUserAgent(request),
      ip,
    });

    const cookieStore = cookies();
    setAuthCookies(cookieStore, access, refresh);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return ok({
      token: access,
      refresh_token: refresh.plain,
      user: {
        id: user.id,
        nickname: user.nickname,
        role: user.role,
        grade: user.grade,
      },
    });
  } catch (e: any) {
    if (
      e?.name === 'PrismaClientInitializationError' ||
      e?.message?.includes("Can't reach database server") ||
      e?.message?.includes('database server')
    ) {
      console.error('[Login] Database error:', e?.message);
      return serviceUnavailable('数据库连接失败，请稍后重试或联系管理员');
    }
    console.error('[Login] Unexpected error:', e);
    return serviceUnavailable('登录失败，请稍后重试');
  }
}
