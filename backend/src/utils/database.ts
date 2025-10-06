// backend/src/utils/database.ts

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

/**
 * 获取数据库连接
 */
export async function getDatabase(): Promise<Database> {
  if (db) return db;

  // 确保 database 目录存在
  const dbDir = path.join(process.cwd(), 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'neuink.db');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // 启用外键约束
  await db.exec('PRAGMA foreign_keys = ON');

  await initializeTables();

  return db;
}

/**
 * 初始化数据库（导出供外部使用）
 */
export async function initDatabase() {
  console.log('正在初始化数据库...');
  await getDatabase();
  console.log('数据库初始化完成！');
}

/**
 * 初始化数据库表（包含幂等迁移：缺列即补）
 */
async function initializeTables() {
  if (!db) return;

  // 1) 如果 papers 不存在则创建（包含所有最新列）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      short_title TEXT,
      authors TEXT,
      publication TEXT,
      year INTEGER,
      date TEXT,
      doi TEXT,
      article_type TEXT,
      sci_quartile TEXT,
      cas_quartile TEXT,
      ccf_rank TEXT,
      impact_factor REAL,
      tags TEXT,
      reading_status TEXT DEFAULT 'unread',
      priority TEXT DEFAULT 'medium',
      rating INTEGER,
      notes TEXT,
      reading_position REAL DEFAULT 0,
      total_reading_time INTEGER DEFAULT 0,
      last_read_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2) 对已存在的旧表进行“补列”迁移
  await ensureColumns('papers', [
    { name: 'short_title',        type: 'TEXT' },
    { name: 'authors',            type: 'TEXT' },
    { name: 'publication',        type: 'TEXT' },
    { name: 'year',               type: 'INTEGER' },
    { name: 'date',               type: 'TEXT' },
    { name: 'doi',                type: 'TEXT' },
    { name: 'article_type',       type: 'TEXT' },
    { name: 'sci_quartile',       type: 'TEXT' },
    { name: 'cas_quartile',       type: 'TEXT' },
    { name: 'ccf_rank',           type: 'TEXT' },
    { name: 'impact_factor',      type: 'REAL' },
    { name: 'tags',               type: 'TEXT' },
    { name: 'reading_status',     type: "TEXT DEFAULT 'unread'" },
    { name: 'priority',           type: "TEXT DEFAULT 'medium'" },
    { name: 'rating',             type: 'INTEGER' },
    { name: 'notes',              type: 'TEXT' },
    { name: 'reading_position',   type: 'REAL DEFAULT 0' },
    { name: 'total_reading_time', type: 'INTEGER DEFAULT 0' },
    { name: 'last_read_time',     type: 'TEXT' },
    { name: 'created_at',         type: 'TEXT' },
    { name: 'updated_at',         type: 'TEXT' },
  ]);

  // 3) 其它表：若不存在则创建
  await db.exec(`
    CREATE TABLE IF NOT EXISTS checklists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      full_path TEXT NOT NULL,
      parent_id TEXT,
      level INTEGER NOT NULL,
      note_template TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES checklists(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS paper_checklists (
      paper_id TEXT NOT NULL,
      checklist_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (paper_id, checklist_id),
      FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS reading_stats (
      id TEXT PRIMARY KEY,
      paper_id TEXT NOT NULL,
      date TEXT NOT NULL,
      reading_time INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
    );
  `);

  console.log('✅ 数据库表初始化完成');
}

/**
 * 幂等补列：若列不存在则 ALTER TABLE ADD COLUMN
 */
async function ensureColumns(
  table: string,
  columns: Array<{ name: string; type: string }>
) {
  if (!db) return;

  const rows = await db.all<{ name: string }[]>(`PRAGMA table_info(${table});`);
  const existing = new Set(rows.map((r: any) => r.name));

  for (const col of columns) {
    if (!existing.has(col.name)) {
      // 这里不使用 NOT NULL 约束，避免对既有数据行的回填失败
      // 默认值通过 type 字符串中携带（如 "TEXT DEFAULT 'unread'"）
      const sql = `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type};`;
      await db.exec(sql);
    }
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
    console.log('数据库连接已关闭');
  }
}
