// backend/src/routes/uploads.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// 生成唯一文件名的函数
function generateUniqueFilename(originalname: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(originalname);
  return `${timestamp}-${random}${ext}`;
}

// 配置文件存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const paperId = req.params.paperId || 'temp';
    const uploadDir = path.join(__dirname, '../../data/uploads/images', paperId);
    
    // 确保目录存在
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = generateUniqueFilename(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式文件'));
    }
  }
});


// 上传图片
router.post('/:paperId/images', upload.single('image'), async (req: Request, res: Response) => {
  try {
    // 🆕 添加参数验证
    if (!req.params.paperId) {
      return res.status(400).json({ 
        success: false, 
        error: 'paperId 参数缺失' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '未上传文件' 
      });
    }

    const imageUrl = `/api/uploads/images/${req.params.paperId}/${req.file.filename}`;
    
    res.json({
      success: true,
      data: {  // 🆕 包装在 data 中，符合你的 API 规范
        url: imageUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('上传图片失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '上传失败' 
    });
  }
});


// 获取图片
router.get('/images/:paperId/:filename', async (req: Request, res: Response) => {
  try {
    const { paperId, filename } = req.params;
    const imagePath = path.join(__dirname, '../../data/uploads/images', paperId, filename);
    
    // 检查文件是否存在
    await fs.access(imagePath);
    
    res.sendFile(imagePath);
  } catch (error) {
    res.status(404).json({ error: '图片不存在' });
  }
});

// 删除图片
router.delete('/images/:paperId/:filename', async (req: Request, res: Response) => {
  try {
    // 🆕 添加参数验证
    if (!req.params.paperId || !req.params.filename) {
      return res.status(400).json({ 
        success: false, 
        error: '参数缺失' 
      });
    }
    
    const { paperId, filename } = req.params;
    const imagePath = path.join(__dirname, '../../data/uploads/images', paperId, filename);
    
    await fs.unlink(imagePath);
    
    res.json({ 
      success: true, 
      data: { message: '图片已删除' }  // 🆕 包装在 data 中
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '删除失败' 
    });
  }
});


export default router;