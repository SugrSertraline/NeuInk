// backend/src/controllers/paperController.ts

import { Request, Response } from 'express';
import { Paper } from '../models/Paper';
import { PaperChecklist } from '../models/PaperChecklist';
import { Checklist } from '../models/Checklist';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { recordToMetadata, metadataToRecord } from '../utils/paperMapper';
import { PaperContent } from '../types/paper';
import { testService } from '../services/testService';

/**
 * ===== 工具函数：Markdown 文件验证 =====
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateMarkdownFile(filename: string, content: string): ValidationResult {
  // 1. 验证文件名后缀
  if (!filename.match(/\.(md|markdown)$/i)) {
    return {
      valid: false,
      error: '文件格式不正确，请上传 .md 或 .markdown 文件'
    };
  }

  // 2. 验证内容不为空
  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      error: 'Markdown 文件内容为空'
    };
  }

  // 3. 验证内容长度（最小 50 字符，最大 50MB）
  if (content.length < 50) {
    return {
      valid: false,
      error: 'Markdown 文件内容过短，请确保文件包含有效的论文内容'
    };
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (content.length > MAX_SIZE) {
    return {
      valid: false,
      error: `文件过大，最大支持 ${MAX_SIZE / 1024 / 1024}MB`
    };
  }

  // 4. 简单的 Markdown 格式检测（至少包含标题或段落）
  const hasMarkdownStructure = 
    content.includes('#') ||           // 标题
    content.includes('\n\n') ||        // 段落分隔
    content.match(/^\s*[-*+]\s/m) ||   // 列表
    content.includes('```');           // 代码块

  if (!hasMarkdownStructure) {
    return {
      valid: false,
      error: 'Markdown 文件格式不正确，请确保包含有效的 Markdown 标记（如标题、段落等）'
    };
  }

  // 5. 检测是否可能是学术论文（可选，宽松检测）
  const academicKeywords = [
    'abstract', 'introduction', 'method', 'result', 'conclusion',
    'reference', 'bibliography', 'keyword', 'author',
    '摘要', '引言', '方法', '结果', '结论', '参考文献', '关键词'
  ];

  const lowerContent = content.toLowerCase();
  const hasAcademicContent = academicKeywords.some(keyword => 
    lowerContent.includes(keyword.toLowerCase())
  );

  if (!hasAcademicContent) {
    console.warn('⚠️  警告：文件可能不是学术论文格式，但仍将继续处理');
  }

  return { valid: true };
}

/**
 * 从 Markdown 文件创建论文（使用测试服务）
 */
export async function createPaperFromMarkdown(req: Request, res: Response) {
  try {
    // 1. 验证文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未上传 Markdown 文件'
      });
    }

    const file = req.file;
    const markdownContent = file.buffer.toString('utf-8');
    
    // 2. 基础验证
    const validation = validateMarkdownFile(file.originalname, markdownContent);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // 3. 生成论文 ID
    const id = randomUUID();

    console.log(`\n📤 收到 Markdown 上传请求 [${id}]`);
    console.log(`📄 文件名: ${file.originalname}`);
    console.log(`📏 大小: ${(markdownContent.length / 1024).toFixed(2)} KB`);

    // 4. 创建论文记录（初始状态）
    const paper = await Paper.create({
      id,
      title: file.originalname.replace(/\.(md|markdown)$/i, ''),
      authors: JSON.stringify([]),
      readingStatus: 'unread',
      readingPosition: 0,
      totalReadingTime: 0,
      parseStatus: 'pending',
      remarks: JSON.stringify({
        parseProgress: {
          stage: 'pending',
          percentage: 0,
          message: '等待解析',
          lastUpdate: new Date().toISOString()
        }
      })
    });

    // 5. 立即返回响应（异步解析）
    res.status(201).json({
      success: true,
      data: paper,
      message: '论文创建成功，正在后台解析中...'
    });

    // 6. 启动异步测试解析
    startTestParsing(id, markdownContent);

  } catch (error) {
    console.error('创建论文失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建论文失败'
    });
  }
}

/**
 * 启动异步测试解析
 */
