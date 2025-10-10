'use client';

import React from 'react';
import { X, Home, Library, FolderTree, Settings, FileText, Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
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
  const pathname = usePathname(); // ✅ 添加 pathname 监听
  const { tabs, activeTabId, setActiveTab, closeTab, loadingTabId, setLoading } = useTabStore();

  // ✅ 监听路径变化，自动清除 loading 状态
  React.useEffect(() => {
    if (loadingTabId) {
      const targetTab = tabs.find(t => t.id === loadingTabId);
      if (targetTab && pathname === targetTab.path) {
        // 路径已经匹配，清除 loading
        const timer = setTimeout(() => {
          setLoading(false, null);
        }, 150); // 给一点时间让页面渲染
        return () => clearTimeout(timer);
      }
    }
  }, [pathname, loadingTabId, tabs, setLoading]);

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
      await router.push(tab.path);
      // ✅ 不再使用固定的 setTimeout，而是依赖 useEffect 监听路径变化
    } catch (error) {
      console.error('Navigation error:', error);
      setLoading(false, null);
    }
  };

  const onCloseTab = async (e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation();
    (document.activeElement as HTMLElement)?.blur();

    // 首页标签无法关闭
    if (tab.id === 'dashboard') return;
    
    // 如果关闭的是当前激活的标签，需要切换到左边的标签
    if (tab.id === activeTabId) {
      const currentIndex = tabs.findIndex(t => t.id === tab.id);
      
      let targetTab: Tab | null = null;
      
      // 优先找到左边的标签
      if (currentIndex > 0) {
        targetTab = tabs[currentIndex - 1];
      } else if (tabs.length > 1) {
        // 如果是第一个标签（但不是 dashboard），切换到右边的标签
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
            await router.push(targetTab.path);
            // ✅ 依赖 useEffect 监听路径变化
          } catch (error) {
            console.error('Navigation error:', error);
            setLoading(false, null);
          }
        }
      }
    }
    
    // 关闭标签
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
          dashboard: "bg-gradient-to-r from-[#284286] to-[#3a5ba8] text-white shadow-lg shadow-[#284286]/20 scale-[1.02]",
          library: "bg-gradient-to-r from-[#3d4d99] to-[#4a5fb3] text-white shadow-lg shadow-indigo-500/20 scale-[1.02]",
          checklist: "bg-gradient-to-r from-[#2d5f7a] to-[#3a7694] text-white shadow-lg shadow-cyan-600/20 scale-[1.02]",
          settings: "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20 scale-[1.02]",
          paper: "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-[1.02]",
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

            {/* 只有非首页标签才显示关闭按钮 */}
            {tab.id !== 'dashboard' && (
              <X
                onClick={(e) => onCloseTab(e, tab)}
                className={cn(
                  "w-4 h-4 transition-all duration-300 hover:text-red-400",
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