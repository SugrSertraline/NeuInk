// backend/src/utils/fileSystem.ts

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// 数据存储目录
const DATA_DIR = path.join(process.cwd(), 'data');
const PAPERS_DIR = path.join(DATA_DIR, 'papers');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

/**
 * 初始化文件系统目录
 */
export async function initFileSystem() {
  console.log('正在初始化文件系统...');
  
  // 确保目录存在
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PAPERS_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  
  console.log('✅ 文件系统初始化完成！');
}

/**
 * 同步方式初始化文件系统（用于某些同步场景）
 */
export function initFileSystemSync() {
  console.log('正在初始化文件系统...');
  
  if (!fsSync.existsSync(DATA_DIR)) {
    fsSync.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fsSync.existsSync(PAPERS_DIR)) {
    fsSync.mkdirSync(PAPERS_DIR, { recursive: true });
  }
  if (!fsSync.existsSync(UPLOADS_DIR)) {
    fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  
  console.log('✅ 文件系统初始化完成！');
}

/**
 * 保存论文JSON文件
 */
export async function savePaperJSON(paperId: string, content: any): Promise<void> {
  const filePath = path.join(PAPERS_DIR, `${paperId}.json`);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
}

/**
 * 读取论文JSON文件
 */
export async function readPaperJSON(paperId: string): Promise<any> {
  const filePath = path.join(PAPERS_DIR, `${paperId}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 删除论文JSON文件
 */
export async function deletePaperJSON(paperId: string): Promise<void> {
  const filePath = path.join(PAPERS_DIR, `${paperId}.json`);
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    // 如果文件不存在，忽略错误
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * 检查论文JSON文件是否存在
 */
export async function paperJSONExists(paperId: string): Promise<boolean> {
  const filePath = path.join(PAPERS_DIR, `${paperId}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取所有论文JSON文件列表
 */
export async function listPaperJSONs(): Promise<string[]> {
  try {
    const files = await fs.readdir(PAPERS_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    return [];
  }
}

/**
 * 保存上传的文件
 */
export async function saveUploadedFile(
  filename: string,
  buffer: Buffer
): Promise<string> {
  const filePath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * 删除上传的文件
 */
export async function deleteUploadedFile(filename: string): Promise<void> {
  const filePath = path.join(UPLOADS_DIR, filename);
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * 获取上传文件的完整路径
 */
export function getUploadPath(filename: string): string {
  return path.join(UPLOADS_DIR, filename);
}

/**
 * 获取论文JSON文件的完整路径
 */
export function getPaperJSONPath(paperId: string): string {
  return path.join(PAPERS_DIR, `${paperId}.json`);
}