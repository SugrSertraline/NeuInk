// app/types/checklist.ts

/** 清单记录（数据库层） */
export interface ChecklistRecord {
  id: string;
  name: string;
  level: 1 | 2;
  parentId: string | null;
  fullPath: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  paperCount?: number;  // 仅查询时附加
}

/** 清单树结构（前端渲染用） */
export interface ChecklistNode extends ChecklistRecord {
  children?: ChecklistNode[];
}

/** 清单树形结构（API返回） */
export type ChecklistTree = ChecklistNode[];

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