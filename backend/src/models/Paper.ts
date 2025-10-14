// backend/src/models/Paper.ts

import { getDatabase } from '../utils/database';
import type { PaperRecord as ApiPaperRecord } from "../types/paper"

function rowToApi(row: any): ApiPaperRecord {
  if (!row) return row;
  return row as ApiPaperRecord;
}

/** 统一把 undefined 转成 null（避免 SQL 中出现 undefined） */
const toNull = <T>(v: T | undefined | null): T | null =>
  v === undefined ? null : (v as any);

const SELECT_FIELDS = `
  id,
  title,
  short_title        AS shortTitle,
  authors,
  publication,
  year,
  date,
  doi,
  article_type       AS articleType,
  sci_quartile       AS sciQuartile,
  cas_quartile       AS casQuartile,
  ccf_rank           AS ccfRank,
  impact_factor      AS impactFactor,
  tags,
  reading_status     AS readingStatus,
  priority,
  rating,
  notes              AS remarks,
  reading_position   AS readingPosition,
  total_reading_time AS totalReadingTime,
  last_read_time     AS lastReadTime,
  parse_status       AS parseStatus,
  pdf_path           AS pdfPath,
  created_at         AS createdAt,
  updated_at         AS updatedAt
`;

/** camelCase → snake_case 的列名映射（用于 INSERT/UPDATE） */
const COL_MAP: Record<string, string> = {
  id: 'id',
  title: 'title',
  shortTitle: 'short_title',
  authors: 'authors',
  publication: 'publication',
  year: 'year',
  date: 'date',
  doi: 'doi',
  articleType: 'article_type',
  sciQuartile: 'sci_quartile',
  casQuartile: 'cas_quartile',
  ccfRank: 'ccf_rank',
  impactFactor: 'impact_factor',
  tags: 'tags',
  readingStatus: 'reading_status',
  priority: 'priority',
  rating: 'rating',
  remarks: 'notes',
  readingPosition: 'reading_position',
  totalReadingTime: 'total_reading_time',
  lastReadTime: 'last_read_time',
  parseStatus: 'parse_status',
  pdfPath: 'pdf_path',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// 🆕 更新 QueryOptions 接口 - 支持多级排序
interface QueryOptions {
  page: number;
  limit: number;
  sortRules: Array<{ field: string; order: 'asc' | 'desc' }>;  // 🆕 改为排序规则数组
  search: string;
  filters: {
    status?: string;
    priority?: string;
    articleType?: string;
    year?: string;
    rating?: string;
    sciQuartile?: string;
    casQuartile?: string;
    ccfRank?: string;
  };
}

export class Paper {
  /** 获取所有论文 - 返回 camelCase */
  static async findAll(): Promise<ApiPaperRecord[]> {
    const db = await getDatabase();
    const rows = await db.all(`SELECT ${SELECT_FIELDS} FROM papers ORDER BY created_at DESC`);
    return rows.map(rowToApi);
  }

  /** 根据ID获取论文 - 返回 camelCase */
  static async findById(id: string): Promise<ApiPaperRecord | undefined> {
    const db = await getDatabase();
    const row = await db.get(`SELECT ${SELECT_FIELDS} FROM papers WHERE id = ?`, id);
    return rowToApi(row);
  }

  /** 创建新论文 - 入参为 camelCase（与 API/前端一致） */
  static async create(
    paper: Omit<ApiPaperRecord, 'createdAt' | 'updatedAt'>
  ): Promise<ApiPaperRecord> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO papers (
        id, title, short_title, authors, publication, year, date, doi,
        article_type, sci_quartile, cas_quartile, ccf_rank, impact_factor,
        tags, reading_status, priority, rating, notes,
        reading_position, total_reading_time, last_read_time,
        parse_status, pdf_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      paper.id,
      paper.title,
      toNull(paper.shortTitle),
      paper.authors,
      toNull(paper.publication),
      toNull(paper.year),
      toNull(paper.date),
      toNull(paper.doi),
      toNull(paper.articleType),
      toNull(paper.sciQuartile),
      toNull(paper.casQuartile),
      toNull(paper.ccfRank),
      toNull(paper.impactFactor),
      toNull(paper.tags),
      toNull(paper.readingStatus) ?? 'unread',
      toNull(paper.priority) ?? 'medium',
      toNull(paper.rating),
      toNull(paper.remarks),
      paper.readingPosition ?? 0,
      paper.totalReadingTime ?? 0,
      toNull(paper.lastReadTime),
      'pending', // parse_status 默认值
      null,      // pdf_path 默认值
      now,
      now
    );

    const created = await this.findById(paper.id);
    if (!created) throw new Error('Failed to create paper');
    return created;
  }

  /** 更新论文 - 更新字段使用 camelCase，内部转换为 snake_case */
  static async update(
    id: string,
    updates: Partial<ApiPaperRecord>
  ): Promise<ApiPaperRecord | undefined> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const { createdAt, updatedAt, id: _id, ...rest } = updates;
    const entries = Object.entries(rest).filter(([, v]) => v !== undefined);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [k, v] of entries) {
      const col = COL_MAP[k];
      if (!col) continue;

      setClauses.push(`${col} = ?`);
      values.push(v);
    }

    setClauses.push(`${COL_MAP.updatedAt} = ?`);
    values.push(now);

    await db.run(
      `UPDATE papers SET ${setClauses.join(', ')} WHERE id = ?`,
      ...values,
      id
    );

    return this.findById(id);
  }

  /** 删除论文 */
  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM papers WHERE id = ?', id);
    return (result.changes || 0) > 0;
  }

  /** 搜索论文（按标题/作者），返回 camelCase */
  static async search(keyword: string): Promise<ApiPaperRecord[]> {
    const db = await getDatabase();
    const pattern = `%${keyword}%`;
    const rows = await db.all(
      `SELECT ${SELECT_FIELDS}
       FROM papers
       WHERE title LIKE ? OR authors LIKE ?
       ORDER BY created_at DESC`,
      pattern,
      pattern
    );
    return rows.map(rowToApi);
  }

  // 🆕 支持多级排序的 findAllWithFilters 方法
  static async findAllWithFilters(options: QueryOptions): Promise<{
    papers: ApiPaperRecord[];
    total: number;
  }> {
    const db = await getDatabase();
    const { page, limit, sortRules, search, filters } = options;

    // 构建 WHERE 子句
    const conditions: string[] = [];
    const params: any[] = [];

    // 搜索条件（标题、作者、期刊、DOI、标签、备注）
    if (search) {
      conditions.push(`(
        title LIKE ? OR 
        authors LIKE ? OR 
        publication LIKE ? OR
        doi LIKE ? OR
        tags LIKE ? OR
        notes LIKE ?
      )`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // 阅读状态筛选
    if (filters.status && filters.status !== 'all') {
      conditions.push('reading_status = ?');
      params.push(filters.status);
    }

    // 优先级筛选
    if (filters.priority && filters.priority !== 'all') {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }

    // 文章类型筛选
    if (filters.articleType && filters.articleType !== 'all') {
      conditions.push('article_type = ?');
      params.push(filters.articleType);
    }

    // 年份筛选
    if (filters.year && filters.year !== 'all') {
      conditions.push('year = ?');
      params.push(parseInt(filters.year));
    }

    // SCI分区筛选
    if (filters.sciQuartile && filters.sciQuartile !== 'all') {
      conditions.push('sci_quartile = ?');
      params.push(filters.sciQuartile);
    }

    // 中科院分区筛选
    if (filters.casQuartile && filters.casQuartile !== 'all') {
      conditions.push('cas_quartile = ?');
      params.push(filters.casQuartile);
    }

    // CCF分级筛选
    if (filters.ccfRank && filters.ccfRank !== 'all') {
      conditions.push('ccf_rank = ?');
      params.push(filters.ccfRank);
    }

    // 评分筛选
    if (filters.rating && filters.rating !== 'all') {
      if (filters.rating === '4+') {
        conditions.push('rating >= 4');
      } else if (filters.rating === '3+') {
        conditions.push('rating >= 3');
      } else if (filters.rating === '<3') {
        conditions.push('rating < 3');
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 🆕 构建多级排序的 ORDER BY 子句
    const sortColumnMap: Record<string, string> = {
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'title': 'title',
      'year': 'year',
      'rating': 'rating',
      'impactFactor': 'impact_factor',
      'readingStatus': 'reading_status',
      'priority': 'priority',
    };

    const orderByParts = sortRules.map(rule => {
      const column = sortColumnMap[rule.field] || 'created_at';
      const direction = rule.order.toUpperCase();
      return `${column} ${direction}`;
    });

    const orderByClause = orderByParts.length > 0
      ? `ORDER BY ${orderByParts.join(', ')}`
      : 'ORDER BY created_at DESC';

    // 计算总数
    const countQuery = `SELECT COUNT(*) as total FROM papers ${whereClause}`;
    const countResult = await db.get(countQuery, ...params);
    const total = countResult.total;

    // 分页查询
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT ${SELECT_FIELDS}
      FROM papers
      ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const rows = await db.all(dataQuery, ...params, limit, offset);

    return {
      papers: rows.map(rowToApi),
      total
    };
  }
}
