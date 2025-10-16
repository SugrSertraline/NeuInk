// backend/src/routes/papers.ts

import express from 'express';
import multer from 'multer';
import path from 'path';
import * as paperController from '../controllers/paperController';

const router = express.Router();
// 配置 multer 用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(md|markdown)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .md 和 .markdown 文件'));
    }
  },
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

// ========== Markdown 上传与解析 ==========
router.post('/upload/markdown', upload.single('file'), paperController.createPaperFromMarkdown);

// ========== 测试解析管理 ==========
router.get('/:id/parse/progress', paperController.getParseProgress);  // 获取解析进度

export default router;