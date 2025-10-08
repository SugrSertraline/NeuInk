// app/components/layout/ChecklistTreeSidebar.tsx
'use client';

import React from 'react';
import { ChevronRight, FileText } from 'lucide-react';
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
  handleNavClick,
  activePathChecker
}: Props) {
  const { checklists, loadChecklists } = useChecklistStore();

  React.useEffect(() => {
    if (isOpen) {
      loadChecklists();
    }
  }, [isOpen, loadChecklists]);

  if (!isOpen) return null;

  return (
    <div className="ml-2 space-y-1 overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {checklists.map((level1) => (
        <div key={level1.id} className="space-y-0.5">
          {/* 一级分类标题 */}
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {level1.name}
          </div>

          {/* 二级分类列表 */}
          {level1.children?.map((level2) => {
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

          {(!level1.children || level1.children.length === 0) && (
            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-600 italic">
              暂无子分类
            </div>
          )}
        </div>
      ))}

      {checklists.length === 0 && (
        <div className="px-3 py-4 text-xs text-slate-400 dark:text-slate-600 text-center">
          还没有创建清单
        </div>
      )}
    </div>
  );
}