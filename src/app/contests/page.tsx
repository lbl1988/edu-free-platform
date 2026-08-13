'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Tag, Input, Select, Button, Empty, App, Pagination, Segmented } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';

interface ContestItem {
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
  creator: { id: string; nickname: string | null };
  enrollmentsCount: number;
  problemsCount: number;
  createdAt: string;
}

export default function ContestsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [list, setList] = useState<ContestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [whitelistOnly, setWhitelistOnly] = useState<'all' | 'whitelist'>('all');
  const [filters, setFilters] = useState({ subjectId: '', year: '', stage: '', keyword: '' });

  async function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '12' });
    if (whitelistOnly === 'whitelist') params.set('whitelist', 'true');
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const res = await fetch(`/api/v1/contests?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setList(data.data.contests || []);
        setTotal(data.pagination.total);
        setPage(p);
      } else {
        message.error(data.error?.message ?? '加载失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subjects = useMemo(() => {
    const m = new Map<number, string>();
    list.forEach((c) => m.set(c.subject.id, c.subject.name));
    return Array.from(m.entries()).map(([id, name]) => ({ value: String(id), label: name }));
  }, [list]);

  const years = useMemo(() => {
    const s = new Set<number>();
    list.forEach((c) => s.add(c.year));
    return Array.from(s)
      .sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: `${y} 年` }));
  }, [list]);

  const now = dayjs();

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-emerald-600 text-sm">← 返回首页</Link>
          <h1 className="text-2xl font-bold mt-1">全国竞赛</h1>
          <p className="text-sm text-gray-500 mt-1">
            教育部白名单赛事与编程竞赛，线上 OJ 判题系统支持
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <Input.Search
          placeholder="搜索竞赛名称"
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onSearch={() => load(1)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="学科"
          value={filters.subjectId || undefined}
          onChange={(v) => setFilters({ ...filters, subjectId: v ?? '' })}
          allowClear
          style={{ width: 130 }}
          options={subjects}
        />
        <Select
          placeholder="年份"
          value={filters.year || undefined}
          onChange={(v) => setFilters({ ...filters, year: v ?? '' })}
          allowClear
          style={{ width: 110 }}
          options={years}
        />
        <Select
          placeholder="阶段"
          value={filters.stage || undefined}
          onChange={(v) => setFilters({ ...filters, stage: v ?? '' })}
          allowClear
          style={{ width: 130 }}
          options={[
            { label: '初赛', value: '初赛' },
            { label: '复赛', value: '复赛' },
            { label: '决赛', value: '决赛' },
            { label: '省级', value: '省级' },
            { label: '国家级', value: '国家级' },
          ]}
        />
        <Segmented
          value={whitelistOnly}
          onChange={(v) => {
            setWhitelistOnly(v as any);
            setTimeout(() => load(1), 0);
          }}
          options={[
            { label: '全部赛事', value: 'all' },
            {
              label: (
                <span className="inline-flex items-center gap-1">
                  <SafetyCertificateOutlined style={{ color: '#f5222d' }} />
                  仅白名单
                </span>
              ),
              value: 'whitelist',
            },
          ]}
        />
        <Button type="primary" onClick={() => load(1)}>查询</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : list.length === 0 ? (
        <Empty description="暂无竞赛" />
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((c) => {
              const start = dayjs(c.startTime);
              const end = dayjs(c.endTime);
              const isNotStarted = now.isBefore(start);
              const isInProgress = !isNotStarted && now.isBefore(end);
              const isEnded = now.isAfter(end);
              const statusColor = isNotStarted ? 'gold' : isInProgress ? 'processing' : 'default';
              const statusText = isNotStarted ? '未开始' : isInProgress ? '进行中' : '已结束';

              return (
                <Card
                  key={c.id}
                  hoverable
                  onClick={() => router.push(`/contests/${c.id}`)}
                  className="overflow-hidden"
                  styles={{ body: { padding: 20 } }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-2">
                      {c.whitelist && (
                        <Tag color="red" icon={<SafetyCertificateOutlined />} className="!text-xs">
                          白名单
                        </Tag>
                      )}
                      <Tag color={statusColor as any}>{statusText}</Tag>
                      <Tag>{c.subject.name}</Tag>
                    </div>
                    <span className="text-xs text-gray-400">{c.year}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 line-clamp-2 min-h-[3.5rem]">
                    {c.title}
                  </h3>
                  {c.shortTitle && (
                    <div className="text-sm text-emerald-600 mb-2 font-medium">{c.shortTitle}</div>
                  )}
                  <div className="text-sm text-gray-500 space-y-1 mb-3">
                    <div>阶段：{c.stage}</div>
                    <div>
                      时间：{start.format('MM-DD HH:mm')} ~ {end.format('MM-DD HH:mm')}
                    </div>
                    <div>时长：{c.durationMin} 分钟 · {c.problemsCount} 道题</div>
                  </div>
                  {c.intro && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3 h-10">
                      {c.intro}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>主办方：{c.creator.nickname ?? '平台'}</span>
                    <span>已报名 {c.enrollmentsCount} 人</span>
                  </div>
                </Card>
              );
            })}
          </div>
          {total > 12 && (
            <div className="flex justify-center mt-8">
              <Pagination current={page} total={total} pageSize={12} onChange={(p) => load(p)} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
