// 后端使用的论文类型定义

/** 作者信息 */
export interface Author {
  name: string;
  affiliation?: string;
  email?: string;
}

/** 文章类型 */
export type ArticleType = 'journal' | 'conference' | 'preprint' | 'book' | 'thesis';

/** SCI 分区 */
export type SciQuartile = '无' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

/** 中科院分区 */
export type CasQuartile = '无' | '1区' | '2区' | '3区' | '4区';

/** CCF 分级 */
export type CcfRank = '无' | 'A' | 'B' | 'C';

/** 阅读状态 */
export type ReadingStatus = 'unread' | 'reading' | 'finished';

/** 优先级 */
export type Priority = 'high' | 'medium' | 'low';

/** 论文元数据基础接口 */
interface PaperMetadataBase {
  id: string;
  title: string;
  shortTitle?: string;
  publication?: string;
  year?: number;
  date?: string;
  doi?: string;
  articleType?: ArticleType;
  sciQuartile?: SciQuartile;
  casQuartile?: CasQuartile;
  ccfRank?: CcfRank;
  impactFactor?: number;
  readingStatus?: ReadingStatus;
  priority?: Priority;
  rating?: number;
  remarks?: string;
  readingPosition?: number;
  totalReadingTime?: number;
  lastReadTime?: string;
  parseStatus?: string;
  pdfPath?: string;
  createdAt: string;
  updatedAt: string;
}

/** 论文元数据（前端使用，authors 和 tags 是数组） */
export interface PaperMetadata extends PaperMetadataBase {
  authors: Author[];
  tags?: string[];
}

/** 数据库记录（后端使用，authors 和 tags 是 JSON 字符串） */
export interface PaperRecord extends PaperMetadataBase {
  authors: string;    // JSON.stringify(Author[])
  tags?: string;      // JSON.stringify(string[])
}

/** 清单笔记 */
export interface ChecklistNote {
  id: string;
  checklistId: string;
  checklistPath: string;
  content: string;        // Markdown 内容
  tags?: string[];        // 可选标签
  createdAt: string;
  updatedAt: string;
}

/** 论文与清单的关联关系 */
export interface PaperChecklistRecord {
  paperId: string;
  checklistId: string;
  sortOrder: number;
  createdAt: string;
}