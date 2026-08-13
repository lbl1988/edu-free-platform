import { SignJWT, jwtVerify } from 'jose';

// ========== 常量 ==========
const ACCESS_COOKIE = 'edu_access';
const REFRESH_COOKIE = 'edu_refresh';
const ISSUER = process.env.JWT_ISSUER ?? 'edu-free-platform';
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me-32chars!!',
);

const ACCESS_TTL = parseDuration(process.env.JWT_ACCESS_EXPIRES ?? '15m');
const REFRESH_TTL = parseDuration(process.env.JWT_REFRESH_EXPIRES ?? '30d');

function parseDuration(s: string): number {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) return 900;
  const n = Number(m[1]);
  return m[2] === 's' ? n : m[2] === 'm' ? n * 60 : m[2] === 'h' ? n * 3600 : n * 86400;
}

export interface AccessTokenPayload {
  sub: string;
  role: string;
  grade: number | null;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    return {
      sub: payload.sub as string,
      role: payload.role as string,
      grade: (payload.grade as number | null) ?? null,
    };
  } catch {
    return null;
  }
}

export const ACCESS_COOKIE_NAME = ACCESS_COOKIE;
export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;
export const TOKEN_TTL = { ACCESS_TTL, REFRESH_TTL };

// 服务端专用函数（hashPassword/verifyPassword/signAccessToken/issueRefreshToken 等）
// 留在 src/lib/auth.server.ts 中，避免 middleware 编译进 argon2/prisma/node:crypto
export {};
