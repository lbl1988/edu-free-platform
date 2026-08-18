/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const noopTs = path.resolve(__dirname, 'src/lib/_noop.ts');

const nextConfig = {
  reactStrictMode: true,
  // 原生模块/动态加载包在服务端保持外部依赖，避免 Next.js nft 打包遗漏 prebuilds 二进制
  serverExternalPackages: ['argon2', 'ioredis', 'minio'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    // 显式把 argon2 的预编译二进制纳入部署产物（nft 动态探测路径无法静态分析到）
    outputFileTracingIncludes: {
      '/api/**': [
        './node_modules/argon2/prebuilds/linux-x64/**',
        './node_modules/argon2/prebuilds/linux-arm64/**',
        './node_modules/argon2/prebuilds/darwin-x64/**',
        './node_modules/argon2/prebuilds/darwin-arm64/**',
      ],
    },
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
