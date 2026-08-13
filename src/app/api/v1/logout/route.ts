export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  revokeAllUserTokens,
  clearAuthCookies,
  getRefreshCookie,
  consumeRefreshToken,
} from '@/lib/auth.server';
import { ok } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const plain = getRefreshCookie(request);
  if (plain) {
    await consumeRefreshToken(plain);
  }
  const cookieStore = cookies();
  clearAuthCookies(cookieStore);
  void revokeAllUserTokens;
  return ok({ message: '已登出' });
}
