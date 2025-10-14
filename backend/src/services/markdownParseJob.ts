// backend/src/services/markdownParseJob.ts

import { createDeepSeekClient } from './deepSeekClient';
import { AIMarkdownParser } from './aiMarkdownParser';
import { ParseProgress, ParseJobResult, ParseJobStatus } from '../types/parseJob';
import { Paper } from '../models/Paper';
import { metadataToRecord } from '../utils/paperMapper';
import fs from 'fs/promises';
import path from 'path';
import { ParseStatus } from '../types/paper';

/**
 * 后台解析任务管理器
 */
class MarkdownParseJobManager {
    private activeJobs: Map<string, ParseProgress> = new Map();

    /**
     * 启动解析任务（后台线程）
     */
    async startParseJob(
        paperId: string,
        markdownContent: string
    ): Promise<void> {
        // 初始化进度
        this.updateJobProgress(paperId, {
            status: 'pending',
            percentage: 0,
            message: '正在准备解析...',
            startTime: Date.now()
        });

        // 保存原始 Markdown（用于重新解析）
        await this.saveOriginalMarkdown(paperId, markdownContent).catch(err => {
            console.error(`保存原始 Markdown 失败 [${paperId}]:`, err);
        });

        // 在后台执行解析（不阻塞）
        setImmediate(() => {
            this.executeParseJob(paperId, markdownContent);
        });
    }

    /**
     * 执行解析任务（实际解析逻辑）
     */
    private async executeParseJob(
  paperId: string,
  markdownContent: string
): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log(`🚀 开始解析任务`);
    console.log(`📋 论文ID: ${paperId}`);
    console.log(`📄 内容长度: ${(markdownContent.length / 1024).toFixed(2)} KB`);
    console.log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('='.repeat(70) + '\n');

    // 更新数据库状态为 parsing
    await Paper.update(paperId, { 
      parseStatus: 'parsing'
    });

    // 创建 DeepSeek 客户端
    console.log('🔧 初始化 DeepSeek 客户端...');
    const client = createDeepSeekClient();
    console.log('✅ 客户端初始化成功\n');

    // 创建解析器（带进度回调）
    const parser = new AIMarkdownParser(
      paperId,
      client,
      (progress) => {
        // 🆕 详细进度输出
        this.logProgress(paperId, progress);
        this.updateJobProgress(paperId, progress);
      }
    );

    // 执行解析
    console.log('🎯 开始执行解析流程...\n');
    const result = await parser.parse(markdownContent);

    // 解析完成统计
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n' + '='.repeat(70));
    console.log('📊 解析完成统计');
    console.log('='.repeat(70));
    console.log(`✓ 标题: ${result.metadata?.title || '未识别'}`);
    console.log(`✓ 作者: ${result.metadata?.authors?.length || 0} 人`);
    console.log(`✓ 章节: ${result.stats?.sectionsCount || 0} 个`);
    console.log(`✓ 参考文献: ${result.stats?.referencesCount || 0} 篇`);
    console.log(`✓ 图片: ${result.stats?.figuresCount || 0} 张`);
    console.log(`✓ 总耗时: ${duration} 秒`);
    console.log('='.repeat(70) + '\n');

    // 更新元数据
    console.log('💾 正在更新数据库元数据...');
    await this.updatePaperMetadata(paperId, result.metadata);
    console.log('✅ 元数据更新完成\n');

    // 保存内容到 JSON 文件
    console.log('💾 正在保存内容到 JSON 文件...');
    await this.saveParseResult(paperId, result.content);
    console.log('✅ JSON 文件保存完成\n');

    // 更新数据库状态为 completed
    await Paper.update(paperId, { 
      parseStatus: 'completed'
    });

    // 更新最终进度
    this.updateJobProgress(paperId, {
      status: 'completed',
      percentage: 100,
      message: '解析完成！',
      endTime: Date.now()
    });

    console.log('🎉 论文解析任务完成！');
    console.log('='.repeat(70) + '\n');

    // 30秒后清理任务
    setTimeout(() => {
      this.cleanupJob(paperId);
    }, 30000);

  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.error('\n' + '='.repeat(70));
    console.error('❌ 解析失败');
    console.error('='.repeat(70));
    console.error(`📋 论文ID: ${paperId}`);
    console.error(`⏱️  已耗时: ${duration} 秒`);
    console.error(`💥 错误信息: ${error instanceof Error ? error.message : '未知错误'}`);
    if (error instanceof Error && error.stack) {
      console.error(`📍 错误堆栈:\n${error.stack}`);
    }
    console.error('='.repeat(70) + '\n');

    // 构建详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const errorDetails = this.getErrorDetails(error);

    // 更新数据库状态为 failed
    await Paper.update(paperId, { 
      parseStatus: 'failed',
      remarks: JSON.stringify({
        parseProgress: {
          percentage: 0,
          message: `解析失败: ${errorMessage}`,
          error: errorDetails,
          lastUpdate: new Date().toISOString()
        }
      })
    });

