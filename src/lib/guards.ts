import type { NextRequest } from 'next/server';
import type { User } from '@prisma/client';
import { getCurrentUser } from './auth-context';
import { unauthorized, forbidden } from './api-response';
import { Role } from '@prisma/client';

/// 要求登录，返回用户或 401 响应（元组 [user, response]）
export async function requireLogin(
  request: NextRequest,
): Promise<[User | null, null] | [null, ReturnType<typeof unauthorized>]> {
  const user = await getCurrentUser(request);
  if (!user) return [null, unauthorized()];
  return [user, null];
}

/// 要求教师或管理员
export async function requireTeacher(
  request: NextRequest,
): Promise<[User | null, null] | [null, ReturnType<typeof forbidden>]> {
  const [user, err] = await requireLogin(request);
  if (err) return [null, err as any];
  if (user!.role !== Role.TEACHER && user!.role !== Role.ADMIN) {
    return [null, forbidden('需要教师或管理员权限')];
  }
  return [user, null];
}

/// 要求管理员
export async function requireAdmin(
  request: NextRequest,
): Promise<[User | null, null] | [null, ReturnType<typeof forbidden>]> {
  const [user, err] = await requireLogin(request);
  if (err) return [null, err as any];
  if (user!.role !== Role.ADMIN) return [null, forbidden('需要管理员权限')];
  return [user, null];
}
