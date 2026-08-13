import { createHash } from 'crypto';

const BIND_CODE_TTL = 600;
const BIND_CODE_PEPPER = process.env.BIND_CODE_PEPPER || 'edu-free-bind-code-pepper-v1';

export interface MemoryBindEntry {
  studentId: string;
  expiresAt: number;
}

export const memoryBindStore = new Map<string, MemoryBindEntry>();

export function genBindCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashBindCode(code: string): string {
  return createHash('sha256')
    .update(`${code}:${BIND_CODE_PEPPER}`)
    .digest('hex');
}

export function cleanupExpiredMemory() {
  const now = Date.now();
  for (const [key, val] of memoryBindStore) {
    if (val.expiresAt < now) {
      memoryBindStore.delete(key);
    }
  }
}

export const BIND_CODE_TTL_SECONDS = BIND_CODE_TTL;