    // 更新错误进度
    this.updateJobProgress(paperId, {
      status: 'failed',
      percentage: 0,
      message: `解析失败: ${errorMessage}`,
      error: errorDetails,
      endTime: Date.now()
    });
  }
}
/**
 * 🆕 详细的进度日志输出
 */
private logProgress(paperId: string, progress: ParseProgress): void {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  const percentage = `${progress.percentage}%`.padStart(4);
  
  // 根据状态显示不同的 emoji
  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    metadata: '📝',
    structure: '🏗️',
    chunking: '✂️',
    parsing: '🔍',
    images: '🖼️',
    references: '📚',
    merging: '🔗',
    saving: '💾',
    completed: '✅',
    failed: '❌'
  };

  const emoji = statusEmoji[progress.status] || '📌';
  
  // 基础进度信息
  console.log(`[${timestamp}] ${emoji} [${percentage}] ${progress.message}`);
  
  // 详细子进度
  if (progress.status === 'parsing' && progress.totalChunks) {
    const chunkProgress = `  └─ 已处理: ${progress.chunksProcessed}/${progress.totalChunks} 块`;
    console.log(chunkProgress);
  }
  
  if (progress.status === 'images' && progress.totalImages) {
    const imageProgress = `  └─ 已处理: ${progress.imagesProcessed}/${progress.totalImages} 张图片`;
    console.log(imageProgress);
  }
  
  // 预估剩余时间
  if (progress.startTime && progress.percentage > 5 && progress.percentage < 100) {
    const elapsed = Date.now() - progress.startTime;
    const estimatedTotal = (elapsed / progress.percentage) * 100;
    const remaining = Math.round((estimatedTotal - elapsed) / 1000);
    if (remaining > 0) {
      console.log(`  └─ 预计剩余: ${remaining} 秒`);
    }
  }
}
    /**
     * 🆕 更新数据库中的元数据
     */
    private async updatePaperMetadata(paperId: string, metadata: any): Promise<void> {
        if (!metadata) return;

        try {
            const updates: any = {};

            // 标题
            if (metadata.title) {
                updates.title = metadata.title;
            }

            // 作者（转换为 JSON 字符串）
            if (metadata.authors && Array.isArray(metadata.authors)) {
                updates.authors = JSON.stringify(metadata.authors);
            }

            // 关键词（可以存储在 tags 字段）
            if (metadata.keywords && Array.isArray(metadata.keywords)) {
                updates.tags = JSON.stringify(metadata.keywords);
            }

            // 如果有更新，则执行
            if (Object.keys(updates).length > 0) {
                const recordUpdates = metadataToRecord(updates);
                await Paper.update(paperId, recordUpdates);
                console.log(`  ✓ 元数据已更新到数据库`);
            }

        } catch (error) {
            console.error(`更新元数据失败 [${paperId}]:`, error);
            // 不抛出错误，允许继续
        }
    }

    /**
     * 保存解析结果到 JSON 文件
     */
    private async saveParseResult(paperId: string, content: any): Promise<void> {
        const dataDir = path.join(__dirname, '../../data/papers');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonPath = path.join(dataDir, `${paperId}.json`);
        await fs.writeFile(
            jsonPath,
            JSON.stringify(content, null, 2),
            'utf-8'
        );

        console.log(`  ✓ 内容已保存到 JSON 文件`);
    }

    /**
     * 🆕 保存原始 Markdown
     */
    private async saveOriginalMarkdown(paperId: string, markdownContent: string): Promise<void> {
        const dataDir = path.join(__dirname, '../../data/papers/markdown');
        await fs.mkdir(dataDir, { recursive: true });

        const mdPath = path.join(dataDir, `${paperId}.md`);
        await fs.writeFile(mdPath, markdownContent, 'utf-8');

        console.log(`  ✓ 原始 Markdown 已保存（可用于重新解析）`);
    }

    /**
     * 🆕 读取原始 Markdown
     */
    private async readOriginalMarkdown(paperId: string): Promise<string | null> {
        try {
            const mdPath = path.join(__dirname, '../../data/papers/markdown', `${paperId}.md`);
            const content = await fs.readFile(mdPath, 'utf-8');
            return content;
        } catch (error) {
            console.error(`读取原始 Markdown 失败 [${paperId}]:`, error);
            return null;
        }
    }

    /**
     * 🆕 获取详细的错误信息
     */
    private getErrorDetails(error: any): string {
        if (error instanceof Error) {
            // API 错误
            if (error.message.includes('API')) {
                return '与 AI 服务通信失败，请检查网络连接和 API 配置';
            }

            // JSON 解析错误
            if (error.message.includes('JSON')) {
                return 'AI 返回的数据格式错误，可能需要调整 prompt';
            }

            // 超时错误
            if (error.message.includes('timeout')) {
                return '解析超时，建议拆分为更小的文档';
            }

            return error.message;
        }

        return '未知错误';
    }

    /**
     * 更新任务进度（同时更新数据库）
     */
    private updateJobProgress(paperId: string, progress: ParseProgress): void {
        this.activeJobs.set(paperId, progress);

        // 异步更新数据库（不阻塞）
        this.updateDatabaseProgress(paperId, progress).catch(err => {
            console.error(`更新数据库进度失败 [${paperId}]:`, err);
        });
    }

    /**
     * 更新数据库中的进度信息
     */
    private async updateDatabaseProgress(
        paperId: string,
        progress: ParseProgress
    ): Promise<void> {
        try {
            // 构建状态描述文字
            let statusText = progress.message;

            if (progress.status === 'parsing' && progress.totalChunks) {
                statusText += ` (${progress.chunksProcessed}/${progress.totalChunks})`;
            } else if (progress.status === 'images' && progress.totalImages) {
                statusText += ` (${progress.imagesProcessed}/${progress.totalImages})`;
            }

            // 计算预估剩余时间
            let estimatedTimeLeft: number | undefined;
            if (progress.startTime && progress.percentage > 0 && progress.percentage < 100) {
                const elapsed = Date.now() - progress.startTime;
                const estimatedTotal = (elapsed / progress.percentage) * 100;
                estimatedTimeLeft = Math.round((estimatedTotal - elapsed) / 1000); // 秒
            }

            // 更新 remarks 字段存储详细进度信息
            const remarksData: any = {
                parseProgress: {
                    percentage: progress.percentage,
                    message: statusText,
                    lastUpdate: new Date().toISOString()
                }
            };

            // 添加预估时间
            if (estimatedTimeLeft !== undefined && estimatedTimeLeft > 0) {
                remarksData.parseProgress.estimatedTimeLeft = estimatedTimeLeft;
            }

            // 添加错误信息
            if (progress.error) {
                remarksData.parseProgress.error = progress.error;
            }

            await Paper.update(paperId, {
                parseStatus: mapJobStatusToParseStatus(progress.status), // 🆕 使用映射函数
                remarks: JSON.stringify(remarksData)
            });

        } catch (error) {
            console.error('更新数据库进度失败:', error);
        }
    }

    /**
     * 获取任务进度
     */
    getJobProgress(paperId: string): ParseProgress | null {
        return this.activeJobs.get(paperId) || null;
    }

    /**
     * 清理完成的任务
     */
    cleanupJob(paperId: string): void {
        this.activeJobs.delete(paperId);
        console.log(`🧹 [${paperId}] 任务已清理`);
    }

    /**
     * 🆕 重新解析论文
     */
    async retryParseJob(paperId: string): Promise<boolean> {
        // 读取原始 Markdown
        const markdownContent = await this.readOriginalMarkdown(paperId);

        if (!markdownContent) {
            console.error(`无法重新解析 [${paperId}]: 未找到原始 Markdown`);
            return false;
        }

        console.log(`🔄 [${paperId}] 开始重新解析...`);

        // 清理旧的进度
        this.cleanupJob(paperId);

        // 重置数据库状态
        await Paper.update(paperId, {
            parseStatus: 'pending',
            remarks: JSON.stringify({
                parseProgress: {
                    percentage: 0,
                    message: '准备重新解析...',
                    lastUpdate: new Date().toISOString()
                }
            })
        });

        // 启动新的解析任务
        await this.startParseJob(paperId, markdownContent);
        return true;
    }
}

// 单例实例
export const parseJobManager = new MarkdownParseJobManager();

/**
 * 启动解析任务（公共接口）
 */
export async function startMarkdownParseJob(
    paperId: string,
    markdownContent: string
): Promise<void> {
    await parseJobManager.startParseJob(paperId, markdownContent);
}

/**
 * 获取解析进度（公共接口）
 */
export function getParseJobProgress(paperId: string): ParseProgress | null {
    return parseJobManager.getJobProgress(paperId);
}

/**
 * 🆕 重新解析论文（公共接口）
 */
export async function retryMarkdownParseJob(paperId: string): Promise<boolean> {
    return parseJobManager.retryParseJob(paperId);
}
/**
 * 🆕 将 ParseJobStatus 映射到数据库的 ParseStatus
 */
function mapJobStatusToParseStatus(jobStatus: ParseJobStatus): ParseStatus {
    switch (jobStatus) {
        case 'pending':
            return 'pending';
        case 'metadata':
        case 'structure':
        case 'chunking':
        case 'parsing':
        case 'images':
        case 'references':
        case 'merging':
        case 'saving':
            return 'parsing';
        case 'completed':
            return 'completed';
        case 'failed':
            return 'failed';
        default:
            return 'pending';
    }
}