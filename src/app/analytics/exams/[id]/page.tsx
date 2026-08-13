'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Spin, Tag, Statistic, Row, Col, Empty, Table, Button } from 'antd';
import Link from 'next/link';

const COLOR_PALETTE = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function BucketBar({
  buckets,
  totalScore,
  height = 260,
}: {
  buckets: Record<string, number>;
  totalScore: number;
  height?: number;
}) {
  const labels = ['<60', '60-70', '70-80', '80-90', '>=90'];
  const data = labels.map(k => ({ label: k, value: buckets[k] ?? 0, key: k }));
  const max = Math.max(...data.map(d => d.value), 1);
  const width = 100;
  const barWidth = (width - 20) / data.length - 2;
  const barColors = ['#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#10B981'];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1="10" x2={width - 5} y1={height - 30 - p * (height - 60)} y2={height - 30 - p * (height - 60)} stroke="#e5e7eb" strokeWidth="0.15" strokeDasharray="0.5 0.5" />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 60);
        const x = 12 + i * (barWidth + 2);
        return (
          <g key={d.key}>
            <rect x={x} y={height - 30 - h} width={barWidth} height={h} fill={barColors[i]} rx="1" />
            <text x={x + barWidth / 2} y={height - 30 - h - 2} fontSize="3" textAnchor="middle" fill="#374151">{d.value}人</text>
            <text x={x + barWidth / 2} y={height - 18} fontSize="3" textAnchor="middle" fill="#6b7280">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizontalRateBars({
  questions,
  height = 420,
}: {
  questions: Array<{
    id: string;
    sortOrder: number;
    contentPreview: string;
    perScore: number;
    avgFinalScore: number;
    scoreRate: number;
    answerCount: number;
  }>;
  height?: number;
}) {
  if (!questions || questions.length === 0) return <Empty description="暂无题目数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  const rowH = Math.max(18, (height - 40) / questions.length);
  const chartW = 100;
  const labelW = 35;
  const valW = 18;
  const totalW = labelW + chartW + valW;
  return (
    <svg viewBox={`0 0 ${totalW} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {questions.map((q, i) => {
        const y = 10 + i * rowH;
        const rate = Math.max(0, Math.min(1, q.scoreRate));
        const color = rate < 0.5 ? '#EF4444' : rate < 0.8 ? '#F59E0B' : '#10B981';
        const qnum = q.sortOrder > 0 ? q.sortOrder : i + 1;
        const textContent = `Q${qnum}. ${q.contentPreview}`;
        const displayText = textContent.length > 26 ? textContent.slice(0, 24) + '…' : textContent;
        return (
          <g key={q.id}>
            <text x={2} y={y + rowH / 2 - 1} fontSize="3" fill="#374151" dominantBaseline="middle">
              {displayText}
            </text>
            <rect x={labelW} y={y + 2} width={chartW - 2} height={rowH - 6} fill="#f3f4f6" rx="1.5" />
            <rect x={labelW} y={y + 2} width={(chartW - 2) * rate} height={rowH - 6} fill={color} rx="1.5" />
            <text x={labelW + chartW + 2} y={y + rowH / 2 - 1} fontSize="3" fill="#374151" dominantBaseline="middle">
              {(rate * 100).toFixed(0)}% ({q.avgFinalScore}/{q.perScore}分, n={q.answerCount})
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ data, height = 260 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  if (!data || data.length === 0) return <Empty description="暂无违规数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
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
    <svg viewBox={`0 0 ${cx * 2 + 130} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ height }}>
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

interface AnalyticsResp {
  basic: {
    id: string; title: string; totalScore: number; passScore: number;
    avgScore: number; duration: number; participants: number; gradedCount: number; scoredCount: number;
  };
  scoreDistribution: { '<60': number; '60-70': number; '70-80': number; '80-90': number; '>=90': number };
  questionStats: Array<{
    id: string; sortOrder: number; contentPreview: string; perScore: number;
    avgFinalScore: number; answerCount: number; scoreRate: number;
  }>;
  violationStats: Array<{ type: string; count: number }>;
  topStudents: Array<{ studentId: string; nickname: string; grade: number | null; score: number | null; status: string }>;
}

export default function ExamAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/v1/exams/${params.id}/analytics`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) {
          const e = await r.json().catch(() => null);
          setErrMsg(e?.error?.message || '加载失败');
          return null;
        }
        return r.json();
      })
      .then(d => { if (d?.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, [params?.id, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;
  if (errMsg) return (
    <main className="max-w-7xl mx-auto p-6">
      <Card>
        <p className="text-red-500">{errMsg}</p>
        <Link href="/analytics/exams/list" className="mt-4 inline-block text-emerald-600">← 返回考试列表</Link>
      </Card>
    </main>
  );
  if (!data) return null;

  const basic = data.basic;
  const passRate = basic.scoredCount > 0
    ? (Object.entries(data.scoreDistribution).reduce((s, [k, v]) => {
        if (k !== '<60') return s + v;
        return s;
      }, 0) / basic.scoredCount)
    : 0;

  const topColumns = [
    { title: '排名', key: 'rank', render: (_: any, __: any, i: number) => i + 1, width: 70 },
    { title: '学生', key: 'name', render: (_: any, r: any) => r.nickname },
    { title: '年级', dataIndex: 'grade', key: 'grade', render: (g: any) => g ? `${g}年级` : '-' },
    { title: '得分', dataIndex: 'score', key: 'score', render: (s: any) => s != null ? <span className="font-semibold text-emerald-600">{s}</span> : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (st: string) => <Tag color={st === 'GRADED' ? 'green' : st === 'SUBMITTED' ? 'blue' : 'default'}>{st}</Tag> },
  ];

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">单场考试分析 · {basic.title}</h1>
          <p className="text-gray-500 text-sm mt-1">ID：{basic.id}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/exams/${basic.id}/results`}><Button ghost>查看成绩表</Button></Link>
          <Link href="/analytics/exams/list">← 返回考试列表</Link>
        </div>
      </div>

      <Card className="mb-6">
        <Row gutter={16}>
          <Col xs={12} md={4}>
            <Statistic title="总分" value={basic.totalScore} suffix="分" valueStyle={{ color: '#3B82F6' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="及格线" value={basic.passScore} suffix="分" valueStyle={{ color: '#F59E0B' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="参加人数" value={basic.participants} valueStyle={{ color: '#8B5CF6' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="已批改" value={basic.gradedCount} suffix={`/${basic.scoredCount}`} valueStyle={{ color: '#14B8A6' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="平均分" value={basic.avgScore} suffix="分" valueStyle={{ color: '#10B981' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="及格率" value={Math.round(passRate * 10000) / 100} suffix="%" valueStyle={{ color: '#EC4899' }} />
          </Col>
        </Row>
      </Card>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card title="分数段分布" extra={<Tag color="blue">{basic.scoredCount} 人已出分</Tag>}>
          <BucketBar buckets={data.scoreDistribution} totalScore={basic.totalScore} />
        </Card>
        <Card title="违规类型分布">
          <PieChart data={data.violationStats.map(v => ({ label: v.type, value: v.count }))} />
        </Card>
      </div>

      <Card
        title="题目得分率分析"
        extra={
          <div className="flex gap-2 items-center text-xs">
            <Tag color="red">难度高 {'<'}50%</Tag>
            <Tag color="orange">中等 50-80%</Tag>
            <Tag color="green">简单 {'>'}80%</Tag>
          </div>
        }
        className="mb-6"
      >
        <div className="overflow-x-auto">
          <HorizontalRateBars questions={data.questionStats} height={Math.max(260, data.questionStats.length * 32 + 40)} />
        </div>
      </Card>

      <Card title="Top 10 得分榜" className="mb-6">
        {data.topStudents.length === 0 ? (
          <Empty description="暂无得分数据" />
        ) : (
          <Table
            rowKey="studentId"
            dataSource={data.topStudents}
            columns={topColumns as any}
            pagination={false}
            size="middle"
          />
        )}
      </Card>

      <div className="text-center">
        <Link href="/analytics" className="text-emerald-600">← 返回总览看板</Link>
      </div>
    </main>
  );
}
