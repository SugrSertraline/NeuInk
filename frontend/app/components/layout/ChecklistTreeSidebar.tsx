// app/components/layout/ChecklistTreeSidebar.tsx
'use client';

import React from 'react';
import { ChevronRight, ChevronDown, FileText, ChevronDown as ExpandIcon, ChevronRight as CollapseIcon } from 'lucide-react';
import { useChecklistStore } from '@/app/store/useChecklistStore';
import { cn } from '@/app/lib/utils';
import type { TabType } from '@/app/store/useTabStore';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  handleNavClick: (id: string, type: TabType, label: string, path?: string) => void;
  activePathChecker: (path: string) => boolean;
}

export default function ChecklistTreeSidebar({
  isOpen,
  onToggle,
  handleNavClick,
  activePathChecker
}: Props) {
  const { checklists, loadChecklists, expandedIds, toggleExpand, expandAll, collapseAll } = useChecklistStore();

  React.useEffect(() => {
    if (isOpen) {
      loadChecklists();
    }
  }, [isOpen, loadChecklists]);

  if (!isOpen) return null;

  const handleCategoryClick = (categoryId: string) => {
    toggleExpand(categoryId);
  };

  const hasExpandedCategories = Object.keys(expandedIds).length > 0;
  const hasCategories = checklists.length > 0;
  const isAllExpanded = hasCategories && checklists.every(level1 => expandedIds[level1.id]);

  const toggleAllCategories = () => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  return (
    <div className="ml-2 space-y-1 overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* 展开/折叠所有按钮 - 合并为一个 */}
      {hasCategories && (
        <div className="flex items-center justify-center px-2 py-1">
          <button
            onClick={toggleAllCategories}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            title={isAllExpanded ? "折叠所有分类" : "展开所有分类"}
          >
            {isAllExpanded ? (
              <>
                <CollapseIcon className="w-3 h-3" />
                <span>折叠全部</span>
              </>
            ) : (
              <>
                <ExpandIcon className="w-3 h-3" />
                <span>展开全部</span>
              </>
            )}
          </button>
        </div>
      )}
      {checklists.map((level1) => {
        const isExpanded = expandedIds[level1.id];
        
        return (
          <div key={level1.id} className="space-y-0.5">
            {/* 一级分类标题 - 可点击展开/折叠 */}
            <button
              onClick={() => handleCategoryClick(level1.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span className="flex-1 text-left">{level1.name}</span>
              {level1.children && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {level1.children.length}
                </span>
              )}
            </button>

            {/* 二级分类列表 - 根据展开状态显示 */}
            {isExpanded && level1.children?.map((level2) => {
              const path = `/checklist/${level2.id}`;
              const isActive = activePathChecker(path);

              return (
                <button
                  key={level2.id}
                  onClick={() => handleNavClick(
                    level2.id,
                    'checklist',
                    level2.name,
                    path
                  )}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                    "focus:outline-none focus-visible:outline-none",
                    isActive
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{level2.name}</span>
                  {level2.paperCount !== undefined && level2.paperCount > 0 && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full font-medium",
                      isActive
                        ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    )}>
                      {level2.paperCount}
                    </span>
                  )}
                </button>
              );
            })}

            {isExpanded && (!level1.children || level1.children.length === 0) && (
              <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-600 italic">
                暂无子分类
              </div>
            )}
          </div>
        );
      })}

      {checklists.length === 0 && (
        <div className="px-3 py-4 text-xs text-slate-400 dark:text-slate-600 text-center">
          还没有创建清单
        </div>
      )}
    </div>
  );
}