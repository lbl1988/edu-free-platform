'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card, Table, Button, Tag, Modal, Form, Input, Select, InputNumber,
  Switch, message, App, Tabs, Spin, Empty, Statistic, Row, Col, Descriptions, Space,
  Alert, Typography, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface ContentSource {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  status: string;
  subjectId: number | null;
  subject?: { id: number; name: string } | null;
  gradeLevel: string | null;
  grade: number | null;
  parseConfig: any;
  crawlIntervalHours: number;
  lastCrawledAt: string | null;
  totalCrawled: number;
  respectRobots: boolean;
  rateLimitMs: number;
  createdAt: string;
}

interface CrawlJobRow {
  id: string;
  sourceId: string;
  source?: { name: string; url: string };
  status: string;
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  itemsFound: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsSkipped: number;
  error: string | null;
  log: string | null;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  RSS: 'RSS 订阅',
  JSON_API: 'JSON API',
  HTML_SCRAPING: 'HTML 解析',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  PAUSED: 'orange',
  ERROR: 'red',
  SUCCESS: 'green',
  FAILED: 'red',
  PARTIAL: 'orange',
  RUNNING: 'blue',
  PENDING: 'default',
};

export default function CrawlAdminPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [jobs, setJobs] = useState<CrawlJobRow[]>([]);
  const [activeTab, setActiveTab] = useState('sources');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<CrawlJobRow | null>(null);
  const [form] = Form.useForm();

  // 定时采集配置
  const [scheduleConfig, setScheduleConfig] = useState({
    enabled: false,
    intervalHours: 6,
    apiKeyConfigured: false,
    cronUrl: null as string | null,
  });
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState(6);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/crawl/sources?limit=100', { credentials: 'include' });
      const d = await res.json();
      if (d.success) setSources(d.data);
    } catch {
      message.error('加载采集源失败');
    }
  }, [message]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/crawl/jobs?limit=50', { credentials: 'include' });
      const d = await res.json();
      if (d.success) setJobs(d.data);
    } catch {
      message.error('加载任务历史失败');
    }
  }, [message]);

  useEffect(() => {
    Promise.all([
      fetchSources(),
      fetchJobs(),
      // 获取定时采集配置
      fetch('/api/v1/admin/crawl/config', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data) {
            setScheduleConfig(d.data);
            setScheduleEnabled(d.data.enabled);
            setScheduleInterval(d.data.intervalHours);
          }
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [fetchSources, fetchJobs]);

  async function handleRun(sourceId?: string) {
    setRunning(sourceId || 'all');
    try {
      const res = await fetch('/api/v1/admin/crawl/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(sourceId ? { sourceId } : { all: true }),
      });
      const d = await res.json();
      if (d.success) {
        message.success(`采集完成: 新增 ${d.data?.itemsAdded ?? 0} 条`);
        fetchSources();
        fetchJobs();
      } else {
        message.error(d.error?.message || '采集失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setRunning(null);
    }
  }

  function openCreate() {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      sourceType: 'RSS',
      crawlIntervalHours: 24,
      respectRobots: true,
      rateLimitMs: 1000,
      gradeLevel: 'ALL',
    });
    setModalOpen(true);
  }

  function openEdit(source: ContentSource) {
    setEditingId(source.id);
    form.setFieldsValue({
      ...source,
      parseConfig: source.parseConfig ? JSON.stringify(source.parseConfig, null, 2) : '',
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    try {
      const values = await form.validateFields();
      // 解析 parseConfig
      let parseConfig = undefined;
      if (values.parseConfig) {
        try {
          parseConfig = JSON.parse(values.parseConfig);
        } catch {
          message.error('解析配置必须是合法 JSON');
          return;
        }
      }

      const payload = {
        ...values,
        subjectId: values.subjectId ? Number(values.subjectId) : undefined,
        grade: values.grade ? Number(values.grade) : undefined,
        crawlIntervalHours: Number(values.crawlIntervalHours),
        rateLimitMs: Number(values.rateLimitMs),
        parseConfig,
      };

      const url = editingId
        ? `/api/v1/admin/crawl/sources/${editingId}`
        : '/api/v1/admin/crawl/sources';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.success) {
        message.success(editingId ? '更新成功' : '创建成功');
        setModalOpen(false);
        fetchSources();
      } else {
        message.error(d.error?.message || '操作失败');
      }
    } catch {
      // form validation error
    }
  }

  async function handleSaveSchedule() {
    setScheduleSaving(true);
    try {
      const res = await fetch('/api/v1/admin/crawl/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: scheduleEnabled, intervalHours: scheduleInterval }),
      });
      const d = await res.json();
      if (d.success) {
        message.success('定时采集配置已保存。请按提示在 Render 环境变量中设置相关变量。');
        // 显示配置详情
        Modal.info({
          title: '定时采集配置说明',
          width: 600,
          content: (
            <div className="space-y-3">
              <Alert
                type={scheduleEnabled ? 'success' : 'warning'}
                message={scheduleEnabled ? '定时采集已启用' : '定时采集已关闭'}
                description={scheduleEnabled ? '系统将按设定间隔自动采集到期采集源' : '需要手动触发采集'}
              />
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="采集间隔">{scheduleInterval} 小时</Descriptions.Item>
                <Descriptions.Item label="INTERNAL_API_KEY">
                  {scheduleConfig.apiKeyConfigured ? (
                    <Tag color="green">已配置</Tag>
                  ) : (
                    <Tag color="red">未配置（定时采集无法工作）</Tag>
                  )}
                </Descriptions.Item>
                {scheduleConfig.cronUrl && (
                  <Descriptions.Item label="定时采集端点">
                    <Typography.Text copyable className="text-xs">
                      {scheduleConfig.cronUrl}
                    </Typography.Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
              <Alert
                type="info"
                message="启用步骤"
                description={
                  <ol className="list-decimal ml-5 text-sm space-y-1">
                    <li>在 Vercel 环境变量中设置 <code>CRON_SECRET</code> 为随机字符串（Vercel Cron 自动鉴权）</li>
                    <li>或设置 <code>INTERNAL_API_KEY</code> + <code>CRAWL_SCHEDULED_ENABLED=true</code>（外部 cron 用）</li>
                    <li>设置 <code>CRAWL_SCHEDULED_INTERVAL_HOURS={scheduleInterval}</code></li>
                    <li>Vercel Cron 已在 vercel.json 中配置，每天 2:00 UTC 自动执行</li>
                    <li>如需更频繁采集，在 cron-job.org 注册定时任务调用上述端点</li>
                  </ol>
                }
              />
            </div>
          ),
        });
      } else {
        message.error(d.error?.message || '保存失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Modal.confirm({
      title: '确认删除此采集源？',
      content: '删除后不可恢复，已采集的课程不会被删除。',
      onOk: async () => {
        const res = await fetch(`/api/v1/admin/crawl/sources/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const d = await res.json();
        if (d.success) {
          message.success('已删除');
          fetchSources();
        } else {
          message.error('删除失败');
        }
      },
    });
  }

  const sourceColumns: ColumnsType<ContentSource> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, r) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-400 truncate max-w-[180px]">{r.url}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 100,
      render: (v) => <Tag>{SOURCE_TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: '学科',
      key: 'subject',
      width: 100,
      render: (_, r) => r.subject?.name || '-',
    },
    {
      title: '年级',
      dataIndex: 'grade',
      key: 'grade',
      width: 80,
      render: (v, r) => v ? `${v}年级` : (r.gradeLevel || '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '已采集',
      dataIndex: 'totalCrawled',
      key: 'totalCrawled',
      width: 80,
      render: (v) => <span className="text-emerald-600 font-medium">{v}</span>,
    },
    {
      title: '上次采集',
      dataIndex: 'lastCrawledAt',
      key: 'lastCrawledAt',
      width: 160,
      render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '从未',
    },
    {
      title: '间隔(h)',
      dataIndex: 'crawlIntervalHours',
      key: 'crawlIntervalHours',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            type="primary"
            loading={running === r.id}
            onClick={() => handleRun(r.id)}
          >
            采集
          </Button>
          <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" danger onClick={() => handleDelete(r.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const jobColumns: ColumnsType<CrawlJobRow> = [
    {
      title: '采集源',
      key: 'source',
      width: 180,
      render: (_, r) => r.source?.name || r.sourceId,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '触发',
      dataIndex: 'trigger',
      key: 'trigger',
      width: 80,
      render: (v) => v === 'SCHEDULED' ? <Tag color="blue">定时</Tag> : <Tag>手动</Tag>,
    },
    { title: '发现', dataIndex: 'itemsFound', key: 'itemsFound', width: 60 },
    { title: '新增', dataIndex: 'itemsAdded', key: 'itemsAdded', width: 60, render: (v) => v ? <span className="text-emerald-600">{v}</span> : 0 },
    { title: '更新', dataIndex: 'itemsUpdated', key: 'itemsUpdated', width: 60 },
    { title: '跳过', dataIndex: 'itemsSkipped', key: 'itemsSkipped', width: 60 },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 160,
      render: (v) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, r) => (
        <Button size="small" onClick={() => setJobDetail(r)}>详情</Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const totalSources = sources.length;
  const activeSources = sources.filter((s) => s.status === 'ACTIVE').length;
  const totalCrawled = sources.reduce((sum, s) => sum + s.totalCrawled, 0);
  const last24hJobs = jobs.filter((j) => {
    const diff = Date.now() - new Date(j.startedAt).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }).length;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">课程采集管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            配置采集源、手动/定时抓取全网课程内容，自动去重入库
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard"><Button>返回个人中心</Button></Link>
          <Button type="primary" onClick={openCreate}>新增采集源</Button>
          <Button
            type="primary"
            ghost
            loading={running === 'all'}
            onClick={() => handleRun()}
          >
            全部采集
          </Button>
        </div>
      </div>

      <Row gutter={16} className="mb-6">
        <Col xs={12} md={6}>
          <Card><Statistic title="采集源总数" value={totalSources} suffix={`/ ${activeSources} 活跃`} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="已采集课程" value={totalCrawled} valueStyle={{ color: '#10B981' }} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="近24h任务" value={last24hJobs} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="定时采集"
              value={scheduleConfig.enabled ? '已启用' : '未启用'}
              valueStyle={{ color: scheduleConfig.enabled ? '#10B981' : '#9CA3AF' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 定时采集配置面板 */}
      <Card className="mb-6" title="定时采集配置" size="small">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">启用定时采集</span>
            <Switch
              checked={scheduleEnabled}
              onChange={setScheduleEnabled}
              checkedChildren="开"
              unCheckedChildren="关"
            />
            <Tag color={scheduleEnabled ? 'green' : 'default'}>
              {scheduleEnabled ? '自动运行中' : '手动模式'}
            </Tag>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">采集间隔</span>
            <Select
              value={scheduleInterval}
              onChange={setScheduleInterval}
              style={{ width: 120 }}
              options={[
                { label: '每 1 小时', value: 1 },
                { label: '每 3 小时', value: 3 },
                { label: '每 6 小时', value: 6 },
                { label: '每 12 小时', value: 12 },
                { label: '每 24 小时', value: 24 },
                { label: '每 48 小时', value: 48 },
              ]}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">API Key</span>
            <Tag color={scheduleConfig.apiKeyConfigured ? 'green' : 'red'}>
              {scheduleConfig.apiKeyConfigured ? '已配置' : '未配置'}
            </Tag>
          </div>

          <Button
            type="primary"
            loading={scheduleSaving}
            onClick={handleSaveSchedule}
          >
            保存配置
          </Button>

          {scheduleConfig.cronUrl && (
            <Tooltip title="点击复制定时采集端点 URL">
              <Typography.Text
                copyable
                className="text-xs text-gray-500"
              >
                {scheduleConfig.cronUrl}
              </Typography.Text>
            </Tooltip>
          )}
        </div>

        {!scheduleConfig.apiKeyConfigured && (
          <Alert
            className="mt-4"
            type="warning"
            message="INTERNAL_API_KEY / CRON_SECRET 环境变量未配置"
            description="定时采集需要鉴权。Vercel 部署请在环境变量中设置 CRON_SECRET（Vercel Cron 用）或 INTERNAL_API_KEY（外部 cron 用）。"
            showIcon
          />
        )}
      </Card>

      {/* 快速操作 */}
      <Card className="mb-6" title="快速操作" size="small">
        <Space wrap>
          <Button
            type="primary"
            loading={running === 'all'}
            onClick={() => handleRun()}
            className="!bg-green-600 !border-green-600"
          >
            全部采集
          </Button>
          <Button
            loading={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                const res = await fetch('/api/v1/admin/crawl/seed', {
                  method: 'POST',
                  credentials: 'include',
                });
                const d = await res.json();
                if (d.success) {
                  message.success(d.data.message);
                  fetchSources();
                } else {
                  message.error(d.error?.message || '预置失败');
                }
              } catch {
                message.error('网络错误');
              } finally {
                setSeeding(false);
              }
            }}
          >
            预置 53 个采集源
          </Button>
          <Button onClick={() => router.push('/courses')}>查看课程</Button>
        </Space>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'sources',
              label: `采集源 (${sources.length})`,
              children: (
                <Table
                  columns={sourceColumns}
                  dataSource={sources}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1100 }}
                  locale={{ emptyText: <Empty description="暂无采集源，点击「新增采集源」开始配置" /> }}
                />
              ),
            },
            {
              key: 'jobs',
              label: `任务历史 (${jobs.length})`,
              children: (
                <Table
                  columns={jobColumns}
                  dataSource={jobs}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 900 }}
                  locale={{ emptyText: <Empty description="暂无采集任务记录" /> }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 新增/编辑采集源 Modal */}
      <Modal
        title={editingId ? '编辑采集源' : '新增采集源'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={640}
        okText={editingId ? '保存' : '创建'}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：国家智慧教育平台-小学数学" />
          </Form.Item>
          <Form.Item label="采集 URL" name="url" rules={[{ required: true, message: '请输入 URL' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item label="采集方式" name="sourceType" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="RSS">RSS 订阅源</Select.Option>
              <Select.Option value="JSON_API">JSON API 接口</Select.Option>
              <Select.Option value="HTML_SCRAPING">HTML 页面解析</Select.Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="学科 ID" name="subjectId">
                <InputNumber className="w-full" placeholder="1-9/101-209" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="学段" name="gradeLevel">
                <Select>
                  <Select.Option value="ALL">全部</Select.Option>
                  <Select.Option value="PRIMARY">小学</Select.Option>
                  <Select.Option value="JUNIOR">初中</Select.Option>
                  <Select.Option value="SENIOR">高中</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="具体年级" name="grade">
                <InputNumber min={1} max={12} className="w-full" placeholder="1-12" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="解析配置 (JSON)"
            name="parseConfig"
            extra="RSS 无需配置；JSON_API 需指定 dataPath/各字段名；HTML_SCRAPING 可指定 linkPattern 正则"
          >
            <Input.TextArea rows={4} placeholder='{"dataPath":"data.items","titleField":"title","urlField":"url"}' />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="采集间隔(小时)" name="crawlIntervalHours">
                <InputNumber min={1} max={168} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="请求间隔(ms)" name="rateLimitMs">
                <InputNumber min={100} max={60000} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="遵守 robots.txt" name="respectRobots" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="状态" name="status">
            <Select>
              <Select.Option value="ACTIVE">活跃</Select.Option>
              <Select.Option value="PAUSED">暂停</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务详情 Modal */}
      <Modal
        title="任务详情"
        open={!!jobDetail}
        onCancel={() => setJobDetail(null)}
        footer={null}
        width={700}
      >
        {jobDetail && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="采集源" span={2}>{jobDetail.source?.name}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={STATUS_COLORS[jobDetail.status]}>{jobDetail.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="触发方式">{jobDetail.trigger === 'SCHEDULED' ? '定时' : '手动'}</Descriptions.Item>
            <Descriptions.Item label="发现条目">{jobDetail.itemsFound}</Descriptions.Item>
            <Descriptions.Item label="新增入库">{jobDetail.itemsAdded}</Descriptions.Item>
            <Descriptions.Item label="更新已有">{jobDetail.itemsUpdated}</Descriptions.Item>
            <Descriptions.Item label="跳过">{jobDetail.itemsSkipped}</Descriptions.Item>
            <Descriptions.Item label="开始" span={2}>{new Date(jobDetail.startedAt).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="完成" span={2}>{jobDetail.completedAt ? new Date(jobDetail.completedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
            {jobDetail.error && (
              <Descriptions.Item label="错误" span={2}>
                <span className="text-red-500">{jobDetail.error}</span>
              </Descriptions.Item>
            )}
            {jobDetail.log && (
              <Descriptions.Item label="日志" span={2}>
                <pre className="text-xs bg-gray-50 p-2 rounded max-h-60 overflow-auto whitespace-pre-wrap">{jobDetail.log}</pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </main>
  );
}
