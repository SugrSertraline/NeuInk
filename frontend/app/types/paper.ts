// frontend/app/types/paper.ts

import { ChecklistNote, PaperMetadata } from "@neuink/shared";

// ============= 基础类型 =============

/** 论文唯一标识 */
export type PaperId = string;

/** 块元素唯一标识 */
export type BlockId = string;

// ============= 内联元素（Inline Elements）=============

/** 内联元素基类 */
export interface InlineElement {
  type: string;
}

/** 纯文本 */
export interface TextNode extends InlineElement {
  type: 'text';
  content: string;
    style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    color?: string;           
    backgroundColor?: string;  
  };
}

/** 超链接 */
export interface LinkNode extends InlineElement {
  type: 'link';
  url: string;
  children: InlineContent[];
  title?: string;
}

/** 行内数学公式 */
export interface InlineMathNode extends InlineElement {
  type: 'inline-math';
  latex: string;
}

/** 文献引用标注 */
export interface CitationNode extends InlineElement {
  type: 'citation';
  referenceIds: string[];
  displayText: string;
}

/** 图表引用标注 */
export interface FigureRefNode extends InlineElement {
  type: 'figure-ref';
  figureId: BlockId;
  displayText: string;
}

export interface TableRefNode extends InlineElement {
  type: 'table-ref';
  tableId: BlockId;
  displayText: string;
}

/** 章节引用标注 */
export interface SectionRefNode extends InlineElement {
  type: 'section-ref';
  sectionId: BlockId;
  displayText: string;
}

/** 公式引用标注 */
export interface EquationRefNode extends InlineElement {
  type: 'equation-ref';
  equationId: BlockId;
  displayText: string;
}

/** 脚注 */
export interface FootnoteNode extends InlineElement {
  type: 'footnote';
  id: string;
  content: string;
  displayText: string;
}

/** 所有内联元素类型联合 */
export type InlineContent = 
  | TextNode 
  | LinkNode 
  | InlineMathNode 
  | CitationNode 
  | FigureRefNode 
  | TableRefNode 
  | SectionRefNode 
  | EquationRefNode
  | FootnoteNode;

// ============= 块级元素（Block Elements）=============

/** 块级元素基类 */
export interface BlockElement {
  id: BlockId;
  type: string;
}

/** 标题 */
export interface HeadingBlock extends BlockElement {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  number?: string;
}

/** 段落 */
export interface ParagraphBlock extends BlockElement {
  type: 'paragraph';
  content: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  align?: 'left' | 'center' | 'right' | 'justify';
}

/** 块级数学公式 */
export interface MathBlock extends BlockElement {
  type: 'math';
  latex: string;
  label?: string;
  number?: number;
}

/** 图片/插图 */
export interface FigureBlock extends BlockElement {
  type: 'figure';
  src: string;
  alt?: string;
  number?: number;
  caption: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  description?: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  width?: string;
  height?: string;
  uploadedFilename?: string;
}

/** 表格 */
export interface TableBlock extends BlockElement {
  type: 'table';
  number?: number;
  caption: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  description?: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  headers?: string[];
  rows: string[][];
  align?: ('left' | 'center' | 'right')[];
}

/** 代码块 */
export interface CodeBlock extends BlockElement {
  type: 'code';
  language?: string;
  code: string;
  caption?: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  showLineNumbers?: boolean;
}

/** 有序列表 */
export interface OrderedListBlock extends BlockElement {
  type: 'ordered-list';
  items: {
    content: {
      en?: InlineContent[];
      zh?: InlineContent[];
    };
  }[];
  start?: number;
}

/** 无序列表 */
export interface UnorderedListBlock extends BlockElement {
  type: 'unordered-list';
  items: {
    content: {
      en?: InlineContent[];
      zh?: InlineContent[];
    };
  }[];
}

/** 引用块 */
export interface QuoteBlock extends BlockElement {
  type: 'quote';
  content: {
    en?: InlineContent[];
    zh?: InlineContent[];
  };
  author?: string;
}

/** 分隔线 */
export interface DividerBlock extends BlockElement {
  type: 'divider';
}

/** 所有块级元素类型联合 */
export type BlockContent = 
  | HeadingBlock 
  | ParagraphBlock 
  | MathBlock 
  | FigureBlock 
  | TableBlock 
  | CodeBlock 
  | OrderedListBlock 
  | UnorderedListBlock 
  | QuoteBlock 
  | DividerBlock;

// ============= 章节结构 =============

/** 论文章节 */
export interface Section {
  id: BlockId;
  number?: string;
  title: {
    en?: string;
    zh?: string;
  };
  content: BlockContent[];
  subsections?: Section[];
}

// ============= 参考文献 =============

/** 参考文献 */
export interface Reference {
  id: string;
  number?: number;
  authors: string[];
  title: string;
  publication?: string;
  year?: number;
  doi?: string;
  url?: string;
  pages?: string;
  volume?: string;
  issue?: string;
}

// ============= 笔记系统 =============

/** 块级笔记 */
export interface BlockNote {
  id: string;
  blockId: BlockId;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}



// ============= 完整论文结构 =============

/** 完整论文数据（JSON文件格式） */
export interface PaperContent {
  metadata: PaperMetadata & {
    parseStatus?: string;
    pdfPath?: string;
  };
  abstract?: {                    // 🆕 新增
    en?: string;
    zh?: string;
  };
  keywords?: string[];
  sections: Section[];
  references: Reference[];
  blockNotes: BlockNote[];
  checklistNotes: ChecklistNote[];
  pdfPath?: string;
  attachments?: string[];
}


export type { ChecklistNote };
