'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Tag, Input, Select, Button, Empty, App, Pagination, Tabs } from 'antd';
import Link from 'next/link';
import dayjs from 'dayjs';
// BoardTypeStr 枚举值（客户端不导入 @prisma/client，避免 webpack alias noop 冲突）
const EXTRACURRICULAR = 'EXTRACURRICULAR' as const;
const COMPETITION = 'COMPETITION' as const;
type BoardTypeStr = typeof EXTRACURRICULAR | typeof COMPETITION;

interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverUrl: string | null;
  category: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  author: { id: string; nickname: string | null };
  subject: { id: number; name: string } | null;
}

interface CategoryAggregate {
  category: string;
  count: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  sciences: '科学探索',
  humanities: '人文历史',
  arts: '艺术启蒙',
  technology: '科技创新',
  nature: '自然百科',
  'contest-news': '竞赛资讯',
  reading: '课外阅读',
  life: '生活常识',
};

export default function ArticlesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [list, setList] = useState<ArticleItem[]>([]);
  const [categoryAggregates, setCategoryAggregates] = useState<CategoryAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [boardType, setBoardType] = useState<BoardTypeStr>(EXTRACURRICULAR);
  const [filters, setFilters] = useState({ category: '', subjectId: '', grade: '', keyword: '' });

  async function load(p = 1, bType: BoardTypeStr = boardType) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '12', boardType: bType });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const res = await fetch(`/api/v1/articles?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setList(data.data.articles || []);
        setCategoryAggregates(data.data.categoryAggregates || []);
        setTotal(data.pagination.total);
        setPage(p);
        setBoardType(bType);
      } else {
        message.error(data.error?.message ?? '加载失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, boardType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabItems = useMemo(() => [
    {
      key: EXTRACURRICULAR,
      label: '课外知识',
    },
    {
      key: COMPETITION,
      label: '竞赛资讯',
    },
  ], []);

  const categoryTabs = useMemo(() => {
    const items: Array<{ key: string; label: string }> = [
      { key: '', label: '全部' },
    ];
    categoryAggregates.forEach((ag) => {
      items.push({
        key: ag.category,
        label: `${CATEGORY_LABELS[ag.category] ?? ag.category} (${ag.count})`,
      });
    });
    return items;
  }, [categoryAggregates]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-emerald-600 text-sm">← 返回首页</Link>
          <h1 className="text-2xl font-bold mt-1">
            {boardType === COMPETITION ? '竞赛资讯' : '课外知识'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {boardType === COMPETITION
              ? '了解最新竞赛动态、赛事安排与获奖资讯'
              : '科学探索、人文历史、艺术启蒙等拓展阅读'}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <Tabs
          activeKey={boardType}
          items={tabItems}
          onChange={(k) => {
            setFilters({ ...filters, category: '' });
            load(1, k as BoardTypeStr);
          }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <Input.Search
          placeholder="搜索标题/摘要/标签"
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onSearch={() => load(1)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="年级"
          value={filters.grade || undefined}
          onChange={(v) => setFilters({ ...filters, grade: v ?? '' })}
          allowClear
          style={{ width: 110 }}
          options={Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1} 年级`, value: String(i + 1) }))}
        />
        <Button type="primary" onClick={() => load(1)}>查询</Button>
      </div>

      {categoryTabs.length > 1 && (
        <div className="mb-5">
          <Tabs
            size="small"
            activeKey={filters.category}
            items={categoryTabs}
            onChange={(k) => {
              setFilters({ ...filters, category: k });
              setTimeout(() => load(1), 0);
            }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : list.length === 0 ? (
        <Empty description="暂无文章" />
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((a) => (
              <Card
                key={a.id}
                hoverable
                onClick={() => router.push(`/articles/${a.slug}`)}
                className="overflow-hidden"
                styles={{ body: { padding: 0 } }}
              >
                {a.coverUrl && (
                  <div
                    className="w-full h-44 bg-gray-100 bg-cover bg-center"
                    style={{ backgroundImage: `url(${a.coverUrl})` }}
                  />
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Tag color="blue">
                      {CATEGORY_LABELS[a.category] ?? a.category}
                    </Tag>
                    {a.subject && (
                      <span className="text-xs text-gray-400">{a.subject.name}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2 line-clamp-2 min-h-[3.5rem]">
                    {a.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 h-10">
                    {a.summary ?? '暂无摘要'}
                  </p>
                  {a.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {a.tags.slice(0, 3).map((t) => (
                        <Tag key={t} className="!text-xs !py-0 !px-2">#{t}</Tag>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>作者：{a.author.nickname ?? '平台'}</span>
                    <span>
                      {a.publishedAt ? dayjs(a.publishedAt).format('MM-DD') : ''}
                      {' · '}{a.viewCount} 阅读 · {a.likeCount} 赞
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {total > 12 && (
            <div className="flex justify-center mt-8">
              <Pagination current={page} total={total} pageSize={12} onChange={(p) => load(p)} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
