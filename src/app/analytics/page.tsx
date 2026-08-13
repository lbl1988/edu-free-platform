'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Tag, Row, Col, Statistic, Empty } from 'antd';
import Link from 'next/link';

const COLOR_PALETTE = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function BarChart({ data, height = 260, unit = '' }: { data: Array<{ label: string; value: number }>; height?: number; unit?: string }) {
  if (!data || data.length === 0) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  const width = 100;
  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = (width - 20) / data.length - 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1="10" x2={width - 5} y1={height - 30 - p * (height - 60)} y2={height - 30 - p * (height - 60)} stroke="#e5e7eb" strokeWidth="0.15" strokeDasharray="0.5 0.5" />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 60);
        const x = 12 + i * (barWidth + 2);
        return (
          <g key={i}>
            <rect x={x} y={height - 30 - h} width={barWidth} height={h} fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} rx="1" />
            <text x={x + barWidth / 2} y={height - 30 - h - 2} fontSize="3" textAnchor="middle" fill="#374151">{d.value.toFixed(0)}{unit}</text>
            <text x={x + barWidth / 2} y={height - 18} fontSize="3" textAnchor="middle" fill="#6b7280">{d.label.length > 6 ? d.label.slice(0, 5) + '…' : d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ data, height = 260 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  if (!data || data.length === 0) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  const cx = 100;
  const cy = height / 2;
  const r = Math.min(70, height / 2 - 25);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const slices = data.map((d, i) => {
    const start = (acc / total) * Math.PI * 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.sin(start);
    const y1 = cy - r * Math.cos(start);
    const x2 = cx + r * Math.sin(end);
    const y2 = cy - r * Math.cos(end);
    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      label: d.label, value: d.value, ratio: d.value / total,
    };
  });
  const legendStart = cx + r + 20;
  return (
    <svg viewBox={`0 0 ${cx * 2 + 120} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ height }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="0.8" />)}
      {slices.map((s, i) => (
        <g key={`l-${i}`} transform={`translate(${legendStart}, ${cy - slices.length * 8 + i * 16})`}>
          <rect width="8" height="8" fill={s.color} rx="1.5" />
          <text x="12" y="6.5" fontSize="5" fill="#374151">{s.label} {Math.round(s.ratio * 100)}% ({s.value})</text>
        </g>
      ))}
    </svg>
  );
}

interface OverviewResp {
  summary: { examCount: number; resultCount: number; scoredResultCount: number; avgScore: number; passRate: number };
  bySubject: Array<{ subjectId: number; name: string; avgScore: number; n: number }>;
  byViolation: Array<{ type: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewResp | null>(null);

  useEffect(() => {
    fetch('/api/v1/exams/analytics/overview?timeRange=this_semester', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.success) setOverview(d.data);
        else if (d?.error?.code === 'UNAUTHORIZED' || d?.error?.code === 'FORBIDDEN') router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">考试数据分析看板</h1>
          <p className="text-gray-500 text-sm mt-1">本学期教学效果总览（按管理员/教师可见范围）</p>
        </div>
        <Link href="/analytics/exams/list">
          <Tag color="blue" className="cursor-pointer">进入单场考试分析 →</Tag>
        </Link>
      </div>

      <Row gutter={16} className="mb-6">
        <Col xs={12} md={6}><Card><Statistic title="考试总数" value={overview?.summary.examCount ?? 0} valueStyle={{ color: '#10B981' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="答卷总数" value={overview?.summary.resultCount ?? 0} valueStyle={{ color: '#3B82F6' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="整体平均分" value={overview?.summary.avgScore ?? 0} suffix="分" valueStyle={{ color: '#F59E0B' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="整体及格率" value={Math.round((overview?.summary.passRate ?? 0) * 10000) / 100} suffix="%" valueStyle={{ color: '#8B5CF6' }} /></Card></Col>
      </Row>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card title="学科平均得分">
          <BarChart data={(overview?.bySubject ?? []).map(s => ({ label: s.name, value: s.avgScore }))} unit="分" />
        </Card>
        <Card title="违规类型分布">
          <PieChart data={(overview?.byViolation ?? []).map(v => ({ label: v.type, value: v.count }))} />
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card title="考试状态分布">
          <PieChart data={(overview?.byStatus ?? []).map(s => ({ label: s.status, value: s.count }))} />
        </Card>
        <Card title="样本量（按学科）">
          <BarChart data={(overview?.bySubject ?? []).map(s => ({ label: s.name, value: s.n }))} unit="人" />
        </Card>
      </div>

      <div className="text-center">
        <Link href="/dashboard" className="text-emerald-600">← 返回工作台</Link>
      </div>
    </main>
  );
}
