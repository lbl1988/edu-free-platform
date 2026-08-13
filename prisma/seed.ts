import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '13800000000';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD 未设置或长度不足 12 位，请在 .env 中配置后重试');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { role: Role.ADMIN, passwordHash },
    create: {
      phone: adminPhone,
      passwordHash,
      nickname: '平台管理员',
      role: Role.ADMIN,
    },
  });

  console.log(`✓ 管理员已初始化: phone=${admin.phone} id=${admin.id}`);

  // 预置学科目录（1-9 主学科）
  const subjects = [
    { id: 1, name: '语文', stage: 'ALL' },
    { id: 2, name: '数学', stage: 'ALL' },
    { id: 3, name: '英语', stage: 'ALL' },
    { id: 4, name: '物理', stage: 'JUNIOR' },
    { id: 5, name: '化学', stage: 'JUNIOR' },
    { id: 6, name: '生物', stage: 'JUNIOR' },
    { id: 7, name: '历史', stage: 'ALL' },
    { id: 8, name: '地理', stage: 'ALL' },
    { id: 9, name: '政治', stage: 'JUNIOR' },
    { id: 10, name: '信息技术', stage: 'ALL' },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }
  console.log(`✓ 已预置 ${subjects.length} 个学科`);
}

main()
  .catch((e) => {
    console.error('seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
