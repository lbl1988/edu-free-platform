'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Spin,
  Tag,
  Button,
  Table,
  App,
  Modal,
  Form,
  Select,
  Input,
  Badge,
  Progress,
  Descriptions,
  Row,
  Col,
  Divider,
  Alert,
  Space,
  Empty,
} from 'antd';
import {
  SafetyCertificateOutlined,
  PlayCircleOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';

interface ProblemShallow {
  id: string;
  problemCode: string;
  title: string;
  difficulty: number;
  timeLimitMs: number;
  memoryLimitMB: number;
  totalSubmit: number;
  totalAccept: number;
  sortOrder: number;
  description?: string;
  inputFormat?: string | null;
  outputFormat?: string | null;
  samples?: unknown;
  testdataKey?: string | null;
}

interface ContestDetail {
  id: string;
  title: string;
  shortTitle: string | null;
  whitelist: boolean;
  subject: { id: number; name: string };
  stage: string;
  year: number;
  startTime: string;
  endTime: string;
  durationMin: number;
  intro: string | null;
  awardInfo: string | null;
  course: { id: string; title: string } | null;
  exam: { id: string; title: string } | null;
  creator: { id: string; nickname: string | null };
  enrollmentsCount: number;
  problemsCount: number;
  problems: ProblemShallow[];
}

interface MySubmission {
  id: string;
  verdict: string;
  score?: number | null;
  runTimeMs?: number | null;
  runMemoryKB?: number | null;
  message?: string | null;
  judgedAt?: string | null;
  createdAt: string;
}

type Language = 'C' | 'C++' | 'Java' | 'Python' | 'JavaScript' | 'Go' | 'Rust';

const VERDICT_LABELS: Record<string, { text: string; color: string; icon: any }> = {
  PENDING: { text: '等待中', color: 'default', icon: <ClockCircleOutlined /> },
  JUDGING: { text: '判题中', color: 'processing', icon: <Spin size="small" /> },
  ACCEPTED: { text: '通过 AC', color: 'success', icon: <CheckCircleFilled /> },
  WRONG_ANSWER: { text: '答案错误 WA', color: 'error', icon: <CloseCircleFilled /> },
  TIME_LIMIT_EXCEEDED: { text: '超时 TLE', color: 'warning', icon: <ClockCircleOutlined /> },
  MEMORY_LIMIT_EXCEEDED: { text: '超内存 MLE', color: 'warning', icon: <ExclamationCircleOutlined /> },
  RUNTIME_ERROR: { text: '运行时错误 RE', color: 'error', icon: <CloseCircleFilled /> },
  COMPILE_ERROR: { text: '编译错误 CE', color: 'error', icon: <ExclamationCircleOutlined /> },
  PRESENTATION_ERROR: { text: '格式错误 PE', color: 'warning', icon: <ExclamationCircleOutlined /> },
  SYSTEM_ERROR: { text: '系统错误 SE', color: 'error', icon: <ExclamationCircleOutlined /> },
};

const DIFFICULTY_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'green' },
  2: { text: '简单', color: 'cyan' },
  3: { text: '中等', color: 'blue' },
  4: { text: '较难', color: 'orange' },
  5: { text: '困难', color: 'red' },
};

const LANG_OPTIONS = [
  { label: 'C', value: 'C' },
  { label: 'C++', value: 'C++' },
  { label: 'Java', value: 'Java' },
  { label: 'Python 3', value: 'Python' },
  { label: 'JavaScript (Node)', value: 'JavaScript' },
  { label: 'Go', value: 'Go' },
  { label: 'Rust', value: 'Rust' },
];

