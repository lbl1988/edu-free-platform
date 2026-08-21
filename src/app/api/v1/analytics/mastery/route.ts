export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok, badRequest } from '@/lib/api-response';

// GET /api/v1/analytics/mastery?subjectId=&grade= — 知识图谱诊断 + 三色掌握度热力图（P0-2）
// 返回 教材 → 章节树 → 每章掌握度(0-1)/颜色(红黄绿)/答题统计/知识点列表
// 掌握度 = 正确率 - 0.1*未掌握错题数（衰减），三色：<0.4红 / 0.4-0.7黄 / >0.7绿
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const grade = searchParams.get('grade');
  if (!subjectId || !grade) return badRequest('需要 subjectId 和 grade 参数');
  const sid = Number(subjectId);
  const gd = Number(grade);

  // 1. 拉教材 + 章节树
  const textbooks = await prisma.textbook.findMany({
    where: { subjectId: sid, grade: gd },
    orderBy: { name: 'asc' },
    include: {
      chapters: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, title: true, parentId: true, sortOrder: true },
      },
    },
  });

  const chapterIds = textbooks.flatMap((t) => t.chapters.map((c) => c.id));
  if (chapterIds.length === 0) {
    return ok({ textbooks: [], stats: { totalChapters: 0, weakChapters: 0, totalAttempts: 0 } });
  }

  // 2. 学生答题记录（含 chapterId，用于按章聚合）
  const answers = await prisma.questionAnswer.findMany({
    where: { studentId: user!.id, question: { chapterId: { in: chapterIds } } },
    select: { isCorrect: true, question: { select: { chapterId: true } } },
  });

  // 3. 未掌握错题（按章统计，用于衰减掌握度）
  const wrongs = await prisma.wrongRecord.findMany({
    where: { studentId: user!.id, mastered: false, question: { chapterId: { in: chapterIds } } },
    select: { question: { select: { chapterId: true } } },
  });

  // 4. 知识点（章节下细分）
  const kps = await prisma.knowledgePoint.findMany({
    where: { chapterId: { in: chapterIds } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, chapterId: true, description: true },
  });

  // 聚合：按 chapterId 统计答题/错题/知识点
  const ansByChapter = new Map<string, { total: number; correct: number }>();
  for (const a of answers) {
    const cid = a.question.chapterId;
    if (!cid) continue;
    const cur = ansByChapter.get(cid) ?? { total: 0, correct: 0 };
    cur.total++;
    if (a.isCorrect) cur.correct++;
    ansByChapter.set(cid, cur);
  }
  const wrongByChapter = new Map<string, number>();
  for (const w of wrongs) {
    const cid = w.question.chapterId;
    if (!cid) continue;
    wrongByChapter.set(cid, (wrongByChapter.get(cid) ?? 0) + 1);
  }
  const kpByChapter = new Map<string, typeof kps>();
  for (const kp of kps) {
    const arr = kpByChapter.get(kp.chapterId) ?? [];
    arr.push(kp);
    kpByChapter.set(kp.chapterId, arr);
  }

  // 组装章节掌握度
  let weakCount = 0;
  const resultTextbooks = textbooks.map((t) => ({
    id: t.id,
    name: t.name,
    chapters: t.chapters.map((c) => {
      const a = ansByChapter.get(c.id);
      const wc = wrongByChapter.get(c.id) ?? 0;
      const total = a?.total ?? 0;
      const correct = a?.correct ?? 0;
      const rate = total > 0 ? correct / total : null;

      // 掌握度计算：有数据才计算；未掌握错题越多衰减越强
      let mastery: number | null = null;
      let color: 'red' | 'yellow' | 'green' | 'gray' = 'gray';
      if (rate !== null) {
        mastery = Math.max(0, Math.min(1, rate - 0.1 * wc));
        color = mastery < 0.4 ? 'red' : mastery < 0.7 ? 'yellow' : 'green';
      }
      if (color === 'red' || color === 'yellow') weakCount++;

      return {
        id: c.id,
        title: c.title,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        mastery,
        masteryPercent: mastery === null ? null : Math.round(mastery * 100),
        color,
        totalAttempts: total,
        correctAttempts: correct,
        wrongUnmastered: wc,
        knowledgePoints: (kpByChapter.get(c.id) ?? []).map((k) => ({
          id: k.id,
          title: k.title,
          description: k.description,
        })),
      };
    }),
  }));

  return ok({
    textbooks: resultTextbooks,
    stats: {
      totalChapters: chapterIds.length,
      weakChapters: weakCount,
      totalAttempts: answers.length,
      masteredRate:
        answers.length === 0
          ? 0
          : Math.round((answers.filter((a) => a.isCorrect).length / answers.length) * 1000) / 10,
    },
  });
}
