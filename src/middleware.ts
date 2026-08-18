import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

// 受保护路径前缀：匹配则需要登录
// 公开读取路径（courses/questions/exams/lessons/contests/articles/subjects/textbooks）
// 公开鉴权端点（login/register/logout/refresh）均不在此列表
// 写操作由 route handler 内部 requireTeacher/requireLogin 拦截
const PROTECTED = [
  '/api/v1/user',
  '/api/v1/papers',
  '/api/v1/wrong',
  '/api/v1/favorites',
  '/api/v1/ai-gen',
  '/api/v1/me',
  '/api/v1/recommend',
  '/api/v1/admin',
  '/dashboard',
  '/admin',
];

// 仅管理员路径
const ADMIN_ONLY = ['/api/v1/ai-gen', '/api/v1/admin'];

// 内部端点：支持 CRON_SECRET Bearer / INTERNAL_API_KEY 头 / Vercel 环境未配置密钥时放行
// （与 route handler 内部鉴权逻辑保持一致，供 Vercel Cron 与外部 cron 服务调用）
const INTERNAL_ENDPOINTS = [
  '/api/v1/admin/crawl/scheduled',
  '/api/v1/admin/seed-contests-exams',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // 解析 access token（cookie 优先，Bearer 备选）
  let token: string | null = null;
  const raw = request.headers.get('cookie') ?? '';
  const m = /(?:^|;\s*)edu_access=([^;]+)/.exec(raw);
  if (m) token = m[1];
  if (!token) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }

  const payload = token ? await verifyAccessToken(token) : null;
  if (!payload) {
    // 内部端点放行：CRON_SECRET Bearer / INTERNAL_API_KEY 头 / Vercel 生产环境
    if (INTERNAL_ENDPOINTS.some((p) => pathname.startsWith(p))) {
      const authHeader = request.headers.get('authorization') ?? '';
      const cronSecret = process.env.CRON_SECRET;
      const internalKey = request.headers.get('x-internal-api-key');
      const expectedInternalKey = process.env.INTERNAL_API_KEY;
      const cronOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
      const keyOk = !!expectedInternalKey && internalKey === expectedInternalKey;
      // Vercel 生产环境放行（Cron 调用无浏览器 cookie；端点内部幂等、受全局开关控制）
      const isVercel = process.env.VERCEL === '1';
      if (cronOk || keyOk || isVercel) {
        return NextResponse.next();
      }
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或登录已过期' } },
        { status: 401 },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 管理员路径鉴权
  if (ADMIN_ONLY.some((p) => pathname.startsWith(p)) && payload.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: '需要管理员权限' } },
      { status: 403 },
    );
  }

  // 透传用户信息到下游（Route Handler 通过 request.headers 读取）
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.sub);
  requestHeaders.set('x-user-role', payload.role);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // 仅对 API、dashboard、admin 路径生效，避免拦截静态资源
  matcher: ['/api/v1/:path*', '/dashboard/:path*', '/admin/:path*'],
};
