// backend/src/services/markdownParseJob.ts

import { AIMarkdownParser } from './aiMarkdownParser';
import { createDeepSeekClient } from './deepSeekClient';
import { Paper } from '../models/Paper';
import { ParseProgress } from '../types/parseJob';
import fs from 'fs/promises';
import path from 'path';

/**
 * 内存中存储正在进行的解析任务进度
 */
const parseJobs = new Map<string, ParseProgress>();

/**
 * 启动 Markdown 解析任务
 * 
 * @param paperId - 论文ID
 * @param markdownContent - Markdown文件内容
 */
export async function startMarkdownParseJob(
  paperId: string,
  markdownContent: string
): Promise<void> {
  console.log(`\n🚀 ============================================`);
  console.log(`   [${paperId}] 开始解析任务`);
  console.log(`============================================\n`);

  // 1️⃣ 缓存原始 Markdown（用于重新解析）
  const markdownDir = path.join(__dirname, '../../data/markdown-cache');
  await fs.mkdir(markdownDir, { recursive: true });
  const markdownPath = path.join(markdownDir, `${paperId}.md`);
  
  try {
    await fs.writeFile(markdownPath, markdownContent, 'utf-8');
    console.log(`📁 已缓存原始文件: ${markdownPath}`);
  } catch (error) {
    console.error(`⚠️  缓存Markdown失败:`, error);
  }

  try {
    // 2️⃣ 更新数据库状态为"解析中"
    await Paper.update(paperId, {
      parseStatus: 'parsing',
      remarks: JSON.stringify({
        parseProgress: {
          percentage: 0,
          message: '正在启动AI解析引擎...',
          status: 'parsing',
          lastUpdate: new Date().toISOString()
        }
      })
    });

    // 3️⃣ 创建 DeepSeek 客户端
    const client = createDeepSeekClient();
    console.log(`🤖 DeepSeek 客户端已就绪`);

    // 4️⃣ 创建解析器（带进度回调）
    const parser = new AIMarkdownParser(
      paperId,
      client,
      (progress: ParseProgress) => {
        // 保存到内存（用于实时查询）
        parseJobs.set(paperId, progress);

        // 同步更新到数据库
        Paper.update(paperId, {
          remarks: JSON.stringify({
            parseProgress: {
              percentage: progress.percentage,
              message: progress.message,
              status: progress.status,
              lastUpdate: new Date().toISOString(),
              // 额外的进度信息
              currentStep: progress.currentStep,
              totalSteps: progress.totalSteps,
              chunksProcessed: progress.chunksProcessed,
              totalChunks: progress.totalChunks,
              imagesProcessed: progress.imagesProcessed,
              totalImages: progress.totalImages
            }
          })
        }).catch(err => {
          console.error(`⚠️  更新进度到数据库失败:`, err);
        });
      }
    );

    console.log(`🔧 解析器已创建，开始解析...\n`);

    // 5️⃣ 执行AI解析 - 获取 metadata 和 content
    const startTime = Date.now();
    const { metadata, content } = await parser.parse(markdownContent);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ AI解析完成! 耗时: ${duration}秒`);
    console.log(`📊 解析结果统计:`);
    console.log(`   ├─ 标题: ${metadata.title}`);
    console.log(`   ├─ 作者: ${metadata.authors?.length || 0} 人`);
    console.log(`   ├─ DOI: ${metadata.doi || '无'}`);
    console.log(`   ├─ 章节: ${content.sections.length} 个`);
    console.log(`   ├─ 参考文献: ${content.references.length} 篇`);
    console.log(`   ├─ 关键词: ${content.keywords?.length || 0} 个`);
    
    // 统计图片数量
    const figureCount = content.sections.reduce((count, section) => {
      return count + countFiguresInSection(section);
    }, 0);
    console.log(`   └─ 图片: ${figureCount} 张\n`);

    // 6️⃣ 更新数据库 - 保存 metadata
    console.log(`💾 保存元数据到数据库...`);
    await Paper.update(paperId, {
      // 元数据字段
      title: metadata.title || '未知标题',
      authors: JSON.stringify(metadata.authors || []),
      publication: metadata.publication || undefined,
      year: metadata.year || undefined,
      doi: metadata.doi || undefined,
      articleType: metadata.articleType || 'journal',
      
      // 解析状态
      parseStatus: 'completed',
      
      // 备注信息
      remarks: JSON.stringify({
        parseProgress: {
          percentage: 100,
          message: '解析完成',
          status: 'completed',
          lastUpdate: new Date().toISOString()
        },
        parseStats: {
          duration: parseFloat(duration),
          sectionsCount: content.sections.length,
          referencesCount: content.references.length,
          figuresCount: figureCount,
          keywordsCount: content.keywords?.length || 0,
          completedAt: new Date().toISOString()
        }
      })
    });
    console.log(`   ✓ 元数据已保存到数据库`);

    // 7️⃣ 保存 content 到 JSON 文件（不包含 metadata）
    console.log(`💾 保存内容到JSON文件...`);
    const jsonDir = path.join(__dirname, '../../data/papers');
    await fs.mkdir(jsonDir, { recursive: true });
    const jsonPath = path.join(jsonDir, `${paperId}.json`);
    
    await fs.writeFile(
      jsonPath,
      JSON.stringify(content, null, 2),
      'utf-8'
    );
    console.log(`   ✓ 内容已保存: ${jsonPath}`);

    // 8️⃣ 清理内存中的进度信息
    parseJobs.delete(paperId);

    console.log(`\n🎉 ============================================`);
    console.log(`   [${paperId}] 解析任务成功完成!`);
    console.log(`============================================\n`);

  } catch (error) {
    console.error(`\n❌ ============================================`);
    console.error(`   [${paperId}] 解析任务失败!`);
    console.error(`============================================`);
    console.error(`错误信息:`, error);
    console.error(`\n`);

    // 更新数据库状态为"失败"
    try {
      await Paper.update(paperId, {
        parseStatus: 'failed',
        remarks: JSON.stringify({
          parseProgress: {
            percentage: 0,
            message: `解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
            status: 'failed',
            lastUpdate: new Date().toISOString()
          },
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (updateError) {
      console.error(`⚠️  更新失败状态到数据库时出错:`, updateError);
    }

    // 清理内存中的进度信息
    parseJobs.delete(paperId);
    
    throw error;
  }
}

