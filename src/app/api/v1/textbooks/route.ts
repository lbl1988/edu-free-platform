export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, badRequest } from '@/lib/api-response';

const QuerySchema = z.object({
  stage: z.string().optional(),
  subjectId: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'subjectId 必须是整数'),
  grade: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'grade 必须是整数'),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    stage: searchParams.get('stage') ?? undefined,
    subjectId: searchParams.get('subjectId') ?? undefined,
    grade: searchParams.get('grade') ?? undefined,
  });
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());

  const { stage, subjectId, grade } = parsed.data;

  const where: Record<string, unknown> = {};
  if (subjectId) where.subjectId = Number(subjectId);
  if (grade) where.grade = Number(grade);
  if (stage) {
    where.subject = { stage };
  }

  const textbooks = await prisma.textbook.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true, stage: true } },
      _count: { select: { chapters: true } },
    },
    orderBy: [{ grade: 'asc' }, { subjectId: 'asc' }, { name: 'asc' }],
  });

  const result = textbooks.map((t) => ({
    id: t.id,
    name: t.name,
    subjectId: t.subjectId,
    grade: t.grade,
    publisher: t.publisher,
    createdAt: t.createdAt,
    subject: t.subject,
    chaptersCount: t._count.chapters,
  }));

  return ok({ textbooks: result });
}
