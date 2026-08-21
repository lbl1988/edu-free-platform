'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Spin, Button, Tag, Empty, Pagination, Popconfirm, App, Segmented, Modal, Select, Tooltip, Badge, Space,
} from 'antd';
import Link from 'next/link';

// ===== 类型 =====
interface WrongItem {
  id: string;
  questionId: string;
  mastered: boolean;
  wrongCount: number;
  lastWrongAnswer: string | null;
  firstWrongAt: string;
  lastWrongAt: string;
  // P0-1 艾宾浩斯复习引擎字段
  nextReviewAt: string | null;
  reviewCount: number;
  lastReviewedAt: string | null;
  errorTag: string | null;
  errorReason: string | null;
  question: {
    id: string;
    content: string;
    questionType: string;
    difficulty: number;
    answer: string | null;
    analysis: string | null;
    subject: { id: number; name: string };
    chapter: { id: string; title: string } | null;
  };
}

interface SimilarItem {
  id: string;
  content: string;
  questionType: string;
  difficulty: number;
  answer: string | null;
  analysis: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTI_CHOICE: '多选', FILL_BLANK: '填空', ESSAY: '解答', CODING: '编程',
};

// 错误原因标签（与 src/lib/spaced-repetition.ts ERROR_TAG_LABELS 保持一致）
const ERROR_TAG_OPTIONS = [
  { value: 'CALCULATION', label: '计算错误' },
  { value: 'CONCEPT', label: '概念混淆' },
  { value: 'MISREAD', label: '审题失误' },
  { value: 'FORGOTTEN', label: '知识遗忘' },
  { value: 'OTHER', label: '其他' },
];
const ERROR_TAG_LABEL: Record<string, string> = Object.fromEntries(
  ERROR_TAG_OPTIONS.map((o) => [o.value, o.label]),
);
const ERROR_TAG_COLOR: Record<string, string> = {
  CALCULATION: 'orange', CONCEPT: 'red', MISREAD: 'gold', FORGOTTEN: 'volcano', OTHER: 'default',
};

type TabKey = 'false' | 'true' | '' | 'due';

