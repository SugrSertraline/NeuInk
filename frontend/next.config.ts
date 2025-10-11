import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 禁用图片优化（静态导出不支持）
  images: {
    unoptimized: true
  },
  // 设置基础路径
  basePath: '',
  // 配置API代理（仅在开发环境）
  async rewrites() {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3001/api/:path*'
        }
      ]
    }
    return [];
  },
  // 设置导出目录
  distDir: 'out',
  // 确保静态资源正确加载
  assetPrefix: '',
  // 添加 trailingSlash 以确保路由正常工作
  trailingSlash: true,
  // 禁用构建时的类型检查和 ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
