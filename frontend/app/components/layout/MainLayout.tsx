'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
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
      
      // 应用控制
      app: {
        getVersion: () => Promise<string>;
        quit: () => Promise<void>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        unmaximize: () => Promise<void>;
        close: () => Promise<void>;
        setTitle: (title: string) => Promise<void>;
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
    activeTabId, 
    tabs, 
    setActiveTab, 
    closeTab, 
    resetToHome,
    closeAllTabs,
    closeOtherTabs
  } = useTabStore();
  const { isLoading } = useRouteLoading();
  
  // 标签页右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

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
      // 首次打开且直达子路由，也回首页并重置 Tab
      // 但是如果是通过标签页导航过来的，不要重定向
      const currentPath = window.location.pathname;
      // 添加 /settings 路径到例外列表，避免设置页面被重定向
      if (currentPath !== '/' && !currentPath.startsWith('/paper/') && !currentPath.startsWith('/settings')) {
        resetToHome();
        router.replace('/');
      }
    }
    
    // 清除任何文本选择和焦点
    requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body) el.blur();
      
      // 清除任何文本选择
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges();
      }
      
      // 为 Electron 环境添加额外处理
      if (window.electronAPI) {
        // 只在特定情况下清除选择，而不是每次鼠标释放都清除
        const handleMouseUp = (e: MouseEvent) => {
          // 只在点击非文本元素时清除选择
          const target = e.target as HTMLElement;
          if (target && !target.matches('input, textarea, [contenteditable="true"], .prose, .prose *, a, button, [role="button"]')) {
            // 延迟清除选择，避免干扰正常的文本选择
            setTimeout(() => {
              if (window.getSelection) {
                const selection = window.getSelection();
                if (selection && selection.toString().length === 0) {
                  // 只有在没有选中文本时才清除选择范围
                  selection.removeAllRanges();
                }
              }
            }, 10);
          }
        };
        
        // 防止拖拽选择
        const handleDragStart = (e: DragEvent) => {
          const target = e.target as HTMLElement;
          if (target && !target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
            e.preventDefault();
          }
        };
        
        // 添加事件监听器
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('dragstart', handleDragStart);
        
        // 清理函数
        return () => {
          document.removeEventListener('mouseup', handleMouseUp);
          document.removeEventListener('dragstart', handleDragStart);
        };
      }
    });
  }, []);

  // 关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // 处理标签页切换
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      router.push(tab.path);
    }
  };

  // 处理标签页关闭
  const handleTabClose = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    // 不允许关闭首页标签
    if (tabId === 'dashboard') return;
    
    // 如果关闭的是当前激活的标签，需要切换到左边的标签
    if (tabId === activeTabId) {
      const currentIndex = tabs.findIndex(t => t.id === tabId);
      
      // 找到左边的标签（优先左侧）
      if (currentIndex > 0) {
        const targetTab = tabs[currentIndex - 1];
        setActiveTab(targetTab.id);
        await router.push(targetTab.path);
      } else if (tabs.length > 1) {
        // 如果是第一个标签（但不是 dashboard），切换到右边的标签
        const targetTab = tabs[currentIndex + 1];
        setActiveTab(targetTab.id);
        await router.push(targetTab.path);
      }
    }
    
    closeTab(tabId);
  };

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
  };

  // 处理关闭其他标签页
  const handleCloseOthers = () => {
    if (contextMenu) {
      closeOtherTabs(contextMenu.tabId);
      setContextMenu(null);
    }
  };

  // 处理关闭所有标签页
  const handleCloseAll = () => {
    closeAllTabs();
    setContextMenu(null);
    router.push('/');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 左侧导航栏 */}
      <Sidebar />
      
      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 标签页栏 */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          {/* 标签页列表 */}
          <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                  transition-all duration-200 group min-w-[100px] max-w-[180px]
                  select-none
                  ${activeTabId === tab.id 
                    ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-600' 
                    : 'bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }
                `}
              >
                <span className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {tab.title}
                </span>
                {tab.id !== 'dashboard' && (
                  <button
                    onClick={(e) => handleTabClose(e, tab.id)}
                    className={`
                      rounded p-0.5 transition-all
                      ${activeTabId === tab.id 
                        ? 'opacity-60 hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-600' 
                        : 'opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600'
                      }
                    `}
                    aria-label="关闭标签页"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* 内容区域 */}
        <main className="flex-1 overflow-auto relative">
          {children}
          
          {/* 全局Loading遮罩 */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  {/* 外圈旋转 */}
                  <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                  {/* 内圈旋转 */}
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  {/* 中心图标 */}
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

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 min-w-[160px]"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.tabId !== 'dashboard' && (
            <button
              onClick={() => {
                const tabToClose = contextMenu.tabId;
                setContextMenu(null);
                // 使用 handleTabClose 的逻辑
                const currentIndex = tabs.findIndex(t => t.id === tabToClose);
                if (tabToClose === activeTabId && currentIndex > 0) {
                  const targetTab = tabs[currentIndex - 1];
                  setActiveTab(targetTab.id);
                  router.push(targetTab.path);
                }
                closeTab(tabToClose);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              关闭标签页
            </button>
          )}
          <button
            onClick={handleCloseOthers}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            关闭其他标签页
          </button>
          <button
            onClick={handleCloseAll}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            关闭所有标签页
          </button>
        </div>
      )}
    </div>
  );
}