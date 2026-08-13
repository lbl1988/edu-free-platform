import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#059669',
          dark: '#064e3b',
          light: '#0891b2',
        },
      },
    },
  },
  // 禁用 preflight 避免与 Ant Design 样式冲突
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};

export default config;
