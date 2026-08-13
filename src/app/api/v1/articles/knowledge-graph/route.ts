export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLogin } from '@/lib/guards';
import { ok } from '@/lib/api-response';
import { ReviewStatus } from '@prisma/client';

// GET /api/v1/articles/knowledge-graph — 课外知识图谱数据（知识点-文章关联）
export async function GET(request: NextRequest) {
  const [user, err] = await requireLogin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const grade = searchParams.get('grade');
  const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 50)));

  // 获取已审核通过的文章，含关联的章节和知识点
  const where: Record<string, unknown> = {
    reviewStatus: ReviewStatus.REVIEWER_PASSED,
    publishedAt: { not: null },
  };
  if (subjectId) where.subjectId = Number(subjectId);
  if (grade) where.grade = Number(grade);

  const articles = await prisma.article.findMany({
    where,
    orderBy: { viewCount: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      tags: true,
      viewCount: true,
      subjectId: true,
      chapterId: true,
      chapter: {
        select: {
          id: true,
          title: true,
          textbook: { select: { id: true, name: true } },
        },
      },
      subject: { select: { id: true, name: true } },
    },
  });

  // 获取相关知识点
  const chapterIds = articles
    .map((a) => a.chapterId)
    .filter((id): id is string => id !== null);

  const knowledgePoints = chapterIds.length > 0
    ? await prisma.knowledgePoint.findMany({
        where: { chapterId: { in: chapterIds } },
        select: {
          id: true,
          title: true,
          chapterId: true,
          description: true,
        },
      })
    : [];

  // 构建图谱节点和边
  const nodes: Array<{
    id: string;
    label: string;
    type: 'article' | 'chapter' | 'knowledge' | 'subject';
    meta?: Record<string, unknown>;
  }> = [];

  const edges: Array<{ source: string; target: string; relation: string }> = [];

  // 学科节点
  const subjectMap = new Map<number, string>();
  articles.forEach((a) => {
    if (a.subject && !subjectMap.has(a.subject.id)) {
      subjectMap.set(a.subject.id, a.subject.name);
      nodes.push({
        id: `subject-${a.subject.id}`,
        label: a.subject.name,
        type: 'subject',
      });
    }
  });

  // 章节节点
  const chapterMap = new Map<string, string>();
  articles.forEach((a) => {
    if (a.chapter && !chapterMap.has(a.chapter.id)) {
      chapterMap.set(a.chapter.id, a.chapter.title);
      nodes.push({
        id: `chapter-${a.chapter.id}`,
        label: a.chapter.title,
        type: 'chapter',
        meta: { textbook: a.chapter.textbook.name },
      });
      // 学科 -> 章节
      if (a.subject) {
        edges.push({
          source: `subject-${a.subject.id}`,
          target: `chapter-${a.chapter.id}`,
          relation: 'contains',
        });
      }
    }
  });

  // 知识点节点
  knowledgePoints.forEach((kp) => {
    nodes.push({
      id: `kp-${kp.id}`,
      label: kp.title,
      type: 'knowledge',
      meta: { description: kp.description },
    });
    // 章节 -> 知识点
    if (chapterMap.has(kp.chapterId)) {
      edges.push({
        source: `chapter-${kp.chapterId}`,
        target: `kp-${kp.id}`,
        relation: 'has_kp',
      });
    }
  });

  // 文章节点
  articles.forEach((a) => {
    nodes.push({
      id: `article-${a.id}`,
      label: a.title,
      type: 'article',
      meta: {
        slug: a.slug,
        category: a.category,
        tags: a.tags,
        viewCount: a.viewCount,
      },
    });
    // 文章 -> 学科
    if (a.subject) {
      edges.push({
        source: `article-${a.id}`,
        target: `subject-${a.subject.id}`,
        relation: 'belongs_to',
      });
    }
    // 文章 -> 章节
    if (a.chapter) {
      edges.push({
        source: `article-${a.id}`,
        target: `chapter-${a.chapter.id}`,
        relation: 'relates_to',
      });
    }
  });

  // 按category聚类生成同分类文章间关联
  const categoryMap = new Map<string, string[]>();
  articles.forEach((a) => {
    if (!categoryMap.has(a.category)) categoryMap.set(a.category, []);
    categoryMap.get(a.category)!.push(a.id);
  });
  categoryMap.forEach((ids) => {
    // 同分类下取前5篇文章建立关联（避免边爆炸）
    const top = ids.slice(0, 5);
    for (let i = 0; i < top.length - 1; i++) {
      edges.push({
        source: `article-${top[i]}`,
        target: `article-${top[i + 1]}`,
        relation: 'same_category',
      });
    }
  });

  return ok({
    nodes,
    edges,
    stats: {
      articleCount: articles.length,
      chapterCount: chapterMap.size,
      knowledgePointCount: knowledgePoints.length,
      subjectCount: subjectMap.size,
    },
  });
}
