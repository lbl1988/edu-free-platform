import { NextResponse } from 'next/server';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  // 便于前端分页
  pagination?: { page: number; limit: number; total: number };
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data } satisfies ApiResponse<T>, { status });
}

export function okPaginated<T>(
  data: T,
  pagination: ApiResponse['pagination'],
): NextResponse {
  return NextResponse.json({ success: true, data, pagination } satisfies ApiResponse<T>);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details } } satisfies ApiResponse,
    { status },
  );
}

// 常用错误快捷方法
export const badRequest = (msg: string, details?: unknown) => fail('BAD_REQUEST', msg, 400, details);
export const unauthorized = (msg = '未登录或登录已过期') => fail('UNAUTHORIZED', msg, 401);
export const forbidden = (msg = '无权访问') => fail('FORBIDDEN', msg, 403);
export const notFound = (msg = '资源不存在') => fail('NOT_FOUND', msg, 404);
export const conflict = (msg: string) => fail('CONFLICT', msg, 409);
export const tooMany = (msg = '请求过于频繁，请稍后再试') => fail('RATE_LIMITED', msg, 429);
