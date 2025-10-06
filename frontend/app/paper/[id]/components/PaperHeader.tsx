// frontend/app/papers/[id]/components/PaperHeader.tsx
'use client';

import React from 'react';
import { Search, BookOpen, StickyNote, ChevronUp, ChevronDown, Edit3, Save, XCircle, AlertCircle } from 'lucide-react';

type Lang = 'en' | 'both';

interface PaperHeaderProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  showNotes: boolean;
  setShowNotes: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  contentRef: React.RefObject<HTMLDivElement|null>;
  searchResultsCount?: number;
  currentSearchIndex?: number;
  onSearchNavigate?: (direction: 'next' | 'prev') => void;
  // 🆕 编辑模式相关 props
  isEditMode?: boolean;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  saveError?: string | null;
  onEnterEditMode?: () => void;
  onCancelEdit?: () => void;
  onSaveChanges?: () => void;
}

export default function PaperHeader({
  lang,
  setLang,
  showNotes,
  setShowNotes,
  searchQuery,
  setSearchQuery,
  searchResultsCount = 0,
  currentSearchIndex = 0,
  onSearchNavigate,
  isEditMode = false,
  hasUnsavedChanges = false,
  isSaving = false,
  saveError = null,
  onEnterEditMode,
  onCancelEdit,
  onSaveChanges,
}: PaperHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        {/* 左侧：Logo + 搜索 */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索论文内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-32 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            {searchQuery && searchResultsCount > 0 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {currentSearchIndex + 1} / {searchResultsCount}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onSearchNavigate?.('prev')}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="上一个"
                  >
                    <ChevronUp className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => onSearchNavigate?.('next')}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="下一个"
                  >
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 右侧：语言切换 + 编辑/笔记按钮 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* 语言切换 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { value: 'en' as Lang, label: 'EN' },
              { value: 'both' as Lang, label: '双语' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLang(value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  lang === value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          {/* 编辑模式按钮组 */}
          {!isEditMode ? (
            <>
              {/* 笔记按钮（仅阅读模式显示） */}
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showNotes
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <StickyNote className="w-4 h-4" />
                <span className="text-sm font-medium">笔记</span>
              </button>
              
              {/* 进入编辑模式按钮 */}
              <button
                onClick={onEnterEditMode}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Edit3 className="w-4 h-4" />
                <span className="text-sm font-medium">编辑</span>
              </button>
            </>
          ) : (
            <>
              {/* 编辑模式指示器 + 未保存提示 */}
              <div className="flex items-center gap-2 text-blue-600">
                <Edit3 className="w-4 h-4" />
                <span className="text-sm font-medium">编辑模式</span>
                {hasUnsavedChanges && (
                  <span className="text-xs text-orange-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    未保存
                  </span>
                )}
              </div>

              {/* 保存错误提示 */}
              {saveError && (
                <span className="text-sm text-red-600">{saveError}</span>
              )}

              {/* 取消按钮 */}
              <button
                onClick={onCancelEdit}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">取消</span>
              </button>

              {/* 保存按钮 */}
              <button
                onClick={onSaveChanges}
                disabled={isSaving || !hasUnsavedChanges}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm font-medium">保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span className="text-sm font-medium">保存 (Ctrl+S)</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}