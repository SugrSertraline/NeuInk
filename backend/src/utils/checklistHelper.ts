// backend/src/utils/checklistHelper.ts

import fs from 'fs/promises';
import path from 'path';
import { Checklist } from '../models/Checklist';
import type { ChecklistNote } from '@neuink/shared';

/**
 * 生成清单路径
 */
export async function generateChecklistPath(checklistId: string): Promise<string> {
  const checklist = await Checklist.findById(checklistId);
  if (!checklist) return '';

  if (checklist.level === 1) {
    return checklist.name;
  } else {
    const parent = checklist.parentId ? await Checklist.findById(checklist.parentId) : null;
    return parent ? `${parent.name}/${checklist.name}` : checklist.name;
  }
}

/**
 * 从论文JSON中移除指定清单的笔记
 */
export async function removeChecklistNotesFromJson(
  paperId: string,
  checklistId: string
): Promise<void> {
  const jsonPath = path.join(__dirname, '../../data/papers', `${paperId}.json`);

  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data.checklistNotes)) {
      data.checklistNotes = data.checklistNotes.filter(
        (note: ChecklistNote) => note.checklistId !== checklistId
      );

      await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (error) {
    // JSON文件不存在或已删除，忽略错误
    console.log(`JSON文件不存在或已删除: ${paperId}`);
  }
}

/**
 * 批量清理清单笔记（用于删除清单时）
 */
export async function batchRemoveChecklistNotes(
  paperIds: string[],
  checklistId: string
): Promise<void> {
  for (const paperId of paperIds) {
    await removeChecklistNotesFromJson(paperId, checklistId);
  }
}