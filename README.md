# 全国 K-12 免费教育学习平台

> 完全免费、公益运营的 K-12 在线学习平台，覆盖课堂学科、题库刷题、在线考试、课外知识、竞赛与 OJ、AI 课程问答、推荐看板等模块。

## 项目简介

本项目旨在为全国中小学生（G1–G12）提供一个**零门槛、零付费**的在线学习平台，学生、家长、教师、志愿者均可参与。平台坚持未成年人保护与数据合规优先，支持匿名浏览核心内容、仅个人记录需登录。

- **角色体系**：学生（STUDENT）/ 家长（PARENT）/ 教师（TEACHER）/ 管理员（ADMIN）
- **匿名友好**：课程中心、题库、考试、课外知识、竞赛五大板块匿名可访问，仅个人记录需登录
- **未成年人保护**：防沉迷每日学习时长上限、数据软删除、QA 日志采集可关、实名信息脱敏存储
- **公益运营**：不接受任何付费解锁，所有学习资源对所有用户开放

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端框架 | Next.js 14（App Router）+ React 18 |
| 语言 | TypeScript（strict 模式，0 错误门禁） |
| UI | Ant Design 5 + Tailwind CSS 3 |
| 数据库 | PostgreSQL 16 + pgvector（第二期 LightRAG 向量检索） |
| 缓存 / 限流 | Redis 7 |
| 对象存储 | MinIO（S3 兼容，视频/课件/转码 HLS） |
| ORM | Prisma 5 |
| 鉴权 | argon2id 密码哈希 + pepper + JWT（jose）+ Refresh Token 轮换 + HttpOnly Cookie |
| 参数校验 | Zod |
| 部署 | Vercel（香港节点）+ Cron 定时任务 |
| 图表 | 纯 SVG 手写（Bar/Pie/Radar/Bucket/HorizontalRate） |

## 功能模块

| 模块 | 路由前缀 | 说明 |
| --- | --- | --- |
| 用户中心 | `/api/v1/user`、`/api/v1/register`、`/login`、`/logout`、`/refresh` | 注册/登录/刷新/登出、个人资料、实名认证、家长绑定码、家庭关系、志愿者申请 |
| 课堂学科 | `/api/v1/subjects`、`/textbooks`、`/lessons/[id]` | 学科 → 教材版本 → 章节树 → 课时（视频+笔记+练习+AI问答） |
| 题库刷题 | `/api/v1/questions`、`/papers`、`/wrong`、`/favorites` | 多维筛选、RANDOM/SMART/MANUAL 三模式组卷、整卷交卷即时判分、错题本、收藏 |
| 在线考试 | `/api/v1/exams`、`/exams` | 创建/发布/开始/交卷/作弊上报/主观题批改/成绩查询，管理员可取消/删除（被竞赛关联的考试禁删） |
| 课外知识 | `/api/v1/articles`、`/articles` | Article 列表 + 详情，支持点赞 |
| 竞赛与 OJ | `/api/v1/contests`、`/judge`、`/submissions` | 竞赛报名/题目、OJ 判题（problem/submit/submission/callback，`X-Internal-Api-Key` 校验） |
| 课程采集爬虫 | `/api/v1/admin/crawl`、`/admin/crawl` | 配置化采集源（RSS/JSON/HTML）、定时调度（持久化生效）、限速、robots.txt 合规、采集任务记录 |
| AI 课程问答 | `/api/v1/courses/[id]/chat`、`/rag` | LightRAG SSE 流式问答，不可用时降级，支持索引触发与任务状态查询 |
| 推荐看板 | `/api/v1/recommend`、`/dashboard`、`/analytics` | 规则召回 → RecallItem、个性化推荐、行为画像、考试分析（总览/列表/单场深度） |

> 当前共 **61 条 API 路由 + 18 张页面**，全部通过 `tsc --noEmit` 与 `next build` 0 错误。

## 快速开始（本地开发）

### 1. 克隆仓库

```bash
git clone https://github.com/lbl1988/edu-free-platform.git
cd edu-free-platform
```

### 2. 启动基础设施

依赖 PostgreSQL（pgvector）、Redis、MinIO，已通过 `docker-compose.yml` 一键编排：

```bash
docker compose up -d
```

启动后访问 MinIO 控制台 `http://localhost:9001`（账号 `minio` / 密码 `minio_minio_minio`），手动创建 Bucket，名称与 `.env` 中 `MINIO_BUCKET` 一致（如 `edu-materials`）。

### 3. 配置环境变量

```bash
cp .env.example .env
```

