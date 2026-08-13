'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserInfo {
  id: string;
  phone: string;
  nickname: string | null;
  role: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/v1/user', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        if (d?.success && d?.data) {
          setUser(d.data);
        }
      })
      .catch(() => {
        // 未登录，保持 user 为 null 即可，不做强制跳转（首页允许匿名访问）
      })
      .finally(() => setChecked(true));
  }, []);

  return (
    <main>
      {/* Hero */}
      <section className="brand-gradient text-white">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <span className="inline-block text-xs tracking-widest uppercase border border-white/25 rounded-full px-3 py-1 mb-6 text-white/70">
            公益教育平台 · 永久免费
          </span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
            全国K-12免费教育学习平台
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mb-8">
            汇聚全国权威专家学者志愿者贡献的学习资料与视频，全部内容永久免费。
            覆盖课堂学科、课外知识、全国竞赛、真题刷题、在线考试五大板块。
          </p>

          <div className="flex flex-wrap gap-4">
            {checked && user ? (
              <>
                {/* 已登录态：优先展示个人中心入口 */}
                <Link
                  href="/dashboard"
                  className="bg-white text-emerald-700 font-semibold px-6 py-3 rounded-lg hover:bg-emerald-50 transition"
                >
                  个人中心
                </Link>
                <span className="border border-white/25 text-white/80 text-sm px-4 py-3 rounded-lg flex items-center">
                  欢迎，{user.nickname ?? user.phone}
                  {user.role ? <span className="ml-2 px-2 py-0.5 rounded bg-white/15 text-xs">{user.role}</span> : null}
                </span>
                <button
                  onClick={async () => {
                    await fetch('/api/v1/logout', { method: 'POST', credentials: 'include' });
                    setUser(null);
                    router.refresh();
                  }}
                  className="border border-white/40 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition"
                >
                  退出登录
                </button>
              </>
            ) : (
              <>
                {/* 未登录态：显示注册/登录引导 */}
                <Link
                  href="/register"
                  className="bg-white text-emerald-700 font-semibold px-6 py-3 rounded-lg hover:bg-emerald-50 transition"
                >
                  免费注册
                </Link>
                <Link
                  href="/login"
                  className="border border-white/40 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition"
                >
                  登录
                </Link>
              </>
            )}

            {/* 公共板块入口：登录/未登录均可见 */}
            <Link
              href="/courses"
              className="border border-white/40 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition"
            >
              课程中心
            </Link>
            <Link
              href="/questions"
              className="border border-white/40 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition"
            >
              题库刷题
            </Link>
            <Link
              href="/exams"
              className="border border-white/40 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition"
            >
              在线考试
            </Link>
            <Link
              href="/articles"
              className="border border-white/40 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition"
            >
              课外知识
            </Link>
            <Link
              href="/contests"
              className="border border-white/40 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition"
            >
              竞赛与OJ
            </Link>
          </div>
        </div>
      </section>

      {/* 五大板块 */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">五大学习板块</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { t: '课堂学科', d: '年级—学科—教材版本—章节—知识点五级目录，视频课程配套课件与练习', tag: 'P0', href: '/courses' },
            { t: '课外知识', d: '科学探索、人文历史、艺术启蒙等多元拓展，知识图谱式关联推荐', tag: 'P1', href: '/articles' },
            { t: '全国竞赛', d: '五大学科奥赛与白名单赛事，含在线判题系统（OJ沙箱）', tag: 'P1', href: '/contests' },
            { t: '真题刷题', d: '全国各省市中高考真题，AI自动采集入库，智能组卷与错题本', tag: 'P0', href: '/questions' },
            { t: '在线考试', d: '正式考试与模拟考试，防作弊、自动阅卷、AI辅助评分', tag: 'P0·新增', href: '/exams' },
          ].map((m) => (
            <Link key={m.t} href={m.href} className="block">
              <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition h-full cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">{m.t}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{m.tag}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{m.d}</p>
                <div className="mt-4 text-sm text-emerald-600 font-medium">进入板块 →</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        全国K-12免费教育学习平台 · 完全免费 · 公益运营
      </footer>
    </main>
  );
}
