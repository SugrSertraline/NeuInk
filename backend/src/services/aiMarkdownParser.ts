// ===== aiMarkdownParser.ts =====
import { DeepSeekClient } from './deepSeekClient';
import { ParseProgress, ParseJobStatus, ParseStatusMessages } from '../types/parseJob';
import { BlockContent, Section, Reference } from '../types/paper';
import { randomUUID } from 'crypto';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

import {
  LineScanner, toLines, normalizeMarkdown, uid,
  reflowParagraphLines, estimateTokens, isBlank
} from './parsers/progressiveScanner';

import {
  parseHeading, parseParagraph, parseCodeBlock, parseTable,
  parseImage, parseBlockquote, parseDivider, parseBlockMath,
  parseList, toInline
} from './parsers/elementDetectors';

// ========= 语言检测 =========
function detectLanguage(text: string): 'en' | 'zh' | 'mixed' {
  if (!text || text.trim().length === 0) return 'en';
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;
  const englishChars = text.match(/[a-zA-Z]/g);
  const englishCount = englishChars ? englishChars.length : 0;
  const totalChars = chineseCount + englishCount;
  if (totalChars === 0) return 'en';
  const chineseRatio = chineseCount / totalChars;
  if (chineseRatio > 0.3) return chineseRatio > 0.7 ? 'zh' : 'mixed';
  return 'en';
}

/** ===== 标题上下文管理器 ===== */
class HeadingContext {
  private headings: { level: number; title: string }[] = [];

  update(level: number, title: string) {
    this.headings = this.headings.filter(h => h.level < level);
    this.headings.push({ level, title });
  }

  getContext(): string {
    if (this.headings.length === 0) return '';
    return this.headings.map(h => `${'#'.repeat(h.level)} ${h.title}`).join(' > ');
  }

  getCurrentLevel(): number {
    return this.headings.length > 0 ? this.headings[this.headings.length - 1].level : 0;
  }
}

/** ===== 智能文本合并策略 ===== */
class SmartMerger {
  /**
   * 🔧 FIX #1: 作者信息专用合并策略
   * 检测连续的作者-单位-邮箱模式，合并成一个完整块
   */
  static mergeAuthorBlock(scanner: LineScanner): string {
    const lines: string[] = [];
    let consecutiveBlankLines = 0;
    
    while (!scanner.eof()) {
      const line = scanner.peek();
      if (!line) break;
      
      const text = line.raw.trim();
      
      // 遇到明显的新块标记，停止
      if (/^#{1,6}\s+(Abstract|Introduction|Keywords)/i.test(text)) {
        break;
      }
      
      // 空行处理：连续2个空行则停止
      if (isBlank(text)) {
        consecutiveBlankLines++;
        if (consecutiveBlankLines >= 2) break;
        scanner.next();
        continue;
      }
      
      consecutiveBlankLines = 0;
      
      // 检测是否是作者信息模式
      const isAuthorPattern = (
        /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\*?$/.test(text) ||  // 人名
        /University|Institute|College|Laboratory|Department|Academy|School/i.test(text) ||  // 单位
        /@/.test(text) ||  // 邮箱
        /^[A-Z][a-z]+,\s+[A-Z][a-z]+/.test(text)  // 城市, 国家
      );
      
      if (!isAuthorPattern && lines.length > 0) {
        // 如果不是作者模式且已有内容，停止
        break;
      }
      
      lines.push(text);
      scanner.next();
      
      // 如果已经累积足够内容（约3-5个作者信息），先返回
      if (lines.length >= 15) break;
    }
    
    return lines.join('\n');
  }

  /**
   * 🔧 FIX #2: 关键词专用合并
   * 检测 Keywords 标题后的内容
   */
  static mergeKeywordsBlock(scanner: LineScanner): string {
    const lines: string[] = [];
    
    while (!scanner.eof() && lines.length < 5) {
      const line = scanner.peek();
      if (!line) break;
      
      const text = line.raw.trim();
      if (isBlank(text)) {
        scanner.next();
        break;  // 关键词通常是单行或少量行
      }
      
      // 遇到新标题停止
      if (/^#{1,6}\s+/.test(text) || /^\d+\.?\s+[A-Z]/.test(text)) {
        break;
      }
      
      lines.push(text);
      scanner.next();
      
      // 如果包含逗号分隔的关键词，可能已经完整
      if (text.includes(',') && lines.length >= 1) break;
    }
    
    return lines.join(' ');
  }
}

