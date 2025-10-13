// electron/server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = false; // 生产环境
const hostname = 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;

// Next.js 应用配置
const app = next({ 
  dev,
  hostname,
  port,
  dir: __dirname  // 当前目录
});

const handle = app.getRequestHandler();

console.log('🚀 准备启动 Next.js 服务器...');

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('处理请求时出错:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`✅ Next.js 服务器运行在 http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('❌ Next.js 服务器启动失败:', err);
  process.exit(1);
});