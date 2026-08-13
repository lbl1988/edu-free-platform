import Redis, { type RedisOptions } from 'ioredis';

// 懒加载：基础设施未启动时不阻塞应用启动（仅相关功能报错）
let _client: Redis | null = null;
let _connectPromise: Promise<Redis> | null = null;
let _redisAvailable: boolean | null = null;

function getOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    keyPrefix: 'edu:',
    // 自动重连，但限制重连次数避免无限报错
    retryStrategy(times) {
      if (times > 3) {
        console.warn('[Redis] 重连次数过多，停止重连');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  };
}

export function isRedisAvailable(): boolean {
  if (_redisAvailable !== null) return _redisAvailable;
  const url = process.env.REDIS_URL;
  _redisAvailable = !!url;
  if (!_redisAvailable) {
    console.info('[Redis] REDIS_URL 未配置，Redis 功能将使用降级策略');
  }
  return _redisAvailable;
}

export function getRedis(): Redis {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available: REDIS_URL is not configured');
  }
  if (_client) return _client;
  const url = process.env.REDIS_URL!;
  _client = new Redis(url, getOptions());
  return _client;
}

/// 异步获取已连接的 Redis（首次连接复用 promise 避免并发重复连）
export async function getRedisAsync(): Promise<Redis> {
  const client = getRedis();
  if (client.status === 'ready') return client;
  if (!_connectPromise) {
    _connectPromise = client.connect().then(() => client);
    _connectPromise.catch(() => {
      _connectPromise = null; // 失败后允许重试
    });
  }
  return _connectPromise;
}

// ========== 限流：滑动窗口计数（用于 API 防刷）==========
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const redis = await getRedisAsync();
    const k = `rl:${key}`;
    const now = Date.now();
    const windowStart = now - windowSec * 1000;
    // pipeline 原子操作：移除窗口外、计数、设置过期
    const results = await redis
      .pipeline()
      .zremrangebyscore(k, 0, windowStart)
      .zadd(k, now, `${now}:${Math.random()}`)
      .zcard(k)
      .pexpire(k, windowSec * 1000)
      .exec();
    const count = results?.[2]?.[1] as number;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    // Redis 不可用时放行（降级策略，避免影响可用性）
    return { allowed: true, remaining: limit };
  }
}
