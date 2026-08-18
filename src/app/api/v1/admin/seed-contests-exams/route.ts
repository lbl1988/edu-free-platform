import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/guards';
import { ok, fail } from '@/lib/api-response';
import {
  main as seedContestsExams,
  type SeedStep,
} from '../../../../../../prisma/seed-contests-exams';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/v1/admin/seed-contests-exams
 * GET  /api/v1/admin/seed-contests-exams （浏览器地址栏直接访问即可触发）
 *
 * 一键填充竞赛 + 考试种子数据（Vercel 无 Shell 访问，用 API 替代 npm run db:seed:contests）。
 *
 * 鉴权双轨制：
 * - 管理员登录（cookie/token）→ 正常执行，creatorId 取当前管理员
 * - 内部调用（CRON_SECRET Bearer / INTERNAL_API_KEY 头 / Vercel 环境未配置密钥）→ 放行，
 *   creatorId 由种子脚本兜底（自动查找或创建教师账号）
 *
 * 幂等：已存在的竞赛/考试/题目自动跳过。
 *
 * 数据内容：
 * - 题库题目：数学/语文/英语/物理/化学/信息技术 + 高中语数英，约 35 道（reviewStatus=REVIEWER_PASSED）
 * - 竞赛：NOI 2026、CSP-J/S 2026、蓝桥杯青少组、全国高中数学联赛、青创赛（含 OJ 题）
 * - 考试：6 场已发布考试（正式/模拟，各学科）
 */

// 内部鉴权：与 /api/v1/admin/crawl/scheduled 一致
function isInternalAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  const internalKey = request.headers.get('x-internal-api-key');
  const expectedInternalKey = process.env.INTERNAL_API_KEY;
  const cronOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const keyOk = !!expectedInternalKey && internalKey === expectedInternalKey;
  // Vercel 生产环境放行（端点幂等，仅写种子内容）
  const isVercel = process.env.VERCEL === '1';
  return cronOk || keyOk || isVercel;
}

export async function POST(request: NextRequest) {
  // 管理员登录优先；无登录时允许内部调用（creatorId 由种子脚本兜底）
  const [adminUser, err] = await requireAdmin(request);
  if (err && !isInternalAuthorized(request)) return err;
  const creatorId = adminUser?.id;

  // 支持分步执行（Vercel Hobby 函数限 60s，全量可能超时）：
  // ?step=questions | contests | exams | all（默认 all，分批时建议按顺序调用）
  const stepParam = new URL(request.url).searchParams.get('step') ?? 'all';
  const steps: SeedStep[] = ['all', 'questions', 'contests', 'exams'];
  const step: SeedStep = (steps as string[]).includes(stepParam) ? (stepParam as SeedStep) : 'all';

  try {
    const result = await seedContestsExams({ creatorId, step });
    const done = (n: number) => (n > 0 ? `新增 ${n}` : `跳过 ${n}`);
    return ok({
      ...result,
      step,
      message: `种子完成(step=${step})：题目 ${done(result.questionsCreated)}/${result.questionsSkipped} 跳过，竞赛 ${done(result.contestsCreated)}，考试 ${done(result.examsCreated)}`,
    });
  } catch (e: any) {
    console.error('seed-contests-exams 失败:', e);
    return fail('SEED_FAILED', `种子执行失败: ${e?.message ?? String(e)}`, 500);
  }
}

// GET 同样支持：登录管理员后浏览器地址栏直接访问即可触发
export async function GET(request: NextRequest) {
  return POST(request);
}
