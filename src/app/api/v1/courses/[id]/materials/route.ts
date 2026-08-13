import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, okPaginated, badRequest, notFound, forbidden } from '@/lib/api-response';
import { uploadBuffer, isAllowedFile, getContentType, MAX_FILE_SIZE } from '@/lib/minio';
import { Role } from '@prisma/client';

type Ctx = { params: { id: string } };

// GET /api/v1/courses/{id}/materials — 课件列表
export async function GET(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, teacherId: true },
  });
  if (!course) return notFound('课程不存在');

  // 学生仅已发布或已选课可查看
  if (user!.role === Role.STUDENT && course.status !== 'PUBLISHED') {
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user!.id } },
    });
    if (!enrolled) return forbidden('无权查看');
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));

  const [total, items] = await Promise.all([
    prisma.material.count({ where: { courseId: params.id } }),
    prisma.material.findMany({
      where: { courseId: params.id },
      include: { uploader: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return okPaginated(items, { page, limit, total });
}

// POST /api/v1/courses/{id}/materials — 上传课件（multipart/form-data，仅教师）
export async function POST(request: NextRequest, { params }: Ctx) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { teacherId: true },
  });
  if (!course) return notFound('课程不存在');
  if (course.teacherId !== user!.id && user!.role !== Role.ADMIN) {
    return forbidden('仅课程创建者可上传课件');
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('请求需为 multipart/form-data');
  }

  const file = formData.get('file');
  const title = (formData.get('title') as string | null) ?? '';
  if (!(file instanceof File)) return badRequest('缺少 file 字段');
  if (!title) return badRequest('缺少 title 字段');
  if (file.size === 0) return badRequest('文件为空');
  if (file.size > MAX_FILE_SIZE) return badRequest(`文件超过限制 ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  if (!isAllowedFile(file.name)) return badRequest('不支持的文件类型');

  const buf = Buffer.from(await file.arrayBuffer());
  const upload = await uploadBuffer(buf, `materials/${params.id}`, {
    contentType: getContentType(file.name),
    originalName: file.name,
  });

  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  const material = await prisma.material.create({
    data: {
      courseId: params.id,
      title,
      objectKey: upload.objectKey,
      fileType: ext,
      fileSize: file.size,
      uploaderId: user!.id,
    },
  });

  return ok({ material, degraded: upload.degraded }, 201);
}
