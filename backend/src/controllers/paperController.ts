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
 * 创建新论文（支持PDF上传）
 */
export async function createPaper(req: Request, res: Response) {
  try {
    const paperData = req.body;
    const id = randomUUID();
    
    // 处理PDF文件上传（如果有）
    let pdfPath: string | undefined;
    if (req.file) {
      const uploadsDir = path.join(__dirname, '../../data/uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const pdfFileName = `${id}.pdf`;
      pdfPath = path.join(uploadsDir, pdfFileName);
      
      // 移动上传的文件到永久位置
      await fs.rename(req.file.path, pdfPath);
    }
    
    // 创建论文记录
    const paper = await Paper.create({
      id,
      readingStatus: 'unread',
      readingPosition: 0,
      totalReadingTime: 0,
      parseStatus: pdfPath ? 'pending' : 'completed', // 如果有PDF则设置为待解析
      pdfPath: pdfPath,
      ...paperData
    });

    // 如果有PDF文件，启动异步解析
    if (pdfPath) {
      try {
        await pdfParseService.createParseJob(id, pdfPath);
      } catch (parseError) {
        console.error('创建PDF解析任务失败:', parseError);
        // 不影响论文创建，只记录错误
      }
    }

    res.status(201).json({
      success: true,
      data: paper
    });
  } catch (error) {
    console.error('创建论文失败:', error);
    res.status(500).json({
      success: false,
      error: '创建论文失败'
    });
  }
}

/**
 * 更新论文
 */
export async function updatePaper(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const paperData = req.body;
    
    const paper = await Paper.update(id, paperData);
    
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
    console.error('更新论文失败:', error);
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
    const success = await Paper.delete(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    const jsonPath = path.join(__dirname, '../../data/papers', `${id}.json`);
    try {
      await fs.unlink(jsonPath);
    } catch (err) {
      console.log('JSON文件不存在或已删除');
    }

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除论文失败:', error);
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
      console.log(`JSON文件不存在，为论文 ${id} 创建默认内容`);
      
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
    
    // 验证论文存在
    const paper = await Paper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    // 获取论文所在的清单ID列表
    const checklistIds = await PaperChecklist.findChecklistIdsByPaperId(id);
    
    // 获取每个清单的详细信息
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
        parseStatus: paper.parseStatus, // 🆕 这里会返回实时的进度状态
        job: job ? {
          id: job.id,
          status: job.status,
          progress: job.progress,        // 🆕 添加进度百分比
          currentStep: job.currentStep,  // 🆕 添加当前步骤
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
