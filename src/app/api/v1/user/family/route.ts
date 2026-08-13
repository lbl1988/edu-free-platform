export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';
import { Role } from '@prisma/client';

// GET /api/v1/user/family — 家长看绑定的子女/学生看绑定的家长
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  if (user!.role === Role.PARENT) {
    const bindings = await prisma.parentBinding.findMany({
      where: {
        parentId: user!.id,
        verified: true,
      },
      include: {
        student: {
          select: {
            id: true,
            nickname: true,
            grade: true,
            learningProfile: {
              select: {
                lastActiveAt: true,
                correctRate: true,
                totalStudyMinutes: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const members = bindings.map((b) => ({
      bindingId: b.id,
      studentId: b.studentId,
      nickname: b.student.nickname,
      grade: b.student.grade,
      lastActiveAt: b.student.learningProfile?.lastActiveAt ?? null,
      correctRate: b.student.learningProfile?.correctRate ?? 0,
      totalStudyMinutes: b.student.learningProfile?.totalStudyMinutes ?? 0,
      boundAt: b.createdAt,
    }));

    return ok({ role: Role.PARENT, members });
  }

  if (user!.role === Role.STUDENT) {
    const bindings = await prisma.parentBinding.findMany({
      where: {
        studentId: user!.id,
        verified: true,
      },
      include: {
        parent: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const members = bindings.map((b) => ({
      bindingId: b.id,
      parentId: b.parentId,
      nickname: b.parent.nickname,
      avatarUrl: b.parent.avatarUrl,
      boundAt: b.createdAt,
    }));

    return ok({ role: Role.STUDENT, members });
  }

  return ok({ role: user!.role, members: [] });
}
