'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Spin,
  Tag,
  Button,
  App,
  Row,
  Col,
  Statistic,
  Empty,
  Progress,
  List,
  Avatar,
  Descriptions,
  Table,
} from 'antd';
import {
  TeamOutlined,
  TrophyOutlined,
  FireOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  BookOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

interface UserInfo {
  id: string;
  role: string;
  nickname: string | null;
}

interface FamilyMember {
  bindingId: string;
  studentId: string;
  nickname: string | null;
  grade: number | null;
  lastActiveAt: string | null;
  correctRate: number;
  totalStudyMinutes: number;
  boundAt: string;
}

interface StudentReport {
  student: {
    id: string;
    nickname: string | null;
    grade: number | null;
    lastLoginAt: string | null;
  };
  learningProfile: {
    totalStudyMinutes: number;
    correctRate: number;
    streakDays: number;
    lastActiveAt: string | null;
    preferences: unknown;
  } | null;
  examStats: {
    total: number;
    avgScore: number;
    passed: number;
    recentExams: Array<{
      id: string;
      title: string;
      subject: string;
      score: number | null;
      totalScore: number;
      status: string;
      submitTime: string;
    }>;
  };
  practiceStats: {
    totalAttempts: number;
    avgCorrectRate: number;
    recentPractices: Array<{
      id: string;
      title: string;
      correctCount: number;
      totalCount: number;
      submittedAt: string;
    }>;
  };
  wrongStats: {
    unresolvedCount: number;
    recentWrong: Array<{
      id: string;
      mastered: boolean;
      wrongCount: number;
      lastWrongAt: string;
      contentPreview: string;
      difficulty: number;
      subject: string;
    }>;
  };
  courses: Array<{
    id: string;
    title: string;
    subject: string;
    coverUrl: string | null;
    enrolledAt: string;
  }>;
  weakPoints: Array<{ chapterId?: string; chapterTitle?: string; mastery?: number }>;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v1/user', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        if (d.success) {
          setUser(d.data);
          if (d.data.role !== 'PARENT') {
            message.warning('仅家长角色可访问此页面');
            router.push('/dashboard');
            return;
          }
          loadFamily();
        }
      })
      .catch(() => router.push('/login?redirect=/parent'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadFamily() {
    try {
      const res = await fetch('/api/v1/user/family', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setMembers(data.data.members ?? []);
      }
    } catch {
      message.error('加载子女列表失败');
    }
  }

  async function loadReport(studentId: string) {
    setReportLoading(true);
    setReport(null);
    try {
      const res = await fetch(`/api/v1/user/family/${studentId}/report`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      } else {
        message.error(data.error?.message ?? '加载学情报告失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setReportLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (selectedStudentId && report) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            setSelectedStudentId(null);
            setReport(null);
          }}
          className="mb-4"
        >
          返回子女列表
        </Button>

        {/* 学生基本信息 */}
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar size={56} className="bg-emerald-500">
                {report.student.nickname?.[0] ?? '?'}
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{report.student.nickname ?? '未设置昵称'}</h2>
                <div className="text-sm text-gray-500 mt-1">
                  {report.student.grade ? `${report.student.grade} 年级` : '年级未设置'}
                  {report.student.lastLoginAt && (
                    <span className="ml-4">
                      最后登录：{new Date(report.student.lastLoginAt).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 学习概况统计 */}
        <Row gutter={16} className="mb-6">
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="连续学习天数"
                value={report.learningProfile?.streakDays ?? 0}
                prefix={<FireOutlined style={{ color: '#EF4444' }} />}
                valueStyle={{ color: '#EF4444' }}
                suffix="天"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="累计学习时长"
                value={report.learningProfile?.totalStudyMinutes ?? 0}
                prefix={<ClockCircleOutlined style={{ color: '#3B82F6' }} />}
                valueStyle={{ color: '#3B82F6' }}
                suffix="分钟"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="整体正确率"
                value={Math.round((report.learningProfile?.correctRate ?? 0) * 10000) / 100}
                precision={2}
                prefix={<CheckCircleOutlined style={{ color: '#10B981' }} />}
                valueStyle={{ color: '#10B981' }}
                suffix="%"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="未掌握错题"
                value={report.wrongStats.unresolvedCount}
                prefix={<WarningOutlined style={{ color: '#F59E0B' }} />}
                valueStyle={{ color: '#F59E0B' }}
                suffix="题"
              />
            </Card>
          </Col>
        </Row>

        {/* 考试成绩 */}
        <Card
          title={<span className="flex items-center gap-2"><TrophyOutlined /> 最近考试成绩</span>}
          className="mb-6"
        >
          {report.examStats.recentExams.length === 0 ? (
            <Empty description="暂无考试记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="space-y-3">
              {report.examStats.recentExams.map((e) => {
                const passLine = e.totalScore * 0.6;
                const passed = e.score != null && e.score >= passLine;
                return (
                  <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{e.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        <Tag color="blue">{e.subject}</Tag>
                        <span className="ml-2">
                          {new Date(e.submitTime).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {e.score != null ? (
                        <>
                          <span className="text-lg font-bold" style={{ color: passed ? '#10B981' : '#EF4444' }}>
                            {e.score}
                          </span>
                          <span className="text-sm text-gray-400"> / {e.totalScore}</span>
                          <Tag color={passed ? 'green' : 'red'} className="ml-2">
                            {passed ? '及格' : '未及格'}
                          </Tag>
                        </>
                      ) : (
                        <Tag>{e.status}</Tag>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t text-sm text-gray-500 flex justify-between">
                <span>平均分：{report.examStats.avgScore}</span>
                <span>及格：{report.examStats.passed} / {report.examStats.total}</span>
              </div>
            </div>
          )}
        </Card>

        {/* 练习与错题 */}
        <Row gutter={16} className="mb-6">
          <Col xs={24} lg={12}>
            <Card title={<span className="flex items-center gap-2"><BookOutlined /> 最近练习</span>} className="h-full">
              {report.practiceStats.recentPractices.length === 0 ? (
                <Empty description="暂无练习记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={report.practiceStats.recentPractices}
                  renderItem={(p) => (
                    <List.Item>
                      <div className="w-full">
                        <div className="flex justify-between text-sm">
                          <span className="truncate flex-1 mr-2">{p.title}</span>
                          <span className="text-gray-500 text-xs">
                            {new Date(p.submittedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <Progress
                          percent={p.totalCount > 0 ? Math.round((p.correctCount / p.totalCount) * 100) : 0}
                          size="small"
                          className="mt-1"
                          format={() => `${p.correctCount}/${p.totalCount}`}
                        />
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={<span className="flex items-center gap-2"><WarningOutlined /> 最近错题</span>} className="h-full">
              {report.wrongStats.recentWrong.length === 0 ? (
                <Empty description="暂无错题记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={report.wrongStats.recentWrong}
                  renderItem={(w) => (
                    <List.Item>
                      <div className="w-full">
                        <div className="flex items-start gap-2">
                          <Tag color={w.mastered ? 'green' : 'orange'} className="shrink-0 mt-0.5">
                            {w.mastered ? '已掌握' : `错${w.wrongCount}次`}
                          </Tag>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-600 line-clamp-2">{w.contentPreview}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              <Tag color="blue" className="text-xs">{w.subject}</Tag>
                              <span>难度 {w.difficulty}/5</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* 课程与薄弱点 */}
        <Row gutter={16}>
          <Col xs={24} lg={14}>
            <Card title="已报名课程" className="mb-6">
              {report.courses.length === 0 ? (
                <Empty description="暂无课程" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={report.courses}
                  renderItem={(c) => (
                    <List.Item>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium text-sm">{c.title}</span>
                        <div>
                          <Tag color="green">{c.subject}</Tag>
                          <span className="text-xs text-gray-400 ml-2">
                            {new Date(c.enrolledAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="薄弱知识点" className="mb-6">
              {report.weakPoints.length === 0 ? (
                <Empty description="暂无薄弱点数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div className="space-y-3">
                  {report.weakPoints.map((w, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{w.chapterTitle ?? `知识点 ${i + 1}`}</span>
                        <span className="text-gray-500">
                          掌握度 {Math.round((w.mastery ?? 0) * 100)}%
                        </span>
                      </div>
                      <Progress
                        percent={Math.round((w.mastery ?? 0) * 100)}
                        size="small"
                        strokeColor={w.mastery && w.mastery < 0.4 ? '#EF4444' : '#F59E0B'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </main>
    );
  }

  // 子女列表视图
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TeamOutlined /> 家长端 · 子女学情
        </h1>
        <Link href="/dashboard">
          <Button>返回工作台</Button>
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-gray-500">已绑定的子女（{members.length} 人）</span>
        </div>

        {members.length === 0 ? (
          <Empty description="尚未绑定任何子女" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <div className="text-sm text-gray-400 mt-2">
              请让孩子在学生端生成绑定码，您凭码完成绑定
            </div>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {members.map((m) => (
              <Col xs={24} sm={12} key={m.bindingId}>
                <Card
                  hoverable
                  onClick={() => {
                    setSelectedStudentId(m.studentId);
                    loadReport(m.studentId);
                  }}
                  className="h-full"
                >
                  <div className="flex items-center gap-4">
                    <Avatar size={48} className="bg-emerald-500">
                      {m.nickname?.[0] ?? '?'}
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{m.nickname ?? '未设置昵称'}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {m.grade ? `${m.grade} 年级` : '年级未设置'}
                      </div>
                    </div>
                  </div>
                  <Row gutter={8} className="mt-4 text-center">
                    <Col span={8}>
                      <Statistic
                        title="正确率"
                        value={Math.round(m.correctRate * 100)}
                        suffix="%"
                        valueStyle={{ fontSize: 16, color: '#10B981' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="学习时长"
                        value={m.totalStudyMinutes}
                        suffix="分"
                        valueStyle={{ fontSize: 16, color: '#3B82F6' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="状态"
                        value={m.lastActiveAt ? '活跃' : '—'}
                        valueStyle={{ fontSize: 16 }}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </main>
  );
}
