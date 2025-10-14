// backend/src/services/aiMarkdownParser.ts

import { DeepSeekClient } from './deepSeekClient';
import { ParseProgress, ParseJobStatus, ParseStatusMessages } from '../types/parseJob';
import { randomUUID } from 'crypto';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// ========== 辅助函数 ==========

/**
 * Token 估算函数
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 从文本末尾获取指定 token 数量的文本
 */
function getTextFromEnd(text: string, maxTokens: number): string {
  const estimatedChars = maxTokens * 4;
  if (text.length <= estimatedChars) {
    return text;
  }
  return text.slice(-estimatedChars);
}

/**
 * 智能语言识别
 */
function detectLanguage(text: string): 'en' | 'zh' | 'mixed' {
  if (!text || text.trim().length === 0) return 'en';
  
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;
  
  const englishChars = text.match(/[a-zA-Z]/g);
  const englishCount = englishChars ? englishChars.length : 0;
  
  const totalChars = chineseCount + englishCount;
  if (totalChars === 0) return 'en';
  
  const chineseRatio = chineseCount / totalChars;
  
  if (chineseRatio > 0.3) {
    return chineseRatio > 0.7 ? 'zh' : 'mixed';
  }
  
  return 'en';
}

/**
 * 分块信息接口
 */
interface ChunkInfo {
  content: string;
  index: number;
  startLine: number;
  endLine: number;
}

/**
 * 🆕 增强的JSON清理和解析函数
 */
function cleanAndParseJSON(jsonString: string, context: string = ''): any {
  // 1. 去除markdown代码块标记
  let cleaned = jsonString.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```\s*$/i, '');
  
  // 2. 替换各种非标准引号为标准双引号
  // 中文引号
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/['']/g, "'");
  // 其他特殊引号
  cleaned = cleaned.replace(/[‚„]/g, '"');
  cleaned = cleaned.replace(/[‹›]/g, "'");
  cleaned = cleaned.replace(/[«»]/g, '"');
  
  // 3. 修复常见的JSON格式问题
  // 移除注释（单行和多行）
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*/g, '');
  
  // 4. 尝试多种解析策略
  const strategies = [
    // 策略1: 直接解析
    () => JSON.parse(cleaned),
    
    // 策略2: 提取第一个完整的JSON对象
    () => {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      }
      throw new Error('No valid JSON object found');
    },
    
    // 策略3: 尝试修复尾部逗号问题
    () => {
      const fixed = cleaned.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(fixed);
    },
    
    // 策略4: 使用eval（最后的手段，有安全风险但在受控环境下可用）
    () => {
      // 仅在其他方法都失败时使用
      return eval('(' + cleaned + ')');
    }
  ];
  
  let lastError: Error | null = null;
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (result && typeof result === 'object') {
        return result;
      }
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }
  
  // 所有策略都失败，抛出错误
  throw new Error(`JSON parsing failed (${context}): ${lastError?.message || 'Unknown error'}`);
}

/**
 * 🆕 保存错误日志到本地
 */
async function saveErrorLog(
  paperId: string,
  stage: string,
  rawResponse: string,
  error: any,
  additionalInfo?: any
): Promise<void> {
  try {
    const errorDir = path.join(__dirname, '../../data/parse-errors');
    await fs.mkdir(errorDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${paperId}_${stage}_${timestamp}.json`;
    const filepath = path.join(errorDir, filename);
    
    const errorLog = {
      paperId,
      stage,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message || String(error),
        stack: error.stack || '',
      },
      rawResponse: rawResponse.substring(0, 10000), // 限制长度避免文件过大
      additionalInfo
    };
    
    await fs.writeFile(filepath, JSON.stringify(errorLog, null, 2), 'utf-8');
    console.log(`   ⚠️  错误日志已保存: ${filepath}`);
  } catch (saveError) {
    console.error('   ⚠️  保存错误日志失败:', saveError);
  }
}

/**
 * AI Markdown 解析器（改进版）
 */
export class AIMarkdownParser {
  private client: DeepSeekClient;
  private paperId: string;
  private progressCallback?: (progress: ParseProgress) => void;
  private documentLanguage: 'en' | 'zh' | 'mixed' = 'en';