/** ===== LLM 批量分类结果 ===== */
type LlmClassResult = {
  type: 'title' | 'author' | 'affiliation' | 'email' | 'journal' | 'date' |
        'abstract-heading' | 'keywords-heading' | 'ccs-heading' | 'acmref-heading' |
        'references-heading' | 'acknowledgments-heading' |
        'heading' | 'paragraph' | 'metadata' | 'ignore' | 'other';
  confidence?: number;
  reasoning?: string;
};

/** ===== 改进的 LLM 分类 Prompt ===== */
async function classifyTextBatchLLM(
  client: DeepSeekClient, 
  text: string, 
  headingContext: string
): Promise<LlmClassResult> {
  const sys = 'You are an expert academic paper structure analyzer. Return ONLY valid JSON.';
  
  // 🔧 FIX: 优化 Prompt，增加更详细的规则和示例
  const prompt = `Analyze this text segment from an academic paper and classify it precisely.

**Current Section Context:** ${headingContext || '<Document Start - Front Matter>'}

**Text to Classify:**
"""
${text}
"""

**Classification Rules:**

1. **title** - Paper main title (usually first text, often capitalized, 5-20 words)
   Example: "Attention Is All You Need"

2. **author** - Author names, possibly with asterisks (*)
   Pattern: Capitalized names, may include multiple people separated by newlines
   Example: "Yang Zhang*\nWenbo Yang\nJun Wang*"

3. **affiliation** - Institution names
   Keywords: University, Institute, College, Laboratory, Department, Academy, Center
   Pattern: Often appears after author names
   Example: "Southwestern University of Finance and Economics\nChengdu, China"

4. **email** - Email addresses (contains @)
   Example: "zhang.yang@example.edu"

5. **journal** - Conference/journal name with venue and year
   Pattern: Conference acronym + year + location OR Journal name + volume
   Example: "KDD '25, August 3-7, 2025, Toronto, Canada"

6. **date** - Publication date
   Example: "August 2025" or "2025-08-15"

7. **abstract-heading** - Abstract section header
   Exact match: "ABSTRACT" or "Abstract" (case-insensitive, standalone)

8. **keywords-heading** - Keywords section header
   Exact match: "KEYWORDS" or "Keywords" or "Key words" (standalone line)

9. **keywords-content** - **NEW TYPE** Comma-separated keyword list
   Pattern: Technical terms separated by commas/semicolons
   Example: "Multimodal learning, Causal Learning, Financial dataset, Timeseries Forecasting"

10. **paragraph** - Normal body text, sentences with proper grammar

11. **heading** - Section/subsection titles
    Pattern: Starts with # or numbers (1., 1.1, etc.) or capitalized standalone line
    Example: "# Introduction" or "1. Introduction" or "INTRODUCTION"

12. **metadata** - DOI, copyright, ACM reference format, CCS concepts, permissions

13. **ignore** - Page numbers, headers, footers, irrelevant fragments

14. **other** - Cannot classify confidently

**Special Detection:**
- If text contains ONLY comma-separated technical terms → keywords-content
- If multiple people names + institutions + emails appear together → author (treat as one block)
- If text is after "Keywords:" or "Key words:" and looks like keyword list → keywords-content

**Output Format (JSON only):**
{
  "type": "...",
  "confidence": 0.95,
  "reasoning": "Brief explanation in 10 words"
}`;

  try {
    const res = await client.chat(sys, prompt, { maxTokens: 200 });
    const jsonMatch = res.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { type: 'other' };
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      type: parsed.type || 'other',
      confidence: parsed.confidence,
      reasoning: parsed.reasoning
    };
  } catch (e) {
    console.error('LLM classification error:', e);
    return { type: 'other' };
  }
}

/** ===== 行内公式修复 ===== */
async function fixInlineMath(client: DeepSeekClient, latex: string): Promise<string> {
  if (!latex || latex.trim().length === 0) return latex;
  
  // 🔧 FIX #3: 确保去除 $ 符号
  let cleaned = latex.trim();
  if (cleaned.startsWith('$')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('$')) cleaned = cleaned.slice(0, -1);
  cleaned = cleaned.trim();
  
  const prompt = `Fix this LaTeX inline math if it has syntax errors. Return ONLY the corrected LaTeX without $ symbols.

Input: ${cleaned}

Rules:
1. NO surrounding $ symbols in output
2. Balance all braces {}
3. Fix common errors: \frac, \sqrt, subscripts, superscripts
4. Keep math meaning unchanged
5. If already correct, return as-is

Output (LaTeX only):`;

  try {
    const res = await client.chat(
      'You are a LaTeX syntax expert. Output only corrected LaTeX code.',
      prompt,
      { maxTokens: 100 }
    );
    let fixed = res.trim();
    // 再次确保没有 $ 符号
    if (fixed.startsWith('$')) fixed = fixed.slice(1);
    if (fixed.endsWith('$')) fixed = fixed.slice(0, -1);
    return fixed.trim() || cleaned;
  } catch {
    return cleaned;
  }
}

