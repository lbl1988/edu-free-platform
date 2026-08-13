/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 服务端运行时无需 Node 运行时 polyfill；启用 experimental.serverActions 兼容
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Ant Design 按需加载已内置，无需 transpilePackages
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
