// backend/src/services/aiMarkdownParser.ts

import { DeepSeekClient } from './deepSeekClient';
import { MarkupParser } from './markupParser';
import { ParseProgress, ParseJobStatus, ParseStatusMessages } from '../types/parseJob';
import { BlockContent, Section, Reference } from '../types/paper';
import { randomUUID } from 'crypto';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// ========== 辅助函数 ==========

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

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

interface ChunkInfo {
  content: string;
  index: number;
  startLine: number;
  endLine: number;
  lastSentence?: string; // 上一个块的最后一句
}

/**
 * AI Markdown 解析器（优化版）
 */
export class AIMarkdownParser {
  private client: DeepSeekClient;
  private markupParser: MarkupParser;
  private paperId: string;
  private progressCallback?: (progress: ParseProgress) => void;
  private documentLanguage: 'en' | 'zh' | 'mixed' = 'en';
  private usedIds: Set<string> = new Set(); // 追踪已使用的ID

  private readonly MAX_CHUNK_TOKENS = 2000;
  private readonly OVERLAP_TOKENS = 300;
  private readonly DELAY_BETWEEN_REQUESTS = 1000;
  private readonly MAX_RESPONSE_TOKENS = 8000;

  constructor(
    paperId: string,
    client: DeepSeekClient,
    progressCallback?: (progress: ParseProgress) => void
  ) {
    this.paperId = paperId;
    this.client = client;
    this.markupParser = new MarkupParser();
    this.progressCallback = progressCallback;
  }

  /**
   * 生成唯一ID
   */
  private generateUniqueId(prefix: string = ''): string {
    let id: string;
    do {
      id = prefix ? `${prefix}-${randomUUID()}` : randomUUID();
    } while (this.usedIds.has(id));
    
    this.usedIds.add(id);
    return id;
  }

