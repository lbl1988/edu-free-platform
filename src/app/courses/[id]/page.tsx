'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Spin, Tag, Button, List, App, Modal, Input, Form, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface CourseDetail {
  id: string;
  title: string;
  grade: number;
  boardType: string;
  status: string;
  intro: string | null;
  subject: { id: number; name: string };
  teacher: { id: string; nickname: string | null; avatarUrl: string | null };
  textbook: { id: string; name: string } | null;
  lessons: Array<{
    id: string;
    title: string;
    sortOrder: number;
    intro: string | null;
    video: { durationSec: number | null; transcodeStatus: string } | null;
  }>;
  _count: { enrollments: number; materials: number };
}

interface MaterialItem {
  id: string;
  title: string;
  fileType: string;
  fileSize: number | null;
  createdAt: string;
  uploader: { nickname: string | null };
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cRes, mRes] = await Promise.all([
        fetch(`/api/v1/courses/${id}`, { credentials: 'include' }),
        fetch(`/api/v1/courses/${id}/materials?limit=50`, { credentials: 'include' }),
      ]);
      const cd = await cRes.json();
      if (cd.success) setCourse(cd.data);
      else message.error(cd.error?.message ?? '加载失败');
      const md = await mRes.json();
      if (md.success) setMaterials(md.data);
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await fetch(`/api/v1/courses/${id}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        message.success(data.data.message);
      } else {
        message.error(data.error?.message ?? '加入失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;
  }
  if (!course) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">课程不存在</div>;
  }

  const BOARD_LABEL: Record<string, string> = {
    CLASSROOM: '课堂学科',
    EXTRACURRICULAR: '课外知识',
    COMPETITION: '全国竞赛',
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <Link href="/courses" className="text-emerald-600 text-sm">← 返回课程列表</Link>

      {/* 课程头部 */}
      <Card className="mt-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Tag color="green">{BOARD_LABEL[course.boardType]}</Tag>
              <Tag>{course.subject.name}</Tag>
              <Tag color="blue">{course.grade} 年级</Tag>
              {course.textbook && <Tag>{course.textbook.name}</Tag>}
            </div>
            <h1 className="text-2xl font-bold mb-2">{course.title}</h1>
            <p className="text-gray-600 mb-4">{course.intro ?? '暂无简介'}</p>
            <div className="text-sm text-gray-500">
              主讲：{course.teacher.nickname ?? '未知'} · {course._count.enrollments} 人在学 · {course.lessons.length} 课时
            </div>
          </div>
          <Button type="primary" size="large" loading={joining} onClick={handleJoin}>
            加入课程
          </Button>
        </div>
      </Card>

      {/* 课时列表 */}
      <Card title="课时列表" className="mb-6">
        {course.lessons.length === 0 ? (
          <div className="text-center text-gray-400 py-8">暂无课时</div>
        ) : (
          <List
            dataSource={course.lessons}
            renderItem={(lesson, idx) => (
              <List.Item>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <span className="text-gray-400 mr-3">{idx + 1}.</span>
                    <span className="font-medium">{lesson.title}</span>
                    {lesson.video && (
                      <Tag className="ml-2">
                        {lesson.video.transcodeStatus === 'READY' ? '可播放' : '转码中'}
                      </Tag>
                    )}
                    {lesson.intro && (
                      <div className="text-sm text-gray-500 mt-1 ml-8">{lesson.intro}</div>
                    )}
                  </div>
                  {lesson.video?.durationSec && (
                    <span className="text-xs text-gray-400">
                      {Math.floor(lesson.video.durationSec / 60)}分{lesson.video.durationSec % 60}秒
                    </span>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 课件列表 */}
      <Card
        title="课件资料"
        extra={
          <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>上传课件</Button>
        }
      >
        {materials.length === 0 ? (
          <div className="text-center text-gray-400 py-8">暂无课件</div>
        ) : (
          <List
            dataSource={materials}
            renderItem={(m) => (
              <List.Item>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <span className="font-medium">{m.title}</span>
                    <Tag className="ml-2 uppercase">{m.fileType}</Tag>
                    <div className="text-xs text-gray-400 mt-1">
                      上传者：{m.uploader.nickname ?? '未知'} · {m.fileSize ? `${(m.fileSize / 1024).toFixed(0)} KB` : '-'}
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      <UploadModal
        open={uploadOpen}
        courseId={id}
        onClose={() => setUploadOpen(false)}
        onSuccess={load}
      />
    </main>
  );
}

function UploadModal({
  open,
  courseId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  courseId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { message } = App.useApp();

  async function handleSubmit() {
    try {
      const values = await form.validateFields();
      if (!file) {
        message.error('请选择文件');
        return;
      }
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', values.title);
      const res = await fetch(`/api/v1/courses/${courseId}/materials`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        message.success('上传成功');
        if (data.data.degraded) {
          message.warning('MinIO 未就绪，文件元数据已记录（降级模式）');
        }
        form.resetFields();
        setFile(null);
        onClose();
        onSuccess();
      } else {
        message.error(data.error?.message ?? '上传失败');
      }
    } catch {
      // 校验失败不处理
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      title="上传课件"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={uploading}
      okText="上传"
    >
      <Form form={form} layout="vertical">
        <Form.Item label="课件标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="如：第三章 课件" />
        </Form.Item>
        <Form.Item label="选择文件" required>
          <Upload
            beforeUpload={(f) => {
              setFile(f);
              return false; // 阻止自动上传
            }}
            maxCount={1}
            onRemove={() => setFile(null)}
            fileList={file ? [{ uid: '-1', name: file.name, status: 'done' }] : []}
          >
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
          <div className="text-xs text-gray-400 mt-1">支持 PDF/Word/PPT/Excel/ZIP/视频，最大 500MB</div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
