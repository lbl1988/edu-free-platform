'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tabs,
  Card,
  Form,
  Input,
  Select,
  Button,
  Tag,
  Spin,
  App,
  InputNumber,
  Avatar,
  Space,
  Typography,
  Divider,
} from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

type RealNameStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
type VolunteerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
type Role = 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN';

interface UserProfile {
  id: string;
  phone: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: Role;
  grade: number | null;
  realNameStatus: RealNameStatus;
  realName: string | null;
}

interface VolunteerCert {
  id: string;
  status: VolunteerStatus;
  certType: string;
  expertise: string[];
  orgName: string | null;
  intro: string | null;
  points: number;
  createdAt: string;
}

interface FamilyMemberParent {
  bindingId: string;
  studentId: string;
  nickname: string | null;
  grade: number | null;
  lastActiveAt: string | null;
  correctRate: number;
  totalStudyMinutes: number;
  boundAt: string;
}

interface FamilyMemberStudent {
  bindingId: string;
  parentId: string;
  nickname: string | null;
  avatarUrl: string | null;
  boundAt: string;
}

function handleResp(r: Response, router: ReturnType<typeof useRouter>, message: any): Promise<any> | null {
  if (r.status === 401) {
    router.push('/login?redirect=/user/settings');
    return null;
  }
  return r.json().catch(() => ({}));
}

function realNameStatusTag(status: RealNameStatus) {
  const map: Record<RealNameStatus, { color: string; text: string }> = {
    UNVERIFIED: { color: 'default', text: '未认证' },
    PENDING: { color: 'orange', text: '审核中' },
    VERIFIED: { color: 'green', text: '已认证' },
    REJECTED: { color: 'red', text: '被拒绝' },
  };
  const s = map[status];
  return <Tag color={s.color}>{s.text}</Tag>;
}

function volunteerStatusTag(status: VolunteerStatus) {
  const map: Record<VolunteerStatus, { color: string; text: string }> = {
    PENDING: { color: 'orange', text: '待审核' },
    APPROVED: { color: 'green', text: '已通过' },
    REJECTED: { color: 'red', text: '已拒绝' },
    REVOKED: { color: 'default', text: '已撤销' },
  };
  const s = map[status];
  return <Tag color={s.color}>{s.text}</Tag>;
}

function roleTag(role: Role) {
  const map: Record<Role, { color: string; text: string }> = {
    STUDENT: { color: 'blue', text: '学生' },
    PARENT: { color: 'purple', text: '家长' },
    TEACHER: { color: 'cyan', text: '教师' },
    ADMIN: { color: 'red', text: '管理员' },
  };
  const s = map[role];
  return <Tag color={s.color}>{s.text}</Tag>;
}

export default function UserSettingsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/user/profile', { credentials: 'include' });
      const d = await handleResp(r, router, message);
      if (d && d.success) {
        setProfile(d.data.user);
      } else if (d && !d.success) {
        message.error(d.error?.message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [router, message]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <Avatar
          size={64}
          src={profile.avatarUrl ?? undefined}
          icon={<UserOutlined />}
        />
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {profile.nickname ?? '未设置昵称'}
          </Title>
          <div className="mt-1">
            {roleTag(profile.role)}
            <Tag color="default">{profile.phone}</Tag>
          </div>
        </div>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: <BasicTab profile={profile} onUpdated={loadProfile} />,
            },
            {
              key: 'realname',
              label: '实名认证',
              children: <RealNameTab profile={profile} onUpdated={loadProfile} />,
            },
            {
              key: 'bind',
              label: '家长绑定',
              children: <BindTab role={profile.role} />,
            },
            {
              key: 'volunteer',
              label: '志愿者认证',
              children: <VolunteerTab />,
            },
          ]}
        />
      </Card>
    </main>
  );
}

