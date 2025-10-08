// backend/src/routes/checklists.ts

import express from 'express';
import * as checklistController from '../controllers/checklistController';

const router = express.Router();

// ⚠️ 重要：具体路径必须放在动态路径 /:id 之前！

// 批量操作（放在 /:id 之前）
router.put('/batch-reorder', checklistController.batchReorderChecklists);

// 清单 CRUD
router.get('/', checklistController.getAllChecklists);
router.post('/', checklistController.createChecklist);
router.get('/:id', checklistController.getChecklistById);
router.put('/:id', checklistController.updateChecklist);
router.delete('/:id', checklistController.deleteChecklist);

// 清单内的论文管理（具体路径也要放在前面）
router.get('/:id/papers', checklistController.getChecklistPapers);
router.post('/:id/papers', checklistController.addPapersToChecklist);
router.put('/:id/papers/reorder', checklistController.reorderChecklistPapers);
router.delete('/:id/papers/:paperId', checklistController.removePaperFromChecklist);

export default router;