async function startTestParsing(paperId: string, markdownContent: string) {
  try {
    console.log(`🚀 启动异步测试解析 [${paperId}]`);

    // 更新解析状态
    await Paper.update(paperId, {
      parseStatus: 'parsing',
      remarks: JSON.stringify({
        parseProgress: {
          stage: 'init',
          percentage: 0,
          message: '开始测试解析...',
          lastUpdate: new Date().toISOString()
        }
      })
    });

    // 启动测试解析任务
    const emitter = testService.startTestParsing(paperId);

    // 监听进度更新
    emitter.on('progress', async (progress) => {
      try {
        await Paper.update(paperId, {
          remarks: JSON.stringify({
            parseProgress: {
              ...progress,
              lastUpdate: new Date().toISOString()
            }
          })
        });
      } catch (error) {
        console.error(`更新进度失败 [${paperId}]:`, error);
      }
    });

    // 监听完成
    emitter.on('complete', async ({ result, paperContent }) => {
      try {
        console.log(`✅ 测试解析完成，保存结果 [${paperId}]`);

        // 更新元数据
        const metadata = result.metadata;
        await Paper.update(paperId, {
          title: metadata.title || 'Untitled',
          authors: JSON.stringify(metadata.authors || []),
          year: metadata.year,
          doi: metadata.doi,
          publication: metadata.publication,
          parseStatus: 'completed',
          remarks: JSON.stringify({
            parseProgress: {
              stage: 'completed',
              percentage: 100,
              message: '测试解析完成',
              lastUpdate: new Date().toISOString()
            }
          })
        });

        // 保存论文内容到 JSON 文件
        const dataDir = path.join(__dirname, '../../data/papers');
        await fs.mkdir(dataDir, { recursive: true });
        
        const jsonPath = path.join(dataDir, `${paperId}.json`);
        await fs.writeFile(
          jsonPath,
          JSON.stringify(paperContent, null, 2),
          'utf-8'
        );

        console.log(`💾 论文内容已保存 [${paperId}]`);
      } catch (error) {
        console.error(`保存解析结果失败 [${paperId}]:`, error);
        
        await Paper.update(paperId, {
          parseStatus: 'failed',
          remarks: JSON.stringify({
            parseProgress: {
              stage: 'failed',
              percentage: 0,
              message: '保存失败: ' + (error instanceof Error ? error.message : String(error)),
              error: String(error),
              lastUpdate: new Date().toISOString()
            }
          })
        });
      }
    });

  } catch (error) {
    console.error(`启动测试解析失败 [${paperId}]:`, error);
    
    await Paper.update(paperId, {
      parseStatus: 'failed',
      remarks: JSON.stringify({
        parseProgress: {
          stage: 'failed',
          percentage: 0,
          message: '启动测试解析失败',
          error: error instanceof Error ? error.message : String(error),
          lastUpdate: new Date().toISOString()
        }
      })
    });
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
 * 创建新论文
 */
export async function createPaper(req: Request, res: Response) {
  try {
    const paperData = req.body;
    const id = randomUUID();
    
    // 检查标题是否为空
    if (!paperData.title || paperData.title.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '论文标题不能为空，请填写标题或上传Markdown文件自动解析'
      });
    }
    
    // 创建论文记录
    const paper = await Paper.create({
      id,
      readingStatus: 'unread',
      readingPosition: 0,
      totalReadingTime: 0,
      ...paperData
    });

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
        attachments: []
      };
      
      const dataDir = path.join(__dirname, '../../data/papers');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(jsonPath, JSON.stringify(contentData, null, 2), 'utf-8');
    }
    
    const metadata = recordToMetadata(paper);
    
    // 构建符合前端 PaperContent 接口的数据结构
    const paperContent = {
      metadata,
      abstract: contentData.abstract ? {
        en: contentData.abstract.en || contentData.abstract,
        zh: contentData.abstract.zh || contentData.abstract
      } : undefined,
      keywords: contentData.keywords || [],
      sections: contentData.sections || [],
      references: contentData.references || [],
      blockNotes: contentData.blockNotes || [],
      checklistNotes: contentData.checklistNotes || [],
      attachments: contentData.attachments || []
    };
    
    res.json({
      success: true,
      data: paperContent
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
    const paperContent = req.body;
    
    // 从 PaperContent 中提取 metadata 和内容数据
    const { metadata, abstract, keywords, sections, references, blockNotes, checklistNotes, attachments } = paperContent;
    
    if (metadata) {
      const recordData = metadataToRecord(metadata);
      await Paper.update(id, recordData);
    }
    
    // 构建要保存到 JSON 文件的内容数据
    const contentData = {
      abstract,
      keywords,
      sections,
      references,
      blockNotes,
      checklistNotes,
      attachments
    };
    
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
    
    // 返回符合前端 PaperContent 接口的数据结构
    const responsePaperContent = {
      metadata: updatedMetadata,
      abstract,
      keywords,
      sections,
      references,
      blockNotes,
      checklistNotes,
      attachments
    };
    
    res.json({
      success: true,
      data: responsePaperContent
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
 * 获取解析进度
 */
export async function getParseProgress(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const paper = await Paper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }

    // 从 remarks 中提取进度信息
    let progress = null;
    if (paper.remarks) {
      try {
        const remarks = JSON.parse(paper.remarks);
        progress = remarks.parseProgress;
      } catch (error) {
        console.error('解析 remarks 失败:', error);
      }
    }

    res.json({
      success: true,
      data: {
        paperId: id,
        parseStatus: paper.parseStatus,
        progress,
        isRunning: testService.isJobRunning(id)
      }
    });
  } catch (error) {
    console.error('获取解析进度失败:', error);
    res.status(500).json({
      success: false,
      error: '获取解析进度失败'
    });
  }
}


