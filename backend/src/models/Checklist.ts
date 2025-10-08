// backend/src/models/Checklist.ts

import { getDatabase } from '../utils/database';
import type { ChecklistRecord, ChecklistTree, ChecklistNode } from '@neuink/shared';

// ✅ 删除了 template_id
const SELECT_FIELDS = `
  id,
  name,
  parent_id AS parentId,
  level,
  full_path AS fullPath,
  sort_order AS sortOrder,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

export class Checklist {
  /** 获取所有清单（树形结构） */
  static async findAllTree(): Promise<ChecklistTree> {
    const db = await getDatabase();
    const rows = await db.all<ChecklistRecord[]>(
      `SELECT ${SELECT_FIELDS} FROM checklists ORDER BY level ASC, sort_order ASC`
    );

    // 构建树形结构
    const level1 = rows.filter(r => r.level === 1);
    const level2ByParent = new Map<string, ChecklistRecord[]>();

    rows.filter(r => r.level === 2).forEach(child => {
      if (!child.parentId) return;
      if (!level2ByParent.has(child.parentId)) {
        level2ByParent.set(child.parentId, []);
      }
      level2ByParent.get(child.parentId)!.push(child);
    });

    // 统计论文数量
    const counts = await db.all<{ checklist_id: string; count: number }[]>(
      `SELECT checklist_id, COUNT(*) as count FROM paper_checklists GROUP BY checklist_id`
    );
    const countMap = new Map(counts.map(c => [c.checklist_id, c.count]));

    const tree: ChecklistNode[] = level1.map(parent => ({
      ...parent,
      paperCount: 0,
      children: (level2ByParent.get(parent.id) || []).map(child => ({
        ...child,
        paperCount: countMap.get(child.id) || 0,
        children: undefined
      }))
    }));

    return tree;
  }

  /** 根据ID获取清单 */
  static async findById(id: string): Promise<ChecklistRecord | undefined> {
    const db = await getDatabase();
    return await db.get<ChecklistRecord>(
      `SELECT ${SELECT_FIELDS} FROM checklists WHERE id = ?`,
      id
    );
  }

  /** 创建清单 */
  static async create(data: {
    id: string;
    name: string;
    parentId: string | null;
    level: 1 | 2;
    sortOrder?: number;
  }): Promise<ChecklistRecord> {  // ✅ 删除了 templateId 参数
    const db = await getDatabase();
    const now = new Date().toISOString();

    // 验证层级约束
    if (data.level === 1 && data.parentId) {
      throw new Error('一级分类不能有父级');
    }

    if (data.level === 2) {
      if (!data.parentId) {
        throw new Error('二级分类必须指定父级');
      }
      const parent = await this.findById(data.parentId);
      if (!parent || parent.level !== 1) {
        throw new Error('二级分类的父级必须是一级分类');
      }
    }

    // 如果没有指定排序，自动获取最大值+1
    let sortOrder = data.sortOrder ?? 0;
    if (sortOrder === 0) {
      const maxSort = await db.get<{ maxSort: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) as maxSort 
         FROM checklists 
         WHERE level = ? AND parent_id ${data.parentId ? '= ?' : 'IS NULL'}`,
        data.parentId ? [data.level, data.parentId] : [data.level]
      );
      sortOrder = (maxSort?.maxSort || 0) + 1;
    }

    // 生成 full_path
    let fullPath = data.name;
    if (data.level === 2 && data.parentId) {
      const parent = await this.findById(data.parentId);
      if (parent) {
        fullPath = `${parent.name}/${data.name}`;
      }
    }

    // ✅ 删除了 template_id 字段
    await db.run(
      `INSERT INTO checklists (id, name, parent_id, level, full_path, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      data.id,
      data.name,
      data.parentId,
      data.level,
      fullPath,
      sortOrder,
      now,
      now
    );

    const created = await this.findById(data.id);
    if (!created) throw new Error('Failed to create checklist');
    return created;
  }

  /** 更新清单 */
  static async update(
    id: string,
    updates: Partial<Pick<ChecklistRecord, 'name' | 'parentId' | 'sortOrder'>>  // ✅ 删除了 templateId
  ): Promise<ChecklistRecord | undefined> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const checklist = await this.findById(id);
    if (!checklist) return undefined;

    // 如果要修改父级，需要验证
    if (updates.parentId !== undefined && updates.parentId !== checklist.parentId) {
      if (checklist.level === 1 && updates.parentId !== null) {
        throw new Error('一级分类不能有父级');
      }
      if (checklist.level === 2 && updates.parentId) {
        const parent = await this.findById(updates.parentId);
        if (!parent || parent.level !== 1) {
          throw new Error('二级分类的父级必须是一级分类');
        }
      }
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }

    if (updates.parentId !== undefined) {
      setClauses.push('parent_id = ?');
      values.push(updates.parentId);
    }

    if (updates.sortOrder !== undefined) {
      setClauses.push('sort_order = ?');
      values.push(updates.sortOrder);
    }

    // ✅ 删除了 templateId 处理逻辑

    // 如果名称或父级改变，需要更新 full_path
    if (updates.name !== undefined || updates.parentId !== undefined) {
      const newName = updates.name ?? checklist.name;
      const newParentId = updates.parentId !== undefined ? updates.parentId : checklist.parentId;

      let newFullPath = newName;
      if (checklist.level === 2 && newParentId) {
        const parent = await this.findById(newParentId);
        if (parent) {
          newFullPath = `${parent.name}/${newName}`;
        }
      }

      setClauses.push('full_path = ?');
      values.push(newFullPath);

      // 如果当前节点是一级分类且名称改变，需要更新所有子节点的 full_path
      if (checklist.level === 1 && updates.name !== undefined) {
        await this.updateChildrenFullPath(id, newName);
      }
    }

    if (setClauses.length === 0) {
      return checklist;
    }

    setClauses.push('updated_at = ?');
    values.push(now);

    await db.run(
      `UPDATE checklists SET ${setClauses.join(', ')} WHERE id = ?`,
      ...values,
      id
    );

    return this.findById(id);
  }

  /** 更新子节点的 full_path（当父节点名称改变时） */
  private static async updateChildrenFullPath(parentId: string, newParentName: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const children = await db.all<ChecklistRecord[]>(
      `SELECT ${SELECT_FIELDS} FROM checklists WHERE parent_id = ?`,
      parentId
    );

    for (const child of children) {
      const newFullPath = `${newParentName}/${child.name}`;
      await db.run(
        'UPDATE checklists SET full_path = ?, updated_at = ? WHERE id = ?',
        newFullPath,
        now,
        child.id
      );
    }
  }

  /** 删除清单（级联删除子清单和关联关系） */
  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM checklists WHERE id = ?', id);
    return (result.changes || 0) > 0;
  }

  /** 批量更新排序 */
  static async batchUpdateOrder(orders: { id: string; sortOrder: number }[]): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const { id, sortOrder } of orders) {
      await db.run(
        'UPDATE checklists SET sort_order = ?, updated_at = ? WHERE id = ?',
        sortOrder,
        now,
        id
      );
    }
  }

  /** 获取清单下的所有子清单ID（递归） */
  static async getDescendantIds(id: string): Promise<string[]> {
    const db = await getDatabase();
    const children = await db.all<{ id: string }[]>(
      'SELECT id FROM checklists WHERE parent_id = ?',
      id
    );

    const ids = [id];
    for (const child of children) {
      const childIds = await this.getDescendantIds(child.id);
      ids.push(...childIds);
    }

    return ids;
  }
}