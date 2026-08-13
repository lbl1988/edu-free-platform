'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Spin, Button, Tag, App } from 'antd';
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

export default function DashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/user', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => d.success && setUser(d.data))
      .catch(() => router.push('/login?redirect=/dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch('/api/v1/logout', { method: 'POST', credentials: 'include' });
    message.success('已登出');
    router.push('/');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">个人中心</h1>
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-lg font-semibold">{user.nickname ?? '未设置昵称'}</span>
            <Tag color="green" className="ml-3">{user.role}</Tag>
          </div>
          <Button onClick={handleLogout}>登出</Button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
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
      <div className="text-center">
        <Link href="/" className="text-emerald-600">返回首页</Link>
      </div>
    </main>
  );
}
