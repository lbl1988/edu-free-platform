export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest, forbidden } from '@/lib/api-response';
import { isValidGrade } from '@/lib/utils';
import { Role } from '@prisma/client';

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

// GET /api/v1/user/profile — 当前登录用户完整信息
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const fullUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      id: true,
      phone: true,
      nickname: true,
      avatarUrl: true,
      role: true,
      grade: true,
      realNameStatus: true,
      realName: true,
      qaCollectionEnabled: true,
      dailyLimitMinutes: true,
      lastLoginAt: true,
      createdAt: true,
      volunteerCerts: {
        where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'] } },
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
      },
      learningProfile: {
        select: {
          totalStudyMinutes: true,
          totalQuestions: true,
          correctRate: true,
          streakDays: true,
          lastActiveAt: true,
        },
      },
      _count: {
        select: {
          parentBindingsAsParent: true,
          parentBindingsAsStudent: true,
        },
      },
    },
  });

  if (!fullUser) {
    return badRequest('用户不存在');
  }

  const enrollmentsCount = await prisma.courseEnrollment.count({ where: { studentId: user!.id } });
  const wrongCount = await prisma.wrongRecord.count({ where: { studentId: user!.id } });
  const examsCount = await prisma.examResult.count({ where: { studentId: user!.id } });

  return ok({
    user: {
      id: fullUser.id,
      phone: maskPhone(fullUser.phone),
      nickname: fullUser.nickname,
      avatarUrl: fullUser.avatarUrl,
      role: fullUser.role,
      grade: fullUser.grade,
      realNameStatus: fullUser.realNameStatus,
      realName: fullUser.realName,
      qaCollectionEnabled: fullUser.qaCollectionEnabled,
      dailyLimitMinutes: fullUser.dailyLimitMinutes,
      lastLoginAt: fullUser.lastLoginAt,
      createdAt: fullUser.createdAt,
      volunteerCerts: fullUser.volunteerCerts,
      learningProfile: fullUser.learningProfile,
      parentBindingsAsParentCount: fullUser._count.parentBindingsAsParent,
      parentBindingsAsStudentCount: fullUser._count.parentBindingsAsStudent,
    },
    stats: {
      enrollmentsCount,
      wrongCount,
      examsCount,
      studyMinutes30d: 0,
    },
  });
}

// PATCH /api/v1/user/profile — 更新 nickname/avatarUrl/grade
const PatchProfileSchema = z.object({
  nickname: z.string().max(32).optional(),
  avatarUrl: z.string().url().optional(),
  grade: z.number().int().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: '至少提供一个更新字段' });

export async function PATCH(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求体格式错误');
  }
  const parsed = PatchProfileSchema.safeParse(body);
  if (!parsed.success) return badRequest('参数校验失败', parsed.error.flatten());
  const data = parsed.data;

  if (data.grade !== undefined) {
    if (user!.role !== Role.STUDENT) {
      return forbidden('仅学生可以修改年级');
    }
    if (!isValidGrade(data.grade)) {
      return badRequest('年级需为 1-12');
    }
  }

  const updateData: Partial<typeof data> = {};
  if (data.nickname !== undefined) updateData.nickname = data.nickname;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  if (data.grade !== undefined) updateData.grade = data.grade;

  const updated = await prisma.user.update({
    where: { id: user!.id },
    data: updateData,
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      grade: true,
      role: true,
      realNameStatus: true,
    },
  });

  return ok({ user: updated });
}