/**
 * 递归统计章节中的图片数量
 */
function countFiguresInSection(section: any): number {
  let count = 0;
  
  // 统计当前章节的图片
  if (section.content && Array.isArray(section.content)) {
    count += section.content.filter((block: any) => block.type === 'figure').length;
  }
  
  // 递归统计子章节的图片
  if (section.subsections && Array.isArray(section.subsections)) {
    for (const subsection of section.subsections) {
      count += countFiguresInSection(subsection);
    }
  }
  
  return count;
}

/**
 * 获取解析任务的实时进度
 * 
 * @param paperId - 论文ID
 * @returns 进度信息，如果任务不存在则返回 null
 */
export function getParseJobProgress(paperId: string): ParseProgress | null {
  return parseJobs.get(paperId) || null;
}

/**
 * 重新解析论文
 * 
 * @param paperId - 论文ID
 * @returns 如果成功启动返回 true，如果找不到原始文件返回 false
 */
export async function retryMarkdownParseJob(paperId: string): Promise<boolean> {
  console.log(`\n🔄 ============================================`);
  console.log(`   [${paperId}] 尝试重新解析`);
  console.log(`============================================\n`);

  // 检查原始 Markdown 文件是否存在
  const markdownPath = path.join(
    __dirname,
    '../../data/markdown-cache',
    `${paperId}.md`
  );
  
  try {
    // 读取缓存的 Markdown 文件
    const markdownContent = await fs.readFile(markdownPath, 'utf-8');
    console.log(`✓ 找到缓存的 Markdown 文件`);
    console.log(`📏 文件大小: ${(markdownContent.length / 1024).toFixed(2)} KB\n`);

    // 重置数据库状态
    await Paper.update(paperId, {
      parseStatus: 'pending',
      remarks: JSON.stringify({
        parseProgress: {
          percentage: 0,
          message: '准备重新解析...',
          status: 'pending',
          lastUpdate: new Date().toISOString(),
          retryAt: new Date().toISOString()
        }
      })
    });

    console.log(`✓ 状态已重置，启动解析任务...\n`);

    // 启动后台解析任务（不阻塞）
    startMarkdownParseJob(paperId, markdownContent).catch(err => {
      console.error(`❌ 重新解析任务执行失败:`, err);
    });

    return true;

  } catch (error) {
    console.error(`❌ 无法读取原始 Markdown 文件:`);
    console.error(`   文件路径: ${markdownPath}`);
    console.error(`   错误信息:`, error);
    console.error(`\n⚠️  提示: 原始文件可能已被删除，请重新上传 Markdown 文件\n`);
    
    return false;
  }
}

/**
 * 清理指定论文的解析缓存
 * 
 * @param paperId - 论文ID
 */
export async function cleanParseCache(paperId: string): Promise<void> {
  // 清理内存进度
  parseJobs.delete(paperId);
  
  // 删除缓存的 Markdown 文件
  const markdownPath = path.join(
    __dirname,
    '../../data/markdown-cache',
    `${paperId}.md`
  );
  
  try {
    await fs.unlink(markdownPath);
    console.log(`✓ 已清理解析缓存: ${paperId}`);
  } catch (error) {
    // 文件不存在或已删除，忽略错误
  }
}

/**
 * 获取所有正在解析的任务列表
 * 
 * @returns 正在解析的任务ID列表
 */
export function getActiveParseJobs(): string[] {
  return Array.from(parseJobs.keys());
}