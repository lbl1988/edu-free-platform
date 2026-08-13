import argon2 from 'argon2';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import {
  AccessTokenPayload,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  TOKEN_TTL,
} from './auth';
import { SignJWT } from 'jose';

// ========== 常量 ==========
const ACCESS_COOKIE = ACCESS_COOKIE_NAME;
const REFRESH_COOKIE = REFRESH_COOKIE_NAME;
const ISSUER = process.env.JWT_ISSUER ?? 'edu-free-platform';
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me-32chars!!',
);
const PEPPER = process.env.CREDENTIAL_CODE_PEPPER ?? 'dev-pepper';

const { ACCESS_TTL, REFRESH_TTL } = TOKEN_TTL;

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
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(SECRET);
}

// ========== Refresh Token（哈希存储，单次消费）==========
async function hashToken(token: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(token + PEPPER).digest('hex');
}

function generateToken(): string {
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

export async function consumeRefreshToken(
  plain: string,
): Promise<{ userId: string; ok: boolean }> {
  const tokenHash = await hashToken(plain);
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
    expires: refresh.expiresAt,
  });
}

export function clearAuthCookies(cookieStore: ReturnType<typeof cookies>) {
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
  cookieStore.delete(REFRESH_COOKIE);
  cookieStore.set(REFRESH_COOKIE, '', { path: '/api/v1/refresh', maxAge: 0 });
}

export function getAccessToken(cookieStore: ReturnType<typeof cookies>) {
  return cookieStore.get(ACCESS_COOKIE)?.value ?? '';
}

export function getRefreshCookie(cookieStore: ReturnType<typeof cookies> | NextRequest) {
  if (typeof (cookieStore as NextRequest).cookies?.get === 'function') {
    return (cookieStore as NextRequest).cookies.get(REFRESH_COOKIE)?.value ?? '';
  }
  return (cookieStore as ReturnType<typeof cookies>).get(REFRESH_COOKIE)?.value ?? '';
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