/** ===== 改进的参考文献解析 ===== */
function parseReferences(rawText: string, generateId: () => string): Reference[] {
  if (!rawText || !rawText.trim()) return [];
  
  // 🔧 FIX #6: 改进参考文献解析
  const items = rawText
    .split(/\n(?=\s*\[?\d+\]?\.?\s+)/)  // 按编号分割
    .map(s => s.trim())
    .filter(s => s.length > 10);  // 过滤太短的
  
  const references: Reference[] = [];
  let num = 1;
  
  for (const item of items) {
    // 提取编号
    const numMatch = item.match(/^\[?(\d+)\]?\.?\s+/);
    if (numMatch) {
      num = parseInt(numMatch[1], 10);
    }
    
    // 清理文本
    const cleanText = item.replace(/^\[?\d+\]?\.?\s+/, '');
    
    // 提取作者（通常在开头，逗号前或句号前）
    const authors: string[] = [];
    const authorMatch = cleanText.match(/^([^.]+?)(?:\.|:)\s+/);
    if (authorMatch) {
      const authorText = authorMatch[1];
      // 简单分割（实际可以更复杂）
      authors.push(...authorText.split(/,\s*(?:and\s+)?/).map(a => a.trim()).filter(Boolean));
    }
    
    // 提取标题（通常在引号内或加粗）
    let title = '';
    const titleMatch = cleanText.match(/["""'']([^"""'']+)["""'']/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      // 如果没有引号，取第一个句号前的内容作为标题
      const parts = cleanText.split(/\.\s+/);
      title = parts[1]?.trim() || parts[0]?.trim() || cleanText.slice(0, 100);
    }
    
    // 提取年份
    const yearMatch = cleanText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;
    
    // 提取 DOI
    const doiMatch = cleanText.match(/(?:doi:|DOI:)?\s*(10\.\d{4,9}\/[\w.()/:;-]+)/i);
    const doi = doiMatch ? doiMatch[1].replace(/[),.;]+$/, '') : undefined;
    
    // 提取 URL
    const urlMatch = cleanText.match(/https?:\/\/\S+/);
    const url = urlMatch ? urlMatch[0].replace(/[),.;]+$/, '') : undefined;
    
    // 提取期刊/会议名称（在标题后，年份前）
    let publication: string | undefined;
    if (title) {
      const afterTitle = cleanText.split(title)[1];
      if (afterTitle) {
        const pubMatch = afterTitle.match(/[,.]?\s*(?:In\s+)?([^,.\d]+?)(?:,|\.|vol|pp|\d{4})/i);
        if (pubMatch) {
          publication = pubMatch[1].trim();
        }
      }
    }
    
    // 提取页码
    const pagesMatch = cleanText.match(/(?:pp\.|pages?)\s*(\d+(?:[-–]\d+)?)/i);
    const pages = pagesMatch ? pagesMatch[1] : undefined;
    
    // 提取卷号
    const volumeMatch = cleanText.match(/(?:vol\.|volume)\s*(\d+)/i);
    const volume = volumeMatch ? volumeMatch[1] : undefined;
    
    // 提取期号
    const issueMatch = cleanText.match(/(?:no\.|number)\s*(\d+)/i);
    const issue = issueMatch ? issueMatch[1] : undefined;
    
    references.push({
      id: generateId(),
      number: num,
      authors: authors.length > 0 ? authors : ['Unknown'],
      title: title || cleanText.slice(0, 80),
      publication,
      year,
      doi,
      url,
      pages,
      volume,
      issue
    });
    
    num++;
  }
  
  return references;
}

// ========= 主解析器 =========
export class AIMarkdownParser {
  private client: DeepSeekClient;
  private paperId: string;
  private progressCallback?: (progress: ParseProgress) => void;
  private documentLanguage: 'en' | 'zh' | 'mixed' = 'en';
  private usedIds: Set<string> = new Set();
  private headingContext = new HeadingContext();

  private readonly DELAY_BETWEEN_REQUESTS = 500;
  private readonly MAX_RESPONSE_TOKENS = 6000;
  private readonly MIN_LINE_TOKENS = 15;
  private readonly MAX_MERGE_LINES = 10;

  constructor(
    paperId: string,
    client: DeepSeekClient,
    progressCallback?: (progress: ParseProgress) => void
  ) {
    this.paperId = paperId;
    this.client = client;
    this.progressCallback = progressCallback;
  }

  private generateUniqueId(prefix: string = ''): string {
    let id: string;
    do { 
      id = prefix ? `${prefix}-${randomUUID()}` : randomUUID(); 
    } while (this.usedIds.has(id));
    this.usedIds.add(id);
    return id;
  }

  private logProgress(message: string) {
    console.log(`\x1b[36m[Parser]\x1b[0m ${message}`);
  }

  async parse(markdownContent: string): Promise<{
    metadata: {
      title: string;
      authors: Array<{ name: string; affiliation?: string; email?: string }>;
      journal?: string;
      publicationDate?: string;
      doi?: string;
      year?: number;
      articleType?: string;
    };
    content: {
      abstract?: { en?: string; zh?: string };
      keywords?: string[];
      sections: Section[];
      references: Reference[];
      blockNotes: any[];
      checklistNotes: any[];
      attachments?: string[];
    };
  }> {
    const startTime = Date.now();
    
    try {
      // ===== 阶段 0: 初始化 =====
      this.logProgress('🚀 Starting parse...');
      this.documentLanguage = detectLanguage(markdownContent);
      this.updateProgress('metadata', 5, { message: 'Language detected: ' + this.documentLanguage });

      const normalized = normalizeMarkdown(markdownContent);
      const scanner = new LineScanner(normalized);
      const lineTotal = scanner.total();
      this.logProgress(`📄 Total lines: ${lineTotal}`);

      // ===== 阶段 1: 前置元数据解析 =====
      this.logProgress('📋 Phase 1: Parsing metadata...');
      this.updateProgress('metadata', 12, { message: 'Parsing front-matter' });

      let title = '';
      const authors: { name: string; affiliation?: string; email?: string }[] = [];
      let journal = '';
      let publicationDate = '';
      let doi = '';
      
      let abstractEn = '';
      let abstractZh = '';
      let keywords: string[] = [];
      
      let inAbstract = false;
      let inKeywords = false;

      const carry = { value: '' };
      const sections: Section[] = [];
      const sectionStack: Section[] = [];

      let metadataLineCount = 0;
      const MAX_METADATA_LINES = 80;

      // 🔧 临时存储待关联的 affiliation 和 email
      let pendingAffiliations: string[] = [];
      let pendingEmails: string[] = [];

      while (!scanner.eof() && metadataLineCount < MAX_METADATA_LINES) {
        const curLine = scanner.peek();
        if (!curLine) break;

        metadataLineCount++;
        const lineProcessed = scanner.idx();
        
        if (lineProcessed % 10 === 0) {
          this.logProgress(`  📍 Line ${lineProcessed}/${lineTotal} (${Math.floor(lineProcessed/lineTotal*100)}%)`);
          this.updateProgress('metadata', Math.min(20, 12 + Math.floor(lineProcessed/lineTotal*8)), {
            lineProcessed,
            lineTotal
          });
        }

        if (isBlank(curLine.raw)) {
          scanner.next();
          continue;
        }

        // 🔧 FIX #1: 检测作者块模式
        const lookAhead = scanner.peek(1);
        const isAuthorBlockStart = lookAhead && (
          /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\*?$/.test(curLine.raw.trim()) &&
          /University|Institute|College|Department/i.test(lookAhead.raw)
        );

        let mergedText: string;
        if (isAuthorBlockStart) {
          mergedText = SmartMerger.mergeAuthorBlock(scanner);
          this.logProgress(`  👥 Merged author block (${mergedText.split('\n').length} lines)`);
        } else {
          mergedText = scanner.peekMergedLines(this.MIN_LINE_TOKENS, this.MAX_MERGE_LINES);
        }

        // 提前检测 Keywords
        if (/^Keywords?:?\s*/i.test(mergedText)) {
          scanner.consumeMergedLines(mergedText);
          inKeywords = true;
          inAbstract = false;
          this.logProgress('  🔑 Keywords heading detected');
          
          // 读取后续的关键词内容
          const keywordText = SmartMerger.mergeKeywordsBlock(scanner);
          if (keywordText) {
            const cleaned = keywordText.replace(/^Keywords?:?\s*/i, '').trim();
            const kws = cleaned.split(/[,;，；]/).map(s => s.trim()).filter(Boolean);
            keywords.push(...kws);
            this.logProgress(`  🔖 Extracted keywords: ${kws.join(', ')}`);
          }
          continue;
        }

        if (/^#{1,6}\s+(Introduction|Related Work|Background|Methodology|Methods|Experiments|Results|Discussion|Conclusion)/i.test(mergedText)) {
          this.logProgress('  ✅ Found main content heading, ending metadata phase');
          break;
        }

        const classification = await classifyTextBatchLLM(
          this.client,
          mergedText,
          this.headingContext.getContext()
        );

        this.logProgress(`  🏷️  Classified as: ${classification.type} (conf: ${classification.confidence?.toFixed(2) || 'N/A'})`);

        switch (classification.type) {
          case 'title':
            if (!title) {
              title = mergedText.replace(/^#\s*/, '').trim();
              this.logProgress(`  📌 Title: ${title.slice(0, 60)}...`);
            }
            scanner.consumeMergedLines(mergedText);
            break;

          case 'author':
            // 🔧 FIX: 更智能的作者信息提取
            const authorLines = mergedText.split('\n').map(l => l.trim()).filter(Boolean);
            
            let currentAuthor: any = null;
            for (const line of authorLines) {
              // 检测人名
              if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+\*?$/.test(line)) {
                if (currentAuthor) {
                  authors.push(currentAuthor);
                }
                currentAuthor = { name: line.replace(/\*+$/, '').trim() };
                this.logProgress(`  👤 Author: ${currentAuthor.name}`);
              }
              // 检测单位
              else if (/University|Institute|College|Laboratory|Department|Academy|Center/i.test(line)) {
                if (currentAuthor) {
                  if (!currentAuthor.affiliation) {
                    currentAuthor.affiliation = line;
                  } else {
                    currentAuthor.affiliation += ', ' + line;
                  }
                } else {
                  pendingAffiliations.push(line);
                }
                this.logProgress(`  🏛️  Affiliation: ${line.slice(0, 40)}`);
              }
              // 检测邮箱
              else if (/@/.test(line)) {
                const emailMatch = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
                if (emailMatch && currentAuthor) {
                  currentAuthor.email = emailMatch[0];
                  this.logProgress(`  📧 Email: ${emailMatch[0]}`);
                } else if (emailMatch) {
                  pendingEmails.push(emailMatch[0]);
                }
              }
            }
            
            if (currentAuthor) {
              authors.push(currentAuthor);
            }
            
            scanner.consumeMergedLines(mergedText);
            break;

          case 'affiliation':
            if (authors.length > 0) {
              const lastAuthor = authors[authors.length - 1];
              if (!lastAuthor.affiliation) {
                lastAuthor.affiliation = mergedText.trim();
              } else {
                lastAuthor.affiliation += ', ' + mergedText.trim();
              }
              this.logProgress(`  🏛️  Affiliation: ${mergedText.slice(0, 40)}`);
            } else {
              pendingAffiliations.push(mergedText.trim());
            }
            scanner.consumeMergedLines(mergedText);
            break;

          case 'email':
            const emailMatch = mergedText.match(/[\w.+-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
              if (authors.length > 0 && !authors[authors.length - 1].email) {
                authors[authors.length - 1].email = emailMatch[0];
                this.logProgress(`  📧 Email: ${emailMatch[0]}`);
              } else {
                pendingEmails.push(emailMatch[0]);
              }
            }
            scanner.consumeMergedLines(mergedText);
            break;

          case 'journal':
            journal = mergedText.trim();
            this.logProgress(`  📚 Journal: ${journal.slice(0, 50)}`);
            scanner.consumeMergedLines(mergedText);
            break;

          case 'date':
            publicationDate = mergedText.trim();
            scanner.consumeMergedLines(mergedText);
            break;

          case 'metadata':
            const doiMatch = mergedText.match(/10\.\d{4,9}\/[\w.()/:;-]+/i);
            if (doiMatch) {
              doi = doiMatch[0];
              this.logProgress(`  🔗 DOI: ${doi}`);
            }
            scanner.consumeMergedLines(mergedText);
            break;

          case 'abstract-heading':
            inAbstract = true;
            inKeywords = false;
            this.logProgress('  📝 Entering Abstract section');
            scanner.consumeMergedLines(mergedText);
            break;

          case 'keywords-heading':
            inKeywords = true;
            inAbstract = false;
            this.logProgress('  🔑 Entering Keywords section');
            scanner.consumeMergedLines(mergedText);
            break;

          // 🔧 FIX #2: 新增 keywords-content 类型处理
          case 'keywords-content' as any:
            const cleaned = mergedText.replace(/^Keywords?:?\s*/i, '').trim();
            const kws = cleaned.split(/[,;，；]/).map(s => s.trim()).filter(Boolean);
            keywords.push(...kws);
            this.logProgress(`  🔖 Keywords extracted: ${kws.join(', ')}`);
            scanner.consumeMergedLines(mergedText);
            break;

          case 'ccs-heading':
          case 'acmref-heading':
          case 'ignore':
            this.logProgress(`  ⏭️  Skipping ${classification.type}`);
            scanner.consumeMergedLines(mergedText);
            break;

          case 'references-heading':
            this.logProgress('  📚 Found References, ending metadata');
            metadataLineCount = MAX_METADATA_LINES;
            break;

          case 'heading':
            if (/Introduction|Related Work|Background|Method/i.test(mergedText)) {
              this.logProgress('  🎯 Main content heading found, ending metadata');
              metadataLineCount = MAX_METADATA_LINES;
            } else {
              scanner.consumeMergedLines(mergedText);
            }
            break;

          case 'paragraph':
            if (inAbstract) {
              abstractEn += (abstractEn ? '\n' : '') + mergedText.trim();
              this.logProgress(`  📄 Abstract paragraph (${mergedText.length} chars)`);
            } else if (inKeywords) {
              const kws = mergedText.split(/[,;，；]/).map(s => s.trim()).filter(Boolean);
              keywords.push(...kws);
              this.logProgress(`  🔖 Keywords: ${kws.join(', ')}`);
            }
            scanner.consumeMergedLines(mergedText);
            break;

          default:
            scanner.next();
        }

        await this.sleep(100);
      }

      // 🔧 关联待处理的 affiliation 和 email
      if (pendingAffiliations.length > 0 && authors.length > 0) {
        for (let i = 0; i < Math.min(pendingAffiliations.length, authors.length); i++) {
          if (!authors[i].affiliation) {
            authors[i].affiliation = pendingAffiliations[i];
          }
        }
      }
      if (pendingEmails.length > 0 && authors.length > 0) {
        for (let i = 0; i < Math.min(pendingEmails.length, authors.length); i++) {
          if (!authors[i].email) {
            authors[i].email = pendingEmails[i];
          }
        }
      }

      this.logProgress(`✅ Metadata parsed: title=${!!title}, authors=${authors.length}, keywords=${keywords.length}, abstract=${!!abstractEn}`);

      // ===== 阶段 2: 正文解析 =====
      this.logProgress('📖 Phase 2: Parsing body content...');
      this.updateProgress('parsing', 25, { message: 'Parsing body' });

      // 🔧 FIX #5: 修复标题重复问题
      const pushHeading = (level: number, titleEn: string) => {
        this.headingContext.update(level, titleEn);
        
        // ❌ 不再创建 HeadingBlock 并推入 content
        // 只创建 Section，设置 title
        
        const newSection: Section = {
          id: this.generateUniqueId('section'),
          number: undefined,
          title: { en: titleEn, zh: '' },
          content: [],  // 空的，不包含 heading block
          subsections: []
        };
        
        while (sectionStack.length && (sectionStack.length > level - 1)) {
          sectionStack.pop();
        }
        
        if (sectionStack.length === 0) {
          sections.push(newSection);
        } else {
          sectionStack[sectionStack.length - 1].subsections!.push(newSection);
        }
        
        sectionStack.push(newSection);
        
        this.logProgress(`  📑 Section [L${level}]: ${titleEn.slice(0, 50)}`);
      };

      let bodyLineCount = 0;
      while (!scanner.eof()) {
        bodyLineCount++;
        const lineProcessed = scanner.idx();

        if (bodyLineCount % 20 === 0) {
          this.logProgress(`  📍 Line ${lineProcessed}/${lineTotal} (${Math.floor(lineProcessed/lineTotal*100)}%)`);
          this.updateProgress('parsing', Math.min(70, 25 + Math.floor((lineProcessed/lineTotal)*45)), {
            lineProcessed,
            lineTotal
          });
        }

        const cur = scanner.peek();
        if (!cur) break;

        if (/^\s*#{1,6}\s*(references|bibliography|参考文献)\s*$/i.test(cur.raw.trim())) {
          this.logProgress('  📚 Found References heading');
          scanner.next();
          break;
        }

        const parsers = [
          parseCodeBlock,
          parseBlockMath,
          parseTable,
          parseImage,
          parseBlockquote,
          parseDivider,
          parseList,
          parseHeading
        ];

        let block: BlockContent | null = null;
        for (const fn of parsers) {
          block = fn(scanner as any);
          if (block) break;
        }

        if (block && block.type === 'heading') {
          const en = (block as any).content?.en?.map((x: any) => x.content || '').join('') || '';
          const lv = (block as any).level || 1;
          pushHeading(lv, en);
          continue;  // 🔧 直接 continue，不要把 heading 推入 content
        }

        if (!block) {
          block = parseParagraph(scanner, carry);
          if (!block) {
            scanner.next();
            continue;
          }
        }

        block.id = this.generateUniqueId(block.type);

        if (sectionStack.length === 0) {
          const root: Section = {
            id: this.generateUniqueId('section'),
            title: { en: '', zh: '' },
            content: [],
            subsections: []
          };
          sections.push(root);
          sectionStack.push(root);
        }
        
        sectionStack[sectionStack.length - 1].content.push(block);
      }

      this.logProgress(`✅ Body parsed: ${sections.length} sections`);

      // ===== 阶段 3: 行内公式修复 =====
      this.logProgress('🔧 Phase 3: Fixing inline math...');
      this.updateProgress('parsing', 72, { message: 'Fixing inline math' });

      let mathFixCount = 0;
      const fixMathInSections = async (secs: Section[]) => {
        for (const sec of secs) {
          for (const block of sec.content) {
            if (block.type === 'paragraph' || block.type === 'heading') {
              const content = (block as any).content?.en || [];
              for (let i = 0; i < content.length; i++) {
                if (content[i].type === 'inline-math') {
                  const original = content[i].latex;
                  const fixed = await fixInlineMath(this.client, original);
                  if (fixed !== original) {
                    content[i].latex = fixed;
                    mathFixCount++;
                    this.logProgress(`  🔧 Fixed math: ${original} → ${fixed}`);
                  }
                }
              }
            }
          }
          if (sec.subsections) await fixMathInSections(sec.subsections);
        }
      };

      await fixMathInSections(sections);
      this.logProgress(`✅ Fixed ${mathFixCount} inline math expressions`);

      // ===== 阶段 4: 翻译 =====
      if (this.documentLanguage === 'en' && abstractEn) {
        this.logProgress('🌏 Phase 4: Translating to Chinese...');
        this.updateProgress('parsing', 75, { message: 'Translating abstract' });
        abstractZh = await this.translateToZh(abstractEn, 'abstract');
        this.logProgress('  ✅ Abstract translated');

        const texts: { write: (zh: string) => void; text: string }[] = [];
        const collectTexts = (sec: Section) => {
          // 收集 section title
          if (sec.title.en) {
            texts.push({
              text: sec.title.en,
              write: (zh: string) => { sec.title.zh = zh; }
            });
          }
          
          for (const b of sec.content) {
            if (b.type === 'paragraph') {
              const en = ((b as any).content?.en || [])
                .map((n: any) => n.type === 'text' ? n.content : '').join('');
              if (en) {
                texts.push({
                  text: en,
                  write: (zh: string) => { (b as any).content.zh = toInline(zh); }
                });
              }
            }
          }
          for (const s of sec.subsections || []) collectTexts(s);
        };

        for (const s of sections) collectTexts(s);

        const batchSize = 20;
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const joined = batch.map(x => x.text).join('\n<<<SEP>>>\n');
          const zhJoined = await this.translateToZh(joined, 'body');
          const zhParts = zhJoined.split(/\n?<<<SEP>>>\n?/).map(s => s.trim());
          
          for (let k = 0; k < batch.length && k < zhParts.length; k++) {
            batch[k].write(zhParts[k] || '');
          }
          
          this.logProgress(`  🌏 Translated ${i + batch.length}/${texts.length} texts`);
          this.updateProgress('parsing', 75 + Math.floor((i / texts.length) * 5), {
            message: `Translating ${i}/${texts.length}`
          });
          
          if (i + batchSize < texts.length) {
            await this.sleep(this.DELAY_BETWEEN_REQUESTS);
          }
        }

        this.logProgress('✅ Translation complete');
      }

      // ===== 阶段 5: 参考文献 =====
      this.logProgress('📚 Phase 5: Parsing references...');
      this.updateProgress('references', 85, { message: 'Parsing references' });

      const refsRaw = scanner.remainingText();
      const references = parseReferences(refsRaw, () => this.generateUniqueId('ref'));
      this.logProgress(`✅ Parsed ${references.length} references`);

      // ===== 阶段 6: 图片处理 =====
      this.logProgress('🖼️  Phase 6: Processing images...');
      await this.processImages(sections);
      this.updateProgress('images', 95, { message: 'Images processed' });

      // ===== 提取年份和文章类型 =====
      let year: number | undefined;
      if (publicationDate) {
        const yearMatch = publicationDate.match(/\b(20\d{2}|19\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1], 10);
      }
      if (!year && journal) {
        const yearMatch = journal.match(/\b(20\d{2}|19\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1], 10);
      }

      let articleType: 'conference' | 'journal' | 'preprint' | 'book' | 'thesis' | undefined;
      if (journal) {
        const lowerJournal = journal.toLowerCase();
        if (lowerJournal.includes('conference') || lowerJournal.includes('proceedings') || 
            lowerJournal.match(/\b(acm|ieee|cvpr|iccv|neurips|icml|iclr|aaai|ijcai)\b/)) {
          articleType = 'conference';
        } else if (lowerJournal.includes('arxiv') || lowerJournal.includes('preprint')) {
          articleType = 'preprint';
        } else if (lowerJournal.includes('journal') || lowerJournal.includes('transactions')) {
          articleType = 'journal';
        } else if (lowerJournal.includes('book')) {
          articleType = 'book';
        } else if (lowerJournal.includes('thesis') || lowerJournal.includes('dissertation')) {
          articleType = 'thesis';
        }
      }

      // ===== 完成 =====
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logProgress(`🎉 Parse complete in ${elapsed}s`);
      this.updateProgress('completed', 100, { message: 'Parsing completed' });

      return {
        metadata: {
          title: title || 'Untitled',
          authors,
          journal: journal || undefined,
          publicationDate: publicationDate || undefined,
          doi: doi || undefined,
          year,
          articleType: articleType || 'journal'
        },
        content: {
          abstract: { en: abstractEn || undefined, zh: abstractZh || undefined },
          keywords,
          sections,
          references,
          blockNotes: [],
          checklistNotes: [],
          attachments: []
        }
      };

    } catch (err: any) {
      this.logProgress(`❌ Parse failed: ${err.message}`);
      this.updateProgress('completed', 100, { message: 'Failed' });
      throw err;
    }
  }

  private async translateToZh(text: string, context: string = 'general'): Promise<string> {
    if (!text || !text.trim()) return '';
    try {
      const prompt = `Translate to Chinese. Keep math, citations and inline markdown intact.
<text>
${text}
</text>
Output ONLY the translation.`;
      
      const resp = await this.client.chat(
        'You are a professional CN translator. Output only the Chinese translation.',
        prompt,
        { maxTokens: this.MAX_RESPONSE_TOKENS }
      );
      return (resp || '').trim();
    } catch {
      return '';
    }
  }

  private isExternalUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private async downloadImage(url: string, blockId: string): Promise<string> {
    const imageDir = path.join(__dirname, '../../data/uploads/images', this.paperId);
    await fs.mkdir(imageDir, { recursive: true });
    
    let ext = '.jpg';
    try {
      const u = new URL(url);
      const g = path.extname(u.pathname);
      if (g) ext = g;
    } catch { /* noop */ }
    
    const filename = `${blockId}${ext || '.jpg'}`;
    const localPath = path.join(imageDir, filename);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    await fs.writeFile(localPath, response.data);
    return `/uploads/images/${this.paperId}/${filename}`;
  }

  private async processImages(sections: Section[]): Promise<void> {
    const figures: any[] = [];
    const collect = (sec: Section) => {
      for (const b of sec.content) {
        if (b.type === 'figure') figures.push(b as any);
      }
      for (const s of sec.subsections || []) collect(s);
    };
    
    for (const s of sections) collect(s);

    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];
      this.updateProgress('images', 92 + Math.floor((i / Math.max(1, figures.length)) * 6), {
        totalImages: figures.length,
        imagesProcessed: i
      });
      
      if (fig.src && this.isExternalUrl(fig.src)) {
        try {
          const local = await this.downloadImage(fig.src, fig.id || this.generateUniqueId('figure'));
          fig.src = local;
          fig.uploadedFilename = path.basename(local);
          this.logProgress(`  ✅ Downloaded image: ${fig.src}`);
        } catch (e: any) {
          this.logProgress(`  ⚠️  Image download failed: ${e.message}`);
        }
      }
    }
  }

  private sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }

  private updateProgress(
    status: ParseJobStatus,
    percentage: number,
    extra?: Partial<ParseProgress> & { 
      lineProcessed?: number; 
      lineTotal?: number; 
      message?: string;
    }
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        status,
        percentage,
        message: extra?.message ?? ParseStatusMessages[status],
        lineProcessed: extra?.lineProcessed,
        lineTotal: extra?.lineTotal,
        ...extra
      } as any);
    }
  }
}