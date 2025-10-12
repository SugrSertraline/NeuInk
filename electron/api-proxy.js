const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3000;
const BACKEND_PORT = 3001; // 后端服务端口

// 启用CORS
app.use(cors());

// 代理 API 请求到后端
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${BACKEND_PORT}`,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // 保持 /api 前缀
  },
  onError: (err, req, res) => {
    console.error('代理错误:', err);
    res.status(500).json({ error: '后端服务连接失败' });
  }
}));

// 获取前端静态文件路径
// 在打包后，静态文件在 resources/frontend 目录
const frontendPath = path.join(process.resourcesPath, 'frontend');

console.log('前端文件路径:', frontendPath);

// 提供 Next.js 静态导出的文件
app.use(express.static(frontendPath));

// 处理 Next.js 的路由 - 所有未匹配的路由返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`API代理服务器运行在 http://localhost:${PORT}`);
  console.log(`代理后端 API 到 http://localhost:${BACKEND_PORT}`);
});

// 错误处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});