// backend/src/services/pdfConverter/pdfConverterService.ts

import { PDFParser } from './pdfParser';
import { LLMService } from './llmService';
import { StructureParser } from './structureParser';

export interface PDFConverterConfig {
  apiKey: string;
  chunkSize?: number;
  contextOverlap?: number;
  onProgress?: (progress: number, message: string) => void; // 🆕 进度回调
}

// 页面内容类型
interface PageContentFlags {
  hasTitle: boolean;
  hasAbstract: boolean;
  hasKeywords: boolean;
  hasMainContent: boolean;
  hasReferences: boolean;
  hasCopyright: boolean;
  isEmptyOrNoise: boolean;
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

  /**
   * 🆕 报告进度（带日志）
   */
  private reportProgress(progress: number, message: string) {
    if (this.config.onProgress) {
      this.config.onProgress(progress, message);
    }
  }

  async convertPDF(filePath: string, originalName: string): Promise<any> {
    console.log(`\n📚 开始解析PDF: ${originalName}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      // ============ 步骤1: 提取PDF文本 (0-10%) ============
      this.reportProgress(0, '🔤 开始提取PDF页面文本');
      console.log('\n🔤 步骤1: 提取PDF页面文本...');
      
      const pages = await this.pdfParser.extractPages(filePath);
      const totalPages = pages.length;
      
      this.reportProgress(10, `✓ 成功提取 ${totalPages} 页内容`);
      console.log(`   ✓ 成功提取 ${totalPages} 页内容`);

      // ============ 步骤2: 分析页面内容类型 (10-15%) ============
      this.reportProgress(10, '🔍 分析页面内容类型');
      console.log('\n🔍 步骤2: 分析页面内容类型...');
      
      const pageAnalysis = pages.map((page, index) => {
        const flags = this.analyzePageContent(page.text);
        const types = this.getContentTypeLabels(flags);
        console.log(`   页面 ${index + 1}: ${types}`);
        return flags;
      });
      
      this.reportProgress(15, '✓ 页面类型分析完成');

      // ============ 步骤3: 提取摘要和关键词 (15-25%) ============
      this.reportProgress(15, '📝 提取摘要和关键词');
      console.log('\n📝 步骤3: 提取摘要和关键词...');
      
      let abstract: { en?: string; zh?: string } = {};
      let keywords: string[] = [];
      
      const abstractPageIndices = pageAnalysis
        .map((flags, index) => ({ flags, index }))
        .filter(({ flags }) => flags.hasAbstract)
        .map(({ index }) => index);

      if (abstractPageIndices.length > 0) {
        const abstractText = abstractPageIndices
          .map(index => pages[index].text)
          .join('\n\n');
        
        const extracted = await this.llmService.extractAbstractAndKeywords(abstractText);
        abstract = extracted.abstract;
        keywords = extracted.keywords;
        
        this.reportProgress(25, `✓ 摘要和关键词提取完成 (${keywords.length} 个关键词)`);
        console.log(`   ✓ 摘要提取成功 (${abstract.en?.length || 0} 字符)`);
        console.log(`   ✓ 关键词提取成功 (${keywords.length} 个)`);
      } else {
        console.log(`   ⚠ 未找到摘要内容，使用前3页尝试提取`);
        const frontMatter = await this.pdfParser.extractFrontMatter(filePath, 3);
        const extracted = await this.llmService.extractAbstractAndKeywords(frontMatter);
        abstract = extracted.abstract;
        keywords = extracted.keywords;
        
        this.reportProgress(25, `✓ 摘要和关键词提取完成 (${keywords.length} 个关键词)`);
        console.log(`   ✓ 摘要提取成功 (${abstract.en?.length || 0} 字符)`);
        console.log(`   ✓ 关键词提取成功 (${keywords.length} 个)`);
      }

      // ============ 步骤4: 解析正文内容 (25-85%) ============
      // 这部分占60%的进度，按页面数平均分配
      this.reportProgress(25, '📄 开始解析论文正文');
      console.log('\n📄 步骤4: 解析论文正文...');
      
      const pagesData = [];
      
      // 过滤出需要解析的页面
      const pagesToParse = pages
        .map((page, index) => ({ page, index, flags: pageAnalysis[index] }))
        .filter(({ flags }) => flags.hasMainContent && !flags.isEmptyOrNoise);
      
      const totalPagesToParse = pagesToParse.length;
      const progressPerPage = 60 / totalPagesToParse; // 每页占的进度
      
      console.log(`   共需解析 ${totalPagesToParse} 页正文内容\n`);
      
      for (let i = 0; i < pagesToParse.length; i++) {
        const { page, index: originalIndex } = pagesToParse[i];
        const currentProgress = 25 + Math.round((i / totalPagesToParse) * 60);
        
        // 🎯 详细的进度信息：当前页/总页数
        this.reportProgress(
          currentProgress, 
          `📄 正在解析第 ${i + 1}/${totalPagesToParse} 页正文 (原始页码: ${page.pageNumber})`
        );
        
        console.log(`   ⊙ 解析页面 ${i + 1}/${totalPagesToParse} (原始页码: ${page.pageNumber})...`);

        // 提供上下文
        let previousContext = '';
        if (originalIndex > 0) {
          const prevText = pages[originalIndex - 1].text;
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
          if (i < totalPagesToParse - 1) {
            await this.delay(500);
          }
        } catch (error) {
          console.error(`     ✗ 解析失败:`, error instanceof Error ? error.message : '未知错误');
          // 继续处理下一页
        }
      }

      this.reportProgress(85, `✓ 正文解析完成 (成功解析 ${pagesData.length} 页)`);
      console.log(`   ✓ 成功解析 ${pagesData.length} 页正文内容\n`);

      // ============ 步骤5: 组织章节结构 (85-90%) ============
      this.reportProgress(85, '🏗️ 组织章节结构');
      console.log('🏗️  步骤5: 组织章节结构...');
      
      const sections = this.structureParser.mergePages(pagesData);
      
      this.reportProgress(90, `✓ 章节组织完成 (共 ${sections.length} 个章节)`);
      console.log(`   ✓ 组织了 ${sections.length} 个章节\n`);

      // ============ 步骤6: 提取参考文献 (90-95%) ============
      this.reportProgress(90, '📚 提取参考文献');
      console.log('📚 步骤6: 提取参考文献...');
      
      let references = [];
      
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
          this.reportProgress(95, `✓ 参考文献提取完成 (${references.length} 条)`);
          console.log(`   ✓ 提取了 ${references.length} 条参考文献\n`);
        } catch (error) {
          console.error('   ✗ 参考文献提取失败:', error);
          this.reportProgress(95, '⚠ 参考文献提取失败');
        }
      } else {
        console.log(`   ⚠ 未找到参考文献标记，尝试从PDF末尾提取`);
        try {
          const referencesText = await this.pdfParser.extractReferences(filePath);
          if (referencesText) {
            references = await this.llmService.extractReferences(referencesText);
            this.reportProgress(95, `✓ 参考文献提取完成 (${references.length} 条)`);
            console.log(`   ✓ 提取了 ${references.length} 条参考文献\n`);
          } else {
            this.reportProgress(95, '⚠ 未找到参考文献');
          }
        } catch (error) {
          console.error('   ✗ 参考文献提取失败:', error);
          this.reportProgress(95, '⚠ 参考文献提取失败');
        }
      }

      references = this.structureParser.normalizeReferences(references);

      // ============ 步骤7: 组装最终结果 (95-100%) ============
      this.reportProgress(95, '📦 组装最终结果');
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

      this.reportProgress(100, '✅ PDF解析完成');

      // ============ 完成总结 ============
      console.log(`\n${'═'.repeat(60)}`);
      console.log('✅ PDF解析完成！');
      console.log(`${'═'.repeat(60)}`);
      console.log(`   📊 统计信息:`);
      console.log(`      - 总页数: ${totalPages}`);
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
   * 分析页面包含的内容类型（支持多类型）
   */
  private analyzePageContent(pageText: string): PageContentFlags {
    const lowerText = pageText.toLowerCase();
    
    return {
      hasTitle: (pageText.match(/@/g) || []).length >= 2,
      hasAbstract: /\babstract\b/i.test(pageText),
      hasKeywords: /\b(keywords?|index terms?|key words?)\b/i.test(pageText),
      hasMainContent: 
        /\b(introduction|methodology|method|results?|discussion|conclusion|analysis)\b/i.test(pageText) ||
        /^\s*\d+\.?\s+[A-Z][a-z]/m.test(pageText) ||
        /^\s*(I{1,3}|IV|V|VI{0,3}|IX|X)\.?\s+[A-Z]/m.test(pageText),
      hasReferences: /\b(references|bibliography)\b/i.test(pageText),
      hasCopyright: 
        /\b(copyright|permission|acm isbn|doi:|https?:\/\/doi\.org)\b/i.test(pageText) ||
        /^\s*\d+\s*$/m.test(pageText),
      isEmptyOrNoise: pageText.trim().length < 50
    };
  }

  /**
   * 获取内容类型标签（用于日志）
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
      if (['heading', 'paragraph', 'math', 'figure', 'table', 
           'code', 'ordered-list', 'unordered-list', 'quote'].includes(block.type)) {
        
        const text = this.extractBlockText(block);
        
        const shouldFilter = 
          (text.match(/@/g) || []).length > 2 ||
          /copyright|permission|acm isbn/i.test(text) ||
          /^https?:\/\/doi\.org/i.test(text.trim()) ||
          /^\s*\d+\s*$/.test(text) ||
          /^(KDD|ICML|NeurIPS|CVPR|ICCV)\s+['']?\d{2}/i.test(text) ||
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