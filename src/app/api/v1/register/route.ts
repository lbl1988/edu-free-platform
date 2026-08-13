import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';
import { ok, badRequest, conflict, tooMany } from '@/lib/api-response';
import { isPhone, isStrongPassword, isValidGrade, getClientIp } from '@/lib/utils';
import { rateLimit } from '@/lib/redis';
import { Role } from '@prisma/client';

// 注册请求体校验
const RegisterSchema = z.object({
  phone: z.string(),
  password: z.string(),
  nickname: z.string().max(32).optional(),
  role: z.nativeEnum(Role).default(Role.STUDENT),
  grade: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  // 限流：同 IP 每分钟 5 次注册
  const ip = getClientIp(request);
  const rl = await rateLimit(`register:${ip}`, 5, 60);
  if (!rl.allowed) return tooMany();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());

  const { phone, password, nickname, role, grade } = parsed.data;

  // 安全线：禁止注册 ADMIN
  if (role === Role.ADMIN) return badRequest('不允许注册管理员账号');

  if (!isPhone(phone)) return badRequest('手机号格式不正确');
  if (!isStrongPassword(password)) return badRequest('密码需 8-64 位且包含字母与数字');
  if (role === Role.STUDENT) {
    if (grade === undefined) return badRequest('学生需选择年级');
    if (!isValidGrade(grade)) return badRequest('年级需为 1-12');
  }

  // 唯一性校验
  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) return conflict('该手机号已注册');

  // 创建用户 + 学生初始化学习画像
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      nickname,
      role,
      grade: role === Role.STUDENT ? grade : null,
      learningProfile: role === Role.STUDENT ? { create: {} } : undefined,
      lastLoginAt: new Date(),
    },
    select: { id: true, phone: true, nickname: true, role: true, grade: true, createdAt: true },
  });

  // 学生返回一次性凭证码（用于家长绑定）
  // 注：凭证码本身非登录凭证，此处先返回基础注册信息，凭证码生成在家长绑定接口实现
  return ok({ user }, 201);
}
