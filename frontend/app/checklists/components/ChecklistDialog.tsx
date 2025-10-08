// app/checklists/components/ChecklistDialog.tsx
'use client';

import React from 'react';

// ✅ 删除了 templateId 字段
export interface ChecklistDialogPayload {
  id?: string;
  parentId?: string;
  name: string;
  level?: 1 | 2;
}

export default function ChecklistDialog({
  open, onClose, defaults, onSubmit
}: {
  open: boolean;
  onClose: () => void;
  defaults?: Partial<ChecklistDialogPayload>;
  onSubmit: (payload: ChecklistDialogPayload) => void | Promise<void>;
}) {
  const [name, setName] = React.useState(defaults?.name ?? '');
  const [parentId, setParentId] = React.useState<string | undefined>(defaults?.parentId);
  // ✅ 删除了 templateId state
  const isLevel2 = !!parentId || defaults?.level === 2;

  const onConfirm = async () => {
    if (!name.trim()) return alert('请输入名称');
    // ✅ 删除了 templateId 参数
    await onSubmit({ 
      id: defaults?.id, 
      name: name.trim(), 
      parentId, 
      level: isLevel2 ? 2 : 1 
    });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <div className="w-[520px] max-w-[92vw] rounded-lg bg-white dark:bg-slate-800 p-5 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          {defaults?.id ? '编辑清单' : '新建清单'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">名称</label>
            <input
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 outline-none focus:border-blue-500 dark:bg-slate-700 dark:text-white"
              placeholder={isLevel2 ? '请输入二级分类名称' : '请输入一级分类名称'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* ✅ 完全删除了模板选择部分 */}
          
          {isLevel2 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              二级分类可以包含论文
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="rounded-md bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={onConfirm} 
            className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}