按需修改 `.env`，**生产环境务必替换全部 `change-me-*` 密钥**（三者互不相同，≥16 字符）。生成方式（PowerShell）：

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 4. 安装依赖与初始化数据库

```bash
npm install
npm run prisma:generate
npm run prisma:migrate      # 本地开发迁移
# 可选：按需分步执行种子（规避 Vercel Hobby 60s 函数超时）
npm run db:seed             # 管理员 + 10 个学科
npm run db:seed:core        # 课堂学科核心内容
npm run db:seed:crawl       # 采集源
npm run db:seed:contests    # 竞赛与考试
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可访问。种子管理员账号见 `prisma/seed.ts`，密码取自 `.env` 的 `SEED_ADMIN_PASSWORD`。

## 部署

### Vercel（推荐）

仓库根目录 `vercel.json` 已配置：

- 构建命令：`prisma generate && prisma migrate deploy && next build`
- 部署区域：`hkg1`（香港）
- Cron：每日 02:00 触发 `/api/v1/admin/crawl/scheduled` 全网采集
- `github.silent: true`：构建状态不回写 PR 评论

### 自托管（Docker）

- 基础设施使用项目自带 `docker-compose.yml`
- 应用本体构建后通过 `next start` 运行，需自备 PostgreSQL/Redis/MinIO 或使用上述 compose

## 项目结构

```
edu-free-platform/
├── prisma/
│   ├── schema.prisma              # 数据模型（用户/内容/考试/AI/采集/竞赛域）
│   ├── migrations/                # 已有 0_init / 1_add_chat_session / 2_add_crawl_system
│   └── seed*.ts                   # 分步种子脚本
├── src/
│   ├── app/
│   │   ├── (pages)/               # 18 张页面：首页/登录/注册/课程/题库/考试/竞赛/分析/...
│   │   ├── api/v1/                # 61 条 API 路由
│   │   ├── admin/crawl/           # 采集源管理页
│   │   ├── layout.tsx / providers.tsx / page.tsx
│   ├── lib/
│   │   ├── prisma.ts              # Prisma 单例
│   │   ├── redis.ts               # Redis 懒加载 + 限流
│   │   ├── auth.ts / auth.server.ts  # jose 纯校验 / argon2+prisma+redis
│   │   ├── lightrag.ts            # LightRAG 客户端（stream/insert/task）
│   │   ├── crawler.ts             # 采集器实现
│   │   ├── minio.ts / api-response.ts / guards.ts / utils.ts
│   └── middleware.ts              # JWT 校验 + 角色鉴权 + Vercel 环境放行内部端点
├── docker-compose.yml
├── vercel.json
└── .env.example
```

## 安全与合规

- **密码**：argon2id 哈希 + 用户级 pepper
- **会话**：JWT Access（默认 15m）+ Refresh（默认 30d）轮换，Refresh Token 单次消费、事务化校验防重放
- **Cookie**：HttpOnly，避免 XSS 窃取
- **限流**：Redis 计数限流，覆盖注册/登录等敏感接口
- **参数校验**：Zod 在 API 边界统一校验
- **主键**：cuid，避免自增 ID 暴露数据规模
- **软删除**：统一 `deletedAt`，不物理删除用户数据（符合未成年人保护与审计要求）
- **防沉迷**：未成年人每日累计学习时长上限（`User.dailyLimitMinutes`，默认 120 分钟）
- **实名信息**：身份证号仅存哈希，姓名脱敏存储
- **QA 日志**：用户可关闭采集（`User.qaCollectionEnabled`），支持个人 QA 日志导出
- **采集合规**：尊重 robots.txt、可配限速、按源配置调度

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建 |
| `npm run start` | 生产启动 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 类型检查（0 错误门禁） |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:migrate` | 本地开发迁移 |
| `npm run prisma:deploy` | 生产迁移（Vercel 构建期执行） |
| `npm run prisma:studio` | Prisma Studio 数据库可视化 |
| `npm run db:seed` | 种子：管理员 + 学科 |
| `npm run db:seed:core` | 种子：课堂学科核心内容 |
| `npm run db:seed:crawl` | 种子：采集源 |
| `npm run db:seed:contests` | 种子：竞赛与考试 |

## 贡献

本项目为公益项目，欢迎教育工作者、学科专家、高校志愿者通过志愿者认证流程参与内容贡献。提交代码请确保：

- `npm run typecheck` 0 错误
- `npm run build` 通过
- 涉及数据模型变更时同步提供 Prisma migration SQL

## License

本项目源代码开放供学习与公益使用，禁止商业化付费转售。