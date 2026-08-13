import type { NextRequest } from 'next/server';

/// 从请求中解析客户端 IP（兼容反代）
export function getClientIp(request: NextRequest | Request): string {
  const headers = request.headers;
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

/// 从请求中解析 User-Agent
export function getUserAgent(request: NextRequest | Request): string | undefined {
  return request.headers.get('user-agent') ?? undefined;
}

/// 中国大陆手机号校验（11 位，1 开头）
export function isPhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value);
}

/// 密码强度：8-64 位，含字母与数字
export function isStrongPassword(value: string): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=]{8,64}$/.test(value);
}

/// 年级校验 1-12
export function isValidGrade(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}
