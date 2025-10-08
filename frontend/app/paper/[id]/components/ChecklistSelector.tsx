// app/paper/[id]/components/ChecklistSelector.tsx
'use client';

import React from 'react';
import { FolderOpen, ChevronDown } from 'lucide-react';
import type { ChecklistNode } from '@neuink/shared';

interface ChecklistSelectorProps {
  checklists: ChecklistNode[];
  activeChecklistId: string | null;
  onChecklistChange: (checklistId: string | null) => void;
}

export default function ChecklistSelector({
  checklists,
  activeChecklistId,
  onChecklistChange,
}: ChecklistSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const activeChecklist = checklists.find(c => c.id === activeChecklistId);

  return (
    <div className="relative">
      {/* 选择器按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
      >
        <FolderOpen className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {activeChecklist ? activeChecklist.fullPath : '选择清单'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 菜单内容 */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto">
            {/* 全部笔记选项 */}
            <button
              onClick={() => {
                onChecklistChange(null);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors border-b border-slate-100 dark:border-slate-700 ${
                !activeChecklistId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="font-medium text-slate-900 dark:text-white">
                📝 段落笔记
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                查看通用的段落笔记
              </div>
            </button>

            {checklists.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                该论文未添加到任何清单
              </div>
            ) : (
              <div className="py-2">
                {checklists.map((checklist) => (
                  <button
                    key={checklist.id}
                    onClick={() => {
                      onChecklistChange(checklist.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors ${
                      activeChecklistId === checklist.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          {checklist.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {checklist.fullPath}
                        </div>
                      </div>
                      {activeChecklistId === checklist.id && (
                        <div className="w-2 h-2 bg-emerald-600 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}