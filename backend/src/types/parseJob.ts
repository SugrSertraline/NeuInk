// backend/src/types/parseJob.ts

/**
 * 解析任务状态
 */
export type ParseJobStatus = 
  | 'pending'      // 待处理
  | 'metadata'     // 正在提取元数据
  | 'structure'    // 正在分析结构
  | 'chunking'     // 正在分块
  | 'parsing'      // 正在解析内容
  | 'images'       // 正在处理图片
  | 'references'   // 正在解析参考文献
  | 'merging'      // 正在合并结果
  | 'saving'       // 正在保存
  | 'completed'    // 完成
  | 'failed';      // 失败

/**
 * 解析进度信息
 */
export interface ParseProgress {
  status: ParseJobStatus;
  percentage: number;           // 0-100
  message: string;              // 当前状态描述
  currentStep?: number;         // 当前步骤
  totalSteps?: number;          // 总步骤数
  chunksProcessed?: number;     // 已处理的块数
  totalChunks?: number;         // 总块数
  imagesProcessed?: number;     // 已处理的图片数
  totalImages?: number;         // 总图片数
  startTime?: number;           // 开始时间戳
  endTime?: number;             // 结束时间戳
  error?: string;               // 错误信息
}

/**
 * 解析任务结果
 */
export interface ParseJobResult {
  success: boolean;
  metadata?: {
    title: string;
    authors: any[];
    abstract?: any;
    keywords?: string[];
  };
  stats?: {
    sectionsCount: number;
    referencesCount: number;
    figuresCount: number;
    duration: number;  // 耗时（秒）
  };
  error?: string;
}

/**
 * 状态描述映射
 */
export const ParseStatusMessages: Record<ParseJobStatus, string> = {
  pending: '正在准备解析...',
  metadata: '正在提取论文元数据（标题、作者、摘要）...',
  structure: '正在分析章节结构...',
  chunking: '正在智能分块，准备并行解析...',
  parsing: '正在解析论文内容...',
  images: '正在下载并处理图片...',
  references: '正在解析参考文献...',
  merging: '正在合并解析结果...',
  saving: '正在保存到数据库...',
  completed: '解析完成！',
  failed: '解析失败'
};