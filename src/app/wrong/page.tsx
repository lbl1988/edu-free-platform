'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Button, Tag, Empty, Pagination, Popconfirm, App, Segmented } from 'antd';
import Link from 'next/link';

interface WrongItem {
  id: string;
  questionId: string;
  mastered: boolean;
  wrongCount: number;
  lastWrongAnswer: string | null;
  firstWrongAt: string;
  lastWrongAt: string;
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

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTI_CHOICE: '多选', FILL_BLANK: '填空', ESSAY: '解答', CODING: '编程',
};

export default function WrongPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [list, setList] = useState<WrongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<string>('false'); // 'false'未掌握 / 'true'已掌握

  async function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '10' });
    if (tab !== '') params.set('mastered', tab);
    try {
      const res = await fetch(`/api/v1/wrong?${params}`, { credentials: 'include' });
      if (res.status === 401) { router.push('/login?redirect=/wrong'); return; }
      const data = await res.json();
      if (data.success) { setList(data.data); setTotal(data.pagination.total); setPage(p); }
      else message.error(data.error?.message ?? '加载失败');
    } catch { message.error('网络错误'); }
    finally { setLoading(false); }
  }

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

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/questions" className="text-emerald-600 text-sm">← 返回题库</Link>
          <h1 className="text-2xl font-bold mt-1">错题本</h1>
          <p className="text-sm text-gray-500">答错的题目会自动加入，答对后自动标记为掌握</p>
        </div>
        <Segmented<string>
          value={tab}
          onChange={setTab}
          options={[
            { label: '未掌握', value: 'false' },
            { label: '已掌握', value: 'true' },
            { label: '全部', value: '' },
          ]}
        />
      </div>

      {loading ? <div className="flex justify-center py-20"><Spin size="large" /></div> :
        list.length === 0 ? <Empty description="这里空空如也 😊" /> :
          <>
            <div className="space-y-4">
              {list.map((w, idx) => (
                <Card key={w.id} size="small"
                  extra={
                    <div className="flex gap-2">
                      <Button size="small" type="link"
                        onClick={() => router.push(`/practice?questionId=${w.question.id}`)}>
                        再练一次
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
                  </div>
                  <div className="text-[15px] line-clamp-3 mb-3">{w.question.content}</div>
                  {w.question.answer && (
                    <div className="text-sm bg-emerald-50 rounded p-2">
                      <span className="text-gray-500 mr-2">参考答案：</span>
                      <span className="font-medium text-emerald-700">{w.question.answer}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
            {total > 10 && (
              <div className="flex justify-center mt-8">
                <Pagination current={page} total={total} pageSize={10} onChange={load} />
              </div>
            )}
          </>
      }
    </main>
  );
}