export default function WrongPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [list, setList] = useState<WrongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<TabKey>('false');
  const [rebuilding, setRebuilding] = useState(false);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarList, setSimilarList] = useState<SimilarItem[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '10' });
    const endpoint = tab === 'due'
      ? '/api/v1/wrong/review-due'
      : (() => {
          if (tab !== '') params.set('mastered', tab);
          return '/api/v1/wrong';
        })();
    try {
      const res = await fetch(`${endpoint}?${params}`, { credentials: 'include' });
      if (res.status === 401) { router.push('/login?redirect=/wrong'); return; }
      const data = await res.json();
      if (data.success) { setList(data.data); setTotal(data.pagination.total); setPage(p); }
      else message.error(data.error?.message ?? '加载失败');
    } catch { message.error('网络错误'); }
    finally { setLoading(false); }
  }, [tab, router, message]);

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [tab]);

  async function mastered(id: string, val: boolean) {
    const res = await fetch(`/api/v1/wrong/${id}${val ? '/mastered' : ''}`, {
      method: val ? 'POST' : 'PUT',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) { message.success(val ? '已标记为掌握' : '已标记为未掌握'); load(page); }
    else message.error(data.error?.message ?? '操作失败');
  }

  async function remove(id: string) {
    const res = await fetch(`/api/v1/wrong/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) { message.success('已移出错题本'); load(page); }
    else message.error(data.error?.message ?? '操作失败');
  }

  // 一键重组错题卷（今日到期错题 → 练习卷）
  async function rebuildPaper() {
    setRebuilding(true);
    try {
      const res = await fetch('/api/v1/wrong/rebuild-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dueOnly: tab === 'due' || tab === 'false', limit: 20 }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(`已生成错题卷（${data.data.totalQuestions}题），开始练习吧`);
        router.push(`/practice?paperId=${data.data.paper.id}`);
      } else {
        message.error(data.error?.message ?? '重组失败');
      }
    } catch { message.error('网络错误'); }
    finally { setRebuilding(false); }
  }

  // 举一反三：相似题推荐
  async function showSimilar(questionId: string) {
    setSimilarOpen(true);
    setSimilarLoading(true);
    setSimilarList([]);
    try {
      const res = await fetch(`/api/v1/wrong/similar?questionId=${questionId}&limit=5`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setSimilarList(data.data.items);
      else message.error(data.error?.message ?? '加载失败');
    } catch { message.error('网络错误'); }
    finally { setSimilarLoading(false); }
  }

  // 标记错误原因（不影响复习周期）
  async function patchErrorTag(id: string, errorTag: string | null) {
    const res = await fetch(`/api/v1/wrong/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ errorTag }),
    });
    const data = await res.json();
    if (data.success) { message.success('已记录错误原因'); load(page); }
    else message.error(data.error?.message ?? '操作失败');
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/questions" className="text-emerald-600 text-sm">← 返回题库</Link>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            错题本
            {tab === 'due' && <Badge count={total} overflowCount={99} style={{ backgroundColor: '#52c41a' }} />}
          </h1>
          <p className="text-sm text-gray-500">
            答错自动加入 · 艾宾浩斯遗忘曲线自动排程复习 · 答对 5 次彻底掌握
          </p>
        </div>
        <Space direction="vertical" align="end" size={8}>
          <Segmented<TabKey>
            value={tab}
            onChange={setTab}
            options={[
              { label: '今日复习', value: 'due' },
              { label: '未掌握', value: 'false' },
              { label: '已掌握', value: 'true' },
              { label: '全部', value: '' },
            ]}
          />
          <Button type="primary" loading={rebuilding} onClick={rebuildPaper}>
            一键重组错题卷
          </Button>
        </Space>
      </div>

      {loading ? <div className="flex justify-center py-20"><Spin size="large" /></div> :
        list.length === 0 ? <Empty description={tab === 'due' ? '今日无到期复习 😊' : '这里空空如也 😊'} /> :
          <>
            <div className="space-y-4">
              {list.map((w, idx) => {
                const review = formatReview(w.nextReviewAt, w.mastered);
                return (
                  <Card key={w.id} size="small"
                    extra={
                      <div className="flex gap-2 flex-wrap justify-end">
                        <Button size="small" type="link"
                          onClick={() => router.push(`/practice?questionId=${w.question.id}`)}>
                          再练一次
                        </Button>
                        <Button size="small" type="link" onClick={() => showSimilar(w.question.id)}>
                          举一反三
                        </Button>
                        {!w.mastered && (
                          <Button size="small" onClick={() => mastered(w.question.id, true)}>
                            标记掌握
                          </Button>
                        )}
                        <Popconfirm title="确认从错题本移除？" onConfirm={() => remove(w.question.id)}>
                          <Button size="small" danger type="link">移除</Button>
                        </Popconfirm>
                      </div>
                    }>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-gray-400 text-sm w-8">#{idx + (page - 1) * 10 + 1}</span>
                      <Tag>{TYPE_LABEL[w.question.questionType] ?? w.question.questionType}</Tag>
                      <Tag>{w.question.subject.name}</Tag>
                      {w.question.chapter && <Tag color="purple">{w.question.chapter.title}</Tag>}
                      {w.mastered ? <Tag color="green">已掌握</Tag> : <Tag color="red">未掌握</Tag>}
                      <span className="text-xs text-gray-400">错 {w.wrongCount} 次</span>
                      <span className="text-xs text-gray-400">复习 {w.reviewCount} 次</span>
                      <Tooltip title={review.tooltip}>
                        <Tag color={review.color}>{review.text}</Tag>
                      </Tooltip>
                      {w.errorTag && (
                        <Tag color={ERROR_TAG_COLOR[w.errorTag] ?? 'default'}>
                          {ERROR_TAG_LABEL[w.errorTag] ?? w.errorTag}
                        </Tag>
                      )}
                    </div>
                    <div className="text-[15px] line-clamp-3 mb-3">{w.question.content}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {w.question.answer && (
                        <div className="text-sm bg-emerald-50 rounded p-2 flex-1 min-w-[200px]">
                          <span className="text-gray-500 mr-2">参考答案：</span>
                          <span className="font-medium text-emerald-700">{w.question.answer}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-400">错误原因：</span>
                        <Select
                          size="small"
                          allowClear
                          placeholder="标记原因"
                          style={{ minWidth: 110 }}
                          value={w.errorTag ?? undefined}
                          options={ERROR_TAG_OPTIONS}
                          onChange={(v) => patchErrorTag(w.question.id, v ?? null)}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {total > 10 && (
              <div className="flex justify-center mt-8">
                <Pagination current={page} total={total} pageSize={10} onChange={load} />
              </div>
            )}
          </>
      }

      {/* 举一反三：相似题弹窗 */}
      <Modal
        title="举一反三 · 相似题推荐"
        open={similarOpen}
        onCancel={() => setSimilarOpen(false)}
        footer={null}
        width={680}
      >
        {similarLoading ? <div className="flex justify-center py-10"><Spin /></div> :
          similarList.length === 0 ? <Empty description="暂无相似题" /> :
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {similarList.map((s, i) => (
                <Card key={s.id} size="small" title={<><Tag>{TYPE_LABEL[s.questionType] ?? s.questionType}</Tag><span className="text-xs text-gray-400">难度 {s.difficulty}</span></>} extra={
                  <Button size="small" type="link" onClick={() => { setSimilarOpen(false); router.push(`/practice?questionId=${s.id}`); }}>练习</Button>
                }>
                  <div className="text-sm line-clamp-3">{i + 1}. {s.content}</div>
                  {s.answer && <div className="text-xs text-emerald-700 mt-1">答案：{s.answer}</div>}
                </Card>
              ))}
            </div>
        }
      </Modal>
    </main>
  );
}

// 下次复习时间格式化
function formatReview(nextReviewAt: string | null, mastered: boolean): { text: string; color: string; tooltip: string } {
  if (mastered) return { text: '已掌握', color: 'green', tooltip: '已彻底掌握，不再排程复习' };
  if (!nextReviewAt) return { text: '未排程', color: 'default', tooltip: '尚未进入复习排程' };
  const next = new Date(nextReviewAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const diffDays = Math.round((nextDay.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 0) return { text: '已到期', color: 'red', tooltip: `到期时间：${next.toLocaleString('zh-CN')}` };
  if (diffDays === 1) return { text: '明天复习', color: 'orange', tooltip: `到期时间：${next.toLocaleString('zh-CN')}` };
  return { text: `${diffDays}天后`, color: 'blue', tooltip: `到期时间：${next.toLocaleString('zh-CN')}` };
}
