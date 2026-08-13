'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Table, Tag, Empty, Button } from 'antd';
import Link from 'next/link';

interface Exam {
  id: string;
  title: string;
  examType: string;
  subjectId: number;
  subject: { name: string };
  grade: number;
  totalScore: number;
  passScore: number | null;
  duration: number;
  status: string;
  createdAt: string;
  creatorId: string;
  results?: Array<{ status: string; score: number | null }>;
}

interface Resp {
  exams: Exam[];
  pagination?: { total: number; page: number; limit: number };
}

export default function ExamsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Exam[]>([]);

  useEffect(() => {
    fetch('/api/v1/exams?page=1&limit=200', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { success: boolean; data?: Resp; error?: any }) => {
        if (d?.success) setData(d.data?.exams ?? []);
        else if (d?.error?.code === 'UNAUTHORIZED' || d?.error?.code === 'FORBIDDEN') router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const columns = [
    {
      title: '考试名称',
      dataIndex: 'title',
      key: 'title',
      render: (t: string, r: Exam) => (
        <Link href={`/analytics/exams/${r.id}`} className="text-emerald-600 hover:underline font-medium">{t}</Link>
      ),
    },
    {
      title: '学科',
      dataIndex: ['subject', 'name'],
      key: 'subject',
      render: (n: string) => <Tag color="geekblue">{n}</Tag>,
    },
    { title: '年级', dataIndex: 'grade', key: 'grade', render: (g: number) => `${g}年级` },
    {
      title: '类型',
      dataIndex: 'examType',
      key: 'examType',
      render: (t: string) => <Tag color={t === 'FORMAL' ? 'red' : 'blue'}>{t === 'FORMAL' ? '正式' : '模拟'}</Tag>,
    },
    { title: '总分', dataIndex: 'totalScore', key: 'totalScore' },
    {
      title: '及格分',
      dataIndex: 'passScore',
      key: 'passScore',
      render: (p: number | null, r: Exam) => p ?? `${Math.round(r.totalScore * 0.6)} (默认)`,
    },
    {
      title: '答卷/已批改',
      key: 'results',
      render: (_: any, r: Exam) => {
        const results = r.results ?? [];
        const total = results.length;
        const graded = results.filter(x => x.score != null).length;
        return <span>{total} / {graded}</span>;
      },
    },
    {
      title: '平均分',
      key: 'avg',
      render: (_: any, r: Exam) => {
        const scores = (r.results ?? []).filter(x => x.score != null).map(x => x.score as number);
        if (!scores.length) return <span className="text-gray-400">-</span>;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return <span className="font-semibold text-emerald-600">{avg.toFixed(1)}</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: Exam) => (
        <Link href={`/analytics/exams/${r.id}`}>
          <Button type="link" size="small">深度分析</Button>
        </Link>
      ),
    },
  ];

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">考试分析 · 选择考试</h1>
          <p className="text-gray-500 text-sm mt-1">点击「深度分析」查看单场考试详细数据</p>
        </div>
        <Link href="/analytics">← 返回总览</Link>
      </div>
      <Card>
        {loading ? (
          <div className="py-16 flex justify-center"><Spin size="large" /></div>
        ) : (
          <Table
            rowKey="id"
            dataSource={data}
            columns={columns as any}
            locale={{ emptyText: <Empty description="暂无考试数据" /> }}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </main>
  );
}
