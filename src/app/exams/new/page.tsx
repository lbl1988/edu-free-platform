'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Form, Input, Select, InputNumber, DatePicker, Switch, Button, Table, App, Space, Tag, Typography, Radio,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import Link from 'next/link';

interface SubjectItem { id: number; name: string; stage: string }
interface QuestionItem {
  id: string;
  content: string;
  difficulty: number;
  questionType: string;
  subject: { id: number; name: string };
  grade: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTI_CHOICE: '多选', FILL_BLANK: '填空', ESSAY: '解答', CODING: '编程',
};
function difficultyLabel(d: number): string {
  if (d <= 2) return '简单';
  if (d === 3) return '中等';
  return '困难';
}
function difficultyColor(d: number): string {
  if (d <= 2) return 'green';
  if (d === 3) return 'blue';
  return 'red';
}

interface FormValues {
  title: string;
  examType: 'FORMAL' | 'MOCK';
  subjectId: number;
  grade: number;
  timeRange: [Dayjs, Dayjs];
  duration: number;
  maxCheating: number;
  aiAutoGrade: boolean;
  retryAllowed: number;
  passScore?: number;
}

export default function ExamCreatePage() {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [checking, setChecking] = useState(true);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qTotal, setQTotal] = useState(0);
  const [qPage, setQPage] = useState(1);
  const [qFilters, setQFilters] = useState({ subjectId: undefined as number | undefined, keyword: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishMode, setPublishMode] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');

  // 权限检查：仅教师/管理员
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/user', { credentials: 'include' });
        if (res.status === 401) { router.replace('/login'); return; }
        const d = await res.json();
        const u = d.success ? (d.data.user ?? d.data) : null;
        if (!u || (u.role !== 'TEACHER' && u.role !== 'ADMIN')) {
          message.warning('仅教师或管理员可创建考试');
          router.replace('/exams');
          return;
        }
        setChecking(false);
      } catch {
        router.replace('/login');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 学科下拉
  useEffect(() => {
    fetch('/api/v1/subjects', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => d.success && setSubjects(d.data.subjects || []))
      .catch(() => {});
  }, []);

  // 题目分页加载
  async function loadQuestions(page = 1) {
    setQLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (qFilters.subjectId) params.set('subjectId', String(qFilters.subjectId));
    if (qFilters.keyword) params.set('keyword', qFilters.keyword);
    try {
      const res = await fetch(`/api/v1/questions?${params}`, { credentials: 'include' });
      const d = await res.json();
      if (d.success) {
        setQuestions(d.data || []);
        setQTotal(d.pagination?.total ?? (d.data || []).length);
        setQPage(page);
      } else {
        message.error(d.error?.message ?? '题库加载失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setQLoading(false);
    }
  }

  useEffect(() => {
    if (!checking) loadQuestions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, qFilters.subjectId]);

  const selectedRows = useMemo(() => {
    const map = new Map(questions.map((q) => [q.id, q]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as QuestionItem[];
  }, [questions, selectedIds]);

  async function handleSubmit(values: FormValues) {
    const [start, end] = values.timeRange;
    if (values.duration * 60 * 1000 > end.valueOf() - start.valueOf()) {
      message.error('考试时长不可超过允许进入的时间窗口');
      return;
    }
    if (selectedIds.length === 0) {
      message.warning('请至少选择一道题目');
      return;
    }
    // 发布确认弹窗
    const confirmed = await modal.confirm({
      title: publishMode === 'PUBLISHED' ? '确认发布该考试？' : '保存为草稿？',
      content: publishMode === 'PUBLISHED'
        ? '发布后，学生将在"在线考试"中看到该考试，并可在进入时段内参加。'
        : '草稿仅你和管理员可见，学生无法查看；之后可在考试列表中点击"发布"上线。',
      okText: publishMode === 'PUBLISHED' ? '确认发布' : '保存草稿',
      cancelText: '再检查一下',
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/v1/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: values.title,
          examType: values.examType,
          subjectId: values.subjectId,
          grade: values.grade,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          duration: values.duration,
          maxCheating: values.maxCheating,
          aiAutoGrade: values.aiAutoGrade,
          retryAllowed: values.retryAllowed,
          passScore: values.passScore,
          status: publishMode,
          fromQuestionIds: selectedIds,
        }),
      });
      const d = await res.json();
      if (d.success) {
        message.success(publishMode === 'PUBLISHED' ? '考试已发布，学生可参加' : '草稿已保存');
        router.push('/exams');
      } else {
        message.error(d.error?.message ?? '创建失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setSaving(false);
    }
  }

  // 提交按钮点击：未选题时给出明确提示（不静默禁用）
  function onSubmitClick() {
    if (selectedIds.length === 0) {
      message.warning('请先在右侧勾选至少一道题目');
      return;
    }
    form.submit();
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>;
  }

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <Link href="/exams" className="text-emerald-600 text-sm">← 返回在线考试</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6">创建考试</h1>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* 基本信息 */}
        <Card className="lg:col-span-2" title="基本信息" size="small">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              examType: 'FORMAL',
              grade: 8,
              duration: 60,
              maxCheating: 3,
              aiAutoGrade: true,
              retryAllowed: 0,
            }}
            onFinish={handleSubmit}
          >
            <Form.Item name="title" label="考试标题" rules={[{ required: true, message: '请输入考试标题' }, { min: 2, max: 120 }]}>
              <Input placeholder="例如：八年级数学期中检测" maxLength={120} />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="examType" label="考试类型" rules={[{ required: true }]}>
                <Select options={[
                  { label: '正式考试', value: 'FORMAL' },
                  { label: '模拟考试', value: 'MOCK' },
                ]} />
              </Form.Item>
              <Form.Item name="subjectId" label="学科" rules={[{ required: true, message: '请选择学科' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择学科"
                  options={subjects.map((s) => ({ label: `${s.name}（${s.stage}）`, value: s.id }))}
                />
              </Form.Item>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="grade" label="年级" rules={[{ required: true }]}>
                <InputNumber min={1} max={12} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="duration" label="时长（分钟）" rules={[{ required: true }]}>
                <InputNumber min={5} max={600} step={5} style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <Form.Item
              name="timeRange"
              label="允许进入时段（进入后单独计时）"
              rules={[{ required: true, message: '请选择开始与结束时间' }]}
            >
              <DatePicker.RangePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
                disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
              />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="maxCheating" label="违规次数上限" tooltip="超出后自动标记违规提交">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="retryAllowed" label="允许重考次数">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <Form.Item name="passScore" label="及格分（可选）">
              <InputNumber min={0} max={1000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="aiAutoGrade" label="客观题自动批改" valuePropName="checked">
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
          </Form>
        </Card>

        {/* 题目选择 */}
        <Card className="lg:col-span-3" size="small" title={
          <Space>
            选择题库题目
            <Typography.Text type="secondary" className="text-xs">
              已选 <span className="text-emerald-600 font-semibold">{selectedIds.length}</span> 道
              {selectedIds.length > 0 && `（约 ${selectedIds.length * 5} 分）`}
            </Typography.Text>
          </Space>
        }>
          <Space className="mb-3" wrap>
            <Select
              allowClear
              placeholder="按学科筛选"
              style={{ width: 160 }}
              value={qFilters.subjectId}
              onChange={(v) => setQFilters((f) => ({ ...f, subjectId: v }))}
              options={subjects.map((s) => ({ label: s.name, value: s.id }))}
            />
            <Input.Search
              placeholder="搜索题干关键词"
              allowClear
              style={{ width: 240 }}
              onSearch={(v) => setQFilters((f) => ({ ...f, keyword: v }))}
            />
          </Space>

          <Table<QuestionItem>
            rowKey="id"
            size="small"
            loading={qLoading}
            dataSource={questions}
            pagination={{
              current: qPage,
              pageSize: 20,
              total: qTotal,
              showSizeChanger: false,
              onChange: loadQuestions,
            }}
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys as string[]),
            }}
            columns={[
              { title: '题干', dataIndex: 'content', ellipsis: true, render: (v) => <span className="text-sm">{v}</span> },
              {
                title: '学科', width: 80,
                render: (_, r) => <span className="text-xs">{r.subject.name}</span>,
              },
              {
                title: '题型', width: 80,
                render: (_, r) => <Tag className="text-xs">{TYPE_LABEL[r.questionType] ?? r.questionType}</Tag>,
              },
              {
                title: '难度', width: 80,
                render: (_, r) => <Tag color={difficultyColor(r.difficulty)} className="text-xs">{difficultyLabel(r.difficulty)}</Tag>,
              },
            ]}
          />

          <div className="mt-4 border-t pt-4">
            <Space className="mb-3" wrap>
              <Radio.Group
                value={publishMode}
                onChange={(e) => setPublishMode(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                options={[
                  { label: '立即发布', value: 'PUBLISHED' },
                  { label: '保存草稿', value: 'DRAFT' },
                ]}
              />
              <Typography.Text type="secondary" className="text-xs">
                {publishMode === 'PUBLISHED'
                  ? '发布后学生立即可见并可参加'
                  : '草稿仅自己可见，可在考试列表中稍后发布'}
              </Typography.Text>
            </Space>
            <div className="flex justify-end">
              <Space>
                <Button onClick={() => router.push('/exams')}>取消</Button>
                <Button
                  type="primary"
                  size="large"
                  loading={saving}
                  onClick={onSubmitClick}
                >
                  {publishMode === 'PUBLISHED'
                    ? `确认发布（${selectedIds.length} 题）`
                    : '保存草稿'}
                </Button>
              </Space>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
