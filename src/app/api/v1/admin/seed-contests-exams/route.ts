import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/guards';
import { ok, fail } from '@/lib/api-response';
import { main as seedContestsExams } from '../../../../../../prisma/seed-contests-exams';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/v1/admin/seed-contests-exams
 *
 * 一键填充竞赛 + 考试种子数据（Vercel 无 Shell 访问，用 API 替代 npm run db:seed:contests）。
 *
 * 需要 ADMIN 权限。幂等：已存在的竞赛/考试/题目自动跳过。
 *
 * 数据内容：
 * - 题库题目：数学/语文/英语/物理/化学/信息技术 + 高中语数英，约 35 道（reviewStatus=REVIEWER_PASSED）
 * - 竞赛：NOI 2026、CSP-J/S 2026、蓝桥杯青少组、全国高中数学联赛、青创赛（含 OJ 题）
 * - 考试：6 场已发布考试（正式/模拟，各学科）
 */
export async function POST(request: NextRequest) {
  const [adminUser, err] = await requireAdmin(request);
  if (err) return err;
  if (!adminUser) return fail('UNAUTHORIZED', '未登录', 401);

  try {
    const result = await seedContestsExams({ creatorId: adminUser.id });
    return ok({
      ...result,
      message: `种子完成：新增题目 ${result.questionsCreated} 道、竞赛 ${result.contestsCreated} 个、考试 ${result.examsCreated} 场（跳过已存在 ${result.questionsSkipped + result.contestsSkipped + result.examsSkipped} 条）`,
    });
  } catch (e: any) {
    console.error('seed-contests-exams 失败:', e);
    return fail('SEED_FAILED', `种子执行失败: ${e?.message ?? String(e)}`, 500);
  }
}
