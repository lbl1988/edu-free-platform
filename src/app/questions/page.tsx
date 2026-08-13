'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Tag, Input, Select, Button, Empty, Pagination, App } from 'antd';
import Link from 'next/link';

interface QuestionItem {
  id: string;
  content: string;
  difficulty: number;
  questionType: string;
  source: string | null;
  correctRate: number | null;
  subject: { id: number; name: string };
  chapter: { id: string; title: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: '单选',
  MULTI_CHOICE: '多选',
  FILL_BLANK: '填空',
  ESSAY: '解答',
  CODING: '编程',
};

function difficultyColor(d: number): string {
  if (d <= 2) return 'green';
  if (d === 3) return 'blue';
  return 'red';
}
function difficultyLabel(d: number): string {
  if (d <= 2) return '简单';
  if (d === 3) return '中等';
  return '困难';
}

export default function QuestionsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [list, setList] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    subjectId: '', grade: '', difficulty: '', questionType: '', keyword: '',
  });

  async function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '15' });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const res = await fetch(`/api/v1/questions?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setList(data.data.map((q: any) => ({
          ...q,
          correctRate: q.attemptCount > 0 ? Math.round(q.correctCount / q.attemptCount * 100) : null,
        })));
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

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">题库刷题</h1>
        <div className="flex gap-3">
          <Link href="/practice"><Button type="primary">开始练习 · 随机组卷</Button></Link>
          <Link href="/wrong">错题本</Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <Input
          placeholder="搜索题干关键词"
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          style={{ width: 220 }} allowClear
        />
        <Select placeholder="学科" value={filters.subjectId || undefined}
          onChange={(v) => setFilters({ ...filters, subjectId: v ?? '' })} allowClear
          style={{ width: 140 }}
          options={[
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
          ]} />
        <Select placeholder="年级" value={filters.grade || undefined}
          onChange={(v) => setFilters({ ...filters, grade: v ?? '' })} allowClear
          style={{ width: 110 }}
          options={Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1} 年级`, value: String(i + 1) }))} />
        <Select placeholder="难度" value={filters.difficulty || undefined}
          onChange={(v) => setFilters({ ...filters, difficulty: v ?? '' })} allowClear
          style={{ width: 110 }}
          options={[
            { label: '简单 1-2', value: '1' },
            { label: '中等 3', value: '3' },
            { label: '困难 4-5', value: '4' },
          ]} />
        <Select placeholder="题型" value={filters.questionType || undefined}
          onChange={(v) => setFilters({ ...filters, questionType: v ?? '' })} allowClear
          style={{ width: 110 }}
          options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ label: l, value: v }))} />
        <Button type="primary" onClick={() => load(1)}>查询</Button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Spin size="large" /></div> :
        list.length === 0 ? <Empty description="暂无题目" /> :
          <>
            <div className="space-y-4">
              {list.map((q, idx) => (
                <Card
                  key={q.id}
                  size="small"
                  hoverable
                  onClick={() => router.push(`/practice?questionId=${q.id}`)}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-gray-400 text-sm w-8">#{idx + (page - 1) * 15 + 1}</span>
                    <Tag>{TYPE_LABEL[q.questionType] ?? q.questionType}</Tag>
                    <Tag color={difficultyColor(q.difficulty)}>
                      {difficultyLabel(q.difficulty)} ({q.difficulty})
                    </Tag>
                    <Tag>{q.subject.name}</Tag>
                    {q.chapter && <Tag color="purple">{q.chapter.title}</Tag>}
                    {q.correctRate !== null && (
                      <span className="text-xs text-gray-400">正确率 {q.correctRate}%</span>
                    )}
                    {q.source && <span className="text-xs text-gray-400">来源：{q.source}</span>}
                  </div>
                  <div className="text-[15px] line-clamp-3">{q.content}</div>
                </Card>
              ))}
            </div>
            {total > 15 && (
              <div className="flex justify-center mt-8">
                <Pagination current={page} total={total} pageSize={15} onChange={load} />
              </div>
            )}
          </>
      }
    </main>
  );
}
