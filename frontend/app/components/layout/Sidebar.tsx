'use client';

import React from 'react';
import {
  Home,
  Library,
  FolderTree,
  Settings,
  ChevronRight,
  Plus,
  BookOpen,
  Loader2
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTabStore } from '@/app/store/useTabStore';
import { cn } from '@/app/lib/utils';
import type { TabType, KnownTabType } from '@/app/store/useTabStore';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  type: 'dashboard' | 'library' | 'checklist' | 'settings';
}

export default function Sidebar() {
  const router = useRouter();
  const { tabs, activeTabId, addTab, setActiveTab, loadingTabId, setLoading } = useTabStore();
  const [checklistsExpanded, setChecklistsExpanded] = React.useState(false);
  const pathname = usePathname();
  const handleNavClick = (
    id: string,
    type: TabType,
    label: string,
    explicitPath?: string
  ) => {

    (document.activeElement as HTMLElement)?.blur();
    const existingTab = tabs.find(t => t.id === id);

    // 1) 解析路径：优先 explicitPath；否则按类型推导
    const path =
      explicitPath
      ?? (type === 'dashboard'
        ? '/'
        : (type === 'paper'
          ? `/paper/${id}`    // 自动支持 paper/[id]
          : `/${String(type)}`));

    // 2) 如果已经在同一路径：不导航、直接激活并清理 loading
    if (pathname === path) {
      if (existingTab) {
        setActiveTab(id);
      } else {
        addTab({ id, type, title: label, path });
        setActiveTab(id);
      }
      setLoading(false, null);
      return;
    }

    // 3) 正常导航：设 loading、设置/新增 tab、push，并加兜底超时
    setLoading(true, id);
    try {
      if (existingTab) {
        setActiveTab(id);
      } else {
        addTab({ id, type, title: label, path });
        setActiveTab(id);
      }

      router.push(path); // 统一在这里导航（无 await）

      // 兜底超时，极端情况下 pathname 监听不到也能清理
      window.setTimeout(() => setLoading(false, null), 800);
    } catch (e) {
      console.error('Navigation error:', e);
      setLoading(false, null);
    }
  };


  const NavButton = ({
    id,
    type,
    label,
    icon: Icon,
    gradientFrom,
    gradientTo,
    children
  }: {
    id: string;
    type: 'dashboard' | 'library' | 'checklist' | 'settings';
    label: string;
    icon: any;
    gradientFrom: string;
    gradientTo: string;
    children?: React.ReactNode;
  }) => {
    const isActive = activeTabId === id;
    const isLoading = loadingTabId === id;

    return (
      <button
        onClick={() => handleNavClick(id, type, label)}
        disabled={isLoading}
        className={cn(
          "relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium group overflow-hidden",
          // 👇 关键：去掉焦点 outline / ring
          "focus:outline-none focus-visible:outline-none focus:ring-0",
          isActive
            ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white shadow-lg shadow-${gradientFrom.split('-')[1]}-500/30 scale-[1.02]`
            : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:scale-[1.02]",
          isLoading && "opacity-75 cursor-wait"
        )}
      >
        {/* Active 指示器 */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-lg" />
        )}

        {/* Loading 或 Icon */}
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Icon className={cn(
            "w-5 h-5 transition-all duration-300",
            isActive ? "scale-110" : "group-hover:scale-110",
            id === 'settings' && isActive && "rotate-90"
          )} />
        )}

        <span className="flex-1 text-left">{label}</span>

        {children}

        {isActive && !isLoading && (
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        )}
      </button>
    );
  };

  return (
    <div className="w-64 h-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
      {/* Logo区域 */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            NeuInk
          </span>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {/* 第一部分：首页和论文库 */}
        <div className="space-y-1.5">
          <NavButton
            id="dashboard"
            type="dashboard"
            label="首页"
            icon={Home}
            gradientFrom="from-blue-500"
            gradientTo="to-blue-600"
          />

          <NavButton
            id="library"
            type="library"
            label="论文库"
            icon={Library}
            gradientFrom="from-purple-500"
            gradientTo="to-purple-600"
          />
        </div>

        {/* 分割线 */}
        <div className="relative py-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
          </div>
        </div>

        {/* 第二部分：清单管理 */}
        <div className="space-y-1.5">
          <button
            onClick={() => {
              handleNavClick('checklists', 'checklist', '清单管理');
              setChecklistsExpanded(!checklistsExpanded);
            }}
            disabled={loadingTabId === 'checklists'}
            className={cn(
              "relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium group overflow-hidden",
  "focus:outline-none focus-visible:outline-none focus:ring-0",
              activeTabId === 'checklists'
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]"
                : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:scale-[1.02]",
              loadingTabId === 'checklists' && "opacity-75 cursor-wait"
            )}
          >
            {/* Active 指示器 */}
            {activeTabId === 'checklists' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-lg" />
            )}

            {loadingTabId === 'checklists' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight
                className={cn(
                  "w-4 h-4 transition-all duration-300",
                  checklistsExpanded && "rotate-90",
                  activeTabId === 'checklists' ? "" : "group-hover:scale-110"
                )}
              />
            )}

            <FolderTree className={cn(
              "w-5 h-5 transition-all duration-300",
              activeTabId === 'checklists' ? "scale-110" : "group-hover:scale-110"
            )} />
            <span className="flex-1 text-left">清单管理</span>
            <Plus className={cn(
              "w-4 h-4 transition-all duration-300",
              activeTabId === 'checklists'
                ? "opacity-100 scale-100"
                : "opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-90"
            )} />
            {activeTabId === 'checklists' && loadingTabId !== 'checklists' && (
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
          </button>

          {/* 清单列表（展开时显示） */}
          <div className={cn(
            "ml-9 space-y-1 overflow-hidden transition-all duration-300",
            checklistsExpanded ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
          )}>
            <div className="text-xs text-slate-500 dark:text-slate-400 px-4 py-3 italic bg-white/50 dark:bg-slate-800/50 rounded-lg">
              暂无清单
            </div>
          </div>
        </div>

        {/* 分割线 */}
        <div className="relative py-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
          </div>
        </div>

        {/* 第三部分：设置 */}
        <div className="space-y-1.5">
          <NavButton
            id="settings"
            type="settings"
            label="设置"
            icon={Settings}
            gradientFrom="from-slate-600"
            gradientTo="to-slate-700"
          />
        </div>
      </nav>

      {/* 底部统计信息 */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="space-y-2.5">
          <div className="flex justify-between items-center group cursor-default px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">论文总数</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-md group-hover:scale-110 transition-transform">
              0
            </span>
          </div>
          <div className="flex justify-between items-center group cursor-default px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">阅读中</span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-md group-hover:scale-110 transition-transform shadow-sm">
              0
            </span>
          </div>
          <div className="flex justify-between items-center group cursor-default px-3 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">已完成</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-md group-hover:scale-110 transition-transform shadow-sm">
              0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}