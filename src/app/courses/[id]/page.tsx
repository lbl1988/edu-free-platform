'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Spin, Tag, Button, List, App, Modal, Input, Form, Upload, message, Avatar, Empty } from 'antd';
import { UploadOutlined, MessageOutlined, LikeOutlined, SendOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { TextArea } = Input;

interface DiscussionAuthor {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
  grade: number | null;
}

interface DiscussionPost {
  id: string;
  courseId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  likeCount: number;
  pinned: boolean;
  createdAt: string;
  author: DiscussionAuthor;
  replies?: DiscussionPost[];
}

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
  // P3-2：讨论区
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [discussInput, setDiscussInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');

  async function loadDiscussions() {
    try {
      const res = await fetch(`/api/v1/courses/${id}/discussions`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setPosts(data.data.posts);
    } catch {
      // 静默
    }
  }

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
      loadDiscussions();
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

  // P3-2：发帖/回复
  async function handleSendPost(parentId?: string) {
    const content = parentId ? replyInput : discussInput;
    if (!content.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/courses/${id}/discussions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), parentId: parentId ?? null }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(parentId ? '回复成功' : '发布成功');
        if (parentId) {
          setReplyInput('');
          setReplyTo(null);
        } else {
          setDiscussInput('');
        }
        loadDiscussions();
      } else {
        message.error(data.error?.message ?? '发布失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setPosting(false);
    }
  }

  // P3-2：点赞
  async function handleLike(postId: string) {
    try {
      const res = await fetch(`/api/v1/courses/${id}/discussions/${postId}/like`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        loadDiscussions();
      }
    } catch {
      // 静默
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

      {/* P3-2：课程讨论区 */}
      <Card
        title={<span className="flex items-center gap-2"><MessageOutlined /> 课程讨论区</span>}
        className="mb-6"
      >
        {/* 发帖输入 */}
        <div className="mb-4">
          <TextArea
            value={discussInput}
            onChange={(e) => setDiscussInput(e.target.value)}
            placeholder="有问题想问老师或同学？在这里发帖讨论…"
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={2000}
          />
          <div className="flex justify-end mt-2">
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={posting}
              disabled={!discussInput.trim()}
              onClick={() => handleSendPost()}
            >
              发布
            </Button>
          </div>
        </div>

        {/* 帖子列表 */}
        {posts.length === 0 ? (
          <Empty description="暂无讨论，快来发第一条吧" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="border rounded-lg p-3">
                {/* 帖子头部 */}
                <div className="flex items-start gap-3">
                  <Avatar size={36} src={post.author.avatarUrl ?? undefined} className="bg-emerald-500 shrink-0">
                    {post.author.nickname?.[0] ?? '?'}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{post.author.nickname ?? '匿名'}</span>
                      {post.author.role === 'TEACHER' && <Tag color="blue" className="text-xs">教师</Tag>}
                      {post.author.role === 'STUDENT' && post.author.grade && (
                        <Tag className="text-xs">{post.author.grade}年级</Tag>
                      )}
                      {post.pinned && <Tag color="red" className="text-xs">置顶</Tag>}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(post.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{post.content}</div>
                    {/* 操作栏 */}
                    <div className="flex items-center gap-4 mt-2">
                      <Button
                        type="text"
                        size="small"
                        icon={<LikeOutlined />}
                        onClick={() => handleLike(post.id)}
                      >
                        {post.likeCount > 0 ? post.likeCount : '点赞'}
                      </Button>
                      <Button
                        type="text"
                        size="small"
                        onClick={() => {
                          setReplyTo(replyTo === post.id ? null : post.id);
                          setReplyInput('');
                        }}
                      >
                        回复
                      </Button>
                    </div>

                    {/* 回复输入 */}
                    {replyTo === post.id && (
                      <div className="mt-2 flex gap-2">
                        <TextArea
                          value={replyInput}
                          onChange={(e) => setReplyInput(e.target.value)}
                          placeholder={`回复 ${post.author.nickname ?? '匿名'}…`}
                          autoSize={{ minRows: 1, maxRows: 3 }}
                          maxLength={2000}
                          className="flex-1"
                        />
                        <Button
                          type="primary"
                          size="small"
                          loading={posting}
                          disabled={!replyInput.trim()}
                          onClick={() => handleSendPost(post.id)}
                        >
                          回复
                        </Button>
                      </div>
                    )}

                    {/* 回复列表 */}
                    {post.replies && post.replies.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-gray-100 space-y-2">
                        {post.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2">
                            <Avatar size={24} src={reply.author.avatarUrl ?? undefined} className="bg-blue-500 shrink-0">
                              {reply.author.nickname?.[0] ?? '?'}
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{reply.author.nickname ?? '匿名'}</span>
                                {reply.author.role === 'TEACHER' && <Tag color="blue" className="text-xs">教师</Tag>}
                                <span className="text-xs text-gray-400">
                                  {new Date(reply.createdAt).toLocaleString('zh-CN')}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{reply.content}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
