'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Spin, App, Button, Radio, Checkbox, Input, Form, Result, Space, Modal } from 'antd';
import Link from 'next/link';

type QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'FILL_BLANK' | 'ESSAY' | 'CODING';

interface PQ {
  id: string;
  sortOrder: number;
  score: number;
  question: {
    id: string;
    content: string;
    options: string[] | null;
    questionType: QuestionType;
    difficulty: number;
    analysis: string | null;
    answer: string | null;
    correctCount: number;
    attemptCount: number;
  };
}

interface PaperDetail {
  id: string;
  title: string;
  subject: { id: number; name: string };
  mode: string;
  totalScore: number;
  durationMin: number | null;
  questions: PQ[];
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">加载中...</div>}>
      <PracticeInner />
    </Suspense>
  );
}

function PracticeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 支持两种模式：?paperId=xxx 整卷练习；?questionId=xxx 单题练习
  const paperId = params.get('paperId');
  const singleQid = params.get('questionId');

  async function loadPaper() {
    setLoading(true);
    try {
      if (paperId) {
        const res = await fetch(`/api/v1/papers/${paperId}`, { credentials: 'include' });
        if (res.status === 401) { router.push('/login?redirect=/practice'); return; }
        const data = await res.json();
        if (data.success) {
          setPaper(data.data.paper);
          setAnswers({});
          setResult(null);
        } else message.error(data.error?.message ?? '加载失败');
      } else if (singleQid) {
        const res = await fetch(`/api/v1/questions/${singleQid}`, { credentials: 'include' });
        if (res.status === 401) { router.push('/login?redirect=/practice'); return; }
        const data = await res.json();
        if (data.success) {
          const q = data.data.question;
          setPaper({
            id: 'single',
            title: '单题练习',
            subject: q.subject,
            mode: 'RANDOM',
            totalScore: 5,
            durationMin: null,
            questions: [{
              id: 'single-wrap', sortOrder: 0, score: 5, question: q,
            }],
          });
          setAnswers({});
          setResult(null);
        } else message.error(data.error?.message ?? '加载失败');
      } else {
        // 默认：随机组卷 10 道单选
        const genRes = await fetch('/api/v1/papers/generate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `随机练习卷 · ${new Date().toLocaleDateString()}`,
            subjectId: 2, // 数学作为默认
            mode: 'RANDOM',
            questionCount: { SINGLE_CHOICE: 10 },
            perScore: 5,
          }),
        });
        if (genRes.status === 401) { router.push('/login?redirect=/practice'); return; }
        const data = await genRes.json();
        if (data.success) {
          router.replace(`/practice?paperId=${data.data.paper.id}`);
          return;
        } else if (data.error?.message?.includes('未找到')) {
          modal.info({
            title: '暂无题目数据',
            content: (
              <div>
                <p>数据库中暂无已审核通过的题目。以下两种方式快速开始：</p>
                <ol className="list-decimal pl-5 mt-2">
                  <li>登录后调用 <code>POST /api/v1/questions</code> 创建题目（教师角色）</li>
                  <li>或先 <code>npm run db:seed</code> 扩展种子题目</li>
                </ol>
                <p className="mt-3">完成后 <Link href="/questions">前往题库</Link> 练习。</p>
              </div>
            ),
          });
        } else {
          message.error(data.error?.message ?? '组卷失败');
        }
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPaper();
    // eslint-disable-next-line
  }, [paperId, singleQid]);

  const questions = useMemo(() => paper?.questions ?? [], [paper]);
  const current = questions[currentIndex];

  async function handleSubmitAll() {
    if (!paper || paper.id === 'single') return;
    modal.confirm({
      title: `确认提交？已答 ${Object.keys(answers).length}/${questions.length}`,
      okText: '提交',
      cancelText: '继续答题',
      onOk: async () => {
        setSubmitting(true);
        try {
          const res = await fetch(`/api/v1/papers/${paper.id}/submit`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers }),
          });
          const data = await res.json();
          if (data.success) {
            setResult(data.data);
            message.success('提交成功');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            message.error(data.error?.message ?? '提交失败');
          }
        } catch {
          message.error('网络错误');
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;
  }
  if (!paper) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-500">
      <p>暂无可练习的题目</p>
      <Link href="/questions" className="text-emerald-600">返回题库</Link>
    </div>;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <Link href="/questions" className="text-emerald-600 text-sm">← 返回题库</Link>
          <h1 className="text-2xl font-bold mt-1">{paper.title}</h1>
          <p className="text-sm text-gray-500">
            {paper.subject.name} · {paper.mode} · 共 {questions.length} 题 · 总分 {paper.totalScore}
            {paper.durationMin && ` · 建议时长 ${paper.durationMin} 分钟`}
          </p>
        </div>
        {paper.id !== 'single' && !result && (
          <Button type="primary" loading={submitting} onClick={handleSubmitAll}>提交答卷</Button>
        )}
      </div>

      {/* 结果面板 */}
      {result && (
        <Result
          status={result.correctRate >= 60 ? 'success' : 'warning'}
          title={`得分 ${result.score}/${result.totalScore}`}
          subTitle={`正确 ${result.correctCount}/${result.totalCount} · 正确率 ${result.correctRate}%`}
          extra={<Link href="/practice"><Button>再练一套</Button></Link>}
          className="mb-6"
        />
      )}

      {/* 题目导航 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {questions.map((_, i) => {
          const qid = questions[i].question.id;
          const done = !!answers[qid];
          const isCurrent = i === currentIndex;
          let cls = 'w-9 h-9 border rounded text-sm flex items-center justify-center cursor-pointer transition ';
          if (isCurrent) cls += 'bg-emerald-600 text-white border-emerald-600';
          else if (done) cls += 'bg-emerald-50 border-emerald-400 text-emerald-700';
          else cls += 'bg-white border-gray-200 hover:border-emerald-400';
          return (
            <div key={i} className={cls} onClick={() => setCurrentIndex(i)}>
              {i + 1}
            </div>
          );
        })}
      </div>

      {/* 当前题 */}
      {current && (
        <Card>
          <QuestionView
            key={current.question.id}
            pq={current}
            index={currentIndex}
            answer={answers[current.question.id]}
            onChange={(val) => setAnswers({ ...answers, [current.question.id]: val })}
            result={result?.details?.find((d: any) => d.questionId === current.question.id)}
          />

          <div className="flex justify-between mt-6">
            <Button disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)}>
              上一题
            </Button>
            <Space>
              {paper.id === 'single' && (
                <Button type="primary" onClick={() => submitSingle(current, answers[current.question.id] ?? '', setResult, setSubmitting, message, paper)} loading={submitting}>
                  提交单题
                </Button>
              )}
              <Button type="primary" disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex(currentIndex + 1)}>
                下一题
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </main>
  );
}

