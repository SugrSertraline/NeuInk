// backend/src/services/markupParser.ts

import { randomUUID } from 'crypto';
import {
  InlineContent,
  TextNode,
  LinkNode,
  InlineMathNode,
  CitationNode,
  FigureRefNode,
  TableRefNode,
  BlockContent,
  HeadingBlock,
  ParagraphBlock,
  MathBlock,
  FigureBlock,
  TableBlock,
  CodeBlock,
  OrderedListBlock,
  UnorderedListBlock,
  QuoteBlock,
  DividerBlock,
  Section,
  Reference
} from '../types/paper';

/**
 * 标记文本解析器
 * 将LLM输出的增强Markdown格式转换为结构化数据
 */
export class MarkupParser {
  
  /**
   * 解析内联内容（支持Markdown语法）
   */
  parseInlineContent(text: string): InlineContent[] {
    if (!text) return [];
    
    const result: InlineContent[] = [];
    let remaining = text;
    
    // 正则模式（按优先级）
    const patterns = [
      // 引用标记: [1,2,3] 或 [1-3]
      { regex: /\[(\d+(?:,\s*\d+)*|\d+-\d+)\]/g, type: 'citation' },
      // 图表引用: Fig. 1, Figure 1, Table 1, Eq. 1
      { regex: /(?:Fig\.|Figure)\s+(\d+)/gi, type: 'figure-ref' },
      { regex: /Table\s+(\d+)/gi, type: 'table-ref' },
      { regex: /(?:Eq\.|Equation)\s+(\d+)/gi, type: 'equation-ref' },
      // 行内数学: $...$
      { regex: /\$([^$]+)\$/g, type: 'inline-math' },
      // 链接: [text](url)
      { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' },
      // 样式: **bold**, *italic*, `code`, ~~strike~~
      { regex: /\*\*([^*]+)\*\*/g, type: 'bold' },
      { regex: /\*([^*]+)\*/g, type: 'italic' },
      { regex: /`([^`]+)`/g, type: 'code' },
      { regex: /~~([^~]+)~~/g, type: 'strikethrough' },
    ];
    
    let lastIndex = 0;
    const matches: Array<{ index: number; length: number; node: InlineContent }> = [];
    
    // 收集所有匹配
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const node = this.createInlineNode(pattern.type, match);
        if (node) {
          matches.push({
            index: match.index,
            length: match[0].length,
            node
          });
        }
      }
    }
    
    // 按位置排序
    matches.sort((a, b) => a.index - b.index);
    
    // 构建结果（处理重叠）
    lastIndex = 0;
    for (const match of matches) {
      // 添加前面的纯文本
      if (match.index > lastIndex) {
        const plainText = text.substring(lastIndex, match.index);
        if (plainText) {
          result.push({ type: 'text', content: plainText });
        }
      }
      
      result.push(match.node);
      lastIndex = match.index + match.length;
    }
    
    // 添加剩余文本
    if (lastIndex < text.length) {
      const plainText = text.substring(lastIndex);
      if (plainText) {
        result.push({ type: 'text', content: plainText });
      }
    }
    
    // 如果没有任何特殊格式，返回纯文本
    if (result.length === 0 && text.trim()) {
      result.push({ type: 'text', content: text });
    }
    
    return result;
  }
  
  /**
   * 创建内联节点
   */
  private createInlineNode(type: string, match: RegExpExecArray): InlineContent | null {
    switch (type) {
      case 'citation':
        return {
          type: 'citation',
          referenceIds: this.parseCitationIds(match[1]),
          displayText: match[0]
        } as CitationNode;
        
      case 'figure-ref':
        return {
          type: 'figure-ref',
          figureId: `fig-${match[1]}`,
          displayText: match[0]
        } as FigureRefNode;
        
      case 'table-ref':
        return {
          type: 'table-ref',
          tableId: `table-${match[1]}`,
          displayText: match[0]
        } as TableRefNode;
        
      case 'equation-ref':
        return {
          type: 'equation-ref',
          equationId: `eq-${match[1]}`,
          displayText: match[0]
        } as any;
        
      case 'inline-math':
        return {
          type: 'inline-math',
          latex: match[1]
        } as InlineMathNode;
        
      case 'link':
        return {
          type: 'link',
          url: match[2],
          children: [{ type: 'text', content: match[1] }]
        } as LinkNode;
        
      case 'bold':
        return {
          type: 'text',
          content: match[1],
          style: { bold: true }
        } as TextNode;
        
      case 'italic':
        return {
          type: 'text',
          content: match[1],
          style: { italic: true }
        } as TextNode;
        
      case 'code':
        return {
          type: 'text',
          content: match[1],
          style: { code: true }
        } as TextNode;
        
      case 'strikethrough':
        return {
          type: 'text',
          content: match[1],
          style: { strikethrough: true }
        } as TextNode;
        
      default:
        return null;
    }
  }
  
  /**
   * 解析引用ID
   */
  private parseCitationIds(text: string): string[] {
    // 处理范围: "1-3" -> ["ref-1", "ref-2", "ref-3"]
    if (text.includes('-')) {
      const [start, end] = text.split('-').map(s => parseInt(s.trim()));
      const ids: string[] = [];
      for (let i = start; i <= end; i++) {
        ids.push(`ref-${i}`);
      }
      return ids;
    }
    
    // 处理列表: "1,2,3" -> ["ref-1", "ref-2", "ref-3"]
    return text.split(',').map(s => `ref-${s.trim()}`);
  }
  
  /**
   * 解析块级内容
   */
  parseBlocks(markup: string): BlockContent[] {
    const blocks: BlockContent[] = [];
    const lines = markup.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // 跳过空行
      if (!line) {
        i++;
        continue;
      }
      
      // 标题
      if (line.startsWith('#HEADING')) {
        const block = this.parseHeading(lines, i);
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 段落
      if (line.startsWith('#PARA')) {
        const block = this.parseParagraph(lines, i);
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 数学公式
      if (line.startsWith('#MATH')) {
        const block = this.parseMath(lines, i);
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 图片
      if (line.startsWith('#FIGURE')) {
        const block = this.parseFigure(lines, i);
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 表格
      if (line.startsWith('#TABLE')) {
        const block = this.parseTable(lines, i);
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 代码
      if (line.startsWith('#CODE')) {
        const block = this.parseCode(lines, i);
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 列表
      if (line.startsWith('#LIST-ORDERED')) {
        const block = this.parseList(lines, i, 'ordered');
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      if (line.startsWith('#LIST-UNORDERED')) {
        const block = this.parseList(lines, i, 'unordered');
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 引用块
      if (line.startsWith('#QUOTE')) {
        const block = this.parseQuote(lines, i);
        if (block.block) {
          blocks.push(block.block);
          i = block.nextIndex;
          continue;
        }
      }
      
      // 分隔线
      if (line === '#DIVIDER' || line === '---' || line === '***') {
        blocks.push({
          id: randomUUID(),
          type: 'divider'
        } as DividerBlock);
        i++;
        continue;
      }
      
      i++;
    }
    
    return blocks;
  }
  
  /**
   * 解析标题
   */
  private parseHeading(lines: string[], startIndex: number): { block: HeadingBlock | null; nextIndex: number } {
    const headerLine = lines[startIndex];
    const match = headerLine.match(/#HEADING(\d)/);
    if (!match) return { block: null, nextIndex: startIndex + 1 };
    
    const level = parseInt(match[1]) as 1 | 2 | 3 | 4 | 5 | 6;
    let i = startIndex + 1;
    
    let enText = '';
    let zhText = '';
    let number = '';
    
    // 读取内容
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i].trim();
      if (line.startsWith('EN:')) {
        enText = line.substring(3).trim();
      } else if (line.startsWith('ZH:')) {
        zhText = line.substring(3).trim();
      } else if (line.startsWith('NUMBER:')) {
        number = line.substring(7).trim();
      }
      i++;
    }
    
    const block: HeadingBlock = {
      id: randomUUID(),
      type: 'heading',
      level,
      content: {
        en: enText ? this.parseInlineContent(enText) : undefined,
        zh: zhText ? this.parseInlineContent(zhText) : undefined
      },
      number: number || undefined
    };
    
    return { block, nextIndex: i };
  }
  
  /**
   * 解析段落
   */
  private parseParagraph(lines: string[], startIndex: number): { block: ParagraphBlock | null; nextIndex: number } {
    let i = startIndex + 1;
    let enText = '';
    let zhText = '';
    
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i].trim();
      if (line.startsWith('EN:')) {
        enText = line.substring(3).trim();
      } else if (line.startsWith('ZH:')) {
        zhText = line.substring(3).trim();
      }
      i++;
    }
    
    const block: ParagraphBlock = {
      id: randomUUID(),
      type: 'paragraph',
      content: {
        en: enText ? this.parseInlineContent(enText) : undefined,
        zh: zhText ? this.parseInlineContent(zhText) : undefined
      }
    };
    
    return { block, nextIndex: i };
  }
  
  /**
   * 解析数学公式
   */
  private parseMath(lines: string[], startIndex: number): { block: MathBlock | null; nextIndex: number } {
    let i = startIndex + 1;
    let latex = '';
    let label = '';
    
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i].trim();
      if (line.startsWith('LATEX:')) {
        latex = line.substring(6).trim();
      } else if (line.startsWith('LABEL:')) {
        label = line.substring(6).trim();
      } else if (line && !line.includes(':')) {
        // 多行LaTeX
        latex += '\n' + line;
      }
      i++;
    }
    
    const block: MathBlock = {
      id: label || randomUUID(),
      type: 'math',
      latex: latex.trim(),
      label: label || undefined
    };
    
    return { block, nextIndex: i };
  }
  
  /**
   * 解析图片
   */
  private parseFigure(lines: string[], startIndex: number): { block: FigureBlock | null; nextIndex: number } {
    let i = startIndex + 1;
    let src = '';
    let captionEn = '';
    let captionZh = '';
    let descEn = '';
    let descZh = '';
    let alt = '';
    let number: number | undefined;
    
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i].trim();
      if (line.startsWith('SRC:')) {
        src = line.substring(4).trim();
      } else if (line.startsWith('CAPTION-EN:')) {
        captionEn = line.substring(11).trim();
      } else if (line.startsWith('CAPTION-ZH:')) {
        captionZh = line.substring(11).trim();
      } else if (line.startsWith('DESC-EN:')) {
        descEn = line.substring(8).trim();
      } else if (line.startsWith('DESC-ZH:')) {
        descZh = line.substring(8).trim();
      } else if (line.startsWith('ALT:')) {
        alt = line.substring(4).trim();
      } else if (line.startsWith('NUMBER:')) {
        number = parseInt(line.substring(7).trim());
      }
      i++;
    }
    
    const block: FigureBlock = {
      id: randomUUID(),
      type: 'figure',
      src,
      alt: alt || undefined,
      number,
      caption: {
        en: captionEn ? this.parseInlineContent(captionEn) : undefined,
        zh: captionZh ? this.parseInlineContent(captionZh) : undefined
      },
      description: {
        en: descEn ? this.parseInlineContent(descEn) : undefined,
        zh: descZh ? this.parseInlineContent(descZh) : undefined
      }
    };
    
    return { block, nextIndex: i };
  }
  
  /**
   * 解析表格
   */
  private parseTable(lines: string[], startIndex: number): { block: TableBlock | null; nextIndex: number } {
    let i = startIndex + 1;
    let captionEn = '';
    let captionZh = '';
    let headers: string[] = [];
    const rows: string[][] = [];
    let number: number | undefined;
    
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i].trim();
      if (line.startsWith('CAPTION-EN:')) {
        captionEn = line.substring(11).trim();
      } else if (line.startsWith('CAPTION-ZH:')) {
        captionZh = line.substring(11).trim();
      } else if (line.startsWith('HEADERS:')) {
        headers = line.substring(8).trim().split('|').map(h => h.trim());
      } else if (line.startsWith('ROW:')) {
        const cells = line.substring(4).trim().split('|').map(c => c.trim());
        rows.push(cells);
      } else if (line.startsWith('NUMBER:')) {
        number = parseInt(line.substring(7).trim());
      }
      i++;
    }
    
    const block: TableBlock = {
      id: randomUUID(),
      type: 'table',
      number,
      caption: {
        en: captionEn ? this.parseInlineContent(captionEn) : undefined,
        zh: captionZh ? this.parseInlineContent(captionZh) : undefined
      },
      headers: headers.length > 0 ? headers : undefined,
      rows
    };
    
    return { block, nextIndex: i };
  }
  
  /**
   * 解析代码块
   */
  private parseCode(lines: string[], startIndex: number): { block: CodeBlock | null; nextIndex: number } {
    const headerLine = lines[startIndex];
    const langMatch = headerLine.match(/#CODE(?:\s+(\w+))?/);
    const language = langMatch?.[1];
    
    let i = startIndex + 1;
    const codeLines: string[] = [];
    let captionEn = '';
    let captionZh = '';
    
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i];
      if (line.trim().startsWith('CAPTION-EN:')) {
        captionEn = line.trim().substring(11).trim();
      } else if (line.trim().startsWith('CAPTION-ZH:')) {
        captionZh = line.trim().substring(11).trim();
      } else {
        codeLines.push(line);
      }
      i++;
    }
    
    const block: CodeBlock = {
      id: randomUUID(),
      type: 'code',
      language,
      code: codeLines.join('\n').trim(),
      caption: (captionEn || captionZh) ? {
        en: captionEn ? this.parseInlineContent(captionEn) : undefined,
        zh: captionZh ? this.parseInlineContent(captionZh) : undefined
      } : undefined
    };
    
    return { block, nextIndex: i };
  }
  
  /**
   * 解析列表
   */
  private parseList(lines: string[], startIndex: number, listType: 'ordered' | 'unordered'): { block: OrderedListBlock | UnorderedListBlock | null; nextIndex: number } {
    let i = startIndex + 1;
    const items: Array<{ content: { en?: InlineContent[]; zh?: InlineContent[] } }> = [];
    
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i].trim();
      if (line.startsWith('ITEM-EN:')) {
        const text = line.substring(8).trim();
        items.push({
          content: {
            en: this.parseInlineContent(text)
          }
        });
      } else if (line.startsWith('ITEM-ZH:')) {
        const text = line.substring(8).trim();
        if (items.length > 0) {
          items[items.length - 1].content.zh = this.parseInlineContent(text);
        }
      }
      i++;
    }
    
    const block = {
      id: randomUUID(),
      type: listType === 'ordered' ? 'ordered-list' : 'unordered-list',
      items
    };
    
    return { block: block as any, nextIndex: i };
  }
  
  /**
   * 解析引用块
   */
  private parseQuote(lines: string[], startIndex: number): { block: QuoteBlock | null; nextIndex: number } {
    let i = startIndex + 1;
    let enText = '';
    let zhText = '';
    let author = '';
    
    while (i < lines.length && !lines[i].trim().startsWith('#')) {
      const line = lines[i].trim();
      if (line.startsWith('EN:')) {
        enText = line.substring(3).trim();
      } else if (line.startsWith('ZH:')) {
        zhText = line.substring(3).trim();
      } else if (line.startsWith('AUTHOR:')) {
        author = line.substring(7).trim();
      }
      i++;
    }
    
    const block: QuoteBlock = {
      id: randomUUID(),
      type: 'quote',
      content: {
        en: enText ? this.parseInlineContent(enText) : undefined,
        zh: zhText ? this.parseInlineContent(zhText) : undefined
      },
      author: author || undefined
    };
    
    return { block, nextIndex: i };
  }
  
  /**
   * 解析参考文献
   */
  parseReferences(markup: string): Reference[] {
    const references: Reference[] = [];
    const lines = markup.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line.startsWith('#REF')) {
        let ref: Partial<Reference> = {
          id: randomUUID(),
          authors: []
        };
        
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('#')) {
          const dataLine = lines[i].trim();
          
          if (dataLine.startsWith('AUTHORS:')) {
            const authorText = dataLine.substring(8).trim();
            ref.authors = authorText.split(';').map(a => a.trim()).filter(Boolean);
          } else if (dataLine.startsWith('TITLE:')) {
            ref.title = dataLine.substring(6).trim();
          } else if (dataLine.startsWith('PUBLICATION:')) {
            ref.publication = dataLine.substring(12).trim();
          } else if (dataLine.startsWith('YEAR:')) {
            ref.year = parseInt(dataLine.substring(5).trim());
          } else if (dataLine.startsWith('DOI:')) {
            ref.doi = dataLine.substring(4).trim();
          } else if (dataLine.startsWith('URL:')) {
            ref.url = dataLine.substring(4).trim();
          } else if (dataLine.startsWith('PAGES:')) {
            ref.pages = dataLine.substring(6).trim();
          } else if (dataLine.startsWith('VOLUME:')) {
            ref.volume = dataLine.substring(7).trim();
          } else if (dataLine.startsWith('NUMBER:')) {
            ref.number = parseInt(dataLine.substring(7).trim());
          }
          
          i++;
        }
        
        if (ref.title) {
          references.push(ref as Reference);
        }
      } else {
        i++;
      }
    }
    
    return references;
  }
}