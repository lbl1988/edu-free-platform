'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Spin,
  Tabs,
  Input,
  Button,
  App,
  Radio,
  Checkbox,
  Tag,
  Empty,
  Divider,
  Breadcrumb,
} from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { TextArea } = Input;

interface LessonDetail {
  lesson: {
    id: string;
    title: string;
    intro: string | null;
    sortOrder: number;
    durationSec: number | null;
    createdAt: string;
    updatedAt: string;
  };
  course: {
    id: string;
    title: string;
    grade: number;
    subjectId: number;
    subject: { id: number; name: string };
    teacher: { id: string; nickname: string | null; avatarUrl: string | null };
  };
  chapter: {
    id: string;
    title: string;
    parentId: string | null;
    textbookId: string;
  } | null;
  video: {
    id: string;
    objectKey: string;
    hlsKey: string | null;
    durationSec: number | null;
    transcodeStatus: string;
    subtitleUrl: string | null;
  } | null;
  note: {
    id: string;
    content: string;
    anchorSec: number | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface PracticeQuestion {
  id: string;
  content: string;
  options: unknown;
  difficulty: number;
  questionType: string;
  subjectId: number;
  grade: number | null;
  chapterId: string | null;
  source: string | null;
  sourceYear: number | null;
}

type QuestionOption = { key: string; label: string };

function parseOptions(raw: unknown): QuestionOption[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) {
      return arr.map((o, i) => {
        if (typeof o === 'object' && o !== null) {
          return {
            key: String((o as { key?: string; label?: string }).key ?? String.fromCharCode(65 + i)),
            label: String((o as { key?: string; label?: string }).label ?? o),
          };
        }
        return { key: String.fromCharCode(65 + i), label: String(o) };
      });
    }
    return [];
  } catch {
    return [];
  }
}

