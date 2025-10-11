const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// 启动后端服务
function startBackendServer() {
  const isDev = process.env.NODE_ENV === 'development';
  const backendPath = isDev
    ? path.join(__dirname, '../../backend')
    : path.join(__dirname, '../backend');
  
  const serverFile = isDev
    ? 'src/index.ts'
    : 'dist/index.js';
    
  const command = isDev ? 'npx' : 'node';
  const args = isDev
    ? ['ts-node', serverFile]
    : [path.join(backendPath, serverFile)];
    
  console.log('启动后端服务:', { backendPath, serverFile, command, args });
  
  const backendProcess = spawn(command, args, {
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: '3001',
      NODE_ENV: isDev ? 'development' : 'production'
    }
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`后端输出: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`后端错误: ${data}`);
  });
  
  backendProcess.on('close', (code) => {
    console.log(`后端进程退出，代码: ${code}`);
  });
  
  return backendProcess;
}

// 启动后端服务
const backendProcess = startBackendServer();

// 等待后端服务启动
setTimeout(() => {
  // 配置代理
  const apiProxy = createProxyMiddleware('/api', {
    target: 'http://localhost:3001',
    changeOrigin: true,
    logLevel: 'debug'
  });
  
  // 使用代理
  app.use(apiProxy);
  
  // 静态文件服务（用于生产环境）
  if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../frontend');
    console.log('静态文件路径:', frontendPath);
    app.use(express.static(frontendPath));
    
    // 所有其他请求都返回 index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }
  
  // 启动服务器
  app.listen(PORT, () => {
    console.log(`API代理服务器已启动: http://localhost:${PORT}`);
  });
}, 3000);

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭API代理服务器...');
  if (backendProcess) {
    backendProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('正在关闭API代理服务器...');
  if (backendProcess) {
    backendProcess.kill();
  }
  process.exit(0);
});