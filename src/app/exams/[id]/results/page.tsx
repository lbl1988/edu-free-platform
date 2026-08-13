'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, Spin, App, Button, Space, Tag, Table, Progress, Descriptions, Empty, Modal, InputNumber, Form, List, Alert, Divider } from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';

type QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'FILL_BLANK' | 'ESSAY' | 'CODING';

interface ResultRow {
  id: string;
  examId: string;
  studentId: string;
  status: string;
  startTime: string;
  deadline: string;
  submitTime: string | null;
  score: number | null;
  objectiveScore: number | null;
  subjectiveScore: number | null;
  totalScore: number;
  correctCount: number;
  totalCount: number;
  cheatingCount: number;
  graded: boolean;
  student: { id: string; nickname: string; grade: number };
  violations: { id: string; type: string; occurredAt: string }[];
}

interface ExamInfo {
  id: string; title: string; duration: number; totalScore: number; creator: { nickname: string };
}

interface AnswerRow {
  id: string;
  answer: string | null;
  isCorrect: boolean | null;
  aiScore: number | null;
  finalScore: number | null;
  perScore: number;
  answeredFast: boolean;
  examQuestion: {
    id: string; sortOrder: number; perScore: number; questionType: QuestionType;
    content: string; options: string[] | null; answer: string | null; analysis: string | null;
  };
}

function typeLabel(t: QuestionType) {
  return ({ SINGLE_CHOICE: '单选', MULTI_CHOICE: '多选', FILL_BLANK: '填空', ESSAY: '问答', CODING: '编程' } as const)[t];
}

