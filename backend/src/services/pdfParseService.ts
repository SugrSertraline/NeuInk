// backend/src/services/pdfParseService.ts

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Paper } from '../models/Paper';
import { PDFConverterService } from './pdfConverterService';

// 解析任务状态
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ParseJob {
  id: string;
  paperId: string;
  pdfPath: string;
  status: JobStatus;
  error?: string;
  progress?: number;
  currentStep?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

class PDFParseService {
  private jobs: Map<string, ParseJob> = new Map();
  private processingQueue: string[] = [];
  private isProcessing = false;
  private pdfConverter: PDFConverterService | null = null;
  private initialized = false;

  /**
   * 延迟初始化（首次使用时才初始化）
   */
  private ensureInitialized() {
    if (this.initialized) return;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      console.error('\n❌ PDF解析服务初始化失败');
      console.error('   原因: 未设置 DEEPSEEK_API_KEY 环境变量');
      console.error('   解决: 在 .env 文件中添加: DEEPSEEK_API_KEY=sk-your-key\n');
      this.initialized = true;
      return;
    }

    try {
      // 🆕 注意：不在这里创建 PDFConverterService，在每个任务中创建
      // 因为需要传递进度回调
      const maskedKey = `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`;
      console.log('✅ PDF解析服务已就绪');
      console.log(`   API Key: ${maskedKey}`);
    } catch (error) {
      console.error('❌ PDF解析服务初始化失败:', error);
    }

    this.initialized = true;
  }

  /**
   * 创建解析任务
   */
  async createParseJob(paperId: string, pdfPath: string): Promise<string> {
    this.ensureInitialized();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('PDF转换服务不可用，请检查 DEEPSEEK_API_KEY 环境变量是否正确设置');
    }

    const jobId = randomUUID();
    const job: ParseJob = {
      id: jobId,
      paperId,
      pdfPath,
      status: 'pending',
      progress: 0,
      currentStep: '等待处理',
      createdAt: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push(jobId);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 [PDF解析] 新建解析任务`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   任务ID: ${jobId}`);
    console.log(`   论文ID: ${paperId}`);
    console.log(`   PDF路径: ${pdfPath}`);
    console.log(`   队列位置: ${this.processingQueue.length}`);
    console.log(`${'='.repeat(60)}\n`);

    // 启动处理队列（非阻塞）
    setImmediate(() => this.processQueue());

    return jobId;
  }

  /**
   * 处理解析队列
   */
  private async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const jobId = this.processingQueue.shift();

    if (jobId) {
      await this.processJob(jobId);
    }

    this.isProcessing = false;

    // 继续处理队列中的下一个任务
    if (this.processingQueue.length > 0) {
      console.log(`\n⏭️  队列中还有 ${this.processingQueue.length} 个任务等待处理...\n`);
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * 处理单个解析任务
   */
  private async processJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const startTime = Date.now();

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 [PDF解析] 开始处理任务`);
      console.log(`${'='.repeat(60)}`);
      console.log(`   任务ID: ${jobId}`);
      console.log(`   论文ID: ${job.paperId}`);
      console.log(`   开始时间: ${new Date().toLocaleString('zh-CN')}`);
      console.log(`${'='.repeat(60)}\n`);

      job.status = 'processing';
      job.startedAt = new Date().toISOString();

      // ============ 步骤1: 验证文件 ============
      await this.updateJobProgress(jobId, 0, '🔍 验证PDF文件');
      await fs.access(job.pdfPath);
      const stats = await fs.stat(job.pdfPath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ 文件验证成功 (${fileSizeMB} MB)`);

      // ============ 步骤2: 创建转换器并开始转换 ============
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY 未配置');
      }

      // 🎯 创建带进度回调的转换器
      const pdfConverter = new PDFConverterService({
        apiKey,
        chunkSize: 1,
        contextOverlap: 500,
        onProgress: async (progress: number, message: string) => {
          // 🔥 实时更新进度到数据库
          await this.updateJobProgress(jobId, progress, message);
        }
      });

      const originalName = path.basename(job.pdfPath);
      const paperContent = await pdfConverter.convertPDF(job.pdfPath, originalName);

      // ============ 步骤3: 保存解析结果 ============
      await this.updateJobProgress(jobId, 98, '💾 正在保存解析结果');
      await this.saveContent(job.paperId, paperContent);
      console.log('✅ 解析结果已保存');

      // ============ 步骤4: 更新论文状态 ============
      await this.updateJobProgress(jobId, 99, '🔄 正在更新论文状态');
      await Paper.update(job.paperId, { parseStatus: 'completed' });

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.progress = 100;
      job.currentStep = '✅ 解析完成';

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ [PDF解析] 任务完成`);
      console.log(`${'='.repeat(60)}`);
      console.log(`   任务ID: ${jobId}`);
      console.log(`   论文ID: ${job.paperId}`);
      console.log(`   总耗时: ${elapsedTime} 秒`);
      console.log(`   章节数: ${paperContent.sections?.length || 0}`);
      console.log(`   参考文献: ${paperContent.references?.length || 0}`);
      console.log(`   关键词: ${paperContent.keywords?.length || 0}`);
      console.log(`   完成时间: ${new Date().toLocaleString('zh-CN')}`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (error) {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      console.log(`\n${'='.repeat(60)}`);
      console.error(`❌ [PDF解析] 任务失败`);
      console.log(`${'='.repeat(60)}`);
      console.error(`   任务ID: ${jobId}`);
      console.error(`   论文ID: ${job.paperId}`);
      console.error(`   错误信息: ${errorMessage}`);
      console.error(`   已耗时: ${elapsedTime} 秒`);
      console.log(`${'='.repeat(60)}\n`);

      job.status = 'failed';
      job.error = errorMessage;
      job.completedAt = new Date().toISOString();

      // 更新论文状态为解析失败
      try {
        await Paper.update(job.paperId, { 
          parseStatus: `failed: ${errorMessage}` 
        });
      } catch (updateError) {
        console.error(`⚠️ 更新论文状态失败:`, updateError);
      }
    }
  }

  /**
   * 🆕 更新任务进度（同步到数据库和内存）
   */
  private async updateJobProgress(jobId: string, progress: number, message: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // 更新内存中的任务状态
    job.progress = progress;
    job.currentStep = message;
    
    // 生成进度条
    const progressBar = this.getProgressBar(progress);
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    
    // 命令行输出
    console.log(`[${timestamp}] ${progressBar} ${progress}% | ${message}`);
    
    // 🔥 实时同步到数据库（只有解析中才更新，完成状态在外部设置）
    if (progress < 100) {
      const statusText = `${progress}% ${message}`;
      try {
        await Paper.update(job.paperId, { parseStatus: statusText });
      } catch (error) {
        console.error(`⚠️ 更新解析状态失败:`, error);
      }
    }
  }

  /**
   * 生成进度条字符串
   */
  private getProgressBar(progress: number): string {
    const totalBars = 25;
    const filledBars = Math.round((progress / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}]`;
  }

  /**
   * 保存解析内容到JSON文件
   */
  private async saveContent(paperId: string, content: any): Promise<void> {
    const dataDir = path.join(__dirname, '../../data/papers');
    await fs.mkdir(dataDir, { recursive: true });
    
    const jsonPath = path.join(dataDir, `${paperId}.json`);
    
    const fullContent = {
      abstract: content.abstract,
      keywords: content.keywords,
      sections: content.sections,
      references: content.references,
      blockNotes: content.blockNotes || [],
      checklistNotes: content.checklistNotes || [],
      attachments: []
    };
    
    await fs.writeFile(
      jsonPath, 
      JSON.stringify(fullContent, null, 2), 
      'utf-8'
    );
    
    console.log(`💾 内容已保存到: ${jsonPath}`);
  }

  /**
   * 根据论文ID获取任务
   */
  getJobByPaperId(paperId: string): ParseJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.paperId === paperId) {
        return job;
      }
    }
    return undefined;
  }

  /**
   * 获取任务状态
   */
  getJob(jobId: string): ParseJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * 获取所有任务
   */
  getAllJobs(): ParseJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      totalJobs: this.jobs.size,
      pendingJobs: this.processingQueue.length,
      isProcessing: this.isProcessing,
      jobs: this.getAllJobs()
    };
  }
}

// 导出单例
export const pdfParseService = new PDFParseService();