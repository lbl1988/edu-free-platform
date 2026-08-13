'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, Spin, App, Button, Radio, Checkbox, Input, Result, Space, Modal, Progress, Tag, message as antMessage } from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';

type QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'FILL_BLANK' | 'ESSAY' | 'CODING';

interface ExamQuestion {
  id: string;
  sortOrder: number;
  perScore: number;
  questionType: QuestionType;
  content: string;
  options: string[] | null;
  difficulty: number;
  answer: string | null;
  analysis: string | null;
}

interface StartResp {
  resultId: string;
  status: string;
  startTime: string;
  deadline: string;
  submitTime: string | null;
  cheatingLimit: number;
  cheatingCount: number;
  questions: ExamQuestion[];
}

interface SubmitDetail {
  examQuestionId: string;
  questionType: QuestionType;
  isCorrect: boolean;
  objectiveScore: number;
  perScore: number;
  fast: boolean;
  message?: string;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function ExamTakePage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const { modal } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState<StartResp | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [usedSec, setUsedSec] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [cheatingCount, setCheatingCount] = useState(0);
  const [cheatingLimit, setCheatingLimit] = useState(3);

  // 记录每题用时（秒）
  const enterAtRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/exams/${params.id}/start`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.status === 401) { router.push(`/login?redirect=/exams/${params.id}/take`); return; }
        const data = await res.json();
        if (!data.success) {
          modal.error({ title: '无法进入考试', content: data.error?.message ?? '错误',
            onOk: () => router.push('/exams') });
          return;
        }
        const s: StartResp = data.data;
        setStart(s);
        setCheatingLimit(s.cheatingLimit ?? 3);
        setCheatingCount(s.cheatingCount ?? 0);
        // 剩余时间
        const deadline = dayjs(s.deadline);
        const now = dayjs();
        const left = Math.max(0, deadline.diff(now, 'second'));
        setRemainingSec(left);
        enterAtRef.current = Date.now();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [params.id]);

  // 倒计时
  useEffect(() => {
    if (remainingSec === null || submitResult) return;
    if (remainingSec <= 0) {
      if (!submitting && !submitResult) {
        antMessage.warning('时间到，自动交卷中');
        void handleSubmit(true);
      }
      return;
    }
    const t = setInterval(() => setRemainingSec((s) => (s === null ? s : s - 1)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [remainingSec, submitResult, submitting]);

  // 切屏 / 复制 / 全屏 防作弊回调
  useEffect(() => {
    if (!start || submitResult || start.status !== 'IN_PROGRESS') return;
    let lastHiddenAt = 0;
    async function report(type: string, detail?: string) {
      try {
        const r = await fetch(`/api/v1/exams/${params.id}/violation`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, detail }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.success) {
            setCheatingCount(d.data.newCount ?? cheatingCount + 1);
            if (d.data.message) modal.warning({ title: '违规提醒', content: d.data.message });
            else if (d.data.remaining !== undefined) {
              antMessage.warning(`违规 ${d.data.newCount}/${d.data.maxAllowed}，剩余允许 ${d.data.remaining} 次`);
            }
            if (d.data.overLimit) {
              // 自动收卷
              setTimeout(() => window.location.reload(), 1200);
            }
          }
        }
      } catch { /* ignore */ }
    }
    const onVisibility = () => {
      if (document.hidden) {
        lastHiddenAt = Date.now();
      } else if (lastHiddenAt > 0 && Date.now() - lastHiddenAt > 1500) {
        void report('tab_switch', `离开时长 ${Math.round((Date.now() - lastHiddenAt) / 1000)}s`);
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      void report('copy');
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      void report('right_click');
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) void report('fullscreen_change', '退出全屏');
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
    // eslint-disable-next-line
  }, [start, submitResult, cheatingCount]);

  const questions = useMemo(() => start?.questions ?? [], [start]);
  const current = questions[currentIndex];

  // 切题时记录用时
  function goTo(i: number) {
    if (!current) { setCurrentIndex(i); return; }
    const elapsed = Math.max(0, Math.round((Date.now() - enterAtRef.current) / 1000));
    setUsedSec((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + elapsed }));
    enterAtRef.current = Date.now();
    setCurrentIndex(i);
  }

  async function handleSubmit(force = false) {
    if (!start) return;
    setSubmitting(true);
    try {
      // 记录当前题耗时
      if (current) {
        const elapsed = Math.max(0, Math.round((Date.now() - enterAtRef.current) / 1000));
        setUsedSec((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + elapsed }));
      }
      const res = await fetch(`/api/v1/exams/${params.id}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId: start.resultId, answers, questionUsedSec: usedSec }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitResult(data.data);
        enterFullscreen.release?.();
        antMessage.success(force ? '已超时自动交卷' : '交卷成功');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        modal.error({ title: '交卷失败', content: data.error?.message ?? '错误' });
      }
    } catch {
      modal.error({ title: '网络错误' });
    } finally {
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    if (!start) return;
    const answered = Object.keys(answers).filter((k) => answers[k]).length;
    modal.confirm({
      title: `确认交卷？已答 ${answered}/${questions.length}`,
      content: remainingSec !== null && remainingSec > 60 ? '提交后将不能修改答案。' : '已接近结束，建议检查未答题目。',
      okText: '确认交卷',
      cancelText: '继续答题',
      onOk: () => handleSubmit(false),
    });
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;
  if (!start) return <div className="min-h-screen flex items-center justify-center"><Button onClick={() => router.push('/exams')}>返回考试列表</Button></div>;

  const isLocked = !!submitResult || ['SUBMITTED', 'VIOLATION_SUBMIT', 'GRADED'].includes(start.status);

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      {/* 顶部栏 */}
      <div className="sticky top-0 z-10 bg-white border-b pb-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <Link href="/exams" className="text-emerald-600 text-sm">← 考试列表</Link>
          <Space wrap>
            <Tag color={cheatingCount >= cheatingLimit && cheatingLimit > 0 ? 'red' : 'blue'}>
              违规 {cheatingCount}/{cheatingLimit}
            </Tag>
            {remainingSec !== null && (
              <Progress
                percent={Math.min(100, Math.round(remainingSec / Math.max(1, (dayjs(start.deadline).diff(dayjs(start.startTime), 'second'))) * 100))}
                showInfo={false}
                size="small"
                status={remainingSec < 300 ? 'exception' : 'active'}
                style={{ width: 140 }}
              />
            )}
            <span className="font-mono text-sm text-gray-600">
              剩余 {remainingSec !== null ? formatSec(remainingSec) : '--:--'}
            </span>
          </Space>
        </div>
      </div>

      {/* 结果面板 */}
      {submitResult && (
        <Result
          status={
            submitResult.status === 'VIOLATION_SUBMIT' ? 'error' :
              submitResult.graded ? (
                (submitResult.correctRate ?? 0) >= 60 ? 'success' : 'warning'
              ) : 'info'
          }
          title={
            submitResult.status === 'VIOLATION_SUBMIT' ? '本次考试因违规被强制收卷' :
              submitResult.graded ? `得分 ${submitResult.score}/${start.questions.reduce((s, q) => s + q.perScore, 0)}` :
                '交卷成功，等待教师批改主观题'
          }
          subTitle={
            <>
              <span>状态：{submitResult.status}</span>
              {submitResult.graded && (
                <> · 正确 {submitResult.correctCount}/{submitResult.totalCount} · 正确率 {submitResult.correctRate}%</>
              )}
              {submitResult.overdue && <Tag color="orange">超时交卷</Tag>}
            </>
          }
          extra={
            <Space>
              <Link href={`/exams/${params.id}/my-result`}><Button type="primary">查看成绩页</Button></Link>
              <Link href="/exams"><Button>返回列表</Button></Link>
            </Space>
          }
        />
      )}

      {/* 题目导航 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {questions.map((q, i) => {
          const done = !!answers[q.id];
          const isCurrent = i === currentIndex;
          let cls = 'w-9 h-9 border rounded text-sm flex items-center justify-center cursor-pointer transition ';
          if (isCurrent) cls += 'bg-emerald-600 text-white border-emerald-600';
          else if (done) cls += 'bg-emerald-50 border-emerald-400 text-emerald-700';
          else cls += 'bg-white border-gray-200 hover:border-emerald-400';
          return <div key={q.id} className={cls} onClick={() => goTo(i)}>{i + 1}</div>;
        })}
      </div>

      {current && (
        <Card>
          <QuestionView
            key={current.id}
            q={current}
            index={currentIndex}
            answer={answers[current.id] ?? ''}
            onChange={(v) => setAnswers({ ...answers, [current.id]: v })}
            disabled={isLocked}
            detail={submitResult?.details?.find((d: SubmitDetail) => d.examQuestionId === current.id)}
          />
          <div className="flex justify-between mt-6">
            <Button disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}>上一题</Button>
            <Space>
              <Button disabled={currentIndex === questions.length - 1} onClick={() => goTo(currentIndex + 1)} type="primary">
                下一题
              </Button>
              {!isLocked && (
                <Button danger loading={submitting} onClick={confirmSubmit}>交卷</Button>
              )}
            </Space>
          </div>
        </Card>
      )}
    </main>
  );
}

function enterFullscreen() { return { release: () => {} }; }

function formatSec(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function QuestionView({
  q, index, answer, onChange, disabled, detail,
}: {
  q: ExamQuestion;
  index: number;
  answer: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  detail?: SubmitDetail;
}) {
  const showResult = !!detail;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-lg font-bold">{index + 1}.</span>
        <Tag color={q.questionType === 'SINGLE_CHOICE' ? 'blue' : q.questionType === 'MULTI_CHOICE' ? 'purple' : q.questionType === 'FILL_BLANK' ? 'cyan' : q.questionType === 'CODING' ? 'gold' : 'geekblue'}>
          {typeLabel(q.questionType)}
        </Tag>
        <span className="text-sm text-gray-400">
          ({q.perScore}分)
          {Array.from({ length: q.difficulty }).map((_, i) => <span key={i} className="ml-1 text-yellow-400">★</span>)}
        </span>
        {detail && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            q.questionType === 'ESSAY' || q.questionType === 'CODING'
              ? 'bg-yellow-50 text-yellow-700'
              : detail.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {detail.isCorrect ? '✓ 正确' : q.questionType === 'ESSAY' || q.questionType === 'CODING' ? '待/已批改' : '✗ 错误'}
            {' '}{detail.objectiveScore}/{detail.perScore}
          </span>
        )}
      </div>
      <div className="text-[15px] leading-relaxed mb-5 whitespace-pre-wrap">{q.content}</div>

      {q.questionType === 'SINGLE_CHOICE' && q.options && (
        <Radio.Group value={answer} onChange={(e) => onChange(e.target.value)} className="flex flex-col gap-3" disabled={disabled}>
          {q.options.map((opt, i) => (
            <Radio key={i} value={LETTERS[i]} className="!flex !items-start">
              <span className="inline-block w-6 font-semibold">{LETTERS[i]}.</span>
              <span className="flex-1 whitespace-pre-wrap">{opt}</span>
            </Radio>
          ))}
        </Radio.Group>
      )}
      {q.questionType === 'MULTI_CHOICE' && q.options && (
        <Checkbox.Group
          value={(() => { try { return JSON.parse(answer); } catch { return answer ? [answer] : []; } })()}
          onChange={(v) => onChange(JSON.stringify(v))}
          className="flex flex-col gap-3"
          disabled={disabled}
        >
          {q.options.map((opt, i) => (
            <Checkbox key={i} value={LETTERS[i]} className="!flex !items-start">
              <span className="inline-block w-6 font-semibold">{LETTERS[i]}.</span>
              <span className="flex-1 whitespace-pre-wrap">{opt}</span>
            </Checkbox>
          ))}
        </Checkbox.Group>
      )}
      {q.questionType === 'FILL_BLANK' && (
        <Input.TextArea value={answer} onChange={(e) => onChange(e.target.value)} placeholder="请输入答案" rows={2} disabled={disabled} />
      )}
      {(q.questionType === 'ESSAY' || q.questionType === 'CODING') && (
        <Input.TextArea
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.questionType === 'CODING' ? '请输入代码（支持伪代码、主流语言）' : '请作答，提交后由教师或 AI 手动批改'}
          rows={8}
          className="font-mono"
          disabled={disabled}
        />
      )}

      {showResult && (
        <div className="mt-6 space-y-3 pt-4 border-t border-gray-100">
          <div>
            <span className="text-gray-400 text-sm mr-2">你的答案：</span>
            <span className={detail!.isCorrect ? 'text-green-700' : 'text-red-600'}>{answer || '未作答'}</span>
          </div>
          <div>
            <span className="text-gray-400 text-sm mr-2">参考答案：</span>
            <span className="text-emerald-700 font-medium">{q.answer ?? '无（主观题）'}</span>
          </div>
          {detail!.message && <div className="text-xs text-gray-400">提示：{detail!.message}</div>}
          {q.analysis && (
            <div className="bg-emerald-50 rounded-lg p-4 text-sm">
              <div className="font-semibold mb-1">解析：</div>
              <div className="whitespace-pre-wrap text-gray-700">{q.analysis}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function typeLabel(t: QuestionType) {
  return ({ SINGLE_CHOICE: '单选', MULTI_CHOICE: '多选', FILL_BLANK: '填空', ESSAY: '问答', CODING: '编程' } as const)[t];
}