function BasicTab({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      nickname: profile.nickname ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      grade: profile.grade ?? undefined,
    });
  }, [profile, form]);

  const onFinish = async (values: any) => {
    const payload: any = {};
    if (values.nickname !== (profile.nickname ?? '')) {
      payload.nickname = values.nickname || null;
    }
    if (values.avatarUrl !== (profile.avatarUrl ?? '')) {
      payload.avatarUrl = values.avatarUrl || null;
    }
    if (values.grade !== profile.grade) {
      if (values.grade !== undefined && values.grade !== null) {
        payload.grade = Number(values.grade);
      }
    }
    if (Object.keys(payload).length === 0) {
      message.info('没有修改');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const d = await handleResp(r, router, message);
      if (!d) return;
      if (d.success) {
        message.success('已保存');
        onUpdated();
      } else {
        message.error(d.error?.message || '保存失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isStudent = profile.role === 'STUDENT';

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      style={{ maxWidth: 480 }}
    >
      <Form.Item
        label="昵称"
        name="nickname"
        rules={[{ max: 32, message: '昵称最多32字符' }]}
      >
        <Input placeholder="请输入昵称" />
      </Form.Item>
      <Form.Item
        label="头像 URL"
        name="avatarUrl"
        rules={[{ type: 'url', message: '请输入合法的 URL' }]}
      >
        <Input placeholder="https://..." />
      </Form.Item>
      {isStudent ? (
        <Form.Item label="年级" name="grade">
          <InputNumber min={1} max={12} style={{ width: '100%' }} placeholder="1-12" />
        </Form.Item>
      ) : (
        <Form.Item label="年级">
          <Input disabled placeholder="仅学生可设置年级" />
        </Form.Item>
      )}
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          保存修改
        </Button>
      </Form.Item>
    </Form>
  );
}

function RealNameTab({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { realName: string; idCardLast4: string }) => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/v1/user/real-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      const d = await handleResp(r, router, message);
      if (!d) return;
      if (d.success) {
        message.success('已提交审核');
        onUpdated();
      } else {
        message.error(d.error?.message || '提交失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verified = profile.realNameStatus === 'VERIFIED';
  const pending = profile.realNameStatus === 'PENDING';

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="mb-4 flex items-center gap-3">
        <Text>当前状态：</Text>
        {realNameStatusTag(profile.realNameStatus)}
        {profile.realName && <Text type="secondary">姓名：{profile.realName}</Text>}
      </div>
      {(verified || pending) ? (
        <Text type="secondary">
          {verified ? '您已完成实名认证，无需重复提交。' : '您的实名认证正在审核中，请耐心等待。'}
        </Text>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            label="真实姓名"
            name="realName"
            rules={[{ required: true, message: '请输入真实姓名' }, { max: 32 }]}
          >
            <Input placeholder="请输入身份证上的姓名" />
          </Form.Item>
          <Form.Item
            label="身份证号末 4 位"
            name="idCardLast4"
            rules={[
              { required: true, message: '请输入身份证号末4位' },
              { pattern: /^\d{4}$/, message: '必须为4位数字' },
            ]}
          >
            <Input placeholder="如 1234" maxLength={4} />
          </Form.Item>
          <Text type="secondary" className="block mb-4">
            仅存储脱敏姓名与身份证末4位哈希，不会保存完整身份证号。
          </Text>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              提交认证
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
}

function BindTab({ role }: { role: Role }) {
  if (role === 'STUDENT') {
    return <StudentBindView />;
  }
  if (role === 'PARENT') {
    return <ParentBindView />;
  }
  return <Text type="secondary">当前角色无需家长绑定功能。</Text>;
}

function StudentBindView() {
  const router = useRouter();
  const { message } = App.useApp();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setCountdown(0);
      return;
    }
    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setCountdown(diff);
      if (diff === 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const genCode = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/user/bind-code', {
        method: 'GET',
        credentials: 'include',
      });
      const d = await handleResp(r, router, message);
      if (!d) return;
      if (d.success) {
        setCode(d.data.code);
        setExpiresAt(new Date(d.data.expiresAt));
        message.success('已生成绑定码');
      } else {
        message.error(d.error?.message || '生成失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card size="small" className="mb-4" style={{ maxWidth: 480 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">将此 6 位码告知家长，家长在绑定页输入即可关联：</Text>
          </div>
          <div className="text-center py-4">
            {code ? (
              <>
                <div
                  className="text-3xl font-bold tracking-widest mb-2"
                  style={{ letterSpacing: '0.5em' }}
                >
                  {code}
                </div>
                <div>
                  {countdown > 0 ? (
                    <Tag color="orange">
                      剩余 {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                    </Tag>
                  ) : (
                    <Tag color="default">已过期</Tag>
                  )}
                </div>
              </>
            ) : (
              <Text type="secondary">尚未生成绑定码</Text>
            )}
          </div>
          <Button type="primary" block loading={loading} onClick={genCode}>
            {code ? '刷新绑定码' : '生成绑定码'}
          </Button>
        </Space>
      </Card>
      <FamilyList role="STUDENT" />
    </div>
  );
}

function ParentBindView() {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { code: string }) => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/v1/user/bind-code/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      const d = await handleResp(r, router, message);
      if (!d) return;
      if (d.success) {
        message.success('绑定成功');
        form.resetFields();
        setForceReload((v) => v + 1);
      } else {
        message.error(d.error?.message || '绑定失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const [forceReload, setForceReload] = useState(0);

  return (
    <div>
      <Card size="small" className="mb-4" style={{ maxWidth: 480 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="请输入学生提供的 6 位绑定码"
            name="code"
            rules={[
              { required: true, message: '请输入绑定码' },
              { pattern: /^\d{6}$/, message: '必须是6位数字' },
            ]}
          >
            <Input placeholder="如 123456" maxLength={6} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              绑定学生
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <FamilyList role="PARENT" key={forceReload} />
    </div>
  );
}

function FamilyList({ role }: { role: Role }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [listRole, setListRole] = useState<Role | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/v1/user/family', { credentials: 'include' });
        if (r.status === 401) {
          router.push('/login?redirect=/user/settings');
          return;
        }
        const d = await r.json().catch(() => ({}));
        if (active && d.success) {
          setListRole(d.data.role);
          setMembers(d.data.members);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) return <Spin />;

  if (listRole === 'PARENT') {
    return (
      <div>
        <Title level={5}>已绑定的子女</Title>
        {members.length === 0 ? (
          <Text type="secondary">暂无绑定</Text>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((m: FamilyMemberParent) => (
              <Card key={m.bindingId} size="small">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Text strong>{m.nickname ?? '未设置昵称'}</Text>
                    <Tag color="blue" className="ml-2">
                      {m.grade ? `${m.grade} 年级` : '未设置年级'}
                    </Tag>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-500">累计学习时长：</span>
                    {m.totalStudyMinutes} 分钟
                  </div>
                  <div>
                    <span className="text-gray-500">正确率：</span>
                    {m.correctRate > 0 ? `${(m.correctRate * 100).toFixed(1)}%` : '-'}
                  </div>
                  <div>
                    <span className="text-gray-500">最近活跃：</span>
                    {m.lastActiveAt ? new Date(m.lastActiveAt).toLocaleString() : '-'}
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div className="text-xs text-gray-400">
                    绑定时间：{new Date(m.boundAt).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (listRole === 'STUDENT') {
    return (
      <div>
        <Title level={5}>已绑定的家长</Title>
        {members.length === 0 ? (
          <Text type="secondary">暂无绑定</Text>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((m: FamilyMemberStudent) => (
              <Card key={m.bindingId} size="small">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar src={m.avatarUrl ?? undefined} icon={<UserOutlined />} />
                  <Text strong>{m.nickname ?? '未设置昵称'}</Text>
                </div>
                <div className="text-xs text-gray-400">
                  绑定时间：{new Date(m.boundAt).toLocaleString()}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <Text type="secondary">暂无绑定信息</Text>;
}

function VolunteerTab() {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [certs, setCerts] = useState<VolunteerCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCerts, setActiveCerts] = useState<VolunteerCert[]>([]);

  const loadCerts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/user/volunteer', { credentials: 'include' });
      if (r.status === 401) {
        router.push('/login?redirect=/user/settings');
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (d.success) {
        setCerts(d.data.certs);
        setActiveCerts(
          d.data.certs.filter(
            (c: VolunteerCert) => c.status === 'PENDING' || c.status === 'APPROVED',
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/v1/user/volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certType: values.certType,
          expertise: (values.expertise ?? []).filter(Boolean),
          orgName: values.orgName || undefined,
          intro: values.intro || undefined,
        }),
        credentials: 'include',
      });
      const d = await handleResp(r, router, message);
      if (!d) return;
      if (d.success) {
        message.success('申请已提交，等待审核');
        form.resetFields();
        loadCerts();
      } else {
        message.error(d.error?.message || '提交失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const hasActive = activeCerts.length > 0;
  const approvedCert = activeCerts.find((c) => c.status === 'APPROVED');

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="mb-4">
        <Title level={5} style={{ marginBottom: 8 }}>我的认证状态</Title>
        {loading ? (
          <Spin />
        ) : certs.length === 0 ? (
          <Text type="secondary">您尚未申请志愿者认证。</Text>
        ) : (
          <div className="space-y-2">
            {certs.map((c) => (
              <Card key={c.id} size="small">
                <div className="flex justify-between items-center mb-2">
                  <Text strong>{c.certType}</Text>
                  {volunteerStatusTag(c.status)}
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-500">擅长领域：</span>
                    {c.expertise.length > 0
                      ? c.expertise.map((e, i) => (
                          <Tag key={i} color="blue">
                            {e}
                          </Tag>
                        ))
                      : '-'}
                  </div>
                  {c.orgName && (
                    <div>
                      <span className="text-gray-500">所属机构：</span>
                      {c.orgName}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">贡献积分：</span>
                    {c.points}
                  </div>
                  <div className="text-xs text-gray-400">
                    申请时间：{new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {approvedCert ? (
        <Text type="secondary">您的志愿者认证已通过，感谢您的贡献！</Text>
      ) : hasActive ? (
        <Text type="secondary">您已有待审核的申请，请耐心等待审核。</Text>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Divider orientation="left">提交新申请</Divider>
          <Form.Item
            label="认证类型"
            name="certType"
            rules={[{ required: true, message: '请选择或填写认证类型' }, { max: 32 }]}
          >
            <Select
              placeholder="选择认证类型，或自定义填写"
              allowClear
              options={[
                { value: 'SUBJECT_EXPERT', label: '学科专家' },
                { value: 'FRONTLINE_TEACHER', label: '一线教师' },
                { value: 'COLLEGE_VOLUNTEER', label: '高校志愿者' },
                { value: 'OTHER', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="擅长学科/领域（最多20项）"
            name="expertise"
            rules={[{ required: true, message: '请填写至少一项擅长领域' }]}
          >
            <Select
              mode="tags"
              placeholder="如：小学数学、初中英语，回车添加"
              maxTagCount={20}
              tokenSeparators={[',', '，']}
            />
          </Form.Item>
          <Form.Item
            label="所属机构（可选）"
            name="orgName"
            rules={[{ max: 64, message: '最多64字符' }]}
          >
            <Input placeholder="学校/机构名称" />
          </Form.Item>
          <Form.Item
            label="个人介绍（可选）"
            name="intro"
            rules={[{ max: 2000, message: '最多2000字符' }]}
          >
            <TextArea rows={4} placeholder="简要介绍您的背景与可参与的志愿方向..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              提交申请
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
}
