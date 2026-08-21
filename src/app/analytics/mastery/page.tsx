'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Select, Button, Tag, Empty, App, Row, Col, Statistic, Space, Tooltip } from 'antd';
import Link from 'next/link';

interface Subject { id: number; name: string; stage: string }
interface KP { id: string; title: string; description: string | null }
interface Chapter {
  id: string;
  title: string;
  parentId: string | null;
  mastery: number | null;
  masteryPercent: number | null;
  color: 'red' | 'yellow' | 'green' | 'gray';
  totalAttempts: number;
  correctAttempts: number;
  wrongUnmastered: number;
  knowledgePoints: KP[];
}
interface Textbook { id: string; name: string; chapters: Chapter[] }
interface MasteryData {
  textbooks: Textbook[];
  stats: { totalChapters: number; weakChapters: number; totalAttempts: number; masteredRate: number };
}

const COLOR_HEX: Record<string, string> = {
  red: '#ef4444', yellow: '#f59e0b', green: '#10b981', gray: '#d1d5db',
};
const COLOR_LABEL: Record<string, string> = {
  red: '薄弱', yellow: '一般', green: '掌握', gray: '未练',
};

export default function MasteryPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [grade, setGrade] = useState<number>(1);
  const [data, setData] = useState<MasteryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // 加载学科
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/subjects', { credentials: 'include' });
        const d = await res.json();
        if (d.success) {
          setSubjects(d.data.subjects);
          if (d.data.subjects.length > 0) setSubjectId(d.data.subjects[0].id);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const loadMastery = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/analytics/mastery?subjectId=${subjectId}&grade=${grade}`, { credentials: 'include' });
      const d = await res.json();
      if (d.success) setData(d.data);
      else message.error(d.error?.message ?? '加载失败');
    } catch { message.error('网络错误'); }
    finally { setLoading(false); }
  }, [subjectId, grade, message]);

  useEffect(() => { loadMastery(); /* eslint-disable-next-line */ }, [subjectId, grade]);

  // 一键专项练习：薄弱章节 → SMART 组卷
  async function genPractice(chapter: Chapter) {
    setGenerating(chapter.id);
    try {
      const res = await fetch('/api/v1/papers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: `${chapter.title} 专项练习`,
          subjectId,
          grade,
          chapterId: chapter.id,
          mode: 'SMART',
          questionCount: { SINGLE_CHOICE: 10, MULTI_CHOICE: 0, FILL_BLANK: 0, ESSAY: 0, CODING: 0 },
          difficultyDist: { easy: 30, medium: 50, hard: 20 },
        }),
      });
      const d = await res.json();
      if (d.success) {
        message.success(`已生成专项卷（${d.data.totalQuestions}题）`);
        router.push(`/practice?paperId=${d.data.paper.id}`);
      } else {
        message.error(d.error?.message ?? '生成失败，该章节题库可能不足');
      }
    } catch { message.error('网络错误'); }
    finally { setGenerating(null); }
  }

  const totalChapters = data?.stats.totalChapters ?? 0;
  const weakChapters = data?.stats.weakChapters ?? 0;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/analytics" className="text-emerald-600 text-sm">← 返回学情分析</Link>
      <h1 className="text-2xl font-bold mt-1">知识图谱诊断</h1>
      <p className="text-sm text-gray-500 mb-4">
        按教材章节掌握度三色热力图：<Tag color="red">薄弱</Tag>
        <Tag color="gold">一般</Tag><Tag color="green">掌握</Tag><Tag>未练</Tag>
        · 点击薄弱章节一键生成专项练习
      </p>

      <Space className="mb-6">
        <Select
          style={{ width: 160 }}
          placeholder="选择学科"
          value={subjectId}
          onChange={setSubjectId}
          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          style={{ width: 120 }}
          value={grade}
          onChange={setGrade}
          options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}年级` }))}
        />
      </Space>

      {data && (
        <Row gutter={16} className="mb-8">
          <Col span={6}><Card size="small"><Statistic title="章节总数" value={totalChapters} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="薄弱/一般章节" value={weakChapters} valueStyle={{ color: '#ef4444' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="累计答题" value={data.stats.totalAttempts} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="整体正确率" value={data.stats.masteredRate} suffix="%" /></Card></Col>
        </Row>
      )}

      {loading ? <div className="flex justify-center py-20"><Spin size="large" /></div> :
        !data || data.textbooks.length === 0 ? <Empty description="该学科年级暂无教材章节数据" /> :
          data.textbooks.map((tb) => (
            <div key={tb.id} className="mb-10">
              <h2 className="text-lg font-semibold mb-4 pb-2 border-b">{tb.name}</h2>
              <Row gutter={[16, 16]}>
                {tb.chapters.map((c) => (
                  <Col key={c.id} xs={24} sm={12} md={8} lg={6}>
                    <Card
                      size="small"
                      className="h-full"
                      style={{ borderTop: `3px solid ${COLOR_HEX[c.color]}` }}
                      title={<span className="text-sm">{c.title}</span>}
                      extra={<Tag color={c.color === 'yellow' ? 'gold' : c.color}>{COLOR_LABEL[c.color]}</Tag>}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <MasteryRing percent={c.masteryPercent} color={COLOR_HEX[c.color]} />
                        <div className="text-xs text-gray-500 leading-relaxed">
                          <div>答题 {c.totalAttempts} 次</div>
                          <div>答对 {c.correctAttempts} 次</div>
                          <div>未掌握错题 {c.wrongUnmastered}</div>
                        </div>
                      </div>
                      {c.knowledgePoints.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-400 mb-1">知识点（{c.knowledgePoints.length}）</div>
                          <div className="flex flex-wrap gap-1">
                            {c.knowledgePoints.slice(0, 4).map((kp) => (
                              <Tooltip key={kp.id} title={kp.description ?? ''}>
                                <Tag style={{ fontSize: 11 }}>{kp.title}</Tag>
                              </Tooltip>
                            ))}
                            {c.knowledgePoints.length > 4 && (
                              <Tag style={{ fontSize: 11 }}>+{c.knowledgePoints.length - 4}</Tag>
                            )}
                          </div>
                        </div>
                      )}
                      <Button
                        size="small"
                        type="primary"
                        block
                        loading={generating === c.id}
                        disabled={c.color === 'green'}
                        onClick={() => genPractice(c)}
                      >
                        {c.color === 'green' ? '已掌握' : '专项练习'}
                      </Button>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ))
      }
    </main>
  );
}

// 掌握度圆环（纯 SVG，与项目现有手写图表风格一致）
function MasteryRing({ percent, color }: { percent: number | null; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = percent === null ? 0 : (percent / 100) * c;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
      <circle
        cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="34" textAnchor="middle" fontSize="12" fill="#374151" fontWeight="600">
        {percent === null ? '—' : `${percent}%`}
      </text>
    </svg>
  );
}