async function submitSingle(
  pq: PQ,
  userAns: string,
  setResult: any,
  setSubmitting: any,
  message: any,
  paper: PaperDetail,
) {
  // 单题场景：调用 submit API 时需要试卷，但单题场景是临时的"paper"包装
  // 简化：直接逐题提示判分结果（调用一个"答题记录"API 超出 scope，本页暂给前端提示）
  message.info('单题即时反馈：请创建试卷（paperId 模式）体验完整交卷+错题本流程');
  // 伪造一个本地结果供展示
  const r = localGrade(pq, userAns);
  setResult({
    score: r.score * pq.score, totalScore: pq.score,
    correctCount: r.isCorrect ? 1 : 0, totalCount: 1, correctRate: r.isCorrect ? 100 : 0,
    details: [{
      questionId: pq.question.id,
      questionType: pq.question.questionType,
      userAnswer: userAns,
      correctAnswer: pq.question.answer,
      isCorrect: r.isCorrect,
      score: r.score * pq.score,
      maxScore: pq.score,
      message: r.message,
    }],
  });
  void paper;
}

function localGrade(pq: PQ, userAns: string) {
  const ans = pq.question.answer ?? '';
  if (!ans) return { isCorrect: false, score: 0, message: '无参考答案' };
  const t = pq.question.questionType;
  if (t === 'SINGLE_CHOICE') {
    const isCorrect = userAns.trim().toUpperCase() === ans.trim().toUpperCase();
    return { isCorrect, score: isCorrect ? 1 : 0 };
  }
  if (t === 'MULTI_CHOICE') {
    const normalize = (s: string) => {
      let arr: string[];
      try { arr = JSON.parse(s); } catch { arr = [s]; }
      return arr.map((x) => x.trim().toUpperCase()).sort().join(',');
    };
    const isCorrect = normalize(userAns) === normalize(ans);
    return { isCorrect, score: isCorrect ? 1 : 0 };
  }
  if (t === 'FILL_BLANK') {
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const isCorrect = norm(userAns) === norm(ans);
    return { isCorrect, score: isCorrect ? 1 : 0 };
  }
  return { isCorrect: false, score: 0, message: '主观题需AI判分' };
}

function QuestionView({
  pq, index, answer, onChange, result,
}: {
  pq: PQ;
  index: number;
  answer: string;
  onChange: (v: string) => void;
  result?: { isCorrect: boolean; score: number; maxScore: number; userAnswer: string; correctAnswer: string | null; message?: string };
}) {
  const q = pq.question;
  const showResult = !!result;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-lg font-bold">{index + 1}.</span>
        <span className="text-sm text-gray-400">
          ({pq.score}分)
          {Array.from({ length: q.difficulty }).map((_, i) =>
            <span key={i} className="ml-1 text-yellow-400">★</span>
          )}
        </span>
        {showResult && (
          <ResultTag isCorrect={result!.isCorrect} score={result!.score} max={result!.maxScore} />
        )}
      </div>
      <div className="text-[15px] leading-relaxed mb-5 whitespace-pre-wrap">{q.content}</div>

      {/* 按题型渲染作答区 */}
      {q.questionType === 'SINGLE_CHOICE' && q.options && (
        <Radio.Group
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          className="flex flex-col gap-3"
          disabled={showResult}
        >
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
          disabled={showResult}
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
        <Input.TextArea
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请输入答案"
          rows={2}
          disabled={showResult}
        />
      )}

      {(q.questionType === 'ESSAY' || q.questionType === 'CODING') && (
        <Input.TextArea
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="主观题/编程题：请作答（提交后由 AI 判分，第二期上线）"
          rows={6}
          disabled={showResult}
        />
      )}

      {/* 解析区 */}
      {showResult && (
        <div className="mt-6 space-y-3 pt-4 border-t border-gray-100">
          <div>
            <span className="text-gray-400 text-sm mr-2">你的答案：</span>
            <span className={result!.isCorrect ? 'text-green-700' : 'text-red-600'}>
              {result!.userAnswer || '未作答'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-sm mr-2">参考答案：</span>
            <span className="text-emerald-700 font-medium">{result!.correctAnswer ?? '无'}</span>
          </div>
          {result!.message && (
            <div className="text-xs text-gray-400">提示：{result!.message}</div>
          )}
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

function ResultTag({ isCorrect, score, max }: { isCorrect: boolean; score: number; max: number }) {
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {isCorrect ? '✓ 正确' : `✗ 错误`} {score}/{max}
    </span>
  );
}
