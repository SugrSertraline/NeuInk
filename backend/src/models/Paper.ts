// backend/src/models/Paper.ts

import { getDatabase } from '../utils/database';
import type { PaperRecord as ApiPaperRecord } from "@neuink/shared"

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
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

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
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?, ?, ?, ?, ?)`,
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

    // 不可更新/由系统维护的字段剔除
    const { createdAt, updatedAt, id: _id, ...rest } = updates;

    // 归一化：boolean → 0/1；undefined 键不更新；null 传递为 NULL
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

    // 强制更新时间
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
}
