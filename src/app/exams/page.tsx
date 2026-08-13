'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, App, Tag, Button, Space, Segmented, Empty, Select } from 'antd';
import Link from 'next/link';
import dayjs from 'dayjs';

type ExamType = 'FORMAL' | 'MOCK';
type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface ExamItem {
  id: string;
  title: string;
  examType: ExamType;
  subject: { id: number; name: string };
  grade: number;
  startTime: string;
  endTime: string;
  duration: number;
  totalScore: number;
  status: CourseStatus;
  maxCheating: number;
  creator: { id: string; nickname: string };
  _count: { questions: number; results: number };
  myResult?: {
    id: string; status: string; submitTime: string | null;
    score: number | null; cheatingCount: number; graded: boolean;
  };
}

const TYPE_MAP: Record<ExamType, { color: string; text: string }> = {
  FORMAL: { color: 'blue', text: '正式' },
  MOCK: { color: 'geekblue', text: '模拟' },
};

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  NOT_STARTED: { color: 'default', text: '未开始' },
  IN_PROGRESS: { color: 'processing', text: '进行中' },
  SUBMITTED: { color: 'purple', text: '已交卷' },
  GRADED: { color: 'green', text: '已批改' },
  VIOLATION_SUBMIT: { color: 'red', text: '违规提交' },
  DRAFT: { color: 'gold', text: '草稿' },
  PUBLISHED: { color: 'cyan', text: '已发布' },
  ARCHIVED: { color: 'default', text: '已归档' },
};

export default function ExamListPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'STUDENT' | 'TEACHER' | 'ADMIN' | null>(null);
  const [list, setList] = useState<ExamItem[]>([]);
  const [tab, setTab] = useState<'all' | 'open' | 'ended'>('all');
  const [subjectId, setSubjectId] = useState<number | null>(null);

  async function loadUser() {
    const res = await fetch('/api/v1/user', { credentials: 'include' });
    if (res.status === 401) return null; // 匿名用户，不跳转
    const data = await res.json();
    return data.success ? data.data.user ?? data.data : null;
  }

  async function loadList() {
    const res = await fetch(`/api/v1/exams?${subjectId ? `subjectId=${subjectId}` : ''}`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      const exams: ExamItem[] = data.data.exams || [];
      const listWithMine = exams.map((ex) => ({ ...ex, myResult: ex.myResult as any }));
      setList(listWithMine);
    } else message.error(data.error?.message ?? '加载失败');
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const u = await loadUser();
      if (u) setRole(u.role);
      await loadList();
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [subjectId]);

  const subjects = useMemo(() => {
    const m = new Map<number, string>();
    list.forEach((e) => m.set(e.subject.id, e.subject.name));
    return Array.from(m.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [list]);

  const now = dayjs();
  const filtered = useMemo(() => {
    return list.filter((e) => {
      if (tab === 'open') return now.isBefore(dayjs(e.endTime)) && e.status === 'PUBLISHED';
      if (tab === 'ended') return now.isAfter(dayjs(e.endTime)) || e.status === 'ARCHIVED';
      return true;
    });
  }, [list, tab, now]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <Link href="/" className="text-emerald-600 text-sm">← 返回首页</Link>
          <h1 className="text-2xl font-bold mt-1">在线考试</h1>
          <p className="text-sm text-gray-500">
            {role === 'STUDENT'
              ? '按进入时段开始考试，违规次数超限将自动标记'
              : role === 'TEACHER' || role === 'ADMIN'
                ? '教师可创建并发布考试，查看全班成绩'
                : '登录后可参加考试，查看历史成绩'}
          </p>
        </div>
        <Space wrap>
          {(role === 'TEACHER' || role === 'ADMIN') && (
            <Link href="/exams/new">
              <Button type="primary">+ 创建考试</Button>
            </Link>
          )}
        </Space>
      </div>

      <Space className="mb-4" wrap>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as any)}
          options={[
            { label: '全部', value: 'all' },
            { label: '可参加', value: 'open' },
            { label: '已结束', value: 'ended' },
          ]}
        />
        <Select
          style={{ width: 160 }}
          allowClear
          placeholder="按学科筛选"
          value={subjectId ?? undefined}
          onChange={(v) => setSubjectId(v ?? null)}
          options={subjects}
        />
      </Space>

      {filtered.length === 0 ? (
        <Empty description="暂无考试" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <ExamCard key={e.id} exam={e} role={role} />
          ))}
        </div>
      )}
    </main>
  );
}

function ExamCard({ exam, role }: { exam: ExamItem; role: string | null }) {
  const router = useRouter();
  const open = dayjs().isBefore(dayjs(exam.endTime)) && exam.status === 'PUBLISHED';
  const t = TYPE_MAP[exam.examType];
  const s = STATUS_MAP[exam.status] ?? STATUS_MAP[exam.myResult?.status ?? ''] ?? { color: 'default', text: exam.status };
  const mr = exam.myResult;

  return (
    <Card hoverable className="flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold leading-snug flex-1">{exam.title}</h3>
        <Space size={4}>
          <Tag color={t.color}>{t.text}</Tag>
          {(role === 'TEACHER' || role === 'ADMIN') && <Tag color={s.color}>{s.text}</Tag>}
          {role === 'STUDENT' && mr && <Tag color={STATUS_MAP[mr.status]?.color}>{STATUS_MAP[mr.status]?.text}</Tag>}
        </Space>
      </div>
      <div className="text-sm text-gray-500 space-y-1 mb-3">
        <div>学科：{exam.subject.name} · {exam.grade}年级</div>
        <div>时段：{dayjs(exam.startTime).format('MM-DD HH:mm')} ~ {dayjs(exam.endTime).format('MM-DD HH:mm')}</div>
        <div>时长：{exam.duration} 分钟 · 满分 {exam.totalScore} · {exam._count.questions} 题</div>
        <div>创建者：{exam.creator.nickname} · 违规上限 {exam.maxCheating} 次</div>
        {mr && mr.score !== null && (
          <div className="text-emerald-700 font-semibold">
            得分：{mr.score}/{exam.totalScore}{mr.graded ? ' · 已批改' : ' · 待批改'}
          </div>
        )}
        {mr && mr.cheatingCount > 0 && (
          <div className="text-red-600 text-xs">本次违规记录 {mr.cheatingCount} 次</div>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {role === 'TEACHER' || role === 'ADMIN'
            ? `已有 ${exam._count.results} 人交卷`
            : open ? '可进入' : '已截止'}
        </span>
        <Space>
          {role === 'STUDENT' ? (
            <>
              {mr && (mr.status === 'SUBMITTED' || mr.status === 'GRADED' || mr.status === 'VIOLATION_SUBMIT') ? (
                <Button onClick={() => router.push(`/exams/${exam.id}/my-result`)} type="link">查看成绩</Button>
              ) : (
                <Button onClick={() => router.push(`/exams/${exam.id}/take`)} type="primary" disabled={!open}>
                  {mr && mr.status === 'IN_PROGRESS' ? '继续答题' : '进入考试'}
                </Button>
              )}
            </>
          ) : role === 'TEACHER' || role === 'ADMIN' ? (
            <>
              <Button onClick={() => router.push(`/exams/${exam.id}/results`)}>成绩</Button>
              <Button onClick={() => router.push(`/exams/${exam.id}/edit`)}>管理</Button>
            </>
          ) : (
            <Button type="primary" disabled>登录后参加</Button>
          )}
        </Space>
      </div>
    </Card>
  );
}
