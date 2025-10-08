// backend/src/controllers/checklistController.ts

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Checklist } from '../models/Checklist';
import { PaperChecklist } from '../models/PaperChecklist';
import { Paper } from '../models/Paper';
import { batchRemoveChecklistNotes } from '../utils/checklistHelper';

/**
 * 获取所有清单（树形结构）
 */
export async function getAllChecklists(req: Request, res: Response) {
  try {
    const tree = await Checklist.findAllTree();

    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('获取清单列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取清单列表失败'
    });
  }
}

/**
 * 根据ID获取清单详情
 */
export async function getChecklistById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const checklist = await Checklist.findById(id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: '清单不存在'
      });
    }

    res.json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('获取清单详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取清单详情失败'
    });
  }
}

/**
 * 创建清单
 */
export async function createChecklist(req: Request, res: Response) {
  try {
    const { name, parentId, level } = req.body;

    if (!name || !level) {
      return res.status(400).json({
        success: false,
        error: '清单名称和层级不能为空'
      });
    }

    if (level !== 1 && level !== 2) {
      return res.status(400).json({
        success: false,
        error: '层级只能是1或2'
      });
    }

    const id = randomUUID();
    const checklist = await Checklist.create({
      id,
      name,
      parentId: parentId || null,
      level
    });

    res.status(201).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('创建清单失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建清单失败'
    });
  }
}

/**
 * 更新清单
 */
export async function updateChecklist(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const checklist = await Checklist.update(id, updates);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: '清单不存在'
      });
    }

    res.json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('更新清单失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新清单失败'
    });
  }
}

/**
 * 删除清单
 */
export async function deleteChecklist(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // 1. 获取该清单及所有子清单
    const descendantIds = await Checklist.getDescendantIds(id);

    // 2. 获取所有关联的论文
    const allPaperIds = new Set<string>();
    for (const checklistId of descendantIds) {
      const paperIds = await PaperChecklist.findPaperIdsByChecklistId(checklistId);
      paperIds.forEach(pid => allPaperIds.add(pid));
    }

    // 3. 清理所有论文JSON中的清单笔记
    for (const checklistId of descendantIds) {
      await batchRemoveChecklistNotes(Array.from(allPaperIds), checklistId);
    }

    // 4. 删除清单（级联删除子清单和关联关系）
    const success = await Checklist.delete(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '清单不存在'
      });
    }

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除清单失败:', error);
    res.status(500).json({
      success: false,
      error: '删除清单失败'
    });
  }
}

/**
 * 批量更新清单排序
 */
export async function batchReorderChecklists(req: Request, res: Response) {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: '参数格式错误'
      });
    }

    await Checklist.batchUpdateOrder(orders);

    res.json({
      success: true,
      message: '排序更新成功'
    });
  } catch (error) {
    console.error('更新排序失败:', error);
    res.status(500).json({
      success: false,
      error: '更新排序失败'
    });
  }
}

/**
 * 获取清单中的论文列表
 */
export async function getChecklistPapers(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // 验证清单是否为二级分类
    const checklist = await Checklist.findById(id);
    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: '清单不存在'
      });
    }

    if (checklist.level !== 2) {
      return res.status(400).json({
        success: false,
        error: '只有二级分类才能包含论文'
      });
    }

    // 获取论文ID列表
    const paperIds = await PaperChecklist.findPaperIdsByChecklistId(id);

    // 分页
    const total = paperIds.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pagedIds = paperIds.slice(start, end);

    // 获取论文详情
    const papers = [];
    for (const paperId of pagedIds) {
      const paper = await Paper.findById(paperId);
      if (paper) papers.push(paper);
    }

    res.json({
      success: true,
      data: {
        papers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取清单论文失败:', error);
    res.status(500).json({
      success: false,
      error: '获取清单论文失败'
    });
  }
}

/**
 * 添加论文到清单
 */
export async function addPapersToChecklist(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paperIds } = req.body;

    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '论文ID列表不能为空'
      });
    }

    // 验证清单是否为二级分类
    const checklist = await Checklist.findById(id);
    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: '清单不存在'
      });
    }

    if (checklist.level !== 2) {
      return res.status(400).json({
        success: false,
        error: '只能向二级分类添加论文'
      });
    }

    // 批量添加
    for (const paperId of paperIds) {
      await PaperChecklist.add(paperId, id);
    }

    res.json({
      success: true,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加论文到清单失败:', error);
    res.status(500).json({
      success: false,
      error: '添加论文到清单失败'
    });
  }
}

/**
 * 从清单移除论文
 */
export async function removePaperFromChecklist(req: Request, res: Response) {
  try {
    const { id, paperId } = req.params;

    const success = await PaperChecklist.remove(paperId, id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '关联关系不存在'
      });
    }

    // 从论文JSON中移除该清单的笔记
    await batchRemoveChecklistNotes([paperId], id);

    res.json({
      success: true,
      message: '移除成功'
    });
  } catch (error) {
    console.error('移除论文失败:', error);
    res.status(500).json({
      success: false,
      error: '移除论文失败'
    });
  }
}

/**
 * 调整清单中论文的排序
 */
export async function reorderChecklistPapers(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: '参数格式错误'
      });
    }

    await PaperChecklist.batchUpdateOrder(id, orders);

    res.json({
      success: true,
      message: '排序更新成功'
    });
  } catch (error) {
    console.error('更新论文排序失败:', error);
    res.status(500).json({
      success: false,
      error: '更新论文排序失败'
    });
  }
}