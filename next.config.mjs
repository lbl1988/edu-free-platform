/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const noopTs = path.resolve(__dirname, 'src/lib/_noop.ts');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 客户端构建：把会引入 node 原生模块的服务端专有包统一替换成空实现，
      // 避免 webpack 报 "node:xxx scheme not handled" 或 external 语法拼接错
      config.resolve.alias = {
        ...config.resolve.alias,
        argon2: noopTs,
        ioredis: noopTs,
        minio: noopTs,
        '@prisma/client': noopTs,
        '@prisma/client/runtime/library': noopTs,
        '@prisma/client/runtime/binary': noopTs,
        prisma: noopTs,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
