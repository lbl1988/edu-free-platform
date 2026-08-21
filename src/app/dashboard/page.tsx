'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Button, Tag, App, Tabs, Statistic, Row, Col, Empty, Progress, Table, Select, InputNumber } from 'antd';
import { FireOutlined, TrophyOutlined, TeamOutlined, AimOutlined, CrownOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface UserInfo {
  id: string;
  phone: string;
  nickname: string | null;
  role: string;
  grade: number | null;
  realNameStatus: string;
  qaCollectionEnabled: boolean;
}

interface BehaviorResp {
  behaviorSummary: {
    minutesLast7d: number;
    minutesLast30d: number;
    questionsLast30d: number;
    correctLast30d: number;
    subjectWeights: Record<string, number>;
  } | null;
  derived30dMinutes: number;
  derivedCorrectRate: number;
}

interface RecommendItem {
  id: string;
  itemType: string;
  itemId: string;
  score: number;
  source: string;
  rank: number;
  resource: Record<string, any>;
}

interface OverviewResp {
  summary: {
    examCount: number;
    resultCount: number;
    scoredResultCount: number;
    avgScore: number;
    passRate: number;
  };
  bySubject: Array<{ subjectId: number; name: string; avgScore: number; n: number }>;
  byViolation: Array<{ type: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

// P1-2：打卡状态
interface CheckInStatus {
  checkedInToday: boolean;
  todayPoints: number | null;
  streakDays: number;
  totalPoints: number;
  lastActiveAt: string | null;
  calendar: Array<{ date: string; points: number; streak: number }>;
  totalCheckIns30d: number;
}

// P1-3：错因分析
interface ErrorCauseResp {
  totalWrong: number;
  days: number;
  tagDistribution: Array<{ tag: string; count: number; percentage: number }>;
  subjectDistribution: Array<{ subject: string; count: number; percentage: number }>;
  reasonDistribution: Array<{ reason: string; count: number; percentage: number }>;
}

// P2-1：学习目标
interface StudyGoalItem {
  id: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  progress: number;
  achieved: boolean;
}

// P2-2：徽章
interface BadgeItem {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
}

// P2-3：学情周报
interface WeeklyReport {
  period: { start: string; end: string };
  summary: {
    questionsAnswered: number;
    correctRate: number;
    correctCount: number;
    wrongAdded: number;
    wrongMastered: number;
    checkInDays: number;
    examCount: number;
    streakDays: number;
    totalPoints: number;
  };
  trends: {
    answerChange: number;
    wrongChange: number;
    answerTrendLabel: string;
    wrongTrendLabel: string;
  };
  dailyActivity: Array<{ date: string; count: number; weekday: string }>;
}

// P3-1：排行榜
interface LeaderboardEntry {
  rank: number;
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  grade: number | null;
  points: number;
  streakDays: number;
  correctRate: number;
  totalQuestions: number;
  isMe: boolean;
}

const COLOR_PALETTE = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function BarChartSVG({
  data,
  height = 260,
  getLabel,
  getValue,
  unit = '',
}: {
  data: any[];
  height?: number;
  getLabel: (d: any) => string;
  getValue: (d: any) => number;
  unit?: string;
}) {
  if (!data || data.length === 0) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  const width = 100;
  const max = Math.max(...data.map(getValue), 1);
  const barWidth = (width - 20) / data.length - 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1="10"
          x2={width - 5}
          y1={height - 30 - (p * (height - 60))}
          y2={height - 30 - (p * (height - 60))}
          stroke="#e5e7eb"
          strokeWidth="0.15"
          strokeDasharray="0.5 0.5"
        />
      ))}
      {data.map((d, i) => {
        const v = getValue(d);
        const h = (v / max) * (height - 60);
        const x = 12 + i * (barWidth + 2);
        return (
          <g key={i}>
            <rect
              x={x}
              y={height - 30 - h}
              width={barWidth}
              height={h}
              fill={COLOR_PALETTE[i % COLOR_PALETTE.length]}
              rx="1"
            />
            <text
              x={x + barWidth / 2}
              y={height - 30 - h - 2}
              fontSize="3"
              textAnchor="middle"
              fill="#374151"
            >
              {v.toFixed(0)}{unit}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 18}
              fontSize="3"
              textAnchor="middle"
              fill="#6b7280"
            >
              {getLabel(d).length > 6 ? getLabel(d).slice(0, 5) + '…' : getLabel(d)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChartSVG({
  data,
  height = 260,
  getLabel,
  getValue,
}: {
  data: any[];
  height?: number;
  getLabel: (d: any) => string;
  getValue: (d: any) => number;
}) {
  if (!data || data.length === 0) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  const cx = 100;
  const cy = height / 2;
  const r = Math.min(70, height / 2 - 25);
  const total = data.reduce((s, d) => s + getValue(d), 0) || 1;
  let acc = 0;
  const slices = data.map((d, i) => {
    const start = (acc / total) * Math.PI * 2;
    acc += getValue(d);
    const end = (acc / total) * Math.PI * 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.sin(start);
    const y1 = cy - r * Math.cos(start);
    const x2 = cx + r * Math.sin(end);
    const y2 = cy - r * Math.cos(end);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { path, color: COLOR_PALETTE[i % COLOR_PALETTE.length], label: getLabel(d), value: getValue(d), ratio: getValue(d) / total };
  });
  const legendStart = cx + r + 20;
  return (
    <svg viewBox={`0 0 ${cx * 2 + 120} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ height }}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="0.8" />
      ))}
      {slices.map((s, i) => (
        <g key={`l-${i}`} transform={`translate(${legendStart}, ${cy - slices.length * 8 + i * 16})`}>
          <rect width="8" height="8" fill={s.color} rx="1.5" />
          <text x="12" y="6.5" fontSize="5" fill="#374151">
            {s.label} {Math.round(s.ratio * 100)}% ({s.value})
          </text>
        </g>
      ))}
    </svg>
  );
}

function RadarChartSVG({
  subjects,
  size = 280,
}: {
  subjects: Array<{ name: string; value: number }>;
  size?: number;
}) {
  if (!subjects || subjects.length === 0) return <Empty description="暂无学科权重数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 50;
  const n = subjects.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const rings = [0.25, 0.5, 0.75, 1];
  const poly = (ratio: number) =>
    subjects.map((_, i) => {
      const r = R * ratio;
      return `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`;
    }).join(' ');
  const valuePoly = subjects
    .map((s, i) => {
      const r = R * Math.max(0, Math.min(1, s.value));
      return `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`;
    }).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size}>
      {rings.map((r, i) => (
        <polygon key={i} points={poly(r)} fill="none" stroke="#e5e7eb" strokeWidth="0.8" />
      ))}
      {subjects.map((_, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + R * Math.cos(angle(i))}
          y2={cy + R * Math.sin(angle(i))}
          stroke="#e5e7eb"
          strokeWidth="0.6"
        />
      ))}
      <polygon points={valuePoly} fill="#10B98133" stroke="#10B981" strokeWidth="1.5" />
      {subjects.map((s, i) => {
        const lx = cx + (R + 18) * Math.cos(angle(i));
        const ly = cy + (R + 18) * Math.sin(angle(i));
        return (
          <text key={`lb-${i}`} x={lx} y={ly} fontSize="10" fill="#374151" textAnchor="middle" dominantBaseline="middle">
            {s.name} {(s.value * 100).toFixed(0)}%
          </text>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [behavior, setBehavior] = useState<BehaviorResp | null>(null);
  const [recommends, setRecommends] = useState<RecommendItem[]>([]);
  const [recTab, setRecTab] = useState<'course' | 'question' | 'article'>('course');
  const [recLoading, setRecLoading] = useState(false);

  const [overview, setOverview] = useState<OverviewResp | null>(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherStats, setTeacherStats] = useState<{ courses: number; exams: number; grading: number; students: number }>({
    courses: 0, exams: 0, grading: 0, students: 0,
  });

  // P1-2：打卡状态
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus | null>(null);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  // P1-3：错因分析
  const [errorCauses, setErrorCauses] = useState<ErrorCauseResp | null>(null);
  // P2-1：学习目标
  const [goals, setGoals] = useState<StudyGoalItem[]>([]);
  // P2-2：徽章
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  // P2-3：学情周报
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  // 目标创建
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [newGoalType, setNewGoalType] = useState('STUDY_MINUTES');
  const [newGoalTarget, setNewGoalTarget] = useState(300);
  // P3-1：排行榜
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardType, setLeaderboardType] = useState('points');
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/v1/user', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { if (d.success) setUser(d.data); })
      .catch(() => router.push('/login?redirect=/dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'STUDENT') {
      fetch('/api/v1/recommend/behavior-summary/me', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setBehavior(d.data));
      setRecLoading(true);
      fetch('/api/v1/recommend/me?scene=dashboard&limit=60', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setRecommends(d.data.items ?? []))
        .finally(() => setRecLoading(false));
      // P1-2：加载打卡状态
      fetch('/api/v1/check-in/status', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setCheckInStatus(d.data));
      // P1-3：加载错因分析
      fetch('/api/v1/analytics/error-causes?days=90&mastered=false', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setErrorCauses(d.data));
      // P2-1：刷新目标进度并加载
      fetch('/api/v1/goals/refresh', { method: 'POST', credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setGoals(d.data.goals));
      fetch('/api/v1/goals', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setGoals(d.data.goals));
      // P2-2：检查并颁发徽章，然后加载
      fetch('/api/v1/badges/check', { method: 'POST', credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.success && d.data.count > 0) {
            message.success(d.data.message);
          }
        });
      fetch('/api/v1/badges', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setBadges(d.data.badges));
      // P2-3：加载学情周报
      fetch('/api/v1/analytics/weekly-report', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.success && setWeeklyReport(d.data));
      // P3-1：加载排行榜
      fetch('/api/v1/leaderboard?type=points&limit=20', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.success) {
            setLeaderboard(d.data.leaderboard);
            setMyRank(d.data.myRank);
          }
        });
    } else if (user.role === 'TEACHER' || user.role === 'ADMIN') {
      setTeacherLoading(true);
      Promise.all([
        fetch('/api/v1/exams/analytics/overview?timeRange=this_semester', { credentials: 'include' })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => d?.success && setOverview(d.data)),
        fetch(`/api/v1/courses?page=1&limit=1`, { credentials: 'include' }).catch(() => null),
      ]).finally(() => setTeacherLoading(false));

      fetch('/api/v1/courses?page=1&limit=200', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.success) {
            const courses = d.data?.courses ?? [];
            const total = d.pagination?.total ?? courses.length;
            setTeacherStats((s) => ({ ...s, courses: total }));
          }
        });
      fetch('/api/v1/exams?page=1&limit=200', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.success) {
            const exams = d.data?.exams ?? [];
            const total = d.pagination?.total ?? exams.length;
            const grading = exams.filter((e: any) => {
              const results = e.results ?? [];
              return results.some((r: any) => r.status === 'SUBMITTED' && !r.graded);
            }).length;
            setTeacherStats((s) => ({ ...s, exams: total, grading }));
          }
        });
      setTeacherStats((s) => ({ ...s, students: 0 }));
    }
  }, [user]);

  const subjectRadar = useMemo(() => {
    const weights = behavior?.behaviorSummary?.subjectWeights ?? {};
    const names: Record<number, string> = {
      // 小学
      101: '小学语文', 102: '小学数学', 103: '小学英语', 104: '小学科学', 105: '道法',
      // 初中
      1: '语文', 2: '数学', 3: '英语', 4: '物理', 5: '化学', 6: '生物', 7: '历史', 8: '地理', 9: '政治',
      // 高中
      201: '高中语文', 202: '高中数学', 203: '高中英语', 204: '高中物理', 205: '高中化学',
      206: '高中生物', 207: '高中历史', 208: '高中地理', 209: '高中政治',
    };
    const arr = Object.entries(weights).map(([id, v]) => ({
      name: names[Number(id)] ?? `学科${id}`,
      value: typeof v === 'number' ? v : Number(v) || 0,
    }));
    if (arr.length >= 3) return arr;
    const filler = [
      { name: '数学', value: 0.8 }, { name: '语文', value: 0.7 }, { name: '英语', value: 0.6 },
      { name: '物理', value: 0.5 },
    ];
    return arr.length ? [...arr, ...filler].slice(0, 6) : filler;
  }, [behavior]);

  const filteredRecs = useMemo(() => {
    return recommends.filter((r) => r.itemType === recTab);
  }, [recommends, recTab]);

  async function handleLogout() {
    await fetch('/api/v1/logout', { method: 'POST', credentials: 'include' });
    message.success('已登出');
    router.push('/');
    router.refresh();
  }

  async function handleRefreshRecommend() {
    if (!user || user.role !== 'ADMIN') return;
    const resp = await fetch('/api/v1/recommend/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene: 'dashboard', limitPerStudent: 50, maxStudents: 50 }),
    });
    if (resp.ok) {
      const d = await resp.json();
      message.success(`已刷新推荐，处理学生 ${d.data.processed} 人`);
    } else {
      message.error('刷新失败');
    }
  }

  // P1-2：每日打卡
  async function handleCheckIn() {
    setCheckInSubmitting(true);
    try {
      const res = await fetch('/api/v1/check-in', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        message.success(data.data.message);
        // 刷新打卡状态
        const statusRes = await fetch('/api/v1/check-in/status', { credentials: 'include' });
        const statusData = await statusRes.json();
        if (statusData.success) setCheckInStatus(statusData.data);
      } else {
        message.warning(data.error?.message ?? '打卡失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setCheckInSubmitting(false);
    }
  }

  // P2-1：创建学习目标
  async function handleCreateGoal() {
    try {
      const res = await fetch('/api/v1/goals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalType: newGoalType, targetValue: newGoalTarget }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('目标已创建');
        // 刷新目标列表
        const refreshRes = await fetch('/api/v1/goals/refresh', { method: 'POST', credentials: 'include' });
        const refreshData = await refreshRes.json();
        if (refreshData.success) setGoals(refreshData.data.goals);
        const goalsRes = await fetch('/api/v1/goals', { credentials: 'include' });
        const goalsData = await goalsRes.json();
        if (goalsData.success) setGoals(goalsData.data.goals);
      } else {
        message.warning(data.error?.message ?? '创建失败');
      }
    } catch {
      message.error('网络错误');
    }
  }

  // P2-2：刷新徽章
  async function handleRefreshBadges() {
    const checkRes = await fetch('/api/v1/badges/check', { method: 'POST', credentials: 'include' });
    const checkData = await checkRes.json();
    if (checkData.success && checkData.data.count > 0) {
      message.success(checkData.data.message);
    }
    const res = await fetch('/api/v1/badges', { credentials: 'include' });
    const data = await res.json();
    if (data.success) setBadges(data.data.badges);
  }

  // P3-1：切换排行榜类型
  async function handleSwitchLeaderboard(type: string) {
    setLeaderboardType(type);
    const res = await fetch(`/api/v1/leaderboard?type=${type}&limit=20`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      setLeaderboard(data.data.leaderboard);
      setMyRank(data.data.myRank);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return null;

  const isStudent = user.role === 'STUDENT';
  const isTeacherView = user.role === 'TEACHER' || user.role === 'ADMIN';

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">
          个人中心 · {isStudent ? '学生工作台' : isTeacherView ? '教师工作台' : '家长工作台'}
        </h1>
        <div className="flex gap-2">
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
          {user.role === 'ADMIN' && (
            <Link href="/admin/crawl"><Button>课程采集</Button></Link>
          )}
          {user.role === 'ADMIN' && (
            <Button type="primary" ghost onClick={handleRefreshRecommend}>刷新推荐缓存</Button>
          )}
          <Button onClick={handleLogout}>登出</Button>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-lg font-semibold">{user.nickname ?? '未设置昵称'}</span>
            <Tag color="green" className="ml-3">{user.role}</Tag>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">手机号：</span>{user.phone}</div>
          <div><span className="text-gray-500">年级：</span>{user.grade ? `${user.grade} 年级` : '-'}</div>
          <div>
            <span className="text-gray-500">实名认证：</span>
            <Tag color={user.realNameStatus === 'VERIFIED' ? 'green' : 'default'}>
              {user.realNameStatus === 'VERIFIED' ? '已认证' : '未认证'}
            </Tag>
          </div>
          <div>
            <span className="text-gray-500">QA采集：</span>
            {user.qaCollectionEnabled ? '已开启' : '已关闭'}
          </div>
        </div>
      </Card>

      {isStudent && (
        <>
          {/* P1-2：学习打卡卡片 */}
          <Card className="mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    background: checkInStatus?.checkedInToday
                      ? 'linear-gradient(135deg, #10B981, #059669)'
                      : 'linear-gradient(135deg, #F59E0B, #EF4444)',
                  }}
                >
                  <FireOutlined style={{ color: '#fff' }} />
                </div>
                <div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    连续学习 {checkInStatus?.streakDays ?? 0} 天
                    {checkInStatus?.streakDays && checkInStatus.streakDays >= 7 && (
                      <Tag color="red" className="text-xs">连续{checkInStatus.streakDays}天</Tag>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {checkInStatus?.checkedInToday
                      ? `今日已打卡 +${checkInStatus.todayPoints} 积分`
                      : '今日尚未打卡，点击打卡获得积分'}
                  </div>
                </div>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-6">
                <Statistic
                  title="累计积分"
                  value={checkInStatus?.totalPoints ?? 0}
                  prefix={<TrophyOutlined style={{ color: '#F59E0B' }} />}
                  valueStyle={{ color: '#F59E0B' }}
                />
                <Statistic
                  title="近30天打卡"
                  value={checkInStatus?.totalCheckIns30d ?? 0}
                  suffix="/30"
                  valueStyle={{ color: '#3B82F6' }}
                />
                <Button
                  type="primary"
                  size="large"
                  loading={checkInSubmitting}
                  disabled={checkInStatus?.checkedInToday}
                  onClick={handleCheckIn}
                  className="!bg-emerald-500"
                >
                  {checkInStatus?.checkedInToday ? '今日已打卡' : '立即打卡'}
                </Button>
              </div>
            </div>
            {/* 30 天打卡日历 */}
            {checkInStatus && checkInStatus.calendar.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <div className="text-xs text-gray-400 mb-2">最近 30 天打卡记录：</div>
                <div className="flex flex-wrap gap-1">
                  {checkInStatus.calendar.map((c) => (
                    <Tag key={c.date} color="green" className="text-xs">
                      {c.date.slice(5)} · {c.streak}天
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* P2-3：学情周报 */}
          {weeklyReport && (
            <Card className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">本周学情报告</h3>
                <span className="text-xs text-gray-400">
                  {weeklyReport.period.start} ~ {weeklyReport.period.end}
                </span>
              </div>
              <Row gutter={16}>
                <Col xs={12} md={3}>
                  <Statistic
                    title="答题量"
                    value={weeklyReport.summary.questionsAnswered}
                    suffix={<span className="text-xs">{weeklyReport.trends.answerTrendLabel}</span>}
                    valueStyle={{
                      color: weeklyReport.trends.answerChange >= 0 ? '#10B981' : '#EF4444',
                      fontSize: 20,
                    }}
                  />
                </Col>
                <Col xs={12} md={3}>
                  <Statistic
                    title="正确率"
                    value={weeklyReport.summary.correctRate}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: '#3B82F6', fontSize: 20 }}
                  />
                </Col>
                <Col xs={12} md={3}>
                  <Statistic
                    title="新增错题"
                    value={weeklyReport.summary.wrongAdded}
                    suffix={<span className="text-xs">{weeklyReport.trends.wrongTrendLabel}</span>}
                    valueStyle={{
                      color: weeklyReport.trends.wrongChange <= 0 ? '#10B981' : '#EF4444',
                      fontSize: 20,
                    }}
                  />
                </Col>
                <Col xs={12} md={3}>
                  <Statistic
                    title="掌握错题"
                    value={weeklyReport.summary.wrongMastered}
                    valueStyle={{ color: '#8B5CF6', fontSize: 20 }}
                  />
                </Col>
              </Row>
              {/* 按天活动 */}
              <div className="mt-4 pt-3 border-t">
                <div className="text-xs text-gray-400 mb-2">本周每日答题量：</div>
                <div className="flex items-end justify-between gap-1" style={{ height: 80 }}>
                  {weeklyReport.dailyActivity.map((d) => {
                    const max = Math.max(...weeklyReport.dailyActivity.map((x) => x.count), 1);
                    const h = (d.count / max) * 60;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: Math.max(2, h),
                            background: d.count > 0 ? '#10B981' : '#E5E7EB',
                          }}
                        />
                        <span className="text-xs text-gray-400">{d.weekday}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* P2-1：学习目标 */}
          <Card
            title={<span className="flex items-center gap-2"><AimOutlined /> 本周学习目标</span>}
            className="mb-6"
          >
            {goals.length > 0 ? (
              <div className="space-y-4">
                {goals.map((g) => (
                  <div key={g.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>
                        {g.goalType === 'STUDY_MINUTES' && `学习时长 ${Math.round(g.currentValue)}/${g.targetValue} 分钟`}
                        {g.goalType === 'QUESTION_COUNT' && `答题量 ${Math.round(g.currentValue)}/${g.targetValue} 题`}
                        {g.goalType === 'ACCURACY' && `正确率 ${Math.round(g.currentValue * 100)}%/${g.targetValue * 100}%`}
                        {g.goalType === 'EXAM_PASS' && `考试及格 ${Math.round(g.currentValue)}/${g.targetValue} 次`}
                      </span>
                      <Tag color={g.achieved ? 'green' : g.progress >= 50 ? 'blue' : 'default'}>
                        {g.achieved ? '已达成' : `${g.progress}%`}
                      </Tag>
                    </div>
                    <Progress
                      percent={g.progress}
                      status={g.achieved ? 'success' : 'active'}
                      strokeColor={g.achieved ? '#52c41a' : '#10B981'}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="尚未设定学习目标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
            {/* 快速创建目标 */}
            <div className="mt-4 pt-3 border-t flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">新建目标：</span>
              <Select
                size="small"
                value={newGoalType}
                onChange={setNewGoalType}
                style={{ width: 130 }}
                options={[
                  { value: 'STUDY_MINUTES', label: '学习时长(分)' },
                  { value: 'QUESTION_COUNT', label: '答题量(题)' },
                  { value: 'ACCURACY', label: '正确率(%)' },
                ]}
              />
              <InputNumber
                size="small"
                min={1}
                max={newGoalType === 'ACCURACY' ? 1 : 10000}
                step={newGoalType === 'ACCURACY' ? 0.05 : 10}
                value={newGoalTarget}
                onChange={(v) => v && setNewGoalTarget(v)}
                style={{ width: 80 }}
              />
              <Button size="small" type="primary" className="!bg-emerald-500" onClick={handleCreateGoal}>
                创建
              </Button>
            </div>
          </Card>

          <Row gutter={16} className="mb-6">
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="近 30 天学习时长（分钟）"
                  value={behavior?.derived30dMinutes ?? behavior?.behaviorSummary?.minutesLast30d ?? 0}
                  valueStyle={{ color: '#10B981' }}
                  prefix="⏱"
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="近 30 天答题量"
                  value={behavior?.behaviorSummary?.questionsLast30d ?? 0}
                  valueStyle={{ color: '#3B82F6' }}
                  prefix="✎"
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="近 30 天正确率"
                  value={Math.round((behavior?.derivedCorrectRate ?? behavior?.behaviorSummary?.correctLast30d ?? 0) * 10000) / 100}
                  precision={2}
                  suffix="%"
                  valueStyle={{ color: '#F59E0B' }}
                  prefix="✓"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} className="mb-6">
            <Col xs={24} lg={12}>
              <Card title="学科兴趣分布">
                <div className="flex justify-center"><RadarChartSVG subjects={subjectRadar} size={320} /></div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="学习进度概览">
                <div className="space-y-4 py-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>近 7 天学习时长</span>
                      <span>{behavior?.behaviorSummary?.minutesLast7d ?? 0} / 300 分钟</span>
                    </div>
                    <Progress percent={Math.min(100, Math.round(((behavior?.behaviorSummary?.minutesLast7d ?? 0) / 300) * 100))} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>近 30 天学习时长</span>
                      <span>{behavior?.derived30dMinutes ?? behavior?.behaviorSummary?.minutesLast30d ?? 0} / 1200 分钟</span>
                    </div>
                    <Progress percent={Math.min(100, Math.round((((behavior?.derived30dMinutes ?? behavior?.behaviorSummary?.minutesLast30d ?? 0) / 1200) * 100)))} status="active" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>正确率目标</span>
                      <span>{Math.round((behavior?.derivedCorrectRate ?? 0) * 10000) / 100} / 80%</span>
                    </div>
                    <Progress percent={Math.min(100, Math.round(((behavior?.derivedCorrectRate ?? behavior?.behaviorSummary?.correctLast30d ?? 0) / 0.8) * 100))} strokeColor="#52c41a" />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card
            title="个性化推荐"
            className="mb-6"
            extra={<Tag color="blue">Dashboard 场景</Tag>}
          >
            {recLoading ? (
              <div className="py-10 flex justify-center"><Spin /></div>
            ) : (
              <Tabs
                activeKey={recTab}
                onChange={(k) => setRecTab(k as any)}
                items={[
                  {
                    key: 'course',
                    label: `课程 (${recommends.filter(r => r.itemType === 'course').length})`,
                    children: (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredRecs.length === 0 && <Empty className="col-span-full" description="暂无课程推荐" />}
                        {filteredRecs.map((it) => {
                          const r = it.resource;
                          return (
                            <Link key={it.id} href={`/courses/${r.id ?? it.itemId}`} className="block">
                              <Card hoverable size="small" className="h-full">
                                {r.coverUrl && (
                                  <div className="h-32 bg-gray-100 mb-3 rounded flex items-center justify-center text-gray-400 text-sm overflow-hidden">
                                    <img src={r.coverUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="font-semibold text-sm mb-1 line-clamp-2">{r.title ?? '热门课程'}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                  {r.subject?.name && <Tag color="green">{r.subject.name}</Tag>}
                                  {r.grade != null && <span>{r.grade}年级</span>}
                                </div>
                                {r.intro && <div className="text-xs text-gray-600 mt-2 line-clamp-2">{r.intro}</div>}
                                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                                  <span>来源：{it.source}</span>
                                  <span>#{it.rank}</span>
                                </div>
                              </Card>
                            </Link>
                          );
                        })}
                      </div>
                    ),
                  },
                  {
                    key: 'question',
                    label: `薄弱题目 (${recommends.filter(r => r.itemType === 'question').length})`,
                    children: (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredRecs.length === 0 && <Empty className="col-span-full" description="暂无薄弱点题目推荐" />}
                        {filteredRecs.map((it) => {
                          const r = it.resource;
                          return (
                            <Link key={it.id} href={`/questions/${r.id ?? it.itemId}`} className="block">
                              <Card hoverable size="small" className="h-full">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 text-sm line-clamp-3">{r.content ?? '练习题目'}</div>
                                  <Tag color="orange">难度 {r.difficulty ?? '-'}/5</Tag>
                                </div>
                                <div className="mt-2 text-xs text-gray-500 flex gap-2">
                                  {r.subject?.name && <Tag color="geekblue">{r.subject.name}</Tag>}
                                  {r.questionType && <Tag>{r.questionType}</Tag>}
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                                  <span>来源：{it.source}</span>
                                  <span>#{it.rank}</span>
                                </div>
                              </Card>
                            </Link>
                          );
                        })}
                      </div>
                    ),
                  },
                  {
                    key: 'article',
                    label: `课外拓展 (${recommends.filter(r => r.itemType === 'article').length})`,
                    children: (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredRecs.length === 0 && <Empty className="col-span-full" description="暂无课外拓展推荐" />}
                        {filteredRecs.map((it) => {
                          const r = it.resource;
                          return (
                            <Link key={it.id} href={`/articles/${r.slug ?? it.itemId}`} className="block">
                              <Card hoverable size="small" className="h-full">
                                {r.coverUrl && (
                                  <div className="h-28 bg-gray-100 mb-3 rounded overflow-hidden">
                                    <img src={r.coverUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="font-semibold text-sm mb-1 line-clamp-2">{r.title ?? '拓展阅读'}</div>
                                {r.summary && <div className="text-xs text-gray-600 line-clamp-2">{r.summary}</div>}
                                <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-1">
                                  {r.category && <Tag color="purple">{r.category}</Tag>}
                                  {(r.tags ?? []).slice(0, 3).map((t: string) => <Tag key={t}>{t}</Tag>)}
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                                  <span>来源：{it.source}</span>
                                  <span>#{it.rank}</span>
                                </div>
                              </Card>
                            </Link>
                          );
                        })}
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>

          {/* P1-3：错因分析看板 */}
          <Card
            title="错因分析看板"
            className="mb-6"
            extra={<Tag color="orange">近 90 天 · 未掌握</Tag>}
          >
            {errorCauses && errorCauses.totalWrong > 0 ? (
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <div className="text-sm font-medium mb-3">错题标签分布</div>
                  {errorCauses.tagDistribution.length > 0 ? (
                    <div className="space-y-2">
                      {errorCauses.tagDistribution.map((t) => (
                        <div key={t.tag}>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{t.tag}</span>
                            <span className="text-gray-500">{t.count} 题 · {t.percentage}%</span>
                          </div>
                          <Progress
                            percent={t.percentage}
                            size="small"
                            strokeColor={t.tag === '未标记' ? '#9CA3AF' : '#F59E0B'}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无错因标签，请在错题本标记错因" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Col>
                <Col xs={24} lg={12}>
                  <div className="text-sm font-medium mb-3">学科错题分布</div>
                  {errorCauses.subjectDistribution.length > 0 ? (
                    <div className="space-y-2">
                      {errorCauses.subjectDistribution.map((s) => (
                        <div key={s.subject}>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{s.subject}</span>
                            <span className="text-gray-500">{s.count} 题 · {s.percentage}%</span>
                          </div>
                          <Progress
                            percent={s.percentage}
                            size="small"
                            strokeColor="#3B82F6"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无学科错题数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Col>
              </Row>
            ) : (
              <Empty description={errorCauses ? '近 90 天暂无未掌握错题，继续保持！' : '加载中...'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
            {errorCauses && errorCauses.totalWrong > 0 && (
              <div className="mt-4 pt-3 border-t text-center">
                <Link href="/wrong">
                  <Button type="link" className="text-emerald-600">去错题本复习 →</Button>
                </Link>
                <Link href="/analytics/mastery">
                  <Button type="link" className="text-emerald-600">查看知识图谱诊断 →</Button>
                </Link>
              </div>
            )}
          </Card>

          {/* P2-2：成就徽章墙 */}
          <Card
            title={<span className="flex items-center gap-2"><CrownOutlined /> 成就徽章</span>}
            className="mb-6"
            extra={
              <Button size="small" onClick={handleRefreshBadges}>刷新</Button>
            }
          >
            {badges.length > 0 ? (
              <Row gutter={[12, 12]}>
                {badges.map((b) => {
                  const tierColor = b.tier === 'GOLD' ? '#F59E0B' : b.tier === 'SILVER' ? '#9CA3AF' : '#D97706';
                  return (
                    <Col xs={12} sm={8} md={6} key={b.id}>
                      <div
                        className="text-center p-4 rounded-lg border transition-all"
                        style={{
                          opacity: b.earned ? 1 : 0.4,
                          borderColor: b.earned ? tierColor : '#E5E7EB',
                          background: b.earned ? `${tierColor}11` : '#F9FAFB',
                        }}
                      >
                        <div className="text-3xl mb-2">{b.icon}</div>
                        <div className="text-sm font-medium">{b.name}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{b.description}</div>
                        <Tag
                          color={b.tier === 'GOLD' ? 'gold' : b.tier === 'SILVER' ? 'default' : 'orange'}
                          className="mt-2 text-xs"
                        >
                          {b.tier === 'GOLD' ? '金' : b.tier === 'SILVER' ? '银' : '铜'}
                        </Tag>
                        {b.earned && (
                          <div className="text-xs text-emerald-600 mt-1">已获得</div>
                        )}
                      </div>
                    </Col>
                  );
                })}
              </Row>
            ) : (
              <Empty description="徽章加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* P3-1：学习排行榜 */}
          <Card
            title="学习排行榜"
            className="mb-6"
            extra={
              <Select
                size="small"
                value={leaderboardType}
                onChange={handleSwitchLeaderboard}
                style={{ width: 120 }}
                options={[
                  { value: 'points', label: '按积分' },
                  { value: 'streak', label: '按连续天数' },
                  { value: 'accuracy', label: '按正确率' },
                ]}
              />
            }
          >
            {leaderboard.length > 0 ? (
              <div>
                {leaderboard.slice(0, 10).map((e, i) => (
                  <div
                    key={e.studentId}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg"
                    style={{
                      background: e.isMe ? '#10B98115' : i < 3 ? '#F9FAFB' : 'transparent',
                      border: e.isMe ? '1px solid #10B98140' : 'none',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#D97706' : '#E5E7EB',
                        color: i < 3 ? '#fff' : '#6b7280',
                      }}
                    >
                      {e.rank}
                    </div>
                    <span className="font-medium text-sm flex-1 truncate">
                      {e.nickname}
                      {e.isMe && <Tag color="green" className="ml-2 text-xs">我</Tag>}
                    </span>
                    <span className="text-sm text-gray-500">
                      {leaderboardType === 'points' && `${e.points} 分`}
                      {leaderboardType === 'streak' && `${e.streakDays} 天`}
                      {leaderboardType === 'accuracy' && `${Math.round(e.correctRate * 100)}%`}
                    </span>
                  </div>
                ))}
                {myRank && myRank > 10 && (
                  <div className="text-center text-sm text-gray-400 pt-2 border-t mt-2">
                    我的排名：第 {myRank} 名
                  </div>
                )}
              </div>
            ) : (
              <Empty description="排行榜加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </>
      )}

      {/* PARENT 角色：家长端入口 */}
      {user.role === 'PARENT' && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TeamOutlined /> 家长端
              </h2>
              <p className="text-gray-500 text-sm mt-1">查看子女学情报告、考试成绩、错题与薄弱点</p>
            </div>
            <Link href="/parent">
              <Button type="primary" size="large" className="!bg-emerald-500">
                进入家长端 →
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {isTeacherView && (
        <>
          <Row gutter={16} className="mb-6">
            <Col xs={12} md={6}>
              <Card><Statistic title="创建课程数" value={teacherStats.courses} valueStyle={{ color: '#10B981' }} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card><Statistic title="创建考试数" value={teacherStats.exams} valueStyle={{ color: '#3B82F6' }} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card><Statistic title="批改中试卷" value={teacherStats.grading} valueStyle={{ color: '#F59E0B' }} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="整体及格率"
                  value={Math.round((overview?.summary.passRate ?? 0) * 10000) / 100}
                  suffix="%"
                  valueStyle={{ color: '#8B5CF6' }}
                />
              </Card>
            </Col>
          </Row>

          {teacherLoading ? (
            <div className="py-16 flex justify-center"><Spin size="large" /></div>
          ) : (
            <>
              <Row gutter={16} className="mb-6">
                <Col xs={24} lg={14}>
                  <Card title="学科平均得分对比" extra={<Tag color="green">样本量柱状</Tag>}>
                    <BarChartSVG
                      data={overview?.bySubject ?? []}
                      getLabel={(d) => d.name}
                      getValue={(d) => d.avgScore}
                      unit="分"
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={10}>
                  <Card title="违规类型分布">
                    <PieChartSVG
                      data={overview?.byViolation ?? []}
                      getLabel={(d) => d.type}
                      getValue={(d) => d.count}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={16} className="mb-6">
                <Col xs={24} lg={12}>
                  <Card title="考试状态分布">
                    <PieChartSVG
                      data={overview?.byStatus ?? []}
                      getLabel={(d) => d.status}
                      getValue={(d) => d.count}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card
                    title="概览摘要"
                    extra={<Link href="/analytics" className="text-emerald-600 text-sm">查看完整看板 →</Link>}
                  >
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500">考试总数</span>
                        <span className="font-semibold">{overview?.summary.examCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500">答卷总数</span>
                        <span className="font-semibold">{overview?.summary.resultCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500">已批改</span>
                        <span className="font-semibold">{overview?.summary.scoredResultCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500">整体平均分</span>
                        <span className="font-semibold text-emerald-600">{overview?.summary.avgScore ?? 0} 分</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">整体及格率</span>
                        <span className="font-semibold text-emerald-600">
                          {Math.round((overview?.summary.passRate ?? 0) * 10000) / 100}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-5">
                      <Link href="/analytics/exams/list" className="block">
                        <Button type="primary" block>进入单场考试分析 →</Button>
                      </Link>
                    </div>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </>
      )}

      <div className="text-center">
        <Link href="/" className="text-emerald-600">返回首页</Link>
      </div>
    </main>
  );
}
