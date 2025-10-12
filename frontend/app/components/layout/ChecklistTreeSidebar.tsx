'use client';

import React from 'react';
import { ChevronRight, FileText, Loader2 } from 'lucide-react';
import { useChecklistStore } from '@/app/store/useChecklistStore';
import { useTabStore } from '@/app/store/useTabStore';
import { cn } from '@/lib/utils';
import type { ChecklistNode } from '@/app/types/checklist';

interface ChecklistTreeSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  handleNavClick: (id: string, type: any, label: string, path?: string) => void;
  activePathChecker: (path: string) => boolean;
}

export default function ChecklistTreeSidebar({
  isOpen,
  onToggle,
  handleNavClick,
  activePathChecker
}: ChecklistTreeSidebarProps) {
  const { checklists, expandedIds, toggleExpand } = useChecklistStore();
  const { loadingTabId } = useTabStore();

  return (
    <div className="space-y-1">
      {checklists.map((checklist) => {
        const isExpanded = expandedIds[checklist.id] === true;
        const hasChildren = checklist.children && checklist.children.length > 0;

        return (
          <div key={checklist.id} className="space-y-0.5">
            {/* 一级清单 - 只展开/折叠，不跳转 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) {
                  toggleExpand(checklist.id);
                }
              }}
              className={cn(
                "relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-300 text-sm font-medium group overflow-hidden",
                "focus:outline-none focus-visible:outline-none focus:ring-0",
                "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/50 hover:shadow-sm hover:scale-[1.01]"
              )}
            >
              {/* 展开/折叠按钮 */}
              {hasChildren && (
                <div
                  className={cn(
                    "flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-all duration-300",
                    "hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "w-3.5 h-3.5 transition-transform duration-300",
                      isExpanded && "rotate-90"
                    )}
                  />
                </div>
              )}

              {/* Icon */}
              <FileText className="w-4 h-4 transition-all duration-300 flex-shrink-0 group-hover:scale-110" />

              {/* 清单名称 */}
              <span className="flex-1 text-left truncate">
                {checklist.name}
              </span>
            </button>

            {/* 二级清单（展开时显示） */}
            {hasChildren && isExpanded && (
              <div className="ml-4 space-y-0.5 pl-2">
                {checklist.children!.map((subChecklist: ChecklistNode) => {
                  const isSubActive = activePathChecker(`/checklist/${subChecklist.id}`);
                  const isSubLoading = loadingTabId === subChecklist.id;

                  return (
                    <button
                      key={subChecklist.id}
                      onClick={() => {
                        handleNavClick(
                          subChecklist.id,
                          'checklist',
                          subChecklist.name,
                          `/checklist/${subChecklist.id}`
                        );
                      }}
                      disabled={isSubLoading}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300 text-xs font-medium group",
                        "focus:outline-none focus-visible:outline-none focus:ring-0",
                        isSubActive
                          ? "bg-gradient-to-r from-[#3a5ba8]/80 to-[#4a6bc8]/80 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:text-slate-800 dark:hover:text-slate-200",
                        isSubLoading && "opacity-75 cursor-wait"
                      )}
                    >
                      {/* Loading 或 Icon */}
                      {isSubLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                      ) : (
                        <FileText className={cn(
                          "w-3 h-3 transition-all duration-300 flex-shrink-0",
                          isSubActive 
                            ? "scale-110" 
                            : "group-hover:scale-110"
                        )} />
                      )}

                      {/* 子清单名称 */}
                      <span className="flex-1 text-left truncate">
                        {subChecklist.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}