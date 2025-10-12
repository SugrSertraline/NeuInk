// backend/src/routes/parse.ts
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import * as parseController from '../controllers/parseController';

const router = express.Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join(__dirname, '../../data/temp');
    await fs.mkdir(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只支持PDF文件'));
    }
  }
});

// 🆕 通用PDF解析接口
router.post('/pdf', upload.single('pdf'), parseController.parsePDF);

export default router;