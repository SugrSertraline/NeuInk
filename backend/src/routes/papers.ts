// backend/src/routes/papers.ts

import express from 'express';
import * as paperController from '../controllers/paperController';

const router = express.Router();

// 论文CRUD路由
router.get('/', paperController.getAllPapers);
router.get('/:id', paperController.getPaperById);
router.post('/', paperController.createPaper);
router.put('/:id', paperController.updatePaper);
router.delete('/:id', paperController.deletePaper);

// 论文内容路由
router.get('/:id/content', paperController.getPaperContent);
router.put('/:id/content', paperController.savePaperContent);

export default router;