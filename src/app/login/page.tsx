'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Form, Input, App } from 'antd';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { phone: string; password: string }) {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.success) {
        message.error(data.error?.message ?? '登录失败');
        return;
      }
      message.success('登录成功');
      const redirect = params.get('redirect') ?? '/dashboard';
      router.push(redirect);
      router.refresh();
    } catch {
      message.error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-center mb-2">登录</h1>
        <p className="text-center text-sm text-gray-500 mb-8">全国K-12免费教育学习平台</p>
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input placeholder="11 位手机号" maxLength={11} />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">
            登录
          </Button>
        </Form>
        <div className="text-center text-sm text-gray-500 mt-6">
          还没有账号？<Link href="/register" className="text-emerald-600">免费注册</Link>
        </div>
      </div>
    </main>
  );
}
