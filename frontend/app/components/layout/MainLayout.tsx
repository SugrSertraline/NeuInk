'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import { useTabStore } from '@/app/store/useTabStore';
import { Loader2 } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeTabId, isLoading, setLoading,resetToHome } = useTabStore();

  useEffect(() => {
    // 1) 检测是否“硬刷新”
    const nav = (performance?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined);
    const isReload = nav?.type === 'reload';
  
    // 2) 首次访问（新标签页第一次进入）
    const hasVisited = sessionStorage.getItem('hasVisited');
   
    if (isReload) {
      // 刷新场景：无条件重置
      resetToHome();
      router.replace('/');
      setLoading(false, null);
      return;
    }
  
    if (!hasVisited) {
      sessionStorage.setItem('hasVisited', 'true');
      // 首次打开且直达子路由，也回首页并重置 Tab
      if (window.location.pathname !== '/') {
        resetToHome();
        router.replace('/');
      }
    }
    requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body) el.blur();
    });
  }, []); // 维持一次性副作用
  

  // 监听路由变化，清除loading状态
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false, null);
    }, 100);
    return () => clearTimeout(timer);
  }, [pathname, setLoading]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 左侧导航栏 */}
      <Sidebar />
      
      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 标签页栏 */}
        <TabBar />
        
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
    </div>
  );
}