function SampleView({ samples }: { samples: unknown }) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  return (
    <div className="space-y-3 mt-3">
      {samples.map((s, i) => (
        <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">样例 {i + 1}</div>
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-3 border-b md:border-b-0 md:border-r border-gray-100">
              <div className="text-xs text-gray-400 mb-1">输入</div>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded whitespace-pre-wrap m-0">{s.input ?? ''}</pre>
            </div>
            <div className="p-3">
              <div className="text-xs text-gray-400 mb-1">输出</div>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded whitespace-pre-wrap m-0">{s.output ?? ''}</pre>
            </div>
          </div>
          {s.note && (
            <div className="p-3 border-t border-gray-100 bg-yellow-50">
              <div className="text-xs text-yellow-700 mb-1 font-medium">提示</div>
              <div className="text-sm text-gray-700">{s.note}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ContestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [activeProblem, setActiveProblem] = useState<ProblemShallow | null>(null);
  const [problemDetailLoading, setProblemDetailLoading] = useState(false);
  const [submitForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [currentSubmission, setCurrentSubmission] = useState<MySubmission | null>(null);
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadUser() {
    const res = await fetch('/api/v1/user', { credentials: 'include' });
    if (res.status !== 200) return null;
    const data = await res.json();
    return data.success ? data.data.user : null;
  }

  async function loadContest() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/contests/${id}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setContest(data.data.contest);
      } else {
        message.error(data.error?.message ?? '加载失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }

  async function loadEnrollment() {
    const res = await fetch(`/api/v1/contests/${id}/enrollment`, { credentials: 'include' });
    if (res.status === 200) {
      const d = await res.json();
      if (d.success) setEnrolled(!!d.data.enrolled);
    }
  }

  useEffect(() => {
    (async () => {
      const u = await loadUser();
      if (u) setRole(u.role);
      await loadContest();
      await loadEnrollment();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  async function handleEnroll() {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/v1/contests/${id}/enroll`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setEnrolled(true);
        message.success(data.data.existed ? '你已报名本竞赛' : '报名成功！');
      } else if (res.status === 401) {
        router.push(`/login?redirect=/contests/${id}`);
      } else {
        message.error(data.error?.message ?? '报名失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setEnrolling(false);
    }
  }

  async function openProblem(p: ProblemShallow) {
    setActiveProblem(p);
    setProblemModalOpen(true);
    setCurrentSubmission(null);
    submitForm.resetFields();

    if (!p.description) {
      setProblemDetailLoading(true);
      try {
        const res = await fetch(`/api/v1/contests/${id}/problems/${p.problemCode}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          setActiveProblem(data.data.problem);
          if (data.data.myLastSubmission) {
            setCurrentSubmission({
              id: data.data.myLastSubmission.id,
              verdict: data.data.myLastSubmission.verdict,
              score: data.data.myLastSubmission.score,
              runTimeMs: data.data.myLastSubmission.runTimeMs,
              runMemoryKB: data.data.myLastSubmission.runMemoryKB,
              message: data.data.myLastSubmission.message,
              judgedAt: data.data.myLastSubmission.judgedAt,
              createdAt: data.data.myLastSubmission.createdAt,
            });
          }
        } else if (res.status === 401) {
          setProblemModalOpen(false);
          router.push('/login');
        } else if (res.status === 403) {
          setProblemModalOpen(false);
          message.warning(data.error?.message ?? '需先报名并等竞赛开始后查看');
        } else {
          message.error(data.error?.message ?? '加载题目失败');
        }
      } catch {
        message.error('网络错误');
      } finally {
        setProblemDetailLoading(false);
      }
    }
  }

  async function pollSubmission(submissionId: string, attempts = 0) {
    if (attempts > 40) {
      setPolling(false);
      message.warning('判题超时，请稍后刷新结果');
      return;
    }
    try {
      const res = await fetch(`/api/v1/submissions/${submissionId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const s = data.data.submission as MySubmission;
        setCurrentSubmission(s);
        if (s.verdict === 'PENDING' || s.verdict === 'JUDGING') {
          pollTimerRef.current = setTimeout(() => pollSubmission(submissionId, attempts + 1), 1500);
        } else {
          setPolling(false);
          message.success(`判题完成：${VERDICT_LABELS[s.verdict]?.text ?? s.verdict}`);
        }
      } else {
        setPolling(false);
      }
    } catch {
      setPolling(false);
    }
  }

  async function handleSubmit() {
    try {
      const values = await submitForm.validateFields();
      if (!activeProblem) return;
      setSubmitting(true);
      const res = await fetch('/api/v1/judge/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contestId: id,
          problemCode: activeProblem.problemCode,
          language: values.language as Language,
          sourceCode: values.sourceCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('提交成功，正在判题...');
        setCurrentSubmission({
          id: data.data.submissionId,
          verdict: data.data.verdict,
          createdAt: new Date().toISOString(),
        });
        setPolling(true);
        pollSubmission(data.data.submissionId);
      } else if (res.status === 401) {
        router.push('/login');
      } else {
        message.error(data.error?.message ?? '提交失败');
      }
    } catch {
      // 校验失败
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;
  }
  if (!contest) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">竞赛不存在</div>;
  }

  const now = dayjs();
  const start = dayjs(contest.startTime);
  const end = dayjs(contest.endTime);
  const isNotStarted = now.isBefore(start);
  const isInProgress = !isNotStarted && now.isBefore(end);
  const isEnded = now.isAfter(end);
  const canAccessProblems = role === 'ADMIN' || role === 'TEACHER' || (isInProgress && enrolled);

  const problemColumns = [
    {
      title: '#',
      dataIndex: 'problemCode',
      width: 80,
      render: (v: string) => <span className="font-mono font-semibold text-gray-700">{v}</span>,
    },
    {
      title: '题目',
      dataIndex: 'title',
      render: (v: string, record: ProblemShallow) => (
        <a
          onClick={(e) => {
            e.preventDefault();
            if (!contest.problems[0]?.description && !canAccessProblems && role === 'STUDENT') {
              message.warning(isNotStarted ? '竞赛未开始' : '请先报名本竞赛');
              return;
            }
            openProblem(record);
          }}
          className="text-blue-600 hover:underline font-medium"
        >
          {v}
        </a>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 90,
      render: (d: number) => {
        const info = DIFFICULTY_LABELS[d] ?? { text: String(d), color: 'default' };
        return <Tag color={info.color as any}>{info.text}</Tag>;
      },
    },
    {
      title: '时间/内存',
      width: 160,
      render: (_: any, r: ProblemShallow) => (
        <div className="text-xs text-gray-500 space-y-0.5">
          <div>时间：{r.timeLimitMs} ms</div>
          <div>内存：{r.memoryLimitMB} MB</div>
        </div>
      ),
    },
    {
      title: '通过/提交',
      width: 130,
      render: (_: any, r: ProblemShallow) => {
        const rate = r.totalSubmit === 0 ? 0 : Math.round((r.totalAccept / r.totalSubmit) * 100);
        return (
          <div>
            <div className="text-sm">
              <span className="text-green-600 font-medium">{r.totalAccept}</span>
              <span className="text-gray-400 mx-1">/</span>
              <span className="text-gray-600">{r.totalSubmit}</span>
            </div>
            <Progress percent={rate} size="small" showInfo={false} className="!mt-1" />
          </div>
        );
      },
    },
  ];

  const verdictInfo = currentSubmission ? (VERDICT_LABELS[currentSubmission.verdict] ?? { text: currentSubmission.verdict, color: 'default', icon: null }) : null;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <Link href="/contests" className="text-emerald-600 text-sm">← 返回竞赛列表</Link>

      <Card className="mt-4 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {contest.whitelist && (
                <Tag color="red" icon={<SafetyCertificateOutlined />}>教育部白名单赛事</Tag>
              )}
              <Tag color={isNotStarted ? 'gold' : isInProgress ? 'processing' : 'default'}>
                {isNotStarted ? '未开始' : isInProgress ? '进行中' : '已结束'}
              </Tag>
              <Tag>{contest.subject.name}</Tag>
              <Tag color="blue">{contest.year} 年</Tag>
              <Tag color="purple">{contest.stage}</Tag>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{contest.title}</h1>
            {contest.shortTitle && (
              <div className="text-emerald-600 font-semibold mb-3">{contest.shortTitle}</div>
            )}
            <Descriptions column={2} size="small" className="!mt-4">
              <Descriptions.Item label="竞赛时间">
                {start.format('YYYY-MM-DD HH:mm')} ~ {end.format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="竞赛时长">{contest.durationMin} 分钟</Descriptions.Item>
              <Descriptions.Item label="题量">{contest.problemsCount} 道</Descriptions.Item>
              <Descriptions.Item label="已报名">{contest.enrollmentsCount} 人</Descriptions.Item>
              <Descriptions.Item label="主办方">{contest.creator.nickname ?? '平台'}</Descriptions.Item>
              {contest.course && (
                <Descriptions.Item label="配套课程">
                  <a onClick={() => router.push(`/courses/${contest.course!.id}`)} className="text-emerald-600 hover:underline">
                    {contest.course.title}
                  </a>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
          <div className="flex flex-col items-end gap-3">
            {role === 'STUDENT' ? (
              enrolled ? (
                <Badge status="success" text="已报名" />
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  loading={enrolling}
                  onClick={handleEnroll}
                  disabled={isEnded}
                >
                  {isEnded ? '已结束' : '立即报名'}
                </Button>
              )
            ) : (
              role && <Tag color="cyan">管理员/教师视角</Tag>
            )}
          </div>
        </div>

        {contest.intro && (
          <>
            <Divider />
            <div>
              <h3 className="font-semibold mb-2 text-gray-800">竞赛介绍</h3>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{contest.intro}</p>
            </div>
          </>
        )}
        {contest.awardInfo && (
          <>
            <Divider />
            <div>
              <h3 className="font-semibold mb-2 text-gray-800">奖励说明</h3>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{contest.awardInfo}</p>
            </div>
          </>
        )}
      </Card>

      <Card
        title={
          <div className="flex items-center justify-between">
            <span>题目列表</span>
            {!isNotStarted && role === 'STUDENT' && !enrolled && (
              <span className="text-xs text-orange-500">（报名后可查看题目详情与提交代码）</span>
            )}
            {isNotStarted && (
              <span className="text-xs text-gray-400">（竞赛开始后展示题目）</span>
            )}
          </div>
        }
      >
        {contest.problems.length === 0 ? (
          <Empty description={isNotStarted ? '题目将在竞赛开始后公布' : '暂无题目'} />
        ) : (
          <Table
            dataSource={contest.problems}
            rowKey="id"
            pagination={false}
            columns={problemColumns}
            size="middle"
          />
        )}
      </Card>

      <Modal
        open={problemModalOpen}
        onCancel={() => {
          setProblemModalOpen(false);
          setCurrentSubmission(null);
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          setPolling(false);
        }}
        title={activeProblem ? `[${activeProblem.problemCode}] ${activeProblem.title}` : ''}
        width={960}
        footer={null}
        destroyOnClose
      >
        {problemDetailLoading ? (
          <div className="flex justify-center py-20"><Spin size="large" /></div>
        ) : !activeProblem ? null : (
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {(() => {
                const d = DIFFICULTY_LABELS[activeProblem.difficulty];
                return <Tag color={d?.color as any}>{d?.text ?? `难度 ${activeProblem.difficulty}`}</Tag>;
              })()}
              <Tag>时间 {activeProblem.timeLimitMs} ms</Tag>
              <Tag>内存 {activeProblem.memoryLimitMB} MB</Tag>
              <Tag color="green">通过 {activeProblem.totalAccept}</Tag>
              <Tag>提交 {activeProblem.totalSubmit}</Tag>
            </div>

            <div className="prose prose-slate max-w-none text-sm mb-4">
              <h3 className="text-base font-semibold mb-2">题目描述</h3>
              <div
                className="whitespace-pre-wrap leading-relaxed text-gray-700"
                dangerouslySetInnerHTML={{ __html: activeProblem.description ?? '' }}
              />
            </div>

            {activeProblem.inputFormat && (
              <div className="mb-4">
                <h3 className="text-base font-semibold mb-2">输入格式</h3>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap text-sm text-gray-700">
                  {activeProblem.inputFormat}
                </div>
              </div>
            )}

            {activeProblem.outputFormat && (
              <div className="mb-4">
                <h3 className="text-base font-semibold mb-2">输出格式</h3>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap text-sm text-gray-700">
                  {activeProblem.outputFormat}
                </div>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-base font-semibold mb-2">样例</h3>
              <SampleView samples={activeProblem.samples} />
            </div>

            <Divider />

            <div className="mb-4">
              <h3 className="text-base font-semibold mb-3">提交代码</h3>
              <Form form={submitForm} layout="vertical" initialValues={{ language: 'C++' }}>
                <Row gutter={16}>
                  <Col md={8}>
                    <Form.Item
                      label="编程语言"
                      name="language"
                      rules={[{ required: true, message: '请选择语言' }]}
                    >
                      <Select options={LANG_OPTIONS} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item
                  label="源代码"
                  name="sourceCode"
                  rules={[
                    { required: true, message: '请输入源代码' },
                    { min: 1, max: 65536, message: '代码长度需在 1~65536 字符之间' },
                  ]}
                >
                  <Input.TextArea
                    rows={16}
                    placeholder="在此粘贴或编写代码..."
                    className="font-mono text-sm"
                    style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
                  />
                </Form.Item>
                <Space>
                  <Button type="primary" onClick={handleSubmit} loading={submitting || polling} size="large">
                    {polling ? '判题中...' : '提交判题'}
                  </Button>
                  <Button onClick={() => submitForm.resetFields()}>重置</Button>
                </Space>
              </Form>
            </div>

            {currentSubmission && verdictInfo && (
              <div>
                <Divider />
                <h3 className="text-base font-semibold mb-3">最近判题结果</h3>
                <Alert
                  type={
                    verdictInfo.color === 'success'
                      ? 'success'
                      : verdictInfo.color === 'error'
                      ? 'error'
                      : verdictInfo.color === 'warning'
                      ? 'warning'
                      : 'info'
                  }
                  showIcon
                  icon={verdictInfo.icon}
                  message={
                    <span className="font-semibold">
                      {verdictInfo.icon} {verdictInfo.text}
                    </span>
                  }
                  description={
                    <div className="text-sm space-y-1 mt-2">
                      <div>提交时间：{dayjs(currentSubmission.createdAt).format('YYYY-MM-DD HH:mm:ss')}</div>
                      {currentSubmission.judgedAt && (
                        <div>判题完成：{dayjs(currentSubmission.judgedAt).format('YYYY-MM-DD HH:mm:ss')}</div>
                      )}
                      {currentSubmission.runTimeMs !== undefined && currentSubmission.runTimeMs !== null && (
                        <div>运行时间：{currentSubmission.runTimeMs} ms</div>
                      )}
                      {currentSubmission.runMemoryKB !== undefined && currentSubmission.runMemoryKB !== null && (
                        <div>
                          内存占用：{(currentSubmission.runMemoryKB / 1024).toFixed(2)} MB
                        </div>
                      )}
                      {currentSubmission.score !== null && currentSubmission.score !== undefined && (
                        <div>得分：{currentSubmission.score}</div>
                      )}
                      {currentSubmission.message && (
                        <div className="bg-gray-900 text-red-300 p-2 rounded font-mono text-xs whitespace-pre-wrap">
                          {currentSubmission.message}
                        </div>
                      )}
                    </div>
                  }
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}
