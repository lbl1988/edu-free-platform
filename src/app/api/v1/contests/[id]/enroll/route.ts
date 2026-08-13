export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, notFound, forbidden } from '@/lib/api-response';
import { Role } from '@prisma/client';

const EnrollSchema = z.object({
  school: z.string().max(200).optional(),
  province: z.string().max(50).optional(),
  city: z.string().max(50).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const [user, err] = await requireLogin(request);
  if (err) return err;
  if (user!.role !== Role.STUDENT) return forbidden('仅学生可报名竞赛');

  const { id } = params;
  const contest = await prisma.contest.findUnique({ where: { id }, select: { id: true, published: true } });
  if (!contest) return notFound('竞赛不存在');
  if (!contest.published) return notFound('竞赛不存在');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = EnrollSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const p = parsed.data;

  const existing = await prisma.contestEnrollment.findUnique({
    where: { contestId_studentId: { contestId: id, studentId: user!.id } },
  });
  if (existing) {
    return ok({ enrollment: existing, existed: true });
  }

  const enrollment = await prisma.contestEnrollment.create({
    data: {
      contestId: id,
      studentId: user!.id,
      school: p.school,
      province: p.province,
      city: p.city,
    },
  });

  return ok({ enrollment, existed: false }, 201);
}
