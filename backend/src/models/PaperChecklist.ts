// backend/src/models/PaperChecklist.ts

import { getDatabase } from '../utils/database';
import type { PaperChecklistRecord } from '@neuink/shared';

export class PaperChecklist {
  /** 添加论文到清单 */
  static async add(paperId: string, checklistId: string, sortOrder?: number): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // 如果没有指定排序，自动获取最大值+1
    let finalSortOrder = sortOrder ?? 0;
    if (finalSortOrder === 0) {
      const maxSort = await db.get<{ maxSort: number }>(
        'SELECT COALESCE(MAX(sort_order), 0) as maxSort FROM paper_checklists WHERE checklist_id = ?',
        checklistId
      );
      finalSortOrder = (maxSort?.maxSort || 0) + 1;
    }

    await db.run(
      `INSERT OR IGNORE INTO paper_checklists (paper_id, checklist_id, sort_order, created_at)
       VALUES (?, ?, ?, ?)`,
      paperId,
      checklistId,
      finalSortOrder,
      now
    );
  }

  /** 从清单中移除论文 */
  static async remove(paperId: string, checklistId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run(
      'DELETE FROM paper_checklists WHERE paper_id = ? AND checklist_id = ?',
      paperId,
      checklistId
    );
    return (result.changes || 0) > 0;
  }

  /** 获取清单中的所有论文ID */
  static async findPaperIdsByChecklistId(checklistId: string): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.all<{ paper_id: string }[]>(
      'SELECT paper_id FROM paper_checklists WHERE checklist_id = ? ORDER BY sort_order ASC',
      checklistId
    );
    return rows.map(r => r.paper_id);
  }

  /** 获取论文所在的所有清单ID */
  static async findChecklistIdsByPaperId(paperId: string): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.all<{ checklist_id: string }[]>(
      'SELECT checklist_id FROM paper_checklists WHERE paper_id = ?',
      paperId
    );
    return rows.map(r => r.checklist_id);
  }

  /** 获取清单的所有关联关系 */
  static async findByChecklistId(checklistId: string): Promise<PaperChecklistRecord[]> {
    const db = await getDatabase();
    return await db.all<PaperChecklistRecord[]>(
      `SELECT 
        paper_id AS paperId, 
        checklist_id AS checklistId, 
        sort_order AS sortOrder, 
        created_at AS createdAt
       FROM paper_checklists 
       WHERE checklist_id = ?
       ORDER BY sort_order ASC`,
      checklistId
    );
  }

  /** 批量更新论文在清单中的排序 */
  static async batchUpdateOrder(
    checklistId: string,
    orders: { paperId: string; sortOrder: number }[]
  ): Promise<void> {
    const db = await getDatabase();

    for (const { paperId, sortOrder } of orders) {
      await db.run(
        'UPDATE paper_checklists SET sort_order = ? WHERE paper_id = ? AND checklist_id = ?',
        sortOrder,
        paperId,
        checklistId
      );
    }
  }

  /** 删除清单的所有关联 */
  static async deleteByChecklistId(checklistId: string): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM paper_checklists WHERE checklist_id = ?', checklistId);
  }
}