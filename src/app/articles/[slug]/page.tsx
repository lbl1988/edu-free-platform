'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, Button, Tag, Card, App, Empty } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';

interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  coverUrl: string | null;
  category: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  reviewStatus: string;
  boardType: string;
  grade: number | null;
  source: string | null;
  sourceUrl: string | null;
  author: { id: string; nickname: string | null; avatarUrl: string | null } | null;
  subject: { id: number; name: string } | null;
  chapter: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverUrl: string | null;
  category: string;
  viewCount: number;
  publishedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  sciences: '科学探索',
  humanities: '人文历史',
  arts: '艺术启蒙',
  technology: '科技创新',
  nature: '自然百科',
  'contest-news': '竞赛资讯',
  reading: '课外阅读',
  life: '生活常识',
};

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [related, setRelated] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/articles/${slug}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setArticle(data.data.article);
        setRelated(data.data.relatedArticles || []);
        setLocalLikes(data.data.article?.likeCount ?? 0);
      } else if (res.status === 403) {
        message.error(data.error?.message ?? '无权查看');
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
    if (slug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleLike() {
    if (!article || liking) return;
    setLiking(true);
    try {
      const res = await fetch(`/api/v1/articles/${article.id}/like`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setLocalLikes(data.data.likeCount);
        message.success('点赞成功');
      } else if (res.status === 401) {
        router.push('/login');
      } else {
        message.error(data.error?.message ?? '点赞失败');
      }
    } catch {
      message.error('网络错误');
    } finally {
      setLiking(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>;
  }
  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Empty description="文章不存在或无权查看" />
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <Link href="/articles" className="text-emerald-600 text-sm">← 返回文章列表</Link>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <article className="lg:col-span-3">
          <Card className="mb-6">
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              <Tag color="blue">{CATEGORY_LABELS[article.category] ?? article.category}</Tag>
              {article.subject && <Tag>{article.subject.name}</Tag>}
              {article.grade !== null && <Tag color="cyan">{article.grade} 年级</Tag>}
              {article.tags.map((t) => (
                <Tag key={t} className="!bg-gray-100 !text-gray-600 !border-none">
                  #{t}
                </Tag>
              ))}
            </div>

            <h1 className="text-3xl font-bold mb-3 leading-tight">{article.title}</h1>
            {article.summary && (
              <p className="text-gray-600 text-base mb-4 bg-gray-50 p-4 rounded-lg border-l-4 border-emerald-400">
                {article.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
              <span>作者：{article.author?.nickname ?? '平台编辑'}</span>
              <span>
                发布：{article.publishedAt ? dayjs(article.publishedAt).format('YYYY-MM-DD HH:mm') : dayjs(article.createdAt).format('YYYY-MM-DD')}
              </span>
              <span>阅读 {article.viewCount}</span>
              {article.source && (
                <span>
                  来源：
                  {article.sourceUrl ? (
                    <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">
                      {article.source}
                    </a>
                  ) : (
                    article.source
                  )}
                </span>
              )}
            </div>

            {article.coverUrl && (
              <div
                className="w-full rounded-lg mb-6 bg-gray-100 overflow-hidden"
                style={{
                  backgroundImage: `url(${article.coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  minHeight: '260px',
                }}
              />
            )}

            <div
              className="prose prose-slate max-w-none mx-auto prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-700 prose-p:leading-relaxed prose-img:rounded-lg prose-a:text-emerald-600"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            <div className="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>觉得有用就点个赞吧~</span>
              </div>
              <Button
                type="primary"
                icon={<HeartFilled />}
                size="large"
                loading={liking}
                onClick={handleLike}
                className="!bg-rose-500 !hover:bg-rose-600"
              >
                点赞 {localLikes > 0 ? `(${localLikes})` : ''}
              </Button>
            </div>
          </Card>
        </article>

        <aside className="lg:col-span-1 space-y-6">
          <Card title="相关推荐">
            {related.length === 0 ? (
              <div className="text-center text-gray-400 py-4 text-sm">暂无相关文章</div>
            ) : (
              <ul className="space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <a
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(`/articles/${r.slug}`);
                      }}
                      href={`/articles/${r.slug}`}
                      className="block group"
                    >
                      <div className="text-sm font-medium text-gray-800 group-hover:text-emerald-600 line-clamp-2 mb-1">
                        {r.title}
                      </div>
                      <div className="text-xs text-gray-400 flex justify-between">
                        <span>{r.viewCount} 阅读</span>
                        {r.publishedAt && <span>{dayjs(r.publishedAt).format('MM-DD')}</span>}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </main>
  );
}
