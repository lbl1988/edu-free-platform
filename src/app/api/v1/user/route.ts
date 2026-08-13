import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-context';
import { ok, badRequest, unauthorized } from '@/lib/api-response';
import { isValidGrade } from '@/lib/utils';

// GET /api/v1/user — 当前用户信息
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  return ok({
    id: user.id,
    phone: maskPhone(user.phone),
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    role: user.role,
    grade: user.grade,
    realNameStatus: user.realNameStatus,
    qaCollectionEnabled: user.qaCollectionEnabled,
    dailyLimitMinutes: user.dailyLimitMinutes,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  });
}

// PUT /api/v1/user — 更新可修改字段（昵称/年级/采集开关/头像/每日时长上限）
const UpdateSchema = z
  .object({
    nickname: z.string().max(32).optional(),
    grade: z.number().int().optional(),
    qaCollectionEnabled: z.boolean().optional(),
    avatarUrl: z.string().url().optional(),
    dailyLimitMinutes: z.number().int().min(0).max(600).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: '至少提供一个更新字段' });

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const data = parsed.data;

  if (data.grade !== undefined && !isValidGrade(data.grade)) {
    return badRequest('年级需为 1-12');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      nickname: true,
      grade: true,
      avatarUrl: true,
      qaCollectionEnabled: true,
      dailyLimitMinutes: true,
    },
  });
  return ok(updated);
}

// 手机号脱敏：138****1234
function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