  private readonly MAX_CHUNK_TOKENS = 6000;
  private readonly OVERLAP_TOKENS = 500;
  private readonly DELAY_BETWEEN_REQUESTS = 500;

  constructor(
    paperId: string,
    client: DeepSeekClient,
    progressCallback?: (progress: ParseProgress) => void
  ) {
    this.paperId = paperId;
    this.client = client;
    this.progressCallback = progressCallback;
  }

  /**
   * 🔄 改进的JSON解析包装器
   */
  private async safeParseJSON(
    response: string,
    stage: string,
    additionalInfo?: any
  ): Promise<any> {
    try {
      return cleanAndParseJSON(response, stage);
    } catch (error) {
      console.error(`   ❌ JSON解析失败 [${stage}]:`, error);
      
      // 保存错误日志
      await saveErrorLog(this.paperId, stage, response, error, additionalInfo);
      
      // 根据不同阶段返回不同的默认值
      switch (stage) {
        case 'metadata':
          return {
            title: '解析失败',
            authors: [],
            abstract: '',
            keywords: []
          };
        case 'structure':
          return { sections: [] };
        case 'content':
          return { blocks: [] };
        case 'references':
          return { references: [] };
        default:
          return {};
      }
    }
  }

  /**
   * 主解析入口
   */
  async parse(markdownContent: string): Promise<any> {
    const startTime = Date.now();

    try {
        console.log('\n┌─────────────────────────────────────────┐');
        console.log('│      开始 AI 解析流程 (v3-改进版)       │');
        console.log('└─────────────────────────────────────────┘\n');

        // 阶段 0: 检测文档语言
        console.log('🌐 【阶段 0/8】检测文档语言...');
        this.documentLanguage = detectLanguage(markdownContent);
        const langName = this.documentLanguage === 'zh' ? '中文' : 
                         this.documentLanguage === 'en' ? '英文' : '中英混合';
        console.log(`   ✓ 检测结果: ${langName}\n`);

        // 阶段 1: 提取元数据
        console.log('📝 【阶段 1/8】提取元数据...');
        this.updateProgress('metadata', 10);
        const metadataStart = Date.now();
        const metadata = await this.extractMetadata(markdownContent);
        const metadataDuration = ((Date.now() - metadataStart) / 1000).toFixed(1);
        console.log(`   ✓ 元数据提取完成 (耗时: ${metadataDuration}s)`);
        console.log(`   ├─ 标题: ${metadata.title || '未识别'}`);
        console.log(`   ├─ 作者: ${metadata.authors?.length || 0} 人`);
        console.log(`   └─ DOI: ${metadata.doi || '未提供'}\n`);

        // 阶段 2: 分析结构
        console.log('🏗️  【阶段 2/8】分析文档结构...');
        this.updateProgress('structure', 20);
        const structureStart = Date.now();
        const structure = await this.analyzeStructure(markdownContent);
        const structureDuration = ((Date.now() - structureStart) / 1000).toFixed(1);
        console.log(`   ✓ 结构分析完成 (耗时: ${structureDuration}s)`);
        console.log(`   └─ 识别章节: ${structure.sections?.length || 0} 个\n`);

        // 阶段 3: 智能分块
        console.log('✂️  【阶段 3/8】智能分块...');
        this.updateProgress('chunking', 25);
        const chunks = this.createIntelligentChunks(markdownContent, structure);
        console.log(`   ✓ 分块完成: 共 ${chunks.length} 块\n`);

        // 阶段 4: 解析内容块
        console.log(`🔍 【阶段 4/8】解析内容块 (共 ${chunks.length} 块)...`);
        this.updateProgress('parsing', 30, {
          totalChunks: chunks.length,
          chunksProcessed: 0
        });
        const parseStart = Date.now();
        const parsedBlocks = await this.parseChunks(chunks);
        const parseDuration = ((Date.now() - parseStart) / 1000).toFixed(1);
        console.log(`   ✓ 内容解析完成 (耗时: ${parseDuration}s)\n`);

        // 阶段 5: 合并结果
        console.log('🔗 【阶段 5/8】合并解析结果...');
        this.updateProgress('merging', 70);
        const mergedContent = this.mergeBlocks(parsedBlocks, structure);
        console.log(`   ✓ 合并完成`);
        console.log(`   ├─ 章节数: ${mergedContent.sections.length}`);
        console.log(`   └─ 图片数: ${mergedContent.figures.length}\n`);

        // 阶段 6: 解析参考文献
        console.log('📚 【阶段 6/8】解析参考文献...');
        this.updateProgress('references', 80);
        const refStart = Date.now();
        const references = await this.parseReferences(markdownContent, structure);
        const refDuration = ((Date.now() - refStart) / 1000).toFixed(1);
        console.log(`   ✓ 参考文献解析完成 (耗时: ${refDuration}s)`);
        console.log(`   └─ 文献数量: ${references.length}\n`);

        // 阶段 7: 处理图片
        console.log(`🖼️  【阶段 7/8】处理图片 (共 ${mergedContent.figures.length} 张)...`);
        this.updateProgress('images', 85, {
          totalImages: mergedContent.figures.length,
          imagesProcessed: 0
        });
        const imageStart = Date.now();
        await this.processImages(mergedContent.figures);
        const imageDuration = ((Date.now() - imageStart) / 1000).toFixed(1);
        console.log(`   ✓ 图片处理完成 (耗时: ${imageDuration}s)\n`);

        // 阶段 8: 构建最终结果
        console.log('💾 【阶段 8/8】构建最终结果...');
        this.updateProgress('saving', 95);
        
        // 🔄 构建符合要求的最终结果（不包含metadata、blockNotes、checklistNotes、attachments）
        const result = {
          abstract: metadata.abstract || { en: '', zh: '' },
          keywords: metadata.keywords || [],
          sections: mergedContent.sections,
          references: references
        };

        this.updateProgress('completed', 100);
        
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('\n┌─────────────────────────────────────────┐');
        console.log(`│   AI 解析流程完成 (总耗时: ${totalDuration}s)   │`);
        console.log('└─────────────────────────────────────────┘\n');
        
        return result;

    } catch (error) {
      console.error('\n❌ AI 解析流程失败:', error);
      
      // 保存顶级错误
      await saveErrorLog(
        this.paperId,
        'main-process',
        markdownContent.substring(0, 5000),
        error,
        { stage: 'main parse function' }
      );
      
      throw error;
    }
  }