  /**
   * 主解析入口
   */
  async parse(markdownContent: string): Promise<{
    metadata: any;
    content: {
      abstract?: { en?: string; zh?: string };
      keywords: string[];
      sections: Section[];
      references: Reference[];
      blockNotes: any[];
      checklistNotes: any[];
      attachments: string[];
    };
  }> {
    const startTime = Date.now();

    try {
      console.log('\n┌─────────────────────────────────────────┐');
      console.log('│    开始 AI 解析流程 (优化版)           │');
      console.log('└─────────────────────────────────────────┘\n');

      // 阶段 0: 检测文档语言
      console.log('🌐 【阶段 0/8】检测文档语言...');
      this.documentLanguage = detectLanguage(markdownContent);
      const langName = this.documentLanguage === 'zh' ? '中文' : 
                       this.documentLanguage === 'en' ? '英文' : '中英混合';
      console.log(`   ✓ 检测结果: ${langName}\n`);

      // 阶段 1: 提取元数据（标题、作者、DOI等）
      console.log('📝 【阶段 1/8】提取元数据...');
      this.updateProgress('metadata', 10);
      const metadataStart = Date.now();
      const metadata = await this.extractMetadata(markdownContent);
      const metadataDuration = ((Date.now() - metadataStart) / 1000).toFixed(1);
      console.log(`   ✓ 元数据提取完成 (耗时: ${metadataDuration}s)`);
      console.log(`   ├─ 标题: ${metadata.title || '未识别'}`);
      console.log(`   ├─ 作者: ${metadata.authors?.length || 0} 人`);
      console.log(`   └─ DOI: ${metadata.doi || '未提供'}\n`);

      // 阶段 2: 提取摘要和关键词
      console.log('📄 【阶段 2/8】提取摘要和关键词...');
      this.updateProgress('metadata', 15);
      const abstractStart = Date.now();
      const { abstract, keywords, abstractEndLine } = await this.extractAbstractAndKeywords(markdownContent);
      const abstractDuration = ((Date.now() - abstractStart) / 1000).toFixed(1);
      console.log(`   ✓ 提取完成 (耗时: ${abstractDuration}s)`);
      console.log(`   ├─ 摘要长度: ${abstract.en?.length || 0} 字符 (EN)`);
      console.log(`   └─ 关键词: ${keywords.length} 个\n`);

      // 从原文中移除摘要和关键词部分，避免重复
      const mainContent = this.removeAbstractSection(markdownContent, abstractEndLine);
      console.log(`   ℹ️  已从正文中移除摘要和关键词部分\n`);

      // 阶段 3: 分析结构
      console.log('🏗️  【阶段 3/8】分析文档结构...');
      this.updateProgress('structure', 20);
      const structureStart = Date.now();
      const structure = await this.analyzeStructure(mainContent);
      const structureDuration = ((Date.now() - structureStart) / 1000).toFixed(1);
      console.log(`   ✓ 结构分析完成 (耗时: ${structureDuration}s)`);
      console.log(`   └─ 识别章节: ${structure.sections?.length || 0} 个\n`);

      // 阶段 4: 智能分块（处理句子边界）
      console.log('✂️  【阶段 4/8】智能分块（句子级别）...');
      this.updateProgress('chunking', 25);
      const chunks = this.createSentenceAwareChunks(mainContent, structure);
      console.log(`   ✓ 分块完成: 共 ${chunks.length} 块\n`);

      // 阶段 5: 解析内容块
      console.log(`🔍 【阶段 5/8】解析内容块 (共 ${chunks.length} 块)...`);
      this.updateProgress('parsing', 30, {
        totalChunks: chunks.length,
        chunksProcessed: 0
      });
      const parseStart = Date.now();
      const parsedBlocks = await this.parseChunks(chunks);
      const parseDuration = ((Date.now() - parseStart) / 1000).toFixed(1);
      console.log(`   ✓ 内容解析完成 (耗时: ${parseDuration}s)\n`);

      // 阶段 6: 合并结果
      console.log('🔗 【阶段 6/8】合并解析结果...');
      this.updateProgress('merging', 70);
      const mergedContent = this.mergeBlocks(parsedBlocks, structure);
      console.log(`   ✓ 合并完成`);
      console.log(`   ├─ 章节数: ${mergedContent.sections.length}`);
      console.log(`   └─ 图片数: ${mergedContent.figures.length}\n`);

      // 阶段 7: 解析参考文献
      console.log('📚 【阶段 7/8】解析参考文献...');
      this.updateProgress('references', 80);
      const refStart = Date.now();
      const references = await this.parseReferences(markdownContent, structure);
      const refDuration = ((Date.now() - refStart) / 1000).toFixed(1);
      console.log(`   ✓ 参考文献解析完成 (耗时: ${refDuration}s)`);
      console.log(`   └─ 文献数量: ${references.length}\n`);

      // 阶段 8: 处理图片
      console.log(`🖼️  【阶段 8/8】处理图片 (共 ${mergedContent.figures.length} 张)...`);
      this.updateProgress('images', 85, {
        totalImages: mergedContent.figures.length,
        imagesProcessed: 0
      });
      const imageStart = Date.now();
      await this.processImages(mergedContent.figures);
      const imageDuration = ((Date.now() - imageStart) / 1000).toFixed(1);
      console.log(`   ✓ 图片处理完成 (耗时: ${imageDuration}s)\n`);

      // 构建最终结果
      console.log('💾 【完成】构建最终结果...');
      this.updateProgress('saving', 95);
      
      const content = {
        abstract,
        keywords,
        sections: mergedContent.sections,
        references,
        blockNotes: [],
        checklistNotes: [],
        attachments: []
      };

      this.updateProgress('completed', 100);
      
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n┌─────────────────────────────────────────┐');
      console.log(`│   AI 解析流程完成 (总耗时: ${totalDuration}s)   │`);
      console.log('└─────────────────────────────────────────┘\n');
      
      return { metadata, content };

    } catch (error) {
      console.error('\n❌ AI 解析流程失败:', error);
      throw error;
    }
  }

