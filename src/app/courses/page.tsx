'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Tag, Input, Select, Button, Empty, App, Pagination } from 'antd';
import Link from 'next/link';

interface CourseItem {
  id: string;
  title: string;
  grade: number;
  boardType: string;
  status: string;
  intro: string | null;
  coverUrl: string | null;
  subject: { id: number; name: string };
  teacher: { id: string; nickname: string | null };
  _count: { enrollments: number; lessons: number };
}

const BOARD_LABEL: Record<string, string> = {
  CLASSROOM: '课堂学科',
  EXTRACURRICULAR: '课外知识',
  COMPETITION: '全国竞赛',
};

export default function CoursesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [list, setList] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ grade: '', subjectId: '', boardType: '', keyword: '' });

  const SUBJECT_OPTIONS = [
    {
      label: '小学',
      title: '小学 1-6 年级',
      options: [
        { label: '语文', value: '101' },
        { label: '数学', value: '102' },
        { label: '英语', value: '103' },
        { label: '科学', value: '104' },
        { label: '道德与法治', value: '105' },
      ],
    },
    {
      label: '初中',
      title: '初中 7-9 年级',
      options: [
        { label: '语文', value: '1' },
        { label: '数学', value: '2' },
        { label: '英语', value: '3' },
        { label: '物理', value: '4' },
        { label: '化学', value: '5' },
        { label: '历史', value: '6' },
        { label: '道德与法治', value: '7' },
        { label: '生物', value: '8' },
        { label: '地理', value: '9' },
      ],
    },
    {
      label: '高中',
      title: '高中 10-12 年级',
      options: [
        { label: '语文', value: '201' },
        { label: '数学', value: '202' },
        { label: '英语', value: '203' },
        { label: '物理', value: '204' },
        { label: '化学', value: '205' },
        { label: '生物', value: '206' },
        { label: '历史', value: '207' },
        { label: '地理', value: '208' },
        { label: '政治', value: '209' },
      ],
    },
  ];

  async function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '12' });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const res = await fetch(`/api/v1/courses?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setList(data.data);
        setTotal(data.pagination.total);
        setPage(p);
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
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">课程中心</h1>
        <Link href="/" className="text-emerald-600 text-sm">← 返回首页</Link>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <Input
          placeholder="搜索课程名称"
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          style={{ width: 200 }}
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
        <Select
          placeholder="学科"
          value={filters.subjectId || undefined}
          onChange={(v) => setFilters({ ...filters, subjectId: v ?? '' })}
          allowClear
          style={{ width: 140 }}
          options={SUBJECT_OPTIONS}
        />
        <Select
          placeholder="板块"
          value={filters.boardType || undefined}
          onChange={(v) => setFilters({ ...filters, boardType: v ?? '' })}
          allowClear
          style={{ width: 130 }}
          options={Object.entries(BOARD_LABEL).map(([v, l]) => ({ label: l, value: v }))}
        />
        <Button type="primary" onClick={() => load(1)}>查询</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : list.length === 0 ? (
        <Empty description="暂无课程" />
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((c) => (
              <Card
                key={c.id}
                hoverable
                onClick={() => router.push(`/courses/${c.id}`)}
                className="overflow-hidden"
                styles={{ body: { padding: 20 } }}
              >
                <div className="flex items-start justify-between mb-2">
                  <Tag color="green">{BOARD_LABEL[c.boardType] ?? c.boardType}</Tag>
                  <span className="text-xs text-gray-400">{c.subject.name} · {c.grade}年级</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 line-clamp-2">{c.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3 h-10">
                  {c.intro ?? '暂无简介'}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>主讲：{c.teacher.nickname ?? '未知'}</span>
                  <span>{c._count.lessons} 课时 · {c._count.enrollments} 人在学</span>
                </div>
              </Card>
            ))}
          </div>
          {total > 12 && (
            <div className="flex justify-center mt-8">
              <Pagination current={page} total={total} pageSize={12} onChange={load} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
