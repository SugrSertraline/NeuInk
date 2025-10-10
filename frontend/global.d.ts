declare module "*.css";

// Electron API 类型定义
interface ElectronAPI {
  // 应用控制
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  unmaximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => boolean;
  getAppVersion: () => Promise<string>;
  
  // 文件系统操作
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  exists: (filePath: string) => Promise<boolean>;
  mkdir: (dirPath: string) => Promise<void>;
  readdir: (dirPath: string) => Promise<string[]>;
  deleteFile: (filePath: string) => Promise<void>;
  
  // 对话框
  showOpenDialog: (options: any) => Promise<any>;
  showSaveDialog: (options: any) => Promise<any>;
  showMessageBox: (options: any) => Promise<any>;
  
  // 通知
  showNotification: (title: string, body: string) => void;
  
  // 系统信息
  getPlatform: () => string;
  getArch: () => string;
  getMemoryInfo: () => any;
  getCpuInfo: () => any;
  
  // 剪贴板
  readClipboardText: () => Promise<string>;
  writeClipboardText: (text: string) => Promise<void>;
  readClipboardHTML: () => Promise<string>;
  writeClipboardHTML: (html: string) => Promise<void>;
  
  // 开发者工具
  openDevTools: () => void;
  closeDevTools: () => void;
  reload: () => void;
  
  // 数据库操作（可选）
  queryDatabase: (sql: string, params?: any[]) => Promise<any>;
  
  // 事件监听
  on: (channel: string, callback: (data: any) => void) => void;
  off: (channel: string, callback: (data: any) => void) => void;
  send: (channel: string, data: any) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
