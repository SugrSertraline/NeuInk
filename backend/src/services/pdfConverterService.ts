// backend/src/services/pdfConverter/pdfConverterService.ts

import { PDFParser } from './pdfParser';
import { LLMService } from './llmService';
import { StructureParser } from './structureParser';

export interface PDFConverterConfig {
  apiKey: string;
  chunkSize?: number;
  contextOverlap?: number;
}

// 🆕 页面内容类型（一页可能包含多种）
interface PageContentFlags {
  hasTitle: boolean;        // 包含标题/作者信息
  hasAbstract: boolean;     // 包含摘要
  hasKeywords: boolean;     // 包含关键词
  hasMainContent: boolean;  // 包含正文
  hasReferences: boolean;   // 包含参考文献
  hasCopyright: boolean;    // 包含版权信息
  isEmptyOrNoise: boolean;  // 空白页或噪声页
}

export class PDFConverterService {
  private pdfParser: PDFParser;
  private llmService: LLMService;
  private structureParser: StructureParser;
  private config: PDFConverterConfig;

  constructor(config: PDFConverterConfig) {
    this.config = {
      chunkSize: 1,
      contextOverlap: 500,
      ...config
    };

    this.pdfParser = new PDFParser();
    this.llmService = new LLMService(config.apiKey);
    this.structureParser = new StructureParser();
  }

