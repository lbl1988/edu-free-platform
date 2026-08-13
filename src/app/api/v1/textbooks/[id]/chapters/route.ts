export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, notFound } from '@/lib/api-response';

type Ctx = { params: { id: string } };

type ChapterFlat = {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
};

type ChapterNode = ChapterFlat & {
  knowledgePointCount: number;
  children: ChapterNode[];
};

function buildTree(flatList: ChapterFlat[], kpCountMap: Map<string, number>): ChapterNode[] {
  const map = new Map<string, ChapterNode>();
  const roots: ChapterNode[] = [];

  for (const c of flatList) {
    map.set(c.id, {
      ...c,
      knowledgePointCount: kpCountMap.get(c.id) ?? 0,
      children: [],
    });
  }

  for (const c of flatList) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortChildren(nodes: ChapterNode[]) {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) {
      if (n.children.length > 0) sortChildren(n.children);
    }
  }
  sortChildren(roots);

  return roots;
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const textbook = await prisma.textbook.findUnique({
    where: { id: params.id },
    include: { subject: { select: { id: true, name: true, stage: true } } },
  });
  if (!textbook) return notFound('教材不存在');

  const chapters = await prisma.chapter.findMany({
    where: { textbookId: params.id },
    select: { id: true, parentId: true, title: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });

  const chapterIds = chapters.map((c) => c.id);
  const kpCounts = await prisma.knowledgePoint.groupBy({
    by: ['chapterId'],
    where: { chapterId: { in: chapterIds } },
    _count: { chapterId: true },
  });

  const kpCountMap = new Map<string, number>();
  for (const k of kpCounts) {
    kpCountMap.set(k.chapterId, k._count.chapterId);
  }

  const tree = buildTree(chapters, kpCountMap);

  return ok({
    textbook: {
      id: textbook.id,
      name: textbook.name,
      subjectId: textbook.subjectId,
      grade: textbook.grade,
      publisher: textbook.publisher,
      subject: textbook.subject,
    },
    tree,
  });
}
