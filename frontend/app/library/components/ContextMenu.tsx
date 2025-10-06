// library/components/ContextMenu.tsx

'use client';

import React from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';
import type { PaperMetadata } from '@neuink/shared';

interface ContextMenuProps {
  show: boolean;
  x: number;
  y: number;
  paper: PaperMetadata | null;
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ContextMenu({
  show,
  x,
  y,
  paper,
  onViewDetails,
  onEdit,
  onDelete
}: ContextMenuProps) {
  if (!show || !paper) return null;

  return (
    <div
      className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px] z-50"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <button
        onClick={onViewDetails}
        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
      >
        <Eye className="w-4 h-4" />
        查看详情
      </button>
      <button
        onClick={onEdit}
        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
      >
        <Edit className="w-4 h-4" />
        编辑
      </button>
      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
      <button
        onClick={onDelete}
        className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        删除
      </button>
    </div>
  );
}