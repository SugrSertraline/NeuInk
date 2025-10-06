'use client';

import MainLayout from '../components/layout/MainLayout';

export default function SettingsPage() {
  return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-slate-500 mt-2">
          后续接入：主题、API Key、数据备份/导出等
        </p>
      </div>
  );
}
