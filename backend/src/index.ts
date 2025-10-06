// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import { initDatabase, closeDatabase } from './utils/database';
import { initFileSystem } from './utils/fileSystem';
import paperRoutes from './routes/papers';
import uploadsRouter from './routes/uploads'; 
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 路由
app.use('/api/papers', paperRoutes);
app.use('/api/uploads', uploadsRouter);  // 新增

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NeuInk Backend is running' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    // 初始化文件系统
    await initFileSystem();

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`✅ 后端服务已启动: http://localhost:${PORT}`);
      console.log(`✅ API健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n正在关闭服务器...');
  await closeDatabase();
  process.exit(0);
});

startServer();