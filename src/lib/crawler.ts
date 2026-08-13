/**
 * 课程内容采集引擎
 *
 * 支持三种采集方式：
 * 1. RSS/Atom 订阅源 — 解析 <item>/<entry> 标签
 * 2. JSON API — 按 JSONPath 取数据数组
 * 3. HTML 页面 — 用正则提取标题/链接/描述
 *
 * 合规措施：
 * - robots.txt 检查（可配置关闭）
 * - 请求间速率限制（rateLimitMs）
 * - User-Agent 标识
 * - 去重（sourceUrl 唯一）
 */

import { prisma } from './prisma';
import type { ContentSource, CrawlJob } from '@prisma/client';

// ========== 类型定义 ==========

export interface CrawledItem {
  title: string;
  url: string;
  description?: string;
  coverUrl?: string;
  duration?: number;
  author?: string;
  publishedAt?: Date;
  extra?: Record<string, unknown>;
}

export interface CrawlResult {
  items: CrawledItem[];
  rawCount: number;
  log: string[];
}

// ========== 工具函数 ==========

const CRAWLER_UA = 'EduFreeCrawler/1.0 (Educational Public Welfare Platform; +https://github.com/lbl1988/Website-Design-Architecture)';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * 简易 robots.txt 检查
 * 获取 /robots.txt 并解析 Disallow 规则
 */
async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const resp = await fetch(robotsUrl, {
      headers: { 'User-Agent': CRAWLER_UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return true; // 没有 robots.txt 默认允许
    const text = await resp.text();
    // 极简解析：找到 User-agent: * 段，检查 Disallow
    const lines = text.split('\n');
    let inUniversal = false;
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith('user-agent:')) {
        inUniversal = trimmed.includes('*');
        continue;
      }
      if (inUniversal && trimmed.startsWith('disallow:')) {
        const path = trimmed.slice('disallow:'.length).trim();
        if (path === '/' || path === '') continue; // 根目录 disallow 才阻止
        // 检查目标 URL 是否匹配
        if (path !== '/' && new URL(baseUrl).pathname.startsWith(path)) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return true; // 获取失败默认允许
  }
}

// ========== RSS/Atom 解析器 ==========

function parseRss(xml: string): CrawledItem[] {
  const items: CrawledItem[] = [];

  // RSS 2.0: <item>...</item>
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;

  const blocks = xml.match(itemRegex) || xml.match(entryRegex) || [];

  for (const block of blocks) {
    const getTag = (tag: string): string | undefined => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return m ? m[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : undefined;
    };

    const title = getTag('title');
    const link = getTag('link') || getTag('guid');
    const description = getTag('description') || getTag('summary');
    const pubDate = getTag('pubDate') || getTag('published') || getTag('updated');
    const author = getTag('author') || getTag('dc:creator');
    const enclosure = /<enclosure[^>]*url="([^"]+)"/i.exec(block);

    if (title && link) {
      items.push({
        title: truncate(title, 200),
        url: link,
        description: description ? truncate(description.replace(/<[^>]+>/g, ''), 500) : undefined,
        coverUrl: enclosure?.[1],
        author: author || undefined,
        publishedAt: pubDate ? new Date(pubDate) : undefined,
      });
    }
  }

  return items;
}

// ========== JSON API 解析器 ==========

function parseJsonApi(
  data: any,
  config: Record<string, string>,
): CrawledItem[] {
  const items: CrawledItem[] = [];

  // 按 dataPath 找到数组（支持点号路径，如 data.items）
  const dataPath = config.dataPath || 'data';
  let arr: any[] = [];
  try {
    const parts = dataPath.split('.');
    let cur = data;
    for (const p of parts) {
      cur = cur?.[p];
    }
    arr = Array.isArray(cur) ? cur : [];
  } catch {
    arr = [];
  }

  for (const row of arr) {
    const title = row[config.titleField || 'title'];
    const url = row[config.urlField || 'url'] || row[config.urlField || 'link'];
    if (!title || !url) continue;

    items.push({
      title: truncate(String(title), 200),
      url: String(url),
      description: row[config.descField || 'description']
        ? truncate(String(row[config.descField || 'description']).replace(/<[^>]+>/g, ''), 500)
        : undefined,
      coverUrl: row[config.coverField || 'coverUrl'] || row[config.coverField || 'thumbnail'],
      duration: row[config.durationField || 'duration'] || undefined,
      author: row[config.authorField || 'author'] || undefined,
      publishedAt: row[config.dateField || 'publishedAt']
        ? new Date(row[config.dateField || 'publishedAt'])
        : undefined,
    });
  }

  return items;
}