export default function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [noteContent, setNoteContent] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  const [tabKey, setTabKey] = useState('note');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/lessons/${lessonId}`, { credentials: 'include' });
      if (res.status === 401) {
        router.push(`/login?redirect=/lessons/${lessonId}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setDetail(data.data);
        setNoteContent(data.data.note?.content ?? '');
      } else {
        message.error(data.error?.message ?? '加载失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (lessonId) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    if (!detail) return;
    noteTimer.current = setTimeout(() => {
      saveNote();
    }, 1000);
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteContent]);

  async function saveNote() {
    if (!detail) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/v1/lessons/${detail.lesson.id}/note`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      });
      const data = await res.json();
      if (!data.success) {
        message.error(data.error?.message ?? '笔记保存失败');
      }
    } catch {
      // 静默失败
    } finally {
      setNoteSaving(false);
    }
  }

  async function loadPractice() {
    if (!detail) return;
    setPracticeLoading(true);
    try {
      const res = await fetch(`/api/v1/lessons/${detail.lesson.id}/practice?count=10`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data.questions);
        setAnswers({});
        setSubmitted({});
      } else {
        message.error(data.error?.message ?? '获取练习题失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setPracticeLoading(false);
    }
  }

  function submitAnswer(qid: string) {
    setSubmitted((prev) => ({ ...prev, [qid]: true }));
    console.log('提交答案:', qid, answers[qid]);
    // TODO: POST /api/v1/questions/{id}/answer 判分；此处仅记录答案
    message.info('练习模式：答案已记录，正确与否以老师批改/AI评分结果为准');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  if (!detail) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">课时不存在</div>;
  }

  const { lesson, course, chapter, video } = detail;

  return (
    <main className="max-w-7xl mx-auto p-6">
      <Breadcrumb
        className="mb-4"
        items={[
          { title: <Link href="/courses">课程</Link> },
          { title: <Link href={`/courses/${course.id}`}>{course.title}</Link> },
          ...(chapter ? [{ title: chapter.title }] : []),
          { title: <span className="font-semibold">{lesson.title}</span> },
        ]}
      />

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <Card className="mb-4">
            <div className="aspect-video bg-gray-900 rounded-md overflow-hidden relative flex items-center justify-center">
              {video ? (
                video.transcodeStatus === 'READY' ? (
                  video.hlsKey ? (
                    <div className="text-center text-white p-8">
                      <div className="text-lg mb-2">🎬 video.js HLS 自适应 TODO</div>
                      <div className="text-sm text-gray-400 mb-3">hlsKey: {video.hlsKey}</div>
                      <div className="text-xs text-gray-500">
                        TODO：集成 video.js / hls.js 播放多清晰度自适应流
                      </div>
                      <video
                        controls
                        className="max-w-full max-h-full mt-4 rounded"
                        poster=""
                      >
                        {/* TODO: 签名 URL 替换 objectKey 为 CDN 下载地址（通过 /api/v1/materials/[id]/download） */}
                        <source src={video.objectKey} />
                      </video>
                    </div>
                  ) : (
                    <div className="w-full h-full">
                      <video
                        controls
                        className="w-full h-full"
                        poster=""
                      >
                        {/* TODO: 签名 URL，当前直接用 objectKey → 前端通过 /api/v1/materials/[id]/download 代理 */}
                        <source src={video.objectKey} />
                      </video>
                    </div>
                  )
                ) : (
                  <div className="text-center text-white">
                    <Spin size="large" />
                    <div className="mt-4">视频转码中 ({video.transcodeStatus})...</div>
                  </div>
                )
              ) : (
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">📺</div>
                  <div>暂无视频</div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <h1 className="text-xl font-bold">{lesson.title}</h1>
              <div className="text-sm text-gray-500 mt-1">
                主讲：{course.teacher.nickname ?? '未知'}
                {video?.durationSec && (
                  <span className="ml-4">
                    时长：{Math.floor(video.durationSec / 60)}分{video.durationSec % 60}秒
                  </span>
                )}
              </div>
              {lesson.intro && (
                <p className="text-gray-600 mt-3">{lesson.intro}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="col-span-2">
          <Card styles={{ body: { padding: 0 } }}>
            <Tabs
              activeKey={tabKey}
              onChange={setTabKey}
              items={[
                {
                  key: 'note',
                  label: '笔记',
                  children: (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">自动保存（防抖 1 秒）</span>
                        {noteSaving && <Spin size="small" />}
                      </div>
                      <TextArea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="在这里记录你的学习笔记..."
                        autoSize={{ minRows: 20, maxRows: 40 }}
                        maxLength={10000}
                        showCount
                      />
                    </div>
                  ),
                },
                {
                  key: 'practice',
                  label: '课后练习',
                  children: (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-medium">本课时练习题</span>
                        <Button type="primary" onClick={loadPractice} loading={practiceLoading}>
                          抽取 10 道练习题
                        </Button>
                      </div>
                      {questions.length === 0 ? (
                        <Empty description="点击上方按钮抽取练习题" />
                      ) : (
                        <div className="space-y-5 max-h-[560px] overflow-y-auto pr-2">
                          {questions.map((q, idx) => (
                            <div key={q.id} className="p-3 border rounded-lg">
                              <div className="flex items-start gap-2">
                                <span className="bg-emerald-50 text-emerald-700 rounded px-2 py-0.5 text-xs shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Tag color="blue">{q.questionType}</Tag>
                                    <Tag color="orange">难度 {q.difficulty}</Tag>
                                  </div>
                                  <div className="text-sm mb-3 whitespace-pre-wrap">{q.content}</div>
                                  {q.questionType === 'SINGLE_CHOICE' && (
                                    <Radio.Group
                                      value={(answers[q.id] as string) ?? undefined}
                                      onChange={(e) =>
                                        setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                      }
                                    >
                                      <div className="space-y-2">
                                        {parseOptions(q.options).map((op) => (
                                          <Radio key={op.key} value={op.key} className="block">
                                            <span className="text-sm">{op.key}. {op.label}</span>
                                          </Radio>
                                        ))}
                                      </div>
                                    </Radio.Group>
                                  )}
                                  {q.questionType === 'MULTI_CHOICE' && (
                                    <Checkbox.Group
                                      value={(answers[q.id] as string[]) ?? []}
                                      onChange={(vals) =>
                                        setAnswers((prev) => ({ ...prev, [q.id]: vals as string[] }))
                                      }
                                    >
                                      <div className="space-y-2">
                                        {parseOptions(q.options).map((op) => (
                                          <Checkbox key={op.key} value={op.key} className="block w-full">
                                            <span className="text-sm">{op.key}. {op.label}</span>
                                          </Checkbox>
                                        ))}
                                      </div>
                                    </Checkbox.Group>
                                  )}
                                  {q.questionType === 'FILL_BLANK' && (
                                    <Input
                                      placeholder="请输入答案"
                                      value={(answers[q.id] as string) ?? ''}
                                      onChange={(e) =>
                                        setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                      }
                                    />
                                  )}
                                  {(q.questionType === 'ESSAY' || q.questionType === 'CODING') && (
                                    <TextArea
                                      placeholder="请输入作答内容"
                                      value={(answers[q.id] as string) ?? ''}
                                      onChange={(e) =>
                                        setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                      }
                                      autoSize={{ minRows: 4 }}
                                    />
                                  )}
                                  <Divider className="my-3" />
                                  <div className="flex justify-end">
                                    <Button
                                      type="primary"
                                      size="small"
                                      disabled={!answers[q.id] || submitted[q.id]}
                                      onClick={() => submitAnswer(q.id)}
                                    >
                                      {submitted[q.id] ? '已记录' : '提交答案'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'ai',
                  label: 'AI 问答',
                  children: (
                    <div className="p-8 text-center">
                      <div className="text-5xl mb-4 text-emerald-500">
                        <RobotOutlined />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">AI 问答助手</h3>
                      <p className="text-gray-500 mb-6 text-sm">
                        已接入 LightRAG，可以针对本课程内容进行个性化问答
                      </p>
                      <Link href={`/courses/${course.id}`}>
                        <Button type="primary" size="large">
                          进入课程问答
                        </Button>
                      </Link>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </main>
  );
}
