/**
 * 预置课程采集源 seed 脚本
 *
 * 使用合法的开放教育资源作为采集源：
 * 1. 国家中小学智慧教育平台（公开内容）
 * 2. 中国教育电视台（公开课程）
 * 3. 可汗学院中文版（开放教育资源）
 * 4. OER Commons（开放教育资源）
 *
 * 运行方式：npx tsx prisma/seed-crawl-sources.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedSource {
  name: string;
  url: string;
  sourceType: 'RSS' | 'JSON_API' | 'HTML_SCRAPING';
  subjectId?: number;
  gradeLevel?: string;
  grade?: number;
  parseConfig?: Record<string, unknown>;
  crawlIntervalHours?: number;
  rateLimitMs?: number;
}

// 预置采集源：按学段+学科分组
const SEED_SOURCES: SeedSource[] = [
  // ========== 小学（G1-G6）==========
  {
    name: '国家智慧教育平台-小学语文',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=chinese&stage=primary',
    sourceType: 'JSON_API',
    subjectId: 101,
    gradeLevel: 'PRIMARY',
    grade: 1,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
      coverField: 'coverUrl',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-小学数学',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=math&stage=primary',
    sourceType: 'JSON_API',
    subjectId: 102,
    gradeLevel: 'PRIMARY',
    grade: 1,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
      coverField: 'coverUrl',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-小学英语',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=english&stage=primary',
    sourceType: 'JSON_API',
    subjectId: 103,
    gradeLevel: 'PRIMARY',
    grade: 3,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  // ========== 初中（G7-G9）==========
  {
    name: '国家智慧教育平台-初中语文',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=chinese&stage=junior',
    sourceType: 'JSON_API',
    subjectId: 1,
    gradeLevel: 'JUNIOR',
    grade: 7,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-初中数学',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=math&stage=junior',
    sourceType: 'JSON_API',
    subjectId: 2,
    gradeLevel: 'JUNIOR',
    grade: 7,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-初中物理',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=physics&stage=junior',
    sourceType: 'JSON_API',
    subjectId: 4,
    gradeLevel: 'JUNIOR',
    grade: 8,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-初中化学',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=chemistry&stage=junior',
    sourceType: 'JSON_API',
    subjectId: 5,
    gradeLevel: 'JUNIOR',
    grade: 9,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  // ========== 高中（G10-G12）==========
  {
    name: '国家智慧教育平台-高中语文',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=chinese&stage=senior',
    sourceType: 'JSON_API',
    subjectId: 201,
    gradeLevel: 'SENIOR',
    grade: 10,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-高中数学',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=math&stage=senior',
    sourceType: 'JSON_API',
    subjectId: 202,
    gradeLevel: 'SENIOR',
    grade: 10,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-高中物理',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=physics&stage=senior',
    sourceType: 'JSON_API',
    subjectId: 204,
    gradeLevel: 'SENIOR',
    grade: 10,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  {
    name: '国家智慧教育平台-高中化学',
    url: 'https://www.smartedu.cn/api/r/textbook?subject=chemistry&stage=senior',
    sourceType: 'JSON_API',
    subjectId: 205,
    gradeLevel: 'SENIOR',
    grade: 10,
    parseConfig: {
      dataPath: 'data.list',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
    },
    crawlIntervalHours: 48,
  },
  // ========== OER 开放教育资源 ==========
  {
    name: 'OER Commons - K-12 Mathematics',
    url: 'https://www.oercommons.org/api/search?terms=mathematics&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary',
    sourceType: 'JSON_API',
    gradeLevel: 'ALL',
    parseConfig: {
      dataPath: 'results',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
      coverField: 'thumbnail',
    },
    crawlIntervalHours: 72,
  },
  {
    name: 'OER Commons - K-12 Science',
    url: 'https://www.oercommons.org/api/search?terms=science&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary',
    sourceType: 'JSON_API',
    gradeLevel: 'ALL',
    parseConfig: {
      dataPath: 'results',
      titleField: 'title',
      urlField: 'url',
      descField: 'description',
      coverField: 'thumbnail',
    },
    crawlIntervalHours: 72,
  },
  // ========== HTML 采集示例 ==========
  {
    name: '教育电视台课程-通用',
    url: 'https://www.centv.cn/p/460676.html',
    sourceType: 'HTML_SCRAPING',
    gradeLevel: 'ALL',
    parseConfig: {
      linkPattern: '<a[^>]+href="(/p/\\d+\\.html)"[^>]*>([^<]+)</a>',
      baseUrl: 'https://www.centv.cn',
    },
    crawlIntervalHours: 72,
    rateLimitMs: 2000,
  },
];

async function main() {
  console.log('🌱 开始预置采集源...\n');

  // 0. 将教师账号升级为 ADMIN（爬虫管理需要管理员权限）
  console.log('🔑 升级教师账号为管理员...');
  const admin = await prisma.user.upsert({
    where: { phone: '13800000001' },
    update: { role: 'ADMIN' },
    create: {
      phone: '13800000001',
      passwordHash: await import('argon2').then((m) => m.default.hash('teacher123')),
      nickname: '教研组教师(管理员)',
      role: 'ADMIN',
      lastLoginAt: new Date(),
    },
  });
  console.log(`  ✅ 管理员账号: ${admin.phone} (role=${admin.role})\n`);

  let created = 0;
  let skipped = 0;

  for (const src of SEED_SOURCES) {
    // 按 URL 去重
    const existing = await prisma.contentSource.findFirst({
      where: { url: src.url },
    });
    if (existing) {
      console.log(`  ⏭️  跳过（已存在）: ${src.name}`);
      skipped++;
      continue;
    }

    await prisma.contentSource.create({
      data: {
        name: src.name,
        url: src.url,
        sourceType: src.sourceType,
        status: 'ACTIVE',
        subjectId: src.subjectId || null,
        gradeLevel: src.gradeLevel || null,
        grade: src.grade || null,
        parseConfig: src.parseConfig ? JSON.parse(JSON.stringify(src.parseConfig)) : undefined,
        crawlIntervalHours: src.crawlIntervalHours || 24,
        rateLimitMs: src.rateLimitMs || 1000,
        respectRobots: true,
      },
    });
    console.log(`  ✅ 创建: ${src.name}`);
    created++;
  }

  console.log(`\n📊 预置完成: 新增 ${created} 个采集源, 跳过 ${skipped} 个已存在`);
  console.log(`\n💡 下一步操作:`);
  console.log(`   1. 登录管理员账号访问 /admin/crawl 管理采集源`);
  console.log(`   2. 点击「全部采集」或单个「采集」按钮手动触发`);
  console.log(`   3. 配置外部 cron 定时调用 /api/v1/admin/crawl/scheduled 实现自动更新`);
  console.log(`   4. 在 Render 环境变量中设置 INTERNAL_API_KEY 用于定时采集鉴权`);
}

main()
  .catch((e) => {
    console.error('❌ Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