// ========== HTML 解析器 ==========

function parseHtml(html: string, config: Record<string, string>): CrawledItem[] {
  const items: CrawledItem[] = [];

  // 按 config.itemSelector 提取条目块（正则模式）
  // 默认提取 <a> 标签中的标题和链接
  const linkPattern = config.linkPattern || /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const matches = html.matchAll(linkPattern instanceof RegExp ? linkPattern : new RegExp(linkPattern, 'gi'));

  const baseUrl = config.baseUrl || '';

  for (const m of matches) {
    let url = m[1];
    const title = m[2]?.trim();

    // 相对 URL 转绝对
    if (url && !url.startsWith('http') && baseUrl) {
      try {
        url = new URL(url, baseUrl).href;
      } catch {
        continue;
      }
    }

    if (title && url && title.length > 2) {
      // 过滤导航类链接
      if (/^(首页|登录|注册|更多|关于|联系|搜索)$/.test(title)) continue;
      items.push({
        title: truncate(title, 200),
        url,
      });
    }
  }

  return items;
}

// ========== 核心采集逻辑 ==========

/**
 * 执行单个采集源的抓取
 */
export async function crawlSource(source: ContentSource): Promise<CrawlResult> {
  const log: string[] = [];
  const config = (source.parseConfig as Record<string, string>) || {};

  log.push(`[${new Date().toISOString()}] 开始采集: ${source.name} (${source.url})`);

  // 1. robots.txt 检查
  if (source.respectRobots) {
    const allowed = await checkRobotsTxt(source.url);
    if (!allowed) {
      log.push('robots.txt 禁止采集此路径，跳过');
      return { items: [], rawCount: 0, log };
    }
    log.push('robots.txt 检查通过');
  }

  // 2. 抓取页面内容
  await sleep(source.rateLimitMs); // 速率限制

  let response: Response;
  try {
    response = await fetch(source.url, {
      headers: {
        'User-Agent': CRAWLER_UA,
        Accept: source.sourceType === 'JSON_API' ? 'application/json' : 'text/html, application/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
  } catch (err: any) {
    log.push(`请求失败: ${err.message}`);
    throw new Error(`Fetch error: ${err.message}`);
  }

  if (!response.ok) {
    log.push(`HTTP ${response.status} ${response.statusText}`);
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  log.push(`获取内容 ${text.length} 字节, Content-Type: ${contentType}`);

  // 3. 解析内容
  let items: CrawledItem[] = [];

  if (source.sourceType === 'RSS' || contentType.includes('xml') || text.includes('<rss') || text.includes('<feed')) {
    items = parseRss(text);
    log.push(`RSS 解析完成, 发现 ${items.length} 条`);
  } else if (source.sourceType === 'JSON_API' || contentType.includes('json')) {
    try {
      const json = JSON.parse(text);
      items = parseJsonApi(json, config);
      log.push(`JSON API 解析完成, 发现 ${items.length} 条`);
    } catch {
      log.push('JSON 解析失败');
      throw new Error('Invalid JSON response');
    }
  } else {
    // HTML_SCRAPING
    config.baseUrl = source.url;
    items = parseHtml(text, config);
    log.push(`HTML 解析完成, 发现 ${items.length} 条`);
  }

  return { items, rawCount: items.length, log };
}

/**
 * 将采集到的条目入库（去重 + 更新）
 * 需要 systemUserId 作为 teacherId（课程必须有教师）
 */
export async function persistCrawledItems(
  items: CrawledItem[],
  source: ContentSource,
  systemUserId: string,
): Promise<{ added: number; updated: number; skipped: number }> {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  // 确定课程归属参数
  const subjectId = source.subjectId;
  const grade = source.grade || 1;
  const boardType = 'CLASSROOM' as const;

  for (const item of items) {
    if (!item.url || !item.title) {
      skipped++;
      continue;
    }

    try {
      // 去重：按 sourceUrl 查找已有课程
      const existing = await prisma.course.findFirst({
        where: { sourceUrl: item.url },
      });

      if (existing) {
        // 更新（仅更新可变字段）
        await prisma.course.update({
          where: { id: existing.id },
          data: {
            title: item.title,
            intro: item.description || existing.intro,
            coverUrl: item.coverUrl || existing.coverUrl,
            status: 'PUBLISHED',
            sourceName: source.name,
          },
        });
        updated++;
      } else {
        // 新增
        await prisma.course.create({
          data: {
            title: item.title,
            teacherId: systemUserId,
            grade,
            subjectId: subjectId || 1,
            boardType,
            status: 'PUBLISHED',
            intro: item.description,
            coverUrl: item.coverUrl,
            sourceUrl: item.url,
            sourceName: source.name,
          },
        });
        added++;
      }
    } catch (err) {
      skipped++;
    }
  }

  return { added, updated, skipped };
}

/**
 * 执行一次完整的采集任务（含入库 + 日志记录）
 */
export async function executeCrawlJob(
  source: ContentSource,
  systemUserId: string,
  trigger: 'MANUAL' | 'SCHEDULED' = 'MANUAL',
): Promise<CrawlJob> {
  // 创建任务记录
  const job = await prisma.crawlJob.create({
    data: {
      sourceId: source.id,
      status: 'RUNNING',
      trigger,
    },
  });

  const allLogs: string[] = [];

  try {
    const result = await crawlSource(source);
    allLogs.push(...result.log);

    // 入库
    const persistResult = await persistCrawledItems(result.items, source, systemUserId);
    allLogs.push(
      `入库完成: 新增 ${persistResult.added}, 更新 ${persistResult.updated}, 跳过 ${persistResult.skipped}`,
    );

    // 更新任务记录
    const completed = await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: persistResult.added > 0 || persistResult.updated > 0 ? 'SUCCESS' : 'PARTIAL',
        completedAt: new Date(),
        itemsFound: result.rawCount,
        itemsAdded: persistResult.added,
        itemsUpdated: persistResult.updated,
        itemsSkipped: persistResult.skipped,
        log: truncate(allLogs.join('\n'), 5000),
      },
    });

    // 更新采集源统计
    await prisma.contentSource.update({
      where: { id: source.id },
      data: {
        lastCrawledAt: new Date(),
        lastCrawlJobId: job.id,
        totalCrawled: { increment: persistResult.added },
        status: 'ACTIVE',
      },
    });

    return completed;
  } catch (err: any) {
    allLogs.push(`采集失败: ${err.message}`);

    const failed = await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: truncate(err.message, 1000),
        log: truncate(allLogs.join('\n'), 5000),
      },
    });

    // 标记采集源为错误状态
    await prisma.contentSource.update({
      where: { id: source.id },
      data: { status: 'ERROR' },
    });

    return failed;
  }
}

