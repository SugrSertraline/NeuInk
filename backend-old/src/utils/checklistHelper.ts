// backend/src/utils/checklistHelper.ts

import fs from 'fs/promises';
import path from 'path';
import { Checklist } from '../models/Checklist';
import type { ChecklistNote } from '../types/checklist';

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

export async function removeChecklistNotesFromJson(
  paperId: string,
  checklistId: string
): Promise<void> {
  const jsonPath = path.join(__dirname, '../../data/papers', `${paperId}.json`);

  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data.checklistNotes)) {
      const originalLength = data.checklistNotes.length;
      
      data.checklistNotes = data.checklistNotes.filter(
        (note: ChecklistNote) => note.checklistId !== checklistId
      );

      // 🆕 只有真正删除了笔记才写入文件
      if (data.checklistNotes.length < originalLength) {
        await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`从论文 ${paperId} 中移除了 ${originalLength - data.checklistNotes.length} 条清单笔记`);
      }
    }
  } catch (error) {
    // JSON文件不存在或已删除，忽略错误
    if ((error as any).code === 'ENOENT') {
      console.log(`JSON文件不存在: ${paperId}`);
    } else {
      console.error(`处理论文 ${paperId} 的JSON文件时出错:`, error);
      throw error; // 🆕 其他错误向上抛出
    }
  }
}
/**
 * 批量清理清单笔记（用于删除清单时）- 并行优化版本
 */
export async function batchRemoveChecklistNotes(
  paperIds: string[],
  checklistId: string
): Promise<void> {
  // 并行处理，每批10个文件
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < paperIds.length; i += BATCH_SIZE) {
    const batch = paperIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(paperId => 
        removeChecklistNotesFromJson(paperId, checklistId).catch(err => {
          console.error(`清理论文 ${paperId} 的清单笔记失败:`, err);
        })
      )
    );
  }
}
/**
 * 更新论文JSON中的清单路径（当清单改名时）
 */
export async function updateChecklistPathInPapers(
  checklistId: string,
  newPath: string
): Promise<void> {
  const { PaperChecklist } = await import('../models/PaperChecklist.js');
  
  // 获取所有关联的论文ID
  const paperIds = await PaperChecklist.findPaperIdsByChecklistId(checklistId);
  
  if (paperIds.length === 0) return;
  
  // 并行处理
  const BATCH_SIZE = 10;
  for (let i = 0; i < paperIds.length; i += BATCH_SIZE) {
    const batch = paperIds.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async paperId => {
        const jsonPath = path.join(__dirname, '../../data/papers', `${paperId}.json`);
        
        try {
          const content = await fs.readFile(jsonPath, 'utf-8');
          const data = JSON.parse(content);
          
          if (Array.isArray(data.checklistNotes)) {
            let hasChanges = false;
            
            data.checklistNotes = data.checklistNotes.map((note: ChecklistNote) => {
              if (note.checklistId === checklistId && note.checklistPath !== newPath) {
                hasChanges = true;
                return { ...note, checklistPath: newPath };
              }
              return note;
            });
            
            // 只有真正改变时才写入
            if (hasChanges) {
              await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
            }
          }
        } catch (error) {
          console.error(`更新论文 ${paperId} 的清单路径失败:`, error);
        }
      })
    );
  }
}

/**
 * 清理孤儿清单笔记（清单ID已不存在）
 */
export async function cleanOrphanChecklistNotes(): Promise<{
  scannedFiles: number;
  cleanedNotes: number;
}> {
  const { Checklist } = await import('../models/Checklist.js');
  
  // 获取所有有效的清单ID
  const tree = await Checklist.findAllTree();
  const validChecklistIds = new Set<string>();
  
  const collectIds = (nodes: any[]) => {
    for (const node of nodes) {
      validChecklistIds.add(node.id);
      if (node.children) {
        collectIds(node.children);
      }
    }
  };
  collectIds(tree);
  
  // 扫描所有论文JSON
  const dataDir = path.join(__dirname, '../../data/papers');
  let files: string[];
  
  try {
    files = await fs.readdir(dataDir);
  } catch (error) {
    console.log('论文数据目录不存在');
    return { scannedFiles: 0, cleanedNotes: 0 };
  }
  
  let scannedFiles = 0;
  let cleanedNotes = 0;
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const jsonPath = path.join(dataDir, file);
    scannedFiles++;
    
    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);
      
      if (Array.isArray(data.checklistNotes) && data.checklistNotes.length > 0) {
        const originalLength = data.checklistNotes.length;
        
        data.checklistNotes = data.checklistNotes.filter(
          (note: ChecklistNote) => validChecklistIds.has(note.checklistId)
        );
        
        const removed = originalLength - data.checklistNotes.length;
        
        if (removed > 0) {
          await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
          cleanedNotes += removed;
          console.log(`从 ${file} 中清理了 ${removed} 条孤儿笔记`);
        }
      }
    } catch (error) {
      console.error(`处理文件 ${file} 失败:`, error);
    }
  }
  
  return { scannedFiles, cleanedNotes };
}