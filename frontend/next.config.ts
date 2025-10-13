import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ✅ 重要：独立输出模式（用于 Electron）
  output: 'standalone',
  
  // 开启 React 严格模式
  reactStrictMode: true,
  
  // 使用 SWC 压缩
  swcMinify: true,
  
  // 构建输出目录
  distDir: '.next',
  
  // 图片配置
  images: {
    // Electron 环境下建议关闭图片优化（加快启动速度）
    unoptimized: true,
  },
  
  // TypeScript 配置
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint 配置
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // ✅ API 代理配置（将 /api 请求转发到后端）
  async rewrites() {
    const backendPort = process.env.BACKEND_PORT || '3001';
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${backendPort}/api/:path*`,
      },
    ];
  },
  
  // Webpack 配置（可选）
  webpack: (config, { isServer }) => {
    // 如果需要自定义 webpack 配置，可以在这里添加
    return config;
  },
};

export default nextConfig;