export default function ExamResultsPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [gradeTarget, setGradeTarget] = useState<{
    result: ResultRow; answers: AnswerRow[];
  } | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  async function load(page = 1) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/exams/${params.id}/results?page=${page}&limit=100`, { credentials: 'include' });
      if (res.status === 401) { router.push(`/login?redirect=/exams/${params.id}/results`); return; }
      if (res.status === 403) { modal.warning({ title: '无权访问', onOk: () => router.push('/exams') }); return; }
      const d = await res.json();
      if (d.success) {
        setExam(d.data.exam);
        setResults(d.data.results ?? []);
      } else message.error(d.error?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params.id]);

  const stats = useMemo(() => {
    const n = results.length;
    if (n === 0) return { avg: 0, pass: 0, max: 0, min: 0 };
    const scores = results.map((r) => r.score ?? 0);
    const passCount = results.filter((r) => {
      if (r.status === 'VIOLATION_SUBMIT') return false;
      const total = r.totalScore;
      if (total === 0) return true;
      return (r.score ?? 0) / total >= 0.6;
    }).length;
    return {
      avg: Math.round((scores.reduce((s, v) => s + v, 0) / n) * 10) / 10,
      pass: Math.round(passCount / n * 1000) / 10,
      max: Math.max(...scores),
      min: Math.min(...scores),
    };
  }, [results]);

  async function openGrade(r: ResultRow) {
    // 拉 resultId 的详情：借用 /exams/{id}/result 接口的返回结构不适合，另走 GET results 需要更完整。
    // 我们直接 GET /api/v1/exams/{id}/results/{r.id}/detail 不存在：换一个方式——学生视角查自己的成绩接口需要改到 /result?studentId=xxx。
    // 这里先 fetch 一个临时的：GET /exams/{id}/result?studentId= 不存在，所以实现一个新 GET /results/{resultId}/detail
    const detailRes = await fetch(`/api/v1/exams/${params.id}/results/${r.id}/detail`, { credentials: 'include' });
    if (detailRes.status !== 200) { message.error('无法加载答题详情'); return; }
    const d = await detailRes.json();
    if (!d.success) { message.error(d.error?.message ?? '加载失败'); return; }
    const ans = (d.data.result?.answers as AnswerRow[]) ?? [];
    setGradeTarget({ result: r, answers: ans });
    // 初始化表单分数：主观题默认 finalScore / perScore
    const scores: Record<string, number> = {};
    ans.forEach((a) => {
      if (a.examQuestion.questionType === 'ESSAY' || a.examQuestion.questionType === 'CODING' || a.examQuestion.questionType === 'FILL_BLANK') {
        if (typeof a.finalScore === 'number') scores[a.examQuestion.id] = a.finalScore;
        else if (typeof a.aiScore === 'number') scores[a.examQuestion.id] = a.aiScore;
      }
    });
    form.setFieldsValue({ scores });
  }

  async function submitGrade() {
    if (!gradeTarget) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/exams/${params.id}/results/${gradeTarget.result.id}/grade`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: values.scores ?? {} }),
      });
      const d = await res.json();
      if (d.success) {
        message.success('批改成功');
        setGradeTarget(null);
        load();
      } else {
        modal.error({ title: '批改失败', content: d.error?.message });
      }
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      title: '学生',
      dataIndex: ['student', 'nickname'],
      render: (v: string, r: ResultRow) => <Link className="text-emerald-700" href="#">{v}</Link>,
    },
    { title: '年级', dataIndex: ['student', 'grade'], width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => {
        const map: Record<string, any> = {
          NOT_STARTED: 'default', IN_PROGRESS: 'processing', SUBMITTED: 'blue',
          GRADED: 'green', VIOLATION_SUBMIT: 'red',
        };
        return <Tag color={map[v] ?? 'default'}>{v}</Tag>;
      },
    },
    {
      title: '分数',
      render: (_v: any, r: ResultRow) => {
        const pct = r.totalScore === 0 ? 0 : Math.round(((r.score ?? 0) / r.totalScore) * 100);
        return (
          <div className="min-w-[180px]">
            <div className="text-sm">{r.score ?? '—'} / {r.totalScore} <span className="text-gray-400">({pct}%)</span></div>
            <Progress percent={pct} showInfo={false} size="small" status={r.status === 'VIOLATION_SUBMIT' ? 'exception' : pct >= 60 ? 'success' : 'exception'} />
          </div>
        );
      },
    },
    { title: '正确', dataIndex: 'correctCount', render: (v: any, r: ResultRow) => `${v ?? 0}/${r.totalCount}`, width: 90 },
    { title: '违规', dataIndex: 'cheatingCount', render: (v: any) => v > 0 ? <span className="text-red-600">{v}</span> : v, width: 80 },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      width: 170,
      render: (v: string | null, r: ResultRow) => v ? dayjs(v).format('MM-DD HH:mm') : <span className="text-gray-400">（{r.status}）</span>,
    },
    {
      title: '操作',
      width: 160,
      render: (_v: any, r: ResultRow) => (
        <Space>
          <Button size="small" type="link" disabled={!['SUBMITTED', 'GRADED', 'VIOLATION_SUBMIT'].includes(r.status)} onClick={() => openGrade(r)}>
            {r.graded ? '查看/复核' : '批改'}
          </Button>
          <Button size="small" type="link" disabled={r.violations.length === 0} onClick={() => {
            modal.info({
              title: `违规事件（${r.violations.length}）`,
              content: (
                <List
                  size="small"
                  dataSource={r.violations}
                  renderItem={(v: any) => (
                    <List.Item>
                      <span className="text-gray-400 mr-2">{dayjs(v.occurredAt).format('HH:mm:ss')}</span>
                      <Tag color="red" className="!mr-2">{v.type}</Tag>
                      <span>{v.detail}</span>
                    </List.Item>
                  )}
                />
              ),
            });
          }}>违规</Button>
        </Space>
      ),
    },
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <Link href="/exams" className="text-emerald-600 text-sm">← 考试列表</Link>
      <h1 className="text-2xl font-bold mt-1">{exam?.title} · 成绩管理</h1>
      <p className="text-sm text-gray-500 mb-6">
        出卷 {exam?.creator?.nickname} · 时长 {exam?.duration} 分钟 · 满分 {exam?.totalScore} · 共 {results.length} 人
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card size="small"><div className="text-gray-400 text-xs">平均分</div><div className="text-2xl font-semibold text-emerald-700">{stats.avg}</div></Card>
        <Card size="small"><div className="text-gray-400 text-xs">及格率</div><div className="text-2xl font-semibold">{stats.pass}%</div></Card>
        <Card size="small"><div className="text-gray-400 text-xs">最高分</div><div className="text-2xl font-semibold text-blue-700">{stats.max}</div></Card>
        <Card size="small"><div className="text-gray-400 text-xs">最低分</div><div className="text-2xl font-semibold text-orange-700">{stats.min}</div></Card>
      </div>

      <Table rowKey="id" columns={columns as any} dataSource={results} pagination={{ pageSize: 50 }} />

      <Modal
        title={gradeTarget ? `批改 — ${gradeTarget.result.student.nickname}` : '批改'}
        open={!!gradeTarget}
        onCancel={() => setGradeTarget(null)}
        onOk={submitGrade}
        confirmLoading={saving}
        width={920}
        okText="保存分数"
        footer={(gradeTarget?.result.status === 'GRADED'
          ? <Space><Button onClick={() => setGradeTarget(null)}>关闭</Button><Button type="primary" onClick={submitGrade} loading={saving}>保存修改</Button></Space>
          : undefined) as any}
      >
        {gradeTarget && (
          <div>
            <Descriptions size="small" column={2} bordered className="mb-4">
              <Descriptions.Item label="状态">{gradeTarget.result.status}</Descriptions.Item>
              <Descriptions.Item label="违规">{gradeTarget.result.cheatingCount}</Descriptions.Item>
              <Descriptions.Item label="客观分">{gradeTarget.result.objectiveScore ?? 0}</Descriptions.Item>
              <Descriptions.Item label="主观分（将覆盖）">{gradeTarget.result.subjectiveScore ?? '未批改'}</Descriptions.Item>
            </Descriptions>

            {gradeTarget.result.cheatingCount > 0 && (
              <Alert type="error" showIcon message={`已记录 ${gradeTarget.result.cheatingCount} 次违规`} className="mb-4" />
            )}

            <Divider orientation="left">逐题批改（仅主观题可修改分数）</Divider>

            <Space direction="vertical" className="w-full" size="large">
              {gradeTarget.answers.map((a, i) => {
                const q = a.examQuestion;
                const obj = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'FILL_BLANK'].includes(q.questionType);
                const current = a.finalScore ?? a.aiScore ?? 0;
                return (
                  <Card size="small" key={a.id}>
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                      <div>
                        <span className="font-bold mr-2">{i + 1}.</span>
                        <Tag>{typeLabel(q.questionType)}</Tag>
                        <span className="text-sm text-gray-500">
                          (满分 {q.perScore}) · 当前得分 {current}/{q.perScore}
                          {obj && <Tag color="blue" className="!ml-2">客观（不可改）</Tag>}
                          {!obj && <Tag color="purple" className="!ml-2">主观题（可改）</Tag>}
                        </span>
                      </div>
                      {!obj && (
                        <Form.Item noStyle shouldUpdate={false} className="!mb-0" name={['scores', q.id]}>
                          <InputNumber min={0} max={q.perScore} step={0.5} precision={1} />
                        </Form.Item>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap mb-2">{q.content}</div>
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="学生作答">
                        <pre className="whitespace-pre-wrap text-[13px] !mb-0">{a.answer ?? '未作答'}</pre>
                      </Descriptions.Item>
                      {q.answer && (
                        <Descriptions.Item label="参考答案">
                          <div className="text-emerald-700 whitespace-pre-wrap">{q.answer}</div>
                        </Descriptions.Item>
                      )}
                      {q.analysis && (
                        <Descriptions.Item label="解析">
                          <div className="whitespace-pre-wrap text-gray-600">{q.analysis}</div>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Card>
                );
              })}
            </Space>
          </div>
        )}
      </Modal>
    </main>
  );
}
