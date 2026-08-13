'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, Input, Select, App } from 'antd';
import Link from 'next/link';

const GRADES = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1} 年级`, value: i + 1 }));

export default function RegisterPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { phone: string; password: string; nickname?: string; grade: number }) {
    setLoading(true);
    try {
      const payload = {
        phone: values.phone,
        password: values.password,
        nickname: values.nickname,
        role: 'STUDENT' as const,
        grade: Number(values.grade), // 强制 number，与后端契约对齐
      };
      const res = await fetch('/api/v1/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(data.error?.message || data.message || '注册失败');
        return;
      }
      if (!data.success) {
        message.error(data.error?.message ?? '注册失败');
        return;
      }
      message.success('注册成功，请登录');
      router.push('/login');
    } catch (e: any) {
      message.error(e?.message || '网络错误，请检查网络后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-center mb-2">免费注册</h1>
        <p className="text-center text-sm text-gray-500 mb-8">所有内容永久免费，无付费墙</p>
        <Form layout="vertical" onFinish={onFinish} autoComplete="off" initialValues={{ grade: 7 }}>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input placeholder="11 位手机号" maxLength={11} />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[
            { required: true, message: '请输入密码' },
            { min: 8, max: 64, message: '密码长度应为 8-64 位' },
            {
              pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=]{8,64}$/,
              message: '密码需同时包含字母与数字',
            },
          ]}>
            <Input.Password placeholder="8-64 位，含字母与数字" />
          </Form.Item>
          <Form.Item label="昵称（选填）" name="nickname">
            <Input placeholder="昵称" maxLength={32} />
          </Form.Item>
          <Form.Item label="年级" name="grade" rules={[{ required: true, message: '请选择年级' }]}>
            <Select options={GRADES} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">
            注册
          </Button>
        </Form>
        <div className="text-center text-sm text-gray-500 mt-6">
          已有账号？<Link href="/login" className="text-emerald-600">登录</Link>
        </div>
      </div>
    </main>
  );
}
