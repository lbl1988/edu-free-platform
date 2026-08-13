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
  '/dashboard',
];

// 仅管理员路径
const ADMIN_ONLY = ['/api/v1/ai-gen', '/api/v1/admin'];

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
  // 仅对 API 与 dashboard 路径生效，避免拦截静态资源
  matcher: ['/api/v1/:path*', '/dashboard/:path*'],
};
