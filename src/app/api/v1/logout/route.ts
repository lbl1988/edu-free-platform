import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { revokeAllUserTokens, clearAuthCookies, getRefreshCookie } from '@/lib/auth';
import { ok, unauthorized } from '@/lib/api-response';

// POST /api/v1/logout — 登出，撤销 refresh token 并清除 cookie
export async function POST(request: NextRequest) {
  const plain = getRefreshCookie(request);
  if (plain) {
    // 撤销该用户全部 refresh token（可选：仅撤销当前 token）
    // 这里采用仅消费当前 token 的方式，避免多端登录互相踢出
    const { consumeRefreshToken } = await import('@/lib/auth');
    await consumeRefreshToken(plain);
  }
  const cookieStore = cookies();
  clearAuthCookies(cookieStore);
  return ok({ message: '已登出' });
}

// 忽略未使用导入（保留以备扩展为撤销全部）
void revokeAllUserTokens;
void unauthorized;