  /**
   * 阶段1: 提取元数据（使用改进的JSON解析）
   */
  private async extractMetadata(content: string): Promise<any> {
    const preview = content.slice(0, 8000);
    const prompt = this.buildMetadataPrompt(preview);
    
    try {
      const response = await this.client.chat(
        'You are a professional academic paper metadata extraction expert.',
        prompt
      );

      const metadata = await this.safeParseJSON(response, 'metadata', { preview: preview.substring(0, 500) });
      
      return await this.cleanAndTranslateMetadata(metadata);
    } catch (error) {
      console.error('元数据提取失败:', error);
      return {
        id: this.paperId,
        title: '未能识别标题',
        authors: [],
        abstract: { en: '', zh: '' },
        keywords: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }
  
  /**
   * 清理和翻译元数据
   */
  private async cleanAndTranslateMetadata(metadata: any): Promise<any> {
    const cleaned: any = {
        id: this.paperId,
        title: metadata.title || '未知标题',
        authors: Array.isArray(metadata.authors) ? metadata.authors : [],
        abstract: { en: '', zh: '' },
        keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
        publication: metadata.publication,
        year: metadata.year,
        doi: metadata.doi,
        articleType: metadata.articleType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const abstractText = metadata.abstract || '';
    if (abstractText) {
        if (this.documentLanguage === 'zh') {
            cleaned.abstract.zh = abstractText;
        } else {
            cleaned.abstract.en = abstractText;
            try {
              cleaned.abstract.zh = await this.translateToZh(abstractText, 'abstract');
            } catch (error) {
              console.error('   ⚠️  摘要翻译失败，跳过翻译');
              cleaned.abstract.zh = '';
            }
        }
    }
    return cleaned;
  }
  
  /**
   * 翻译文本到中文
   */
  private async translateToZh(text: string, context: string = 'general'): Promise<string> {
    if (!text || text.trim().length === 0) return '';
    
    try {
        const prompt = `Translate the following academic text into Chinese.
Context: ${context}.
Rules:
1. Maintain academic and professional tone.
2. Convey the original meaning accurately.
3. Use fluent Chinese.
4. Output only the translated text, without any prefixes like "翻译：" or "Translation:".

Original Text:
${text}

Translation:`;

      const response = await this.client.chat(
        'You are a professional academic translator.',
        prompt
      );

      return response.trim();
    } catch (error) {
      console.error(`翻译失败 (${context}):`, error);
      return '';
    }
  }

  /**
   * 阶段2: 分析结构
   */
  private async analyzeStructure(content: string): Promise<any> {
    const prompt = this.buildStructurePrompt(content);
    
    try {
      const response = await this.client.chat(
        'You are a professional document structure analyzer.',
        prompt
      );

      return await this.safeParseJSON(response, 'structure');
    } catch (error) {
      console.error('结构分析失败:', error);
      return { sections: [] };
    }
  }

  /**
   * 阶段3: 智能分块
   */
  private createIntelligentChunks(content: string, structure: any): ChunkInfo[] {
    const lines = content.split('\n');
    const chunks: ChunkInfo[] = [];
    
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = estimateTokens(line);

      if (currentTokens + lineTokens > this.MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join('\n'),
          index: chunks.length,
          startLine,
          endLine: i - 1
        });

        const overlapText = getTextFromEnd(currentChunk.join('\n'), this.OVERLAP_TOKENS);
        currentChunk = overlapText.split('\n');
        currentTokens = estimateTokens(overlapText);
        startLine = i - currentChunk.length;
      }

      currentChunk.push(line);
      currentTokens += lineTokens;
    }

    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        index: chunks.length,
        startLine,
        endLine: lines.length - 1
      });
    }

    return chunks;
  }

  /**
   * 阶段4: 解析内容块
   */
  private async parseChunks(chunks: ChunkInfo[]): Promise<any[]> {
    const results: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      const progress = 30 + Math.floor((i / chunks.length) * 40);
      this.updateProgress('parsing', progress, {
        totalChunks: chunks.length,
        chunksProcessed: i
      });

      const chunkStart = Date.now();
      console.log(`   📄 [${i + 1}/${chunks.length}] 解析块 (行 ${chunk.startLine}-${chunk.endLine})...`);

      const context = i > 0 ? {
        lastBlock: results[i - 1]?.blocks?.slice(-1)[0],
        chunkIndex: i
      } : undefined;

      const prompt = this.buildContentParsePrompt(chunk.content, context);
      
      try {
        const response = await this.client.chat(
          'You are a professional academic paper content parser.',
          prompt
        );

        const parsed = await this.safeParseJSON(
          response,
          'content',
          { chunkIndex: i, startLine: chunk.startLine, endLine: chunk.endLine }
        );
        
        const chunkDuration = ((Date.now() - chunkStart) / 1000).toFixed(1);
        const blockCount = parsed.blocks?.length || 0;
        console.log(`       ✓ 完成 (${blockCount} 个元素, ${chunkDuration}s)`);
        
        if (this.documentLanguage === 'en' && parsed.blocks && parsed.blocks.length > 0) {
          console.log(`       🌐 翻译中...`);
          const translateStart = Date.now();
          await this.translateBlocks(parsed.blocks);
          const translateDuration = ((Date.now() - translateStart) / 1000).toFixed(1);
          console.log(`       ✓ 翻译完成 (${translateDuration}s)`);
        }
        
        results.push(parsed);

      } catch (error) {
        console.error(`       ✗ 解析失败:`, error instanceof Error ? error.message : error);
        results.push({ blocks: [] });
      }

      if (i < chunks.length - 1) {
        await this.sleep(this.DELAY_BETWEEN_REQUESTS);
      }
    }

    return results;
  }

  /**
   * 翻译内容块
   */
  private async translateBlocks(blocks: any[]): Promise<void> {
    for (const block of blocks) {
        try {
            if (block.content?.en && !block.content.zh) {
                const enText = this.extractTextFromInlineContent(block.content.en);
                if (enText.trim()) {
                    const zhText = await this.translateToZh(enText, 'heading title');
                    block.content.zh = this.convertTextToInlineContent(zhText);
                }
            }

            if (block.caption?.en && !block.caption.zh) {
                const enText = this.extractTextFromInlineContent(block.caption.en);
                if (enText.trim()) {
                    const zhText = await this.translateToZh(enText, `${block.type} caption`);
                    block.caption.zh = this.convertTextToInlineContent(zhText);
                }
            }

            if (block.description?.en && !block.description.zh) {
                const enText = this.extractTextFromInlineContent(block.description.en);
                if (enText.trim()) {
                    const zhText = await this.translateToZh(enText, `${block.type} description`);
                    block.description.zh = this.convertTextToInlineContent(zhText);
                }
            }
            
            if (block.items && Array.isArray(block.items)) {
                for(const item of block.items) {
                    if (item.content?.en && !item.content.zh) {
                         const enText = this.extractTextFromInlineContent(item.content.en);
                         if (enText.trim()) {
                             const zhText = await this.translateToZh(enText, `list item`);
                             item.content.zh = this.convertTextToInlineContent(zhText);
                         }
                    }
                }
            }
            
            await this.sleep(300);

        } catch (error) {
            console.error(`块翻译失败 (ID: ${block.id}):`, error);
        }
    }
  }

  /**
   * 从内联内容数组中提取纯文本
   */
  private extractTextFromInlineContent(inlineContent: any[]): string {
    if (!Array.isArray(inlineContent)) return '';
    return inlineContent
      .map(node => {
        if (node.type === 'text') return node.content;
        if (node.type === 'link' && node.children) {
          return this.extractTextFromInlineContent(node.children);
        }
        return '';
      })
      .join('');
  }

  /**
   * 将纯文本转换为内联内容数组
   */
  private convertTextToInlineContent(text: string): any[] {
    if (!text) return [];
    return [{
      type: 'text',
      content: text
    }];
  }

  /**
   * 阶段5: 合并块
   */
  private mergeBlocks(parsedBlocks: any[], structure: any): any {
    const allBlocks: any[] = [];

    for (const blockResult of parsedBlocks) {
      if (!blockResult.blocks || !Array.isArray(blockResult.blocks)) {
        continue;
      }

      for (const block of blockResult.blocks) {
        if (block.isContinuation && allBlocks.length > 0) {
          const lastBlock = allBlocks[allBlocks.length - 1];
          
          if (lastBlock.type === block.type && lastBlock.type === 'paragraph') {
            if (lastBlock.content?.en && block.content?.en) {
              lastBlock.content.en.push(...block.content.en);
            }
            if (lastBlock.content?.zh && block.content?.zh) {
              lastBlock.content.zh.push(...block.content.zh);
            }
            continue;
          }
        }

        delete block.isContinuation;
        allBlocks.push(block);
      }
    }

    const sections = this.buildSectionTree(allBlocks, structure);
    const figures = allBlocks.filter(b => b.type === 'figure');

    return { sections, figures };
  }

  /**
   * 阶段6: 解析参考文献
   */
  private async parseReferences(content: string, structure: any): Promise<any[]> {
    const refSectionText = this.extractReferencesSection(content, structure);
    
    if (!refSectionText || refSectionText.trim().length === 0) {
      console.log('   ⚠️  未找到参考文献章节');
      return [];
    }
    
    const prompt = this.buildReferencesPrompt(refSectionText);
    
    try {
      const response = await this.client.chat(
        'You are a professional academic reference parser.',
        prompt
      );

      const parsed = await this.safeParseJSON(response, 'references');
      return parsed.references || [];
    } catch (error) {
      console.error('参考文献解析失败:', error);
      return [];
    }
  }

  /**
   * 阶段7: 处理图片
   */
  private async processImages(figures: any[]): Promise<void> {
    if (figures.length === 0) {
        console.log('   ℹ️  没有图片需要处理');
        return;
    }

    for (let i = 0; i < figures.length; i++) {
        const figure = figures[i];
        
        this.updateProgress('images', 85 + Math.floor((i / figures.length) * 10), {
            totalImages: figures.length,
            imagesProcessed: i
        });

        console.log(`   🖼️  [${i + 1}/${figures.length}] 处理图片: ${figure.id}`);
        
        if (figure.src && this.isExternalUrl(figure.src)) {
            try {
                const downloadStart = Date.now();
                const localPath = await this.downloadImage(figure.src, figure.id);
                const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(1);
                
                figure.src = localPath;
                figure.uploadedFilename = path.basename(localPath);
                console.log(`       ✓ 下载成功 (${downloadDuration}s) -> ${localPath}`);
            } catch (error) {
                console.error(`       ✗ 下载失败: ${error instanceof Error ? error.message : error}`);
                console.log(`       └─ 保留原始 URL`);
            }
        } else {
            console.log(`       ℹ️  使用本地/相对路径，跳过下载`);
        }
    }
  }

  // ========== Prompt 构建方法 ==========

  private buildMetadataPrompt(content: string): string {
    return `Extract metadata from this academic paper.

# Input Content (first 8000 chars)
${content}

# Task
Extract the following fields based on the content.
1. **title**: The full title of the paper.
2. **authors**: An array of author objects. Each object must have a "name", and can optionally have "affiliation" and "email".
3. **abstract**: The complete abstract text.
4. **keywords**: An array of keyword strings.
5. **publication**: The name of the journal, conference, or publication venue.
6. **year**: The publication year as a number.
7. **doi**: The Digital Object Identifier (DOI) string, if available.
8. **articleType**: The type of article, choose from 'journal', 'conference', 'preprint', 'book', 'thesis'.

# Output Format
Output ONLY valid JSON. NO markdown code blocks. NO backticks. Start with { and end with }.
Use ONLY standard double quotes (") for all strings.

Example:
{
  "title": "Example Paper Title",
  "authors": [{"name": "First Author", "affiliation": "University"}],
  "abstract": "This is the abstract...",
  "keywords": ["keyword1", "keyword2"],
  "publication": "Journal Name",
  "year": 2025,
  "doi": "10.1234/example",
  "articleType": "journal"
}`;
  }

  private buildStructurePrompt(content: string): string {
    return `Analyze the structure of this academic paper. Identify all section headings.

# Input Content
${content}

# Output Format
Output ONLY valid JSON. NO markdown code blocks. Use ONLY standard double quotes (").

{
  "sections": [
    {
      "level": 1,
      "title": "Introduction",
      "startLine": 10,
      "endLine": 50
    }
  ]
}`;
  }

  private buildContentParsePrompt(content: string, context?: any): string {
    const contextInfo = context ?
      `This is chunk ${context.chunkIndex + 1}. Previous context provided.` :
      'This is the first chunk.';

    return `Parse this Markdown content into structured JSON blocks.

# Context
${contextInfo}
Language: ${this.documentLanguage}

# Input Markdown
${content}

# Output Rules
1. Output ONLY valid JSON. NO markdown code blocks. NO backticks.
2. Use ONLY standard double quotes (") for all strings.
3. Start with { and end with }.
4. Format: {"blocks": [...]}

# Block Types
- heading: {id, type:"heading", level:1-6, content:{en:[]}}
- paragraph: {id, type:"paragraph", content:{en:[]}}
- figure: {id, type:"figure", src:"...", caption:{en:[]}}
- math: {id, type:"math", latex:"..."}
- table: {id, type:"table", caption:{en:[]}, rows:[[]]}
- code: {id, type:"code", language:"...", code:"..."}

Example:
{"blocks":[{"id":"p1","type":"paragraph","content":{"en":[{"type":"text","content":"Hello"}]}}]}`;
  }
  
  private buildReferencesPrompt(content: string): string {
    return `Parse these academic references into JSON.

# Input
${content}

# Output Format
Output ONLY valid JSON. NO markdown blocks. Use ONLY standard double quotes (").

{
  "references": [
    {
      "id": "ref-1",
      "authors": ["Author Name"],
      "title": "Paper Title",
      "publication": "Journal",
      "year": 2024
    }
  ]
}`;
  }

  // ========== 辅助方法 ==========

  private buildSectionTree(blocks: any[], structure: any): any[] {
    const sections: any[] = [];
    let currentSection: any = null;
    let currentSubsection: any = null;
    let currentSubSubsection: any = null;

    for (const block of blocks) {
        if (block.type === 'heading') {
            const newSection = {
                id: block.id,
                number: block.number || '',
                title: {
                    en: this.extractTextFromInlineContent(block.content?.en),
                    zh: this.extractTextFromInlineContent(block.content?.zh)
                },
                content: [],
                subsections: []
            };

            if (block.level === 1) {
                sections.push(newSection);
                currentSection = newSection;
                currentSubsection = null;
                currentSubSubsection = null;
            } else if (block.level === 2 && currentSection) {
                currentSection.subsections.push(newSection);
                currentSubsection = newSection;
                currentSubSubsection = null;
            } else if (block.level === 3 && currentSubsection) {
                currentSubsection.subsections.push(newSection);
                currentSubSubsection = newSection;
            } else if (currentSubSubsection) {
                currentSubSubsection.subsections.push(newSection);
            } else if (currentSubsection) {
                 currentSubsection.subsections.push(newSection);
            } else if (currentSection) {
                currentSection.subsections.push(newSection);
            } else {
                sections.push(newSection);
                currentSection = newSection;
            }
        } else {
            if (currentSubSubsection) {
                currentSubSubsection.content.push(block);
            } else if (currentSubsection) {
                currentSubsection.content.push(block);
            } else if (currentSection) {
                currentSection.content.push(block);
            } else {
                if (sections.length === 0) {
                    const defaultSection = { 
                      id: `section-${randomUUID()}`, 
                      title: { en: '', zh: '' },
                      content: [], 
                      subsections: [] 
                    };
                    sections.push(defaultSection);
                }
                sections[sections.length - 1].content.push(block);
            }
        }
    }
    return sections;
  }
  
  private extractReferencesSection(content: string, structure: any): string | null {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^#+\s*(references|bibliography|参考文献)/i)) {
            return lines.slice(i + 1).join('\n');
        }
    }
    return null;
  }

  private isExternalUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  private async downloadImage(url: string, figureId: string): Promise<string> {
    const imageDir = path.join(__dirname, '../../data/uploads/images', this.paperId);
    await fs.mkdir(imageDir, { recursive: true });

    let ext = '.jpg';
    try {
        const parsedUrl = new URL(url);
        ext = path.extname(parsedUrl.pathname) || '.jpg';
    } catch (e) {
        console.warn(`无效的图片URL: ${url}`);
    }

    const filename = `${figureId}${ext}`;
    const localPath = path.join(imageDir, filename);

    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    await fs.writeFile(localPath, response.data);
    return `/uploads/images/${this.paperId}/${filename}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateProgress(
    status: ParseJobStatus, 
    percentage: number,
    extra?: Partial<ParseProgress>
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        status,
        percentage,
        message: ParseStatusMessages[status],
        ...extra
      });
    }
  }
}

// ========== 导出的辅助函数 ==========

export interface ParsedMarkdownInfo {
  title?: string;
  authors?: string[];
  abstract?: string;
  keywords?: string[];
  content: string;
}

export function parseMarkdownContent(markdownContent: string): ParsedMarkdownInfo {
  let title = '未知标题';
  const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  const authors: string[] = [];
  const authorMatch = markdownContent.match(/^##?\s*(?:Author|作者)[s:]?\s*(.+)$/mi);
  if (authorMatch && authorMatch[1]) {
    const authorText = authorMatch[1].trim();
    authors.push(...authorText.split(/[,，;；]/).map(a => a.trim()).filter(Boolean));
  }

  let abstract = '';
  const abstractMatch = markdownContent.match(/^##?\s*(?:Abstract|摘要)\s*\n+(.+?)(?=\n#|$)/mis);
  if (abstractMatch && abstractMatch[1]) {
    abstract = abstractMatch[1].trim();
  }

  const keywords: string[] = [];
  const keywordsMatch = markdownContent.match(/^##?\s*(?:Keywords?|关键词)[:]?\s*(.+)$/mi);
  if (keywordsMatch && keywordsMatch[1]) {
    const keywordsText = keywordsMatch[1].trim();
    keywords.push(...keywordsText.split(/[,，;；]/).map(k => k.trim()).filter(Boolean));
  }

  return {
    title,
    authors: authors.length > 0 ? authors : ['未知作者'],
    abstract: abstract || '暂无摘要',
    keywords: keywords.length > 0 ? keywords : [],
    content: markdownContent
  };
}

export function validateMarkdownFile(filename: string, content: string): { valid: boolean; error?: string } {
  const validExtensions = ['.md', '.markdown'];
  const fileExtension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  
  if (!validExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: '只支持 .md 或 .markdown 格式的文件'
    };
  }

  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      error: 'Markdown 文件内容不能为空'
    };
  }

  if (content.length > 2 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Markdown 文件过大，请确保文件小于 2MB'
    };
  }

  return { valid: true };
}