declare module "*.css";

declare global {
  interface Window {
    electronAPI?: {
      // 基础信息
      platform: string;
      version: string;
      
      // 窗口控制
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        setTitle: (title: string) => Promise<void>;
      };
      
      // 应用控制
      app: {
        getVersion: () => Promise<string>;
        quit: () => Promise<void>;
      };
      
      // 文件系统操作
      fs: {
        readFile: (path: string) => Promise<any>;
        writeFile: (path: string, data: any) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
        mkdir: (path: string) => Promise<void>;
        unlink: (path: string) => Promise<void>;
        readdir: (path: string) => Promise<string[]>;
        stat: (path: string) => Promise<any>;
      };
      
      // 对话框
      dialog: {
        showOpenDialog: (options: any) => Promise<any>;
        showSaveDialog: (options: any) => Promise<any>;
        showMessageDialog: (options: any) => Promise<any>;
        showErrorDialog: (options: any) => Promise<any>;
      };
      
      // 通知
      notification: {
        show: (options: any) => Promise<void>;
        requestPermission: () => Promise<any>;
      };
      
      // 系统信息
      system: {
        getOSInfo: () => Promise<any>;
        getMemoryInfo: () => Promise<any>;
        getCPUInfo: () => Promise<any>;
      };
      
      // 剪贴板
      clipboard: {
        readText: () => Promise<string>;
        writeText: (text: string) => Promise<void>;
        readHTML: () => Promise<string>;
        writeHTML: (html: string) => Promise<void>;
      };
      
      // 开发者工具
      dev: {
        openDevTools: () => Promise<void>;
        closeDevTools: () => Promise<void>;
        reload: () => Promise<void>;
        toggleDevTools: () => Promise<void>;
      };
      
      // 数据库操作
      database: {
        query: (sql: string, params?: any[]) => Promise<any>;
        backup: (path: string) => Promise<void>;
        restore: (path: string) => Promise<void>;
      };
      
      // 事件监听
      on: (channel: string, callback: (data: any) => void) => void;
      removeListener: (channel: string, callback: (data: any) => void) => void;
    };
  }
}
