'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import { useTabStore } from '@/app/store/useTabStore';
import { useRouteLoading } from '@/app/hooks/useRouteLoading';
import { Loader2, X } from 'lucide-react';

// 声明 window.electronAPI 的类型
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

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    resetToHome
  } = useTabStore();
  const { isLoading } = useRouteLoading();

  useEffect(() => {
    // 1) 检测是否"硬刷新"
    const nav = (performance?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined);
    const isReload = nav?.type === 'reload';
  
    // 2) 首次访问（新标签页第一次进入）
    const hasVisited = sessionStorage.getItem('hasVisited');
   
    if (isReload) {
      // 刷新场景：无条件重置
      resetToHome();
      router.replace('/');
      return;
    }
  
    if (!hasVisited) {
      sessionStorage.setItem('hasVisited', 'true');
      const currentPath = window.location.pathname;
      if (currentPath !== '/' && !currentPath.startsWith('/paper/') && !currentPath.startsWith('/settings')) {
        resetToHome();
        router.replace('/');
      }
    }
    
    // 清除任何文本选择和焦点
    requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body) el.blur();
      
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges();
      }
      
      // 为 Electron 环境添加额外处理
      if (window.electronAPI) {
        const handleMouseUp = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target && !target.matches('input, textarea, [contenteditable="true"], .prose, .prose *, a, button, [role="button"]')) {
            setTimeout(() => {
              if (window.getSelection) {
                const selection = window.getSelection();
                if (selection && selection.toString().length === 0) {
                  selection.removeAllRanges();
                }
              }
            }, 10);
          }
        };
        
        const handleDragStart = (e: DragEvent) => {
          const target = e.target as HTMLElement;
          if (target && !target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
            e.preventDefault();
          }
        };
        
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('dragstart', handleDragStart);
        
        return () => {
          document.removeEventListener('mouseup', handleMouseUp);
          document.removeEventListener('dragstart', handleDragStart);
        };
      }
    });
  }, []);


  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 左侧导航栏 */}
      <Sidebar />
      
      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 使用 TabBar 组件替换原有的标签页栏 */}
        <TabBar />
        
        {/* 内容区域 */}
        <main className="flex-1 overflow-auto relative">
          {children}
          
          {/* 全局Loading遮罩 */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                </div>
                <div className="text-slate-600 dark:text-slate-400 font-medium animate-pulse">
                  加载中...
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}