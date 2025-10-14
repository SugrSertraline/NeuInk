// backend/src/routes/papers.ts

import express from 'express';
import multer from 'multer';
import path from 'path';
import * as paperController from '../controllers/paperController';

const router = express.Router();

// ========== Multer 文件上传配置 ==========

// 配置 Markdown 文件上传
const markdownStorage = multer.memoryStorage();
const markdownUpload = multer({
  storage: markdownStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.md', '.markdown'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .md 或 .markdown 格式的文件'));
    }
  }
});

// ========== 基础 CRUD 路由 ==========

/**
 * 获取所有论文列表（支持分页、排序、筛选）
 * GET /api/papers
 * Query params: page, limit, sort, search, status, priority, etc.
 */
router.get('/', paperController.getAllPapers);

/**
 * 根据 ID 获取论文详情
 * GET /api/papers/:id
 */
router.get('/:id', paperController.getPaperById);

/**
 * 创建新论文（手动创建）
 * POST /api/papers
 * Body: { title, authors, ... }
 */
router.post('/', paperController.createPaper);

/**
 * 更新论文元数据
 * PUT /api/papers/:id
 * Body: { title?, authors?, ... }
 */
router.put('/:id', paperController.updatePaper);

/**
 * 删除论文
 * DELETE /api/papers/:id
 */
router.delete('/:id', paperController.deletePaper);

// ========== 论文内容路由 ==========

/**
 * 获取论文完整内容（包含 sections, references 等）
 * GET /api/papers/:id/content
 */
router.get('/:id/content', paperController.getPaperContent);

/**
 * 保存论文完整内容
 * PUT /api/papers/:id/content
 * Body: PaperContent (不包含 metadata)
 */
router.put('/:id/content', paperController.savePaperContent);

// ========== 论文清单关联路由 ==========

/**
 * 获取论文所属的所有清单
 * GET /api/papers/:id/checklists
 */
router.get('/:id/checklists', paperController.getPaperChecklists);

// ========== Markdown 智能解析路由 ==========

/**
 * 从 Markdown 文件创建论文（后台异步解析）
 * POST /api/papers/from-markdown
 * Content-Type: multipart/form-data
 * Body: { markdown: File }
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": { id: "...", title: "...", parseStatus: "pending", ... },
 *   "message": "论文创建成功，正在后台解析中",
 *   "parseStatus": { status: "pending", message: "..." }
 * }
 */
router.post('/from-markdown', markdownUpload.single('markdown'), paperController.createPaperFromMarkdown);

/**
 * 获取论文解析进度
 * GET /api/papers/:id/parse-progress
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "paperId": "...",
 *     "parseStatus": "parsing",
 *     "progress": {
 *       "status": "parsing",
 *       "percentage": 45,
 *       "message": "正在解析论文内容... (3/8)",
 *       "totalChunks": 8,
 *       "chunksProcessed": 3
 *     }
 *   }
 * }
 */
router.get('/:id/parse-progress', paperController.getPaperParseProgress);

/**
 * 重新解析论文（待实现）
 * POST /api/papers/:id/reparse
 * 
 * 注意：需要保存原始 Markdown 内容才能重新解析
 */
router.post('/:id/reparse', paperController.retryParsePaper);

// ========== 导出路由 ==========

export default router;