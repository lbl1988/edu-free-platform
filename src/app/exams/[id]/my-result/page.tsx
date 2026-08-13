'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, Spin, App, Button, Result, Space, Tag, Progress, Divider, Empty, Alert, Descriptions, Table, InputNumber, Input, Form, Modal } from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';

type QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'FILL_BLANK' | 'ESSAY' | 'CODING';

interface AnswerRow {
  id: string;
  answer: string | null;
  isCorrect: boolean | null;
  aiScore: number | null;
  finalScore: number | null;
  perScore: number;
  answeredFast: boolean;
  answeredAt: string;
  examQuestion: {
    id: string;
    sortOrder: number;
    perScore: number;
    questionType: QuestionType;
    content: string;
    options: string[] | null;
    answer: string | null;
    analysis: string | null;
  };
}

interface ExamResult {
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
  gradedBy?: string;
  gradedAt?: string;
  exam: {
    id: string; title: string; duration: number; totalScore: number; aiAutoGrade: boolean; maxCheating: number;
    creator: { nickname: string };
  };
  answers: AnswerRow[];
  violations: { id: string; type: string; detail?: string; occurredAt: string }[];
  student?: { id: string; nickname: string; grade: number };
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function typeLabel(t: QuestionType) {
  return ({ SINGLE_CHOICE: '单选', MULTI_CHOICE: '多选', FILL_BLANK: '填空', ESSAY: '问答', CODING: '编程' } as const)[t];
}

export default function ExamMyResultPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExamResult | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/exams/${params.id}/result`, { credentials: 'include' });
        if (res.status === 401) { router.push(`/login?redirect=/exams/${params.id}/my-result`); return; }
        const d = await res.json();
        if (d.success) setData(d.data.result);
        else message.error(d.error?.message ?? '加载失败');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [params.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;
  if (!data) return <Empty description="暂无数据" />;

  const correctRate = data.totalCount === 0 ? 0 : Math.round(((data.correctCount ?? 0) / data.totalCount) * 1000) / 10;
  const percent = data.totalScore === 0 ? 0 : Math.round(((data.score ?? 0) / data.totalScore) * 100);

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <Link href="/exams" className="text-emerald-600 text-sm">← 考试列表</Link>
      <h1 className="text-2xl font-bold mt-1 mb-2">{data.exam.title} · 成绩单</h1>
      <p className="text-sm text-gray-500 mb-6">
        学科：出卷 {data.exam.creator.nickname} · 时长 {data.exam.duration} 分钟 · 满分 {data.exam.totalScore}
      </p>

      <Result
        status={
          data.status === 'VIOLATION_SUBMIT' ? 'error' :
            !data.graded ? 'info' :
              percent >= 60 ? 'success' : 'warning'
        }
        title={
          data.status === 'VIOLATION_SUBMIT' ? '违规提交（本次成绩无效）' :
            data.graded ? `${data.score}/${data.totalScore} 分` :
              `客观 ${data.objectiveScore ?? 0} · 主观题待批改`
        }
        subTitle={
          <>
            <Space size="middle" wrap>
              <Tag color={data.graded ? 'green' : 'blue'}>{data.graded ? '已批改' : '待批改'}</Tag>
              <span>正确 {data.correctCount ?? 0}/{data.totalCount}（正确率 {correctRate}%）</span>
              <span>用时 {data.startTime && data.submitTime ? Math.round((dayjs(data.submitTime).diff(dayjs(data.startTime), 'minute') * 10) / 10 : 0)} 分钟</span>
              <span className={data.cheatingCount > 0 ? 'text-red-600' : ''}>违规 {data.cheatingCount}/{data.exam.maxCheating}</span>
            </Space>
            <Progress percent={percent} status={percent >= 60 ? (data.status === 'VIOLATION_SUBMIT' ? 'exception' : 'success') : 'exception'} showInfo className="mt-3" />
          </>
        }
      />

      <Descriptions size="small" column={2} className="mb-4" bordered>
        <Descriptions.Item label="状态">{data.status}</Descriptions.Item>
        <Descriptions.Item label="起止">{dayjs(data.startTime).format('MM-DD HH:mm')} ~ {data.submitTime ? dayjs(data.submitTime).format('HH:mm') : '-'}</Descriptions.Item>
        <Descriptions.Item label="客观分">{data.objectiveScore ?? 0}</Descriptions.Item>
        <Descriptions.Item label="主观分">{data.subjectiveScore ?? '未批改'}</Descriptions.Item>
        <Descriptions.Item label="批改人">{data.gradedBy ?? (data.graded ? 'AI自动批改' : '-')}</Descriptions.Item>
        <Descriptions.Item label="批改时间">{data.gradedAt ? dayjs(data.gradedAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
      </Descriptions>

      {data.violations.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`作弊/异常事件（共 ${data.violations.length} 次）`}
          description={
            <ul className="list-disc pl-5 text-xs space-y-1">
              {data.violations.map((v) => (
                <li key={v.id}>
                  [{dayjs(v.occurredAt).format('HH:mm:ss')}] <strong>{v.type}</strong>
                  {v.detail && ` — ${v.detail}`}
                </li>
              ))}
            </ul>
          }
          className="mb-6"
        />
      )}

      <Divider orientation="left">答题详情</Divider>
      <Space direction="vertical" className="w-full" size="large">
        {data.answers.map((a, i) => (
          <Card key={a.id} size="small" className="!mb-0">
            <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
              <div>
                <span className="font-bold mr-2">{i + 1}.</span>
                <Tag color={a.examQuestion.questionType === 'SINGLE_CHOICE' ? 'blue' : a.examQuestion.questionType === 'MULTI_CHOICE' ? 'purple' : a.examQuestion.questionType === 'FILL_BLANK' ? 'cyan' : a.examQuestion.questionType === 'CODING' ? 'gold' : 'geekblue'}>
                  {typeLabel(a.examQuestion.questionType)}
                </Tag>
                <span className="text-xs text-gray-400">
                  (满分 {a.perScore}) · 得分 <b className={
                    (a.finalScore ?? a.aiScore ?? 0) === a.perScore ? 'text-emerald-600' : (a.finalScore ?? a.aiScore ?? 0) === 0 ? 'text-red-600' : 'text-orange-600'
                  }>{a.finalScore ?? a.aiScore ?? 0}</b>/{a.perScore}
                  {a.isCorrect === true && <Tag color="green" className="!ml-2">✓</Tag>}
                  {a.isCorrect === false && a.examQuestion.questionType !== 'ESSAY' && a.examQuestion.questionType !== 'CODING' && <Tag color="red" className="!ml-2">✗</Tag>}
                </span>
                {a.answeredFast && <Tag color="orange" className="!ml-2">秒答</Tag>}
              </div>
            </div>
            <div className="whitespace-pre-wrap mb-3">{a.examQuestion.content}</div>
            {a.examQuestion.options && (
              <ul className="space-y-2 text-sm">
                {a.examQuestion.options.map((o, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-semibold w-6">{LETTERS[idx]}.</span>
                    <span className="whitespace-pre-wrap">{o}</span>
                  </li>
                ))}
              </ul>
            )}
            <Descriptions size="small" column={1} className="mt-3" bordered>
              <Descriptions.Item label="你的答案">
                <span className={a.isCorrect === false ? 'text-red-600' : 'text-emerald-700'}>
                  {a.answer || '未作答'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="参考答案">
                <span className="text-emerald-700 font-medium">
                  {a.examQuestion.answer ?? '无（主观题）'}
                </span>
              </Descriptions.Item>
              {a.examQuestion.analysis && (
                <Descriptions.Item label="解析">
                  <div className="whitespace-pre-wrap text-gray-600">{a.examQuestion.analysis}</div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        ))}
      </Space>

      <div className="flex justify-center my-8">
        <Link href="/exams"><Button type="primary">返回考试列表</Button></Link>
      </div>
    </main>
  );
}
