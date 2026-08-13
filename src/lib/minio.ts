// MinIO (S3 兼容) 对象存储客户端
// 按交接报告 CH4/CH9：视频、课件、资料文件存储于 MinIO
//
// 降级策略：本地无 MinIO 或未安装 minio 包时，上传返回本地回退 key，
// 保证开发流程不阻塞；生产环境务必启用真实 MinIO。

import { createHash, randomUUID } from 'crypto';

let minioClient: any = null;
let initError: string | null = null;
let initAttempted = false;

async function getClient(): Promise<any | null> {
  if (initAttempted) return minioClient;
  initAttempted = true;

  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) {
    initError = 'MINIO_ENDPOINT 未配置';
    return null;
  }

  try {
    // 动态 import，避免 minio 包未安装时整体崩溃
    const { Client } = await import('minio');
    const url = new URL(endpoint);
    minioClient = new Client({
      endPoint: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
      useSSL: url.protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY ?? '',
      secretKey: process.env.MINIO_SECRET_KEY ?? '',
    });
  } catch (e) {
    initError = `minio 包未安装或初始化失败: ${(e as Error).message}`;
    minioClient = null;
  }
  return minioClient;
}

const BUCKET = process.env.MINIO_BUCKET ?? 'edu-materials';

/// 生成对象 key：{prefix}/{yyyy}/{mm}/{uuid}{ext}
export function genObjectKey(prefix: string, originalName?: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = originalName ? extractExt(originalName) : '';
  return `${prefix}/${yyyy}/${mm}/${randomUUID()}${ext}`;
}

function extractExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export interface UploadResult {
  objectKey: string;
  bucket: string;
  size: number;
  degraded: boolean; // 是否降级（本地回退）
}

/// 上传 Buffer 到 MinIO；降级时返回标记
export async function uploadBuffer(
  buf: Buffer,
  prefix: string,
  meta: { contentType?: string; originalName?: string },
): Promise<UploadResult> {
  const objectKey = genObjectKey(prefix, meta.originalName);
  const client = await getClient();

  if (!client) {
    // 降级：仅返回 key，不实际存储。开发环境可配合本地 fs 回退（此处省略）
    console.warn(`[minio] 降级模式，未实际上传: ${initError}`);
    return { objectKey, bucket: BUCKET, size: buf.length, degraded: true };
  }

  await client.putObject(BUCKET, objectKey, buf, buf.length, {
    'Content-Type': meta.contentType ?? 'application/octet-stream',
  });
  return { objectKey, bucket: BUCKET, size: buf.length, degraded: false };
}

/// 生成预签名下载 URL（有效期秒）
export async function presignedGet(objectKey: string, expiresSec = 3600): Promise<string | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    return await client.presignedGetObject(BUCKET, objectKey, expiresSec);
  } catch (e) {
    console.error(`[minio] 预签名失败:`, (e as Error).message);
    return null;
  }
}

/// 文件类型白名单校验（防上传可执行文件）
const ALLOWED = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function isAllowedFile(name: string): boolean {
  return !!extractExt(name).slice(1) && Object.keys(ALLOWED).includes(extractExt(name).slice(1));
}

export function getContentType(name: string): string {
  const ext = extractExt(name).slice(1);
  return ALLOWED[ext as keyof typeof ALLOWED] ?? 'application/octet-stream';
}

/// 文件大小限制（字节）
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// 供测试/健康检查使用
export async function pingMinIO(): Promise<{ ok: boolean; error?: string }> {
  const client = await getClient();
  if (!client) return { ok: false, error: initError ?? '未初始化' };
  try {
    await client.bucketExists(BUCKET);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// 哈希工具（统一入口，避免各处重复 import）
export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
