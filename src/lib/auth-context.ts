import type { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { verifyAccessToken, ACCESS_COOKIE_NAME } from './auth';
import type { User } from '@prisma/client';

/// 从请求解析当前登录用户（基于 access cookie / Bearer）
/// 返回 null 表示未登录或 token 无效
export async function getCurrentUser(request: NextRequest | Request): Promise<User | null> {
  let token: string | null = null;
  // 1. 优先 HttpOnly Cookie
  const raw = request.headers.get('cookie') ?? '';
  const match = new RegExp(`(?:^|;\\s*)${ACCESS_COOKIE_NAME}=([^;]+)`).exec(raw);
  if (match) token = match[1];
  // 2. 备选 Authorization: Bearer
  if (!token) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
  });
  return user;
}

/// 要求登录，否则返回 401 响应
export async function requireUser(request: NextRequest): Promise<User | null> {
  return getCurrentUser(request);
}