  async convertPDF(filePath: string, originalName: string): Promise<any> {
    console.log(`\n📚 开始解析PDF: ${originalName}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      // ============ 步骤1: 提取PDF文本 ============
      console.log('\n🔤 步骤1: 提取PDF页面文本...');
      const pages = await this.pdfParser.extractPages(filePath);
      console.log(`   ✓ 成功提取 ${pages.length} 页内容`);

      // ============ 步骤2: 分析每页内容类型 ============
      console.log('\n🔍 步骤2: 分析页面内容类型...');
      const pageAnalysis = pages.map((page, index) => {
        const flags = this.analyzePageContent(page.text);
        const types = this.getContentTypeLabels(flags);
        console.log(`   页面 ${index + 1}: ${types}`);
        return flags;
      });

      // ============ 步骤3: 提取摘要和关键词 ============
      console.log('\n📝 步骤3: 提取摘要和关键词...');
      
      // ✅ 修复：使用正确的类型定义
      let abstract: { en?: string; zh?: string } = {};
      let keywords: string[] = [];
      
      // 找到包含摘要的页面
      const abstractPageIndices = pageAnalysis
        .map((flags, index) => ({ flags, index }))
        .filter(({ flags }) => flags.hasAbstract)
        .map(({ index }) => index);

      if (abstractPageIndices.length > 0) {
        // 提取包含摘要的页面文本
        const abstractText = abstractPageIndices
          .map(index => pages[index].text)
          .join('\n\n');
        
        const extracted = await this.llmService.extractAbstractAndKeywords(abstractText);
        abstract = extracted.abstract;
        keywords = extracted.keywords;
        
        console.log(`   ✓ 摘要提取成功 (${abstract.en?.length || 0} 字符)`);
        console.log(`   ✓ 关键词提取成功 (${keywords.length} 个)`);
      } else {
        console.log(`   ⚠ 未找到摘要内容，使用前3页尝试提取`);
        const frontMatter = await this.pdfParser.extractFrontMatter(filePath, 3);
        const extracted = await this.llmService.extractAbstractAndKeywords(frontMatter);
        abstract = extracted.abstract;
        keywords = extracted.keywords;
        
        console.log(`   ✓ 摘要提取成功 (${abstract.en?.length || 0} 字符)`);
        console.log(`   ✓ 关键词提取成功 (${keywords.length} 个)`);
      }

      // ============ 步骤4: 解析正文内容 ============
      console.log('\n📄 步骤4: 解析论文正文...');
      const pagesData = [];
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const flags = pageAnalysis[i];
        
        // 🔑 关键改进：只要页面包含正文内容就解析
        if (!flags.hasMainContent) {
          console.log(`   ⊗ 跳过页面 ${i + 1} (无正文内容)`);
          continue;
        }

        // 如果页面只有版权/噪声，也跳过
        if (flags.isEmptyOrNoise) {
          console.log(`   ⊗ 跳过页面 ${i + 1} (空白或噪声)`);
          continue;
        }

        console.log(`   ⊙ 解析页面 ${i + 1}/${pages.length}...`);

        // 提供上下文
        let previousContext = '';
        if (i > 0) {
          const prevText = pages[i - 1].text;
          previousContext = prevText.slice(-this.config.contextOverlap!);
        }

        try {
          const pageData = await this.llmService.parsePage(
            page.text,
            page.pageNumber,
            previousContext
          );

          // 过滤掉元数据块
          if (pageData.blocks && Array.isArray(pageData.blocks)) {
            pageData.blocks = this.filterNonContentBlocks(pageData.blocks);
          }

          if (pageData.blocks && pageData.blocks.length > 0) {
            pagesData.push(pageData);
            console.log(`     ✓ 提取了 ${pageData.blocks.length} 个内容块`);
          } else {
            console.log(`     ⚠ 页面无有效内容块`);
          }

          // API限流延迟
          if (i < pages.length - 1) {
            await this.delay(500);
          }
        } catch (error) {
          console.error(`     ✗ 解析失败:`, error instanceof Error ? error.message : '未知错误');
          // 继续处理下一页
        }
      }

      console.log(`   ✓ 成功解析 ${pagesData.length} 页正文内容\n`);

      // ============ 步骤5: 组织章节结构 ============
      console.log('🏗️  步骤5: 组织章节结构...');
      const sections = this.structureParser.mergePages(pagesData);
      console.log(`   ✓ 组织了 ${sections.length} 个章节\n`);

      // ============ 步骤6: 提取参考文献 ============
      console.log('📚 步骤6: 提取参考文献...');
      let references = [];
      
      // 找到包含参考文献的页面
      const referencePageIndices = pageAnalysis
        .map((flags, index) => ({ flags, index }))
        .filter(({ flags }) => flags.hasReferences)
        .map(({ index }) => index);

      if (referencePageIndices.length > 0) {
        console.log(`   找到参考文献页: ${referencePageIndices.map(i => i + 1).join(', ')}`);
        const referencesText = referencePageIndices
          .map(index => pages[index].text)
          .join('\n\n');
        
        try {
          references = await this.llmService.extractReferences(referencesText);
          console.log(`   ✓ 提取了 ${references.length} 条参考文献\n`);
        } catch (error) {
          console.error('   ✗ 参考文献提取失败:', error);
        }
      } else {
        console.log(`   ⚠ 未找到参考文献标记，尝试从PDF末尾提取`);
        try {
          const referencesText = await this.pdfParser.extractReferences(filePath);
          if (referencesText) {
            references = await this.llmService.extractReferences(referencesText);
            console.log(`   ✓ 提取了 ${references.length} 条参考文献\n`);
          }
        } catch (error) {
          console.error('   ✗ 参考文献提取失败:', error);
        }
      }

      references = this.structureParser.normalizeReferences(references);

      // ============ 步骤7: 组装最终结果 ============
      console.log('📦 步骤7: 组装最终结果...');
      const paperContent = {
        abstract,
        keywords,
        sections,
        references,
        blockNotes: [],
        checklistNotes: []
      };

      const validatedContent = this.structureParser.validateAndFix(paperContent);

      // ============ 完成总结 ============
      console.log(`\n${'═'.repeat(60)}`);
      console.log('✅ PDF解析完成！');
      console.log(`${'═'.repeat(60)}`);
      console.log(`   📊 统计信息:`);
      console.log(`      - 总页数: ${pages.length}`);
      console.log(`      - 解析页数: ${pagesData.length}`);
      console.log(`      - 章节数: ${validatedContent.sections.length}`);
      console.log(`      - 参考文献: ${validatedContent.references.length}`);
      console.log(`      - 关键词: ${validatedContent.keywords.length}`);
      console.log(`      - 摘要长度: ${validatedContent.abstract?.en?.length || 0} 字符`);
      console.log(`${'═'.repeat(60)}\n`);
      
      return validatedContent;

    } catch (error) {
      console.error('\n❌ PDF转换失败:', error);
      throw new Error(`PDF转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 🆕 分析页面包含的内容类型（支持多类型）
   */
  private analyzePageContent(pageText: string): PageContentFlags {
    const lowerText = pageText.toLowerCase();
    
    return {
      // 包含大量邮箱地址 = 标题页
      hasTitle: (pageText.match(/@/g) || []).length >= 2,
      
      // 包含Abstract关键词
      hasAbstract: /\babstract\b/i.test(pageText),
      
      // 包含Keywords关键词
      hasKeywords: /\b(keywords?|index terms?|key words?)\b/i.test(pageText),
      
      // 包含Introduction或章节编号 = 正文
      hasMainContent: 
        /\b(introduction|methodology|method|results?|discussion|conclusion|analysis)\b/i.test(pageText) ||
        /^\s*\d+\.?\s+[A-Z][a-z]/m.test(pageText) || // 章节编号
        /^\s*(I{1,3}|IV|V|VI{0,3}|IX|X)\.?\s+[A-Z]/m.test(pageText), // 罗马数字章节
      
      // 包含References关键词
      hasReferences: /\b(references|bibliography)\b/i.test(pageText),
      
      // 包含版权信息
      hasCopyright: 
        /\b(copyright|permission|acm isbn|doi:|https?:\/\/doi\.org)\b/i.test(pageText) ||
        /^\s*\d+\s*$/m.test(pageText), // 单独的页码
      
      // 空白页或纯噪声
      isEmptyOrNoise: pageText.trim().length < 50
    };
  }

  /**
   * 🆕 获取内容类型标签（用于日志）
   */
  private getContentTypeLabels(flags: PageContentFlags): string {
    const labels: string[] = [];
    
    if (flags.hasTitle) labels.push('标题');
    if (flags.hasAbstract) labels.push('摘要');
    if (flags.hasKeywords) labels.push('关键词');
    if (flags.hasMainContent) labels.push('正文');
    if (flags.hasReferences) labels.push('参考文献');
    if (flags.hasCopyright) labels.push('版权');
    if (flags.isEmptyOrNoise) labels.push('空白/噪声');
    
    return labels.length > 0 ? labels.join(' + ') : '未知';
  }

  /**
   * 过滤非正文块
   */
  private filterNonContentBlocks(blocks: any[]): any[] {
    return blocks.filter(block => {
      // 保留主要内容块
      if (['heading', 'paragraph', 'math', 'figure', 'table', 
           'code', 'ordered-list', 'unordered-list', 'quote'].includes(block.type)) {
        
        const text = this.extractBlockText(block);
        
        // 过滤规则：元数据和噪声
        const shouldFilter = 
          // 包含过多邮箱地址（标题页信息）
          (text.match(/@/g) || []).length > 2 ||
          // 版权信息
          /copyright|permission|acm isbn/i.test(text) ||
          // DOI链接（单独一行）
          /^https?:\/\/doi\.org/i.test(text.trim()) ||
          // 单独的页码
          /^\s*\d+\s*$/.test(text) ||
          // 会议信息（特定格式）
          /^(KDD|ICML|NeurIPS|CVPR|ICCV)\s+['']?\d{2}/i.test(text) ||
          // 太短的内容（可能是噪声）
          text.trim().length < 10;
        
        return !shouldFilter;
      }
      
      return true;
    });
  }

  /**
   * 提取块的文本内容（用于过滤）
   */
  private extractBlockText(block: any): string {
    if (!block.content) return '';
    
    const extractInline = (arr: any[]): string => {
      if (!Array.isArray(arr)) return '';
      return arr.map(item => {
        if (typeof item === 'string') return item;
        if (item.content) return item.content;
        return '';
      }).join('');
    };
    
    return extractInline(block.content.en || []);
  }

  /**
   * 延迟函数（API限流）
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}