// backend/src/index.ts

// 🔥 关键：必须在所有其他导入之前加载环境变量！
import dotenv from 'dotenv';
dotenv.config();

// ✅ 现在才能导入其他模块
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase, closeDatabase } from './utils/database';
import { initFileSystem } from './utils/fileSystem';
import paperRoutes from './routes/papers';
import uploadsRouter from './routes/uploads';
import checklistRoutes from './routes/checklists';

const app = express();
const PORT = process.env.PORT || 3001;

// ============ 环境变量验证 ============
console.log('\n' + '═'.repeat(60));
console.log('🔧 环境变量检查');
console.log('═'.repeat(60));
console.log(`   PORT: ${process.env.PORT || '3001 (默认)'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development (默认)'}`);

console.log('═'.repeat(60) + '\n');

// ============ 中间件 ============
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务（用于访问上传的PDF）
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// ============ 路由 ============
app.use('/api/papers', paperRoutes);
app.use('/api/uploads', uploadsRouter);
app.use('/api/checklists', checklistRoutes);

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'NeuInk Backend is running',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT
    }
  });
});

// ============ 404处理 ============
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `接口不存在: ${req.method} ${req.path}`
  });
});

// ============ 错误处理 ============
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('\n❌ 服务器错误:');
  console.error(`   路径: ${req.method} ${req.path}`);
  console.error(`   错误: ${err.message}`);
  if (err.stack) {
    console.error(`   堆栈:\n${err.stack}`);
  }
  console.error('');
  
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

// ============ 启动服务器 ============
async function startServer() {
  try {
    console.log('🚀 正在启动服务器...\n');

    // 1. 初始化数据库
    console.log('📊 初始化数据库...');
    await initDatabase();
    console.log('   ✓ 数据库初始化完成\n');
    
    // 2. 初始化文件系统
    console.log('📁 初始化文件系统...');
    await initFileSystem();
    console.log('   ✓ 文件系统初始化完成\n');
    

    // 4. 启动HTTP服务器
    app.listen(PORT, () => {
      console.log('═'.repeat(60));
      console.log('✅ 服务器启动成功！');
      console.log('═'.repeat(60));
      console.log(`   🌐 服务地址: http://localhost:${PORT}`);
      console.log(`   🏥 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`   📚 论文接口: http://localhost:${PORT}/api/papers`);
      console.log(`   📋 清单接口: http://localhost:${PORT}/api/checklists`);
      console.log(`   📤 上传接口: http://localhost:${PORT}/api/uploads`);
      console.log(`   🌍 环境模式: ${process.env.NODE_ENV || 'development'}`);
      console.log('═'.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('\n❌ 服务器启动失败:');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

// ============ 优雅关闭 ============
async function gracefulShutdown(signal: string) {
  console.log(`\n\n📡 收到 ${signal} 信号`);
  console.log('🔄 正在优雅关闭服务器...\n');
  
  try {
    console.log('   📊 关闭数据库连接...');
    await closeDatabase();
    console.log('   ✓ 数据库已关闭\n');
    
    console.log('✅ 服务器已安全关闭');
    process.exit(0);
  } catch (error) {
    console.error('❌ 关闭过程中出错:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ============ 未捕获异常处理 ============
process.on('uncaughtException', (error) => {
  console.error('\n💥 未捕获的异常:');
  console.error(error);
  console.error('\n服务器将退出...\n');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 未处理的Promise拒绝:');
  console.error('原因:', reason);
  console.error('Promise:', promise);
  console.error('\n');
});

// 启动
startServer(); 