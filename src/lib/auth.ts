import { SignJWT, jwtVerify } from 'jose';
import argon2 from 'argon2';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

// ========== 常量 ==========
const ACCESS_COOKIE = 'edu_access';
const REFRESH_COOKIE = 'edu_refresh';
const ISSUER = process.env.JWT_ISSUER ?? 'edu-free-platform';
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me-32chars!!',
);
const PEPPER = process.env.CREDENTIAL_CODE_PEPPER ?? 'dev-pepper';

const ACCESS_TTL = parseDuration(process.env.JWT_ACCESS_EXPIRES ?? '15m');
const REFRESH_TTL = parseDuration(process.env.JWT_REFRESH_EXPIRES ?? '30d');

function parseDuration(s: string): number {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) return 900;
  const n = Number(m[1]);
  return m[2] === 's' ? n : m[2] === 'm' ? n * 60 : m[2] === 'h' ? n * 3600 : n * 86400;
}

// ========== 密码哈希 ==========
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// ========== JWT ==========
export interface AccessTokenPayload {
  sub: string; // userId
  role: string;
  grade: number | null;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(SECRET);
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

// ========== Refresh Token（哈希存储，单次消费）==========
async function hashToken(token: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(token + PEPPER).digest('hex');
}

function generateToken(): string {
  // 32 字节随机 + base64url
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

export async function issueRefreshToken(userId: string, meta?: { ua?: string; ip?: string }) {
  const plain = generateToken();
  const tokenHash = await hashToken(plain);
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash, userAgent: meta?.ua, ipAddr: meta?.ip, expiresAt },
  });
  return { plain, expiresAt };
}

/// 校验并消费 refresh token（事务化，防重放）
export async function consumeRefreshToken(
  plain: string,
): Promise<{ userId: string; ok: boolean }> {
  const tokenHash = await hashToken(plain);
  // 事务：查询未撤销未过期的 token → 标记撤销
  return await prisma.$transaction(async (tx) => {
    const record = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      return { userId: '', ok: false };
    }
    await tx.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return { userId: record.userId, ok: true };
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ========== Cookie 操作 ==========
export function setAuthCookies(
  cookieStore: ReturnType<typeof cookies>,
  access: string,
  refresh: { plain: string; expiresAt: Date },
) {
  cookieStore.set(ACCESS_COOKIE, access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TTL,
  });
  cookieStore.set(REFRESH_COOKIE, refresh.plain, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/refresh',
    maxAge: REFRESH_TTL,
  });
}

export function clearAuthCookies(cookieStore: ReturnType<typeof cookies>) {
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

export function getRefreshCookie(request: Request): string | undefined {
  const raw = request.headers.get('cookie') ?? '';
  const match = /(?:^|;\s*)edu_refresh=([^;]+)/.exec(raw);
  return match?.[1];
}

export const ACCESS_COOKIE_NAME = ACCESS_COOKIE;
export const ACCESS_TTL_SECONDS = ACCESS_TTL;
