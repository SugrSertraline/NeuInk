// backend/src/controllers/paperController.ts

import { Request, Response } from 'express';
import { Paper } from '../models/Paper';
import { PaperChecklist } from '../models/PaperChecklist';
import { Checklist } from '../models/Checklist';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { recordToMetadata, metadataToRecord } from '../utils/paperMapper';
import { pdfParseService } from '../services/pdfParseService';

/**
 * 🧹 清理临时文件
 */
async function cleanupTempFile(filePath: string) {
  try {
    await fs.unlink(filePath);
    console.log(`🧹 [文件清理] 临时文件已删除: ${filePath}`);
  } catch (error) {
    console.error(`⚠️ [文件清理] 删除失败: ${filePath}`, error);
  }
}

/**
 * 📁 处理PDF文件上传（带错误清理）
 */
async function handlePdfUpload(
  req: Request, 
  paperId: string
): Promise<string | undefined> {
  if (!req.file) return undefined;

  console.log(`📤 [PDF上传] 开始处理文件: ${req.file.originalname}`);
  console.log(`   临时路径: ${req.file.path}`);
  console.log(`   文件大小: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

  const uploadsDir = path.join(__dirname, '../../data/uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  
  const pdfFileName = `${paperId}.pdf`;
  const pdfPath = path.join(uploadsDir, pdfFileName);
  
  try {
    // 移动上传的文件到永久位置
    await fs.rename(req.file.path, pdfPath);
    console.log(`✅ [PDF上传] 文件已保存: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    // ⚠️ 如果移动失败，清理临时文件
    console.error(`❌ [PDF上传] 文件移动失败:`, error);
    await cleanupTempFile(req.file.path);
    throw new Error(`PDF文件保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 获取所有论文列表 - 支持多级排序
 */
export async function getAllPapers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';

    const sortParam = req.query.sort as string || 'createdAt:desc';
    const sortRules = sortParam.split(',').map(rule => {
      const [field, order] = rule.split(':');
      return { 
        field: field.trim(), 
        order: (order?.trim().toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
      };
    });

    const filters = {
      status: req.query.status as string,
      priority: req.query.priority as string,
      articleType: req.query.articleType as string,
      year: req.query.year as string,
      rating: req.query.rating as string,
      sciQuartile: req.query.sciQuartile as string,
      casQuartile: req.query.casQuartile as string,
      ccfRank: req.query.ccfRank as string,
    };
    
    const result = await Paper.findAllWithFilters({
      page,
      limit,
      sortRules,
      search,
      filters
    });
    
    res.json({
      success: true,
      data: {
        papers: result.papers,
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取论文列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取论文列表失败'
    });
  }
}

/**
 * 根据ID获取论文详情
 */
export async function getPaperById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const paper = await Paper.findById(id);
    
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    res.json({
      success: true,
      data: paper
    });
  } catch (error) {
    console.error('获取论文详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取论文详情失败'
    });
  }
}

/**
 * ✨ 创建新论文（支持PDF上传）
 */
export async function createPaper(req: Request, res: Response) {
  let tempFilePath: string | undefined;
  
  try {
    const paperData = req.body;
    const id = randomUUID();
    
    // 记录临时文件路径（用于错误时清理）
    if (req.file) {
      tempFilePath = req.file.path;
    }

    console.log(`\n📝 [创建论文] 开始创建论文`);
    console.log(`   论文ID: ${id}`);
    console.log(`   标题: ${paperData.title}`);
    
    // 🔹 处理PDF文件上传（如果有）
    let pdfPath: string | undefined;
    try {
      pdfPath = await handlePdfUpload(req, id);
    } catch (uploadError) {
      // PDF上传失败，但不影响论文创建（仅记录错误）
      console.error(`⚠️ [创建论文] PDF上传失败，将创建不含PDF的论文`, uploadError);
    }
    
    // 🔹 创建论文记录到数据库
    const paper = await Paper.create({
      id,
      readingStatus: 'unread',
      readingPosition: 0,
      totalReadingTime: 0,
      parseStatus: pdfPath ? 'pending' : 'completed',
      pdfPath: pdfPath,
      ...paperData
    });

    console.log(`✅ [创建论文] 论文记录已创建`);

    // 🔹 如果有PDF文件，启动异步解析任务
    if (pdfPath) {
      try {
        await pdfParseService.createParseJob(id, pdfPath);
      } catch (parseError) {
        console.error(`⚠️ [创建论文] PDF解析任务创建失败:`, parseError);
        // 不影响论文创建，只更新状态
        await Paper.update(id, { parseStatus: 'failed' });
      }
    }

    res.status(201).json({
      success: true,
      data: paper
    });
  } catch (error) {
    console.error(`❌ [创建论文] 创建失败:`, error);
    
    // 🧹 清理临时文件
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建论文失败'
    });
  }
}

/**
 * 更新论文（不支持PDF上传）
 */
export async function updatePaper(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const paperData = req.body;
    
    console.log(`\n✏️ [更新论文] 论文ID: ${id}`);
    
    const paper = await Paper.update(id, paperData);
    
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    console.log(`✅ [更新论文] 更新成功`);

    res.json({
      success: true,
      data: paper
    });
  } catch (error) {
    console.error(`❌ [更新论文] 更新失败:`, error);
    res.status(500).json({
      success: false,
      error: '更新论文失败'
    });
  }
}

/**
 * 删除论文
 */
export async function deletePaper(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    console.log(`\n🗑️ [删除论文] 论文ID: ${id}`);
    
    // 获取论文信息（用于删除关联文件）
    const paper = await Paper.findById(id);
    
    const success = await Paper.delete(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    // 🧹 删除JSON内容文件
    const jsonPath = path.join(__dirname, '../../data/papers', `${id}.json`);
    try {
      await fs.unlink(jsonPath);
      console.log(`🧹 [删除论文] JSON文件已删除`);
    } catch (err) {
      console.log(`⚠️ [删除论文] JSON文件不存在或已删除`);
    }

    // 🧹 删除PDF文件（如果有）
    if (paper?.pdfPath) {
      try {
        await fs.unlink(paper.pdfPath);
        console.log(`🧹 [删除论文] PDF文件已删除: ${paper.pdfPath}`);
      } catch (err) {
        console.log(`⚠️ [删除论文] PDF文件不存在或已删除`);
      }
    }

    console.log(`✅ [删除论文] 删除成功`);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error(`❌ [删除论文] 删除失败:`, error);
    res.status(500).json({
      success: false,
      error: '删除论文失败'
    });
  }
}

/**
 * 获取论文内容
 */
export async function getPaperContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const paper = await Paper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }
    
    const jsonPath = path.join(__dirname, '../../data/papers', `${id}.json`);
    let contentData;
    
    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      contentData = JSON.parse(content);
    } catch (error) {
      console.log(`⚠️ [获取内容] JSON文件不存在，为论文 ${id} 创建默认内容`);
      
      contentData = {
        abstract: undefined,      
        keywords: undefined, 
        sections: [],
        references: [],
        blockNotes: [],
        checklistNotes: [],
        pdfPath: undefined,
        attachments: []
      };
      
      const dataDir = path.join(__dirname, '../../data/papers');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(jsonPath, JSON.stringify(contentData, null, 2), 'utf-8');
    }
    
    const metadata = recordToMetadata(paper);
    
    res.json({
      success: true,
      data: {
        metadata,
        ...contentData
      }
    });
  } catch (error) {
    console.error('获取论文内容失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取论文内容失败'
    });
  }
}

/**
 * 保存论文完整内容（到JSON文件）
 */
export async function savePaperContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { metadata, ...contentData } = req.body;
    
    if (metadata) {
      const recordData = metadataToRecord(metadata);
      await Paper.update(id, recordData);
    }
    
    const dataDir = path.join(__dirname, '../../data/papers');
    await fs.mkdir(dataDir, { recursive: true });
    
    const jsonPath = path.join(dataDir, `${id}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(contentData, null, 2), 'utf-8');
    
    const paper = await Paper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    const updatedMetadata = recordToMetadata(paper);
    
    res.json({
      success: true,
      data: {
        metadata: updatedMetadata,
        ...contentData
      }
    });
  } catch (error) {
    console.error('保存论文内容失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '保存论文内容失败'
    });
  }
}

/**
 * 获取论文所在的所有清单
 */
export async function getPaperChecklists(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const paper = await Paper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    const checklistIds = await PaperChecklist.findChecklistIdsByPaperId(id);
    
    const checklists = [];
    for (const checklistId of checklistIds) {
      const checklist = await Checklist.findById(checklistId);
      if (checklist) {
        checklists.push(checklist);
      }
    }

    res.json({
      success: true,
      data: checklists
    });
  } catch (error) {
    console.error('获取论文清单失败:', error);
    res.status(500).json({
      success: false,
      error: '获取论文清单失败'
    });
  }
}

/**
 * 获取论文解析状态
 */
export async function getPaperParseStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const paper = await Paper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    const job = pdfParseService.getJobByPaperId(id);
    
    res.json({
      success: true,
      data: {
        parseStatus: paper.parseStatus,
        job: job ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          error: job.error,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt
        } : null
      }
    });
  } catch (error) {
    console.error('获取论文解析状态失败:', error);
    res.status(500).json({
      success: false,
      error: '获取论文解析状态失败'
    });
  }
}