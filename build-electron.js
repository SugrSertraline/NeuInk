const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('开始构建 NeuInk Electron 应用...');

try {
  // 构建后端
  console.log('构建后端...');
  execSync('cd backend && npm run build', { stdio: 'inherit' });

  // 构建前端
  console.log('构建前端...');
  execSync('cd frontend && npm run build', { stdio: 'inherit' });

  // 构建 Electron 应用
  console.log('构建 Electron 应用...');
  execSync('cd electron && npm run build', { stdio: 'inherit' });

  console.log('构建完成！安装包位于 electron/dist/ 目录下');
} catch (error) {
  console.error('构建过程中出现错误:', error.message);
  process.exit(1);
}