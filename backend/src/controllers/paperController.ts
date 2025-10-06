// backend/src/controllers/paperController.ts

import { Request, Response } from 'express';
import { Paper } from '../models/Paper';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto'; 
import type { PaperMetadata } from '@neuink/shared';

/**
 * 获取所有论文列表
 */
export async function getAllPapers(req: Request, res: Response) {
  try {
    const papers = await Paper.findAll();
    res.json({
      success: true,
      data: papers
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
    const paper = await Paper.create({
      id,
      readingStatus: 'unread',
      readingPosition: 0,
      totalReadingTime: 0,
      ...paperData
    });

    // 返回创建结果
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

    // 同时删除对应的JSON文件
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
 * 获取论文完整内容（从JSON文件）
 * 如果文件不存在，则创建一个默认的空内容
 */
export async function getPaperContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // 1. 从数据库获取 metadata
    const paper = await Paper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        error: '论文不存在'
      });
    }
    
    // 2. 从 JSON 文件获取内容
    const jsonPath = path.join(__dirname, '../../data/papers', `${id}.json`);
    let contentData;
    
    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      contentData = JSON.parse(content);
    } catch (error) {
      // 文件不存在，创建默认内容（不包含 metadata）
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
    
    // 3. 构建 metadata（从数据库）
    const metadata: PaperMetadata = {
      id: paper.id,
      title: paper.title,
      shortTitle: paper.shortTitle,
      authors: paper.authors ? JSON.parse(paper.authors) : [],
      publication: paper.publication,
      year: paper.year,
      date: paper.date,
      doi: paper.doi,
      articleType: paper.articleType as any,
      sciQuartile: paper.sciQuartile as any,
      casQuartile: paper.casQuartile as any,
      ccfRank: paper.ccfRank as any,
      impactFactor: paper.impactFactor,
      tags: paper.tags ? JSON.parse(paper.tags) : [],
      readingStatus: paper.readingStatus as any,
      priority: paper.priority as any,
      rating: paper.rating,
      remarks: paper.remarks,
      readingPosition: paper.readingPosition,
      totalReadingTime: paper.totalReadingTime,
      lastReadTime: paper.lastReadTime,
      createdAt: paper.createdAt,
      updatedAt: paper.updatedAt
    };
    
    // 4. 合并返回
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
      error: '获取论文内容失败'
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
    
    // 1. 如果有 metadata，更新到数据库
    if (metadata) {
      await Paper.update(id, {
        title: metadata.title,
        shortTitle: metadata.shortTitle,
        authors: metadata.authors ? JSON.stringify(metadata.authors) : undefined,
        publication: metadata.publication,
        year: metadata.year,
        date: metadata.date,
        doi: metadata.doi,
        articleType: metadata.articleType,
        sciQuartile: metadata.sciQuartile,
        casQuartile: metadata.casQuartile,
        ccfRank: metadata.ccfRank,
        impactFactor: metadata.impactFactor,
        tags: metadata.tags ? JSON.stringify(metadata.tags) : undefined,
        readingStatus: metadata.readingStatus,
        priority: metadata.priority,
        rating: metadata.rating,
        remarks: metadata.remarks,
        readingPosition: metadata.readingPosition,
        totalReadingTime: metadata.totalReadingTime,
        lastReadTime: metadata.lastReadTime,
      });
    }
    
    // 2. 保存内容到 JSON（不包含 metadata）
    const dataDir = path.join(__dirname, '../../data/papers');
    await fs.mkdir(dataDir, { recursive: true });
    
    const jsonPath = path.join(dataDir, `${id}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(contentData, null, 2), 'utf-8');
    
    res.json({
      success: true,
      message: '保存成功'
    });
  } catch (error) {
    console.error('保存论文内容失败:', error);
    res.status(500).json({
      success: false,
      error: '保存论文内容失败'
    });
  }
}
