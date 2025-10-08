// app/paper/[id]/components/ChecklistNoteEditor.tsx
'use client';

import React from 'react';
import type { ChecklistNote } from '@neuink/shared';
import { NOTE_TEMPLATES, getTemplateById } from '@/app/types/checklist';
import { cn } from '@/app/lib/utils';
import { Loader2 } from 'lucide-react';

export interface NoteEditorOpenPayload {
  checklistId: string;
  checklistName: string;
  templateId?: string | null;
  note?: ChecklistNote | null;   // 有则编辑，无则新建
}

export default function ChecklistNoteEditor({
  open,
  onClose,
  payload,
  onSubmit,
  submitting = false,
}: {
  open: boolean;
  onClose: () => void;
  payload: NoteEditorOpenPayload | null;
  onSubmit: (fields: Record<string, any>) => void | Promise<void>;
  submitting?: boolean;
}) {
  const tpl = React.useMemo(
    () => (payload?.templateId ? getTemplateById(payload.templateId) : null),
    [payload?.templateId]
  );

  const [fields, setFields] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    if (!open || !payload) return;
    // 初始值：已有 note.fields 或空
    setFields(payload.note?.fields ?? {});
  }, [open, payload]);

  if (!open || !payload) return null;

  const save = async () => {
    // 简单必填检查
    if (tpl?.fields) {
      for (const f of tpl.fields) {
        if (f.required && !String(fields[f.id] ?? '').trim()) {
          alert(`请填写「${f.label}」`);
          return;
        }
      }
    }
    await onSubmit(fields);
  };

  const renderField = (id: string, label: string, type: string, options?: string[]) => {
    const value = fields[id] ?? '';
    const set = (v: any) => setFields(prev => ({ ...prev, [id]: v }));

    switch (type) {
      case 'textarea':
        return (
          <div key={id}>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">{label}</label>
            <textarea
              rows={4}
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 dark:bg-slate-900"
              value={value}
              onChange={(e)=>set(e.target.value)}
            />
          </div>
        );
      case 'select':
        return (
          <div key={id}>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">{label}</label>
            <select
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 dark:bg-slate-900"
              value={value}
              onChange={(e)=>set(e.target.value)}
            >
              <option value="">请选择</option>
              {(options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        );
      case 'number':
        return (
          <div key={id}>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">{label}</label>
            <input
              type="number"
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 dark:bg-slate-900"
              value={value}
              onChange={(e)=>set(e.target.valueAsNumber)}
            />
          </div>
        );
      case 'date':
        return (
          <div key={id}>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">{label}</label>
            <input
              type="date"
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 dark:bg-slate-900"
              value={value}
              onChange={(e)=>set(e.target.value)}
            />
          </div>
        );
      default: // text
        return (
          <div key={id}>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">{label}</label>
            <input
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 dark:bg-slate-900"
              value={value}
              onChange={(e)=>set(e.target.value)}
            />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40">
      <div className="w-[640px] max-w-[92vw] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold">
            {payload.note ? '编辑清单笔记' : '新建清单笔记'} · {payload.checklistName}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {tpl ? (
            tpl.fields.map(f => renderField(f.id, f.label, f.type, f.options))
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              此清单未配置模板。可直接添加任意键值（JSON），或先在“清单管理”中为该清单设置模板。
              <div className="mt-3">
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">内容（JSON）</label>
                <textarea
                  className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500 dark:bg-slate-900"
                  rows={8}
                  value={JSON.stringify(fields, null, 2)}
                  onChange={(e) => {
                    try { setFields(JSON.parse(e.target.value || '{}')); }
                    catch { /* ignore */ }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <button className="rounded-md px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                  onClick={onClose}>取消</button>
          <button className="rounded-md px-3 py-1.5 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                  disabled={submitting}
                  onClick={save}>
            {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/>保存中…</span> : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
