'use client';

import MainLayout from '../components/layout/MainLayout';

export default function ChecklistPage() {
  return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">清单管理</h1>
        <p className="text-sm text-slate-500 mt-2">
          这里将展示清单树、清单内论文列表、清单笔记（后续接入）
        </p>
      </div>
  );
}
