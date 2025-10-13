'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import { useTabStore } from '@/app/store/useTabStore';
import { useRouteLoading } from '@/app/hooks/useRouteLoading';
import { Loader2, X } from 'lucide-react';

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