/**
 * 批量执行到期采集源的自动采集
 * 由定时任务调用
 */
export async function runScheduledCrawl(systemUserId: string): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  details: Array<{ sourceName: string; status: string; added: number }>;
}> {
  // 查找到期的活跃采集源
  const now = new Date();
  const sources = await prisma.contentSource.findMany({
    where: {
      status: { in: ['ACTIVE', 'ERROR'] },
    },
  });

  const due = sources.filter((s) => {
    if (!s.lastCrawledAt) return true;
    const hoursSince = (now.getTime() - s.lastCrawledAt.getTime()) / (1000 * 60 * 60);
    return hoursSince >= s.crawlIntervalHours;
  });

  let succeeded = 0;
  let failed = 0;
  const details: Array<{ sourceName: string; status: string; added: number }> = [];

  for (const source of due) {
    try {
      const job = await executeCrawlJob(source, systemUserId, 'SCHEDULED');
      if (job.status === 'SUCCESS' || job.status === 'PARTIAL') {
        succeeded++;
      } else {
        failed++;
      }
      details.push({
        sourceName: source.name,
        status: job.status,
        added: job.itemsAdded,
      });
    } catch {
      failed++;
      details.push({ sourceName: source.name, status: 'FAILED', added: 0 });
    }
  }

  return { processed: due.length, succeeded, failed, details };
}
