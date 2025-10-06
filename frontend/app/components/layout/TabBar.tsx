'use client';

import React from 'react';
import { X, Home, Library, FolderTree, Settings, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTabStore, Tab } from '@/app/store/useTabStore';
import { cn } from '@/app/lib/utils';

const iconMap: Record<Tab['type'], React.ReactNode> = {
  dashboard: <Home className="w-5 h-5 transition-all duration-300" />,
  library: <Library className="w-5 h-5 transition-all duration-300" />,
  checklist: <FolderTree className="w-5 h-5 transition-all duration-300" />,
  settings: <Settings className="w-5 h-5 transition-all duration-300" />,
  paper: <FileText className="w-5 h-5 transition-all duration-300" />,
};

export default function TabBar() {
  const router = useRouter();
  const { tabs, activeTabId, setActiveTab, closeTab, loadingTabId, setLoading } = useTabStore();

  const onClickTab = async (tab: Tab) => {

    (document.activeElement as HTMLElement)?.blur();

    // 如果点击的是当前激活的tab，不需要切换
    if (tab.id === activeTabId) return;
    const currentPath = window.location.pathname;
    if (currentPath === tab.path) {
      setActiveTab(tab.id);
      setLoading(false, null);
      return;
    }
    // 设置加载状态
    setLoading(true, tab.id);
    
    try {
      setActiveTab(tab.id);
      router.push(tab.path);
      window.setTimeout(() => setLoading(false, null), 800);

    } catch (error) {
      console.error('Navigation error:', error);
      setLoading(false, null);
    }
    // 注意：loading状态会在MainLayout中的路由监听器中清除
  };

  const onCloseTab = async (e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation();
    (document.activeElement as HTMLElement)?.blur();

    if (tab.id === 'dashboard') return;
    
    // 如果关闭的是当前激活的标签，需要切换到左边的标签
    if (tab.id === activeTabId) {
      const currentIndex = tabs.findIndex(t => t.id === tab.id);
      
      let targetTab: Tab | null = null;
      
      // 找到左边的标签（如果存在）
      if (currentIndex > 0) {
        targetTab = tabs[currentIndex - 1];
      } else if (tabs.length > 1) {
        // 如果是第一个标签，切换到右边的标签
        targetTab = tabs[currentIndex + 1];
      }
      
      if (targetTab) {
        if (window.location.pathname === targetTab.path) {
          setActiveTab(targetTab.id);
          setLoading(false, null);
        } else {
          setLoading(true, targetTab.id);
          try {
            setActiveTab(targetTab.id);
            router.push(targetTab.path); // 不要 await
            window.setTimeout(() => setLoading(false, null), 800);
          } catch (error) {
            console.error('Navigation error:', error);
            setLoading(false, null);
          }
        }
      }
      
    }
    
    closeTab(tab.id);
  };

  return (
    <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isLoading = loadingTabId === tab.id;
        const baseBtn =
          "relative inline-flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium group overflow-hidden";
        const activeStylesMap: Record<Tab['type'], string> = {
          dashboard: "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]",
          library: "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 scale-[1.02]",
          checklist: "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]",
          settings: "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/30 scale-[1.02]",
          paper: "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]",
        };
        const inactiveStyles =
          "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:scale-[1.02]";

        return (
          <button
          key={tab.id}
          onClick={() => onClickTab(tab)}
          disabled={isLoading}
          className={cn(
            baseBtn,
            "focus:outline-none focus-visible:outline-none focus:ring-0",
            isActive ? activeStylesMap[tab.type] : inactiveStyles,
            isLoading && "opacity-75 cursor-wait"
          )}
          title={tab.title}
        >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-lg" />
            )}

            <span className={cn(isActive ? "scale-110" : "group-hover:scale-110")}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : iconMap[tab.type]}
            </span>

            <span className="flex-1 text-left whitespace-nowrap">{tab.title}</span>

            {isActive && !isLoading && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}

            {tab.id !== 'dashboard' && (
              <X
                onClick={(e) => onCloseTab(e, tab)}
                className={cn(
                  "w-4 h-4 transition-all duration-300",
                  isActive ? "" : "opacity-60 group-hover:opacity-100 group-hover:scale-110"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}