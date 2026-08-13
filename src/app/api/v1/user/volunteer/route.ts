export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, conflict } from '@/lib/api-response';
import { VolunteerStatus } from '@prisma/client';

// POST /api/v1/user/volunteer — 申请志愿者认证
const VolunteerSchema = z.object({
  certType: z.string().max(32, '认证类型最多32字符'),
  expertise: z
    .array(z.string().max(32, '单条擅长领域最多32字符'))
    .max(20, '擅长领域最多20项'),
  orgName: z.string().max(64, '所属机构最多64字符').optional(),
  intro: z.string().max(2000, '个人介绍最多2000字符').optional(),
});

export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = VolunteerSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const { certType, expertise, orgName, intro } = parsed.data;

  const existing = await prisma.volunteerCert.findFirst({
    where: {
      userId: user!.id,
      status: { in: [VolunteerStatus.PENDING, VolunteerStatus.APPROVED] },
    },
  });
  if (existing) {
    return conflict('您已有待审核或已通过的志愿者认证申请');
  }

  const cert = await prisma.volunteerCert.create({
    data: {
      userId: user!.id,
      status: VolunteerStatus.PENDING,
      certType,
      expertise,
      orgName,
      intro,
    },
    select: {
      id: true,
      status: true,
      certType: true,
      expertise: true,
      orgName: true,
      intro: true,
      points: true,
      createdAt: true,
    },
  });

  return ok({ cert });
}

// GET /api/v1/user/volunteer — 查询自己的志愿者记录
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const certs = await prisma.volunteerCert.findMany({
    where: { userId: user!.id },
    select: {
      id: true,
      status: true,
      certType: true,
      expertise: true,
      orgName: true,
      intro: true,
      points: true,
      reviewedBy: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok({ certs });
}