  /**
   * 阶段1: 提取元数据（优化版）
   */
  private async extractMetadata(content: string): Promise<any> {
    const preview = content.slice(0, 8000);
    const prompt = `You are extracting metadata from an academic paper. Read carefully and output ONLY the structured format requested.

<document>
${preview}
</document>

Extract the following information:
- Title: The main title of the paper (without any numbering)
- Authors: All author names with affiliations
- Publication: Journal or conference name
- Year: Publication year
- DOI: Digital Object Identifier
- Type: Article type (journal/conference/preprint/book/thesis)

OUTPUT FORMAT (output ONLY this, no other text):
TITLE: [paper title here]
AUTHORS: Name1|Affiliation1|Email1; Name2|Affiliation2; Name3
PUBLICATION: [journal name]
YEAR: [number]
DOI: [doi]
TYPE: [type]

IMPORTANT RULES:
- Output ONLY lines starting with the field names above
- Do NOT include any explanatory text
- Do NOT repeat these instructions
- If a field is not found, skip that line
- TITLE is required, output "Unknown Title" if not found`;

    try {
      const response = await this.client.chat(
        'You are a metadata extraction assistant. Output only the requested format.',
        prompt
      );

      // 清理响应，移除可能的系统提示词
      const cleanedResponse = this.cleanAIResponse(response);
      const lines = cleanedResponse.split('\n');
      const metadata: any = {
        id: this.paperId,
        title: '',
        authors: [],
        publication: '',
        year: undefined,
        doi: '',
        articleType: 'journal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('TITLE:')) {
          metadata.title = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('AUTHORS:')) {
          const authorText = trimmed.substring(8).trim();
          metadata.authors = authorText.split(';').map(a => {
            const parts = a.trim().split('|');
            if (parts.length === 1) {
              return { name: parts[0].trim() };
            }
            return {
              name: parts[0].trim(),
              affiliation: parts[1]?.trim() || undefined,
              email: parts[2]?.trim() || undefined
            };
          }).filter(a => a.name);
        } else if (trimmed.startsWith('PUBLICATION:')) {
          metadata.publication = trimmed.substring(12).trim();
        } else if (trimmed.startsWith('YEAR:')) {
          const year = parseInt(trimmed.substring(5).trim());
          if (!isNaN(year)) metadata.year = year;
        } else if (trimmed.startsWith('DOI:')) {
          metadata.doi = trimmed.substring(4).trim();
        } else if (trimmed.startsWith('TYPE:')) {
          const type = trimmed.substring(5).trim().toLowerCase();
          if (['journal', 'conference', 'preprint', 'book', 'thesis'].includes(type)) {
            metadata.articleType = type;
          }
        }
      }

      if (!metadata.title) {
        metadata.title = '未能识别标题';
      }

      return metadata;
    } catch (error) {
      console.error('元数据提取失败:', error);
      return {
        id: this.paperId,
        title: '未能识别标题',
        authors: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 阶段2: 提取摘要和关键词（优化版）
   */
  private async extractAbstractAndKeywords(content: string): Promise<{
    abstract: { en?: string; zh?: string };
    keywords: string[];
    abstractEndLine: number;
  }> {
    const preview = content.slice(0, 10000);
    const prompt = `You are extracting abstract and keywords from an academic paper.

<document>
${preview}
</document>

Find the abstract section and keywords. Output ONLY the format below:

ABSTRACT-EN: [full English abstract text if present]
ABSTRACT-ZH: [full Chinese abstract text if present]
KEYWORDS: [comma-separated keywords]

IMPORTANT RULES:
- Output ONLY the three lines above
- Do NOT include any explanations
- Do NOT repeat these instructions
- If abstract is in English, put it in ABSTRACT-EN
- If abstract is in Chinese, put it in ABSTRACT-ZH
- Output the complete abstract text, not a summary`;

    try {
      const response = await this.client.chat(
        'You are an abstract extraction assistant. Output only the requested format.',
        prompt
      );

      const cleanedResponse = this.cleanAIResponse(response);
      const lines = cleanedResponse.split('\n');
      let abstractEn = '';
      let abstractZh = '';
      const keywords: string[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('ABSTRACT-EN:')) {
          abstractEn = trimmed.substring(12).trim();
        } else if (trimmed.startsWith('ABSTRACT-ZH:')) {
          abstractZh = trimmed.substring(12).trim();
        } else if (trimmed.startsWith('KEYWORDS:')) {
          const kwText = trimmed.substring(9).trim();
          keywords.push(...kwText.split(/[,;，；]/).map(k => k.trim()).filter(Boolean));
        }
      }

      // 如果是英文文档但没有中文摘要，需要翻译
      if (this.documentLanguage === 'en' && abstractEn && !abstractZh) {
        console.log('   🌐 翻译摘要中...');
        abstractZh = await this.translateToZh(abstractEn, 'abstract');
      }

      // 查找摘要结束位置
      const abstractEndLine = this.findAbstractEndLine(content);

      return {
        abstract: {
          en: abstractEn || undefined,
          zh: abstractZh || undefined
        },
        keywords,
        abstractEndLine
      };
    } catch (error) {
      console.error('摘要提取失败:', error);
      return {
        abstract: { en: '', zh: '' },
        keywords: [],
        abstractEndLine: 0
      };
    }
  }

  /**
   * 查找摘要和关键词结束的行号
   */
  private findAbstractEndLine(content: string): number {
    const lines = content.split('\n');
    let abstractFound = false;
    let keywordsFound = false;
    
    for (let i = 0; i < Math.min(lines.length, 200); i++) {
      const line = lines[i].toLowerCase().trim();
      
      if (line.match(/^#+\s*(abstract|摘要)/)) {
        abstractFound = true;
      }
      
      if (abstractFound && line.match(/^#+\s*(keywords?|关键词)/)) {
        keywordsFound = true;
      }
      
      // 找到关键词后的第一个主要章节标题
      if (keywordsFound && line.match(/^#+\s*(introduction|背景|引言|1\.|i\.|chapter)/i)) {
        return i;
      }
    }
    
    return 0;
  }

  /**
   * 从原文中移除摘要和关键词部分
   */
  private removeAbstractSection(content: string, endLine: number): string {
    if (endLine === 0) return content;
    
    const lines = content.split('\n');
    // 保留摘要之前的内容和摘要之后的内容
    return lines.slice(endLine).join('\n');
  }

  /**
   * 翻译文本到中文
   */
  private async translateToZh(text: string, context: string = 'general'): Promise<string> {
    if (!text || text.trim().length === 0) return '';
    
    try {
      const prompt = `Translate this academic text to Chinese. Output ONLY the translation.

<text>
${text}
</text>

RULES:
- Output ONLY the Chinese translation
- No explanations, no "Here is the translation", no extra text
- Maintain academic tone`;

      const response = await this.client.chat(
        'You are a professional translator. Output only the translation.',
        prompt
      );

      return this.cleanAIResponse(response).trim();
    } catch (error) {
      console.error(`翻译失败 (${context}):`, error);
      return '';
    }
  }

  /**
   * 阶段3: 分析结构（优化版）
   */
  private async analyzeStructure(content: string): Promise<any> {
    const preview = content.substring(0, 12000);
    const prompt = `Analyze the structure of this academic paper and identify all section headings.

<document>
${preview}
</document>

Find all section headings (marked with #, ##, ### or numbered like "1.", "1.1", "I.", etc.).

OUTPUT FORMAT (one per line):
SECTION: [level]|[title without numbering]|[line number]

Example:
SECTION: 1|Introduction|10
SECTION: 2|Methodology|50
SECTION: 2|Results|120

RULES:
- Output ONLY lines starting with "SECTION:"
- Level 1 for main sections, 2 for subsections, 3 for sub-subsections
- Remove any numbering from the title (e.g., "1. Introduction" → "Introduction")
- No explanations or other text`;

    try {
      const response = await this.client.chat(
        'You are a document structure analyzer. Output only the requested format.',
        prompt
      );

      const cleanedResponse = this.cleanAIResponse(response);
      const sections: any[] = [];
      const lines = cleanedResponse.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('SECTION:')) {
          const parts = trimmed.substring(8).trim().split('|');
          if (parts.length >= 3) {
            const title = this.removeNumberingFromTitle(parts[1].trim());
            sections.push({
              level: parseInt(parts[0].trim()),
              title: title,
              startLine: parseInt(parts[2].trim()) || 0
            });
          }
        }
      }

      return { sections };
    } catch (error) {
      console.error('结构分析失败:', error);
      return { sections: [] };
    }
  }

  /**
   * 从标题中移除编号
   */
  private removeNumberingFromTitle(title: string): string {
    // 移除各种编号格式：1. 1.1 I. A. (1) [1] 等
    return title
      .replace(/^[\d\.\s]+/, '')           // 数字编号：1. 1.1. 
      .replace(/^[IVXivx]+[\.\s]+/i, '')   // 罗马数字：I. IV.
      .replace(/^[A-Z][\.\s]+/, '')        // 字母编号：A. B.
      .replace(/^[\(\[\{][\d]+[\)\]\}]/, '') // 括号数字：(1) [1] {1}
      .trim();
  }

  /**
   * 阶段4: 智能分块（句子感知版）
   */
  private createSentenceAwareChunks(content: string, structure: any): ChunkInfo[] {
    const lines = content.split('\n');
    const chunks: ChunkInfo[] = [];
    
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let startLine = 0;
    let previousLastSentence = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = estimateTokens(line);

      // 如果当前块会超限，且已有内容，则保存当前块
      if (currentTokens + lineTokens > this.MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        // 提取最后一个未完成的句子
        const lastSentence = this.extractIncompleteSentence(currentChunk.join('\n'));
        
        chunks.push({
          content: currentChunk.join('\n'),
          index: chunks.length,
          startLine,
          endLine: i - 1,
          lastSentence: previousLastSentence
        });

        // 为下一个块准备上下文（未完成的句子）
        if (lastSentence) {
          currentChunk = [lastSentence];
          currentTokens = estimateTokens(lastSentence);
          previousLastSentence = lastSentence;
        } else {
          currentChunk = [];
          currentTokens = 0;
          previousLastSentence = '';
        }
        
        startLine = i;
      }

      currentChunk.push(line);
      currentTokens += lineTokens;
    }

    // 保存最后一个块
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        index: chunks.length,
        startLine,
        endLine: lines.length - 1,
        lastSentence: previousLastSentence
      });
    }

    return chunks;
  }

  /**
   * 提取未完成的句子
   */
  private extractIncompleteSentence(text: string): string {
    // 查找最后一个完整句子的结束符
    const sentenceEnders = /[.!?。！？]/g;
    let lastCompleteIndex = -1;
    let match;
    
    while ((match = sentenceEnders.exec(text)) !== null) {
      lastCompleteIndex = match.index;
    }
    
    // 如果找到句子结束符，返回之后的内容
    if (lastCompleteIndex > -1) {
      const incompletePart = text.substring(lastCompleteIndex + 1).trim();
      // 只有当未完成部分有实际内容时才返回
      if (incompletePart.length > 10) {
        return incompletePart;
      }
    }
    
    return '';
  }

  /**
   * 阶段5: 解析内容块（优化版）
   */
  private async parseChunks(chunks: ChunkInfo[]): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      const progress = 30 + Math.floor((i / chunks.length) * 40);
      this.updateProgress('parsing', progress, {
        totalChunks: chunks.length,
        chunksProcessed: i
      });

      const chunkStart = Date.now();
      console.log(`   📄 [${i + 1}/${chunks.length}] 解析块 (行 ${chunk.startLine}-${chunk.endLine})...`);

      const prompt = this.buildContentParsePrompt(chunk.content, i, chunk.lastSentence);
      
      try {
        const response = await this.client.chat(
          'You are a content parser. Output only the structured format requested.',
          prompt,
          { maxTokens: this.MAX_RESPONSE_TOKENS }
        );

        const cleanedResponse = this.cleanAIResponse(response);
        const chunkDuration = ((Date.now() - chunkStart) / 1000).toFixed(1);
        console.log(`       ✓ 完成 (${chunkDuration}s)`);
        
        results.push(cleanedResponse);

      } catch (error) {
        console.error(`       ✗ 解析失败:`, error instanceof Error ? error.message : error);
        results.push('');
      }

      if (i < chunks.length - 1) {
        await this.sleep(this.DELAY_BETWEEN_REQUESTS);
      }
    }

    return results;
  }

  /**
   * 阶段6: 合并块
   */
  private mergeBlocks(parsedMarkups: string[], structure: any): any {
    const allBlocks: BlockContent[] = [];

    for (const markup of parsedMarkups) {
      if (!markup) continue;
      
      try {
        const blocks = this.markupParser.parseBlocks(markup);
        // 确保每个块都有唯一ID
        blocks.forEach(block => {
          if (!block.id || this.usedIds.has(block.id)) {
            block.id = this.generateUniqueId(block.type);
          } else {
            this.usedIds.add(block.id);
          }
        });
        allBlocks.push(...blocks);
      } catch (error) {
        console.error('解析标记文本失败:', error);
      }
    }

    const sections = this.buildSectionTree(allBlocks, structure);
    const figures = allBlocks.filter(b => b.type === 'figure');

    return { sections, figures };
  }

  /**
   * 阶段7: 解析参考文献
   */
  private async parseReferences(content: string, structure: any): Promise<Reference[]> {
    const refSectionText = this.extractReferencesSection(content, structure);
    
    if (!refSectionText || refSectionText.trim().length === 0) {
      console.log('   ⚠️  未找到参考文献章节');
      return [];
    }
    
    const prompt = `Parse these academic references into structured format.

<references>
${refSectionText.substring(0, 20000)}
</references>

For each reference, output:

#REF
AUTHORS: Author1; Author2; Author3
TITLE: Paper title
PUBLICATION: Journal/Conference name
YEAR: 2024
DOI: 10.xxxx/xxxxx
URL: https://...
PAGES: 1-10
VOLUME: 12
NUMBER: 3

RULES:
- Output ONLY #REF blocks
- One block per reference
- Separate authors with semicolons
- Skip missing fields
- No explanations`;

    try {
      const response = await this.client.chat(
        'You are a reference parser. Output only the structured format.',
        prompt
      );

      const cleanedResponse = this.cleanAIResponse(response);
      return this.markupParser.parseReferences(cleanedResponse);
    } catch (error) {
      console.error('参考文献解析失败:', error);
      return [];
    }
  }

  /**
   * 阶段8: 处理图片
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

  private buildContentParsePrompt(content: string, chunkIndex: number, lastSentence?: string): string {
    const needTranslation = this.documentLanguage === 'en';
    
    let contextNote = '';
    if (lastSentence) {
      contextNote = `\nCONTEXT FROM PREVIOUS CHUNK:
"${lastSentence}"
(This is the incomplete sentence from previous chunk. Continue parsing from where this left off to avoid duplication.)`;
    }
    
    return `Parse this Markdown content into structured format. Output ONLY the markers specified below.
${contextNote}

<content>
${content}
</content>

OUTPUT MARKERS:

## Heading (h1-h6)
#HEADING[1-6]
EN: [English heading text without numbering]
ZH: [Chinese translation]

## Paragraph
#PARA
EN: [English text with **bold**, *italic*, [link](url), $math$, [1,2] citations]
ZH: [Chinese translation]

## Math Formula
#MATH
LATEX: equation
LABEL: eq-1

## Figure
#FIGURE
SRC: image.png
CAPTION-EN: [caption]
CAPTION-ZH: [Chinese caption]
ALT: [alt text]
NUMBER: 1

## Table
#TABLE
CAPTION-EN: [caption]
CAPTION-ZH: [Chinese caption]
HEADERS: Col1|Col2|Col3
ROW: Data1|Data2|Data3
NUMBER: 1

## Code
#CODE python
[code]
CAPTION-EN: [optional]

## Lists
#LIST-ORDERED
ITEM-EN: First
ITEM-ZH: 第一

#LIST-UNORDERED
ITEM-EN: Bullet
ITEM-ZH: 要点

## Quote
#QUOTE
EN: Quote text
ZH: 引用
AUTHOR: Name

## Divider
#DIVIDER

CRITICAL RULES:
1. Output ONLY the markers above - nothing else
2. Do NOT include any explanatory text like "Here is the parsed content"
3. Do NOT repeat these instructions in output
4. Do NOT include phrases like "Chunk X", "Document language", etc.
5. Keep inline formatting: **bold**, *italic*, \`code\`, [link](url)
6. Citations: [1], [1,2], [1-3]
7. Remove numbering from headings (e.g., "1. Introduction" → "Introduction")
${needTranslation ? '8. Translate ALL content to Chinese in ZH fields' : '8. Extract content as-is'}
9. If parsing continues from previous context, do NOT duplicate that content`;
  }

  /**
   * 清理AI响应，移除系统提示词污染
   */
  private cleanAIResponse(response: string): string {
    // 移除常见的系统提示词污染
    const patterns = [
      /^(?:Here is|Here's|Below is|The following is|I've|I have).+?[:：]\s*/gim,
      /^(?:Sure|OK|Okay|Certainly|Of course).+?[:：]\s*/gim,
      /Chunk\s+\d+\s*[*\-•]\s*Document language:\s*\w+\s*[*\-•].+$/gim,
      /^[\-*•]\s*(?:Chunk|Document language|Please translate).+$/gim,
      /^(?:Based on|According to|As per).+?(?:instructions|prompt|request).+?[:：]/gim,
    ];

    let cleaned = response;
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  // ========== 辅助方法 ==========

  private buildSectionTree(blocks: BlockContent[], structure: any): Section[] {
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let currentSubsection: Section | null = null;
    let currentSubSubsection: Section | null = null;

    for (const block of blocks) {
      if (block.type === 'heading') {
        const headingBlock = block as any;
        
        // 确保使用唯一ID
        const sectionId = this.generateUniqueId('section');
        
        const newSection: Section = {
          id: sectionId,
          number: headingBlock.number || undefined,
          title: {
            en: this.extractTextFromInline(headingBlock.content?.en),
            zh: this.extractTextFromInline(headingBlock.content?.zh)
          },
          content: [],
          subsections: []
        };

        if (headingBlock.level === 1) {
          sections.push(newSection);
          currentSection = newSection;
          currentSubsection = null;
          currentSubSubsection = null;
        } else if (headingBlock.level === 2 && currentSection) {
          currentSection.subsections!.push(newSection);
          currentSubsection = newSection;
          currentSubSubsection = null;
        } else if (headingBlock.level === 3 && currentSubsection) {
          currentSubsection.subsections!.push(newSection);
          currentSubSubsection = newSection;
        } else if (headingBlock.level === 4 && currentSubSubsection) {
          currentSubSubsection.subsections!.push(newSection);
        } else if (currentSubsection) {
          currentSubsection.subsections!.push(newSection);
        } else if (currentSection) {
          currentSection.subsections!.push(newSection);
        } else {
          sections.push(newSection);
          currentSection = newSection;
        }
      } else {
        // 确保内容块有唯一ID
        if (!block.id || this.usedIds.has(block.id)) {
          block.id = this.generateUniqueId(block.type);
        }
        
        if (currentSubSubsection) {
          currentSubSubsection.content.push(block);
        } else if (currentSubsection) {
          currentSubsection.content.push(block);
        } else if (currentSection) {
          currentSection.content.push(block);
        } else {
          if (sections.length === 0) {
            sections.push({
              id: this.generateUniqueId('section'),
              title: { en: '', zh: '' },
              content: [],
              subsections: []
            });
          }
          sections[sections.length - 1].content.push(block);
        }
      }
    }

    return sections;
  }

  private extractTextFromInline(inline: any): string {
    if (!inline || !Array.isArray(inline)) return '';
    return inline
      .map((node: any) => {
        if (node.type === 'text') return node.content;
        if (node.type === 'link' && node.children) {
          return this.extractTextFromInline(node.children);
        }
        return '';
      })
      .join('');
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