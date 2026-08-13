export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest } from '@/lib/api-response';
import { RealNameStatus } from '@prisma/client';

const ID_CARD_PEPPER = process.env.ID_CARD_PEPPER || 'edu-free-id-card-pepper-v1';

// POST /api/v1/user/real-name — 实名认证申请
const RealNameSchema = z.object({
  realName: z.string().min(1, '姓名不能为空').max(32),
  idCardLast4: z.string().regex(/^\d{4}$/, '身份证末4位必须是4位数字'),
});

function maskRealName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function hashIdCardLast4(last4: string): string {
  return createHash('sha256')
    .update(`${last4}:${ID_CARD_PEPPER}`)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  if (user!.realNameStatus === RealNameStatus.VERIFIED) {
    return ok({ status: RealNameStatus.VERIFIED });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = RealNameSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const { realName, idCardLast4 } = parsed.data;

  const maskedName = maskRealName(realName);
  const idCardHash = hashIdCardLast4(idCardLast4);

  const updated = await prisma.user.update({
    where: { id: user!.id },
    data: {
      realNameStatus: RealNameStatus.PENDING,
      realName: maskedName,
      idCardHash,
    },
    select: {
      realNameStatus: true,
    },
  });

  return ok({ status: updated.realNameStatus });
}
