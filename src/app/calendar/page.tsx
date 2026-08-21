'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, App, Button, Tag, Row, Col, Statistic, Empty } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  EditOutlined,
  AimOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

interface CalendarEvent {
  type: string;
  title: string;
  detail?: string;
}

interface DayEvents {
  date: string;
  events: CalendarEvent[];
}

interface CalendarResp {
  month: string;
  monthStart: string;
  monthEnd: string;
  summary: { examCount: number; checkInDays: number; practiceCount: number; activeGoals: number };
  events: DayEvents[];
}

const EVENT_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  exam: { color: '#EF4444', icon: <TrophyOutlined /> },
  checkin: { color: '#10B981', icon: <CheckCircleOutlined /> },
  practice: { color: '#3B82F6', icon: <EditOutlined /> },
  goal: { color: '#F59E0B', icon: <AimOutlined /> },
};

export default function CalendarPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CalendarResp | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadCalendar = useCallback((month: string) => {
    setLoading(true);
    fetch(`/api/v1/calendar?month=${month}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        if (d.success) setData(d.data);
        else message.error(d.error?.message ?? '加载失败');
      })
      .catch(() => {
        message.error('网络错误');
        router.push('/login?redirect=/calendar');
      })
      .finally(() => setLoading(false));
  }, [message, router]);

  useEffect(() => {
    loadCalendar(currentMonth);
  }, [currentMonth, loadCalendar]);

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // 构建日历网格
  const [year, month] = currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const eventMap = new Map<string, CalendarEvent[]>();
  data?.events.forEach((d) => eventMap.set(d.date, d.events));

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const cells: Array<{ day: number | null; date: string | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr });
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarOutlined /> 学习日历
        </h1>
        <Link href="/dashboard">
          <Button>返回工作台</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : data ? (
        <>
          {/* 月度统计 */}
          <Row gutter={16} className="mb-6">
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="本月考试" value={data.summary.examCount} prefix={<TrophyOutlined style={{ color: '#EF4444' }} />} valueStyle={{ color: '#EF4444' }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="本月打卡" value={data.summary.checkInDays} prefix={<CheckCircleOutlined style={{ color: '#10B981' }} />} valueStyle={{ color: '#10B981' }} suffix="天" />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="本月练习" value={data.summary.practiceCount} prefix={<EditOutlined style={{ color: '#3B82F6' }} />} valueStyle={{ color: '#3B82F6' }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="有效目标" value={data.summary.activeGoals} prefix={<AimOutlined style={{ color: '#F59E0B' }} />} valueStyle={{ color: '#F59E0B' }} />
              </Card>
            </Col>
          </Row>

          {/* 日历网格 */}
          <Card>
            {/* 月份导航 */}
            <div className="flex items-center justify-between mb-4">
              <Button icon={<LeftOutlined />} onClick={prevMonth} />
              <h2 className="text-lg font-semibold">{currentMonth}</h2>
              <Button icon={<RightOutlined />} onClick={nextMonth} />
            </div>

            {/* 星期表头 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekdays.map((w) => (
                <div key={w} className="text-center text-xs font-medium text-gray-500 py-1">
                  {w}
                </div>
              ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                const events = cell.date ? eventMap.get(cell.date) ?? [] : [];
                const isToday = cell.date === today;
                return (
                  <div
                    key={i}
                    className="min-h-20 border rounded p-1"
                    style={{
                      background: isToday ? '#10B98108' : events.length > 0 ? '#F9FAFB' : '#fff',
                      borderColor: isToday ? '#10B98140' : '#E5E7EB',
                    }}
                  >
                    {cell.day && (
                      <div className="text-xs text-gray-600 mb-1" style={{ fontWeight: isToday ? 700 : 400 }}>
                        {cell.day}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map((e, ei) => {
                        const cfg = EVENT_CONFIG[e.type] ?? { color: '#6b7280', icon: null };
                        return (
                          <div
                            key={ei}
                            className="text-xs rounded px-1 truncate"
                            style={{ background: `${cfg.color}15`, color: cfg.color }}
                            title={`${e.title}${e.detail ? ' - ' + e.detail : ''}`}
                          >
                            {e.title}
                          </div>
                        );
                      })}
                      {events.length > 3 && (
                        <div className="text-xs text-gray-400">+{events.length - 3} 更多</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 图例 */}
            <div className="mt-4 pt-3 border-t flex flex-wrap gap-3">
              {Object.entries(EVENT_CONFIG).map(([type, cfg]) => (
                <Tag key={type} style={{ color: cfg.color, borderColor: `${cfg.color}40` }}>
                  {cfg.icon} {type === 'exam' ? '考试' : type === 'checkin' ? '打卡' : type === 'practice' ? '练习' : '目标'}
                </Tag>
              ))}
            </div>
          </Card>

          {/* 当月事件列表 */}
          <Card title="本月事件详情" className="mt-6">
            {data.events.length > 0 ? (
              <div className="space-y-2">
                {data.events.map((d) => (
                  <div key={d.date} className="border rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {d.date}（{weekdays[new Date(d.date).getDay()]}）
                    </div>
                    <div className="space-y-1">
                      {d.events.map((e, ei) => {
                        const cfg = EVENT_CONFIG[e.type] ?? { color: '#6b7280', icon: null };
                        return (
                          <div key={ei} className="flex items-start gap-2 text-sm">
                            <span style={{ color: cfg.color }}>{cfg.icon}</span>
                            <span className="flex-1">{e.title}</span>
                            {e.detail && <span className="text-gray-400 text-xs">{e.detail}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="本月暂无学习事件记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </>
      ) : null}
    </main>
  );
}
