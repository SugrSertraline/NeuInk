'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGetData } from '../../lib/api';
import type { PaperContent as PaperContentType, Section } from '../../types/paper';
import PaperHeader from './components/PaperHeader';
import PaperMetadata from './components/PaperMetadata';
import PaperContentComponent from './components/PaperContent';
import EditablePaperContent from './components/editor/EditablePaperContent';
import NotesPanel from './components/NotesPanel';
import { X, StickyNote, Edit3, Eye, Save, XCircle, AlertCircle } from 'lucide-react';

type Lang = 'en' | 'both';

export default function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  // 原有状态
  const [content, setContent] = useState<PaperContentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [showNotes, setShowNotes] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [highlightedRefs, setHighlightedRefs] = useState<string[]>([]);
  const [showHeader, setShowHeader] = useState(false);
  const [hasChineseContent, setHasChineseContent] = useState(false);

  // 🆕 编辑模式状态
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<PaperContentType | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHeaderHoveredRef = useRef(false);
  const originalContentRef = useRef<PaperContentType | null>(null);

  const HOVER_LEAVE_DELAY = 200;
  const SCROLL_AUTO_HIDE_DELAY = 200;
  const TRIGGER_AREA_HEIGHT = 'h-12';

  // 检查是否有中文内容
  const checkChineseContent = (sections: Section[]): boolean => {
    const checkBlock = (block: any): boolean => {
      if (block.content?.zh) return true;
      if (block.caption?.zh) return true;
      if (block.description?.zh) return true;
      return false;
    };

    const checkSection = (section: Section): boolean => {
      if (section.title?.zh) return true;
      if (section.content.some(checkBlock)) return true;
      if (section.subsections?.some(checkSection)) return true;
      return false;
    };

    return sections.some(checkSection);
  };

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const startHideTimer = useCallback((delay: number) => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!isHeaderHoveredRef.current) {
        setShowHeader(false);
      }
    }, delay);
  }, [clearHideTimer]);

  const handleMouseEnter = useCallback(() => {
    isHeaderHoveredRef.current = true;
    clearHideTimer();
    setShowHeader(true);
  }, [clearHideTimer]);

  const handleMouseLeave = useCallback(() => {
    isHeaderHoveredRef.current = false;
    startHideTimer(HOVER_LEAVE_DELAY);
  }, [startHideTimer, HOVER_LEAVE_DELAY]);

  // 加载论文内容
  useEffect(() => {
    const fetchPaperContent = async () => {
      try {
        setLoading(true);
        const data = await apiGetData<PaperContentType>(`/api/papers/${id}/content`);
        setContent(data);
        originalContentRef.current = JSON.parse(JSON.stringify(data)); // 深拷贝
        setHasChineseContent(checkChineseContent(data.sections));
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchPaperContent();
  }, [id]);

  // 滚动效果
  useEffect(() => {
    const handleScroll = () => {
      clearHideTimer();
      setShowHeader(true);
      startHideTimer(SCROLL_AUTO_HIDE_DELAY);
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll);
      return () => {
        contentElement.removeEventListener('scroll', handleScroll);
        clearHideTimer();
      };
    }
  }, [clearHideTimer, startHideTimer, SCROLL_AUTO_HIDE_DELAY]);

  const handleEnterEditMode = () => {
    if (!content) return;
    setEditedContent(JSON.parse(JSON.stringify(content))); // 深拷贝
    setIsEditMode(true);
    setShowNotes(false); // 关闭笔记面板
    setHasUnsavedChanges(false);
    setSaveError(null);
  };

  // 🆕 退出编辑模式（不保存）
  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('有未保存的更改，确定要放弃吗？');
      if (!confirmed) return;
    }
    setIsEditMode(false);
    setEditedContent(null);
    setHasUnsavedChanges(false);
    setSaveError(null);
  };

  // 🆕 保存更改
  const handleSaveChanges = async () => {
    if (!editedContent) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // TODO: 替换为实际的 API 调用
      const response = await fetch(`/api/papers/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedContent),
      });

      if (!response.ok) {
        throw new Error('保存失败');
      }

      const updatedContent = await response.json();
      setContent(updatedContent);
      originalContentRef.current = JSON.parse(JSON.stringify(updatedContent));
      setIsEditMode(false);
      setEditedContent(null);
      setHasUnsavedChanges(false);

      // 显示成功提示
      alert('✓ 保存成功！');
    } catch (error: any) {
      setSaveError(error.message || '保存失败');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 🆕 编辑内容变更处理
  const handleContentChange = (newContent: PaperContentType) => {
    setEditedContent(newContent);
    setHasUnsavedChanges(true);
  };

  // 🆕 键盘快捷键 (Ctrl+S 保存)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditMode && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveChanges();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, editedContent]);

  const handleBlockClick = (blockId: string) => {
    if (isEditMode) return; // 编辑模式下不打开笔记面板
    setActiveBlockId(blockId);
    setShowNotes(true);
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }

    setCurrentSearchIndex(newIndex);
    const targetBlockId = searchResults[newIndex];
    const targetElement = document.getElementById(targetBlockId);

    if (targetElement && contentRef.current) {
      const containerRect = contentRef.current.getBoundingClientRect();
      const elementRect = targetElement.getBoundingClientRect();
      const scrollTop = contentRef.current.scrollTop;
      const targetPosition = scrollTop + (elementRect.top - containerRect.top) - 100;

      contentRef.current.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Loading 状态
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">加载论文中...</p>
        </div>
      </div>
    );
  }

  // Error 状态
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <X className="w-16 h-16 mx-auto mb-2" />
            <p className="text-lg font-semibold">加载失败</p>
          </div>
          <p className="text-sm text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">未找到论文内容</p>
      </div>
    );
  }

  const showChineseWarning = lang === 'both' && !hasChineseContent;

  return (
    <div className="h-full bg-gray-50 overflow-hidden relative">
      {/* 顶部触发区域 */}
      <div
        className={`absolute top-0 left-0 right-0 ${TRIGGER_AREA_HEIGHT} z-40`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {/* Header - 在编辑模式下始终显示 */}
      <div
        className={`absolute top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${
          showHeader ? 'translate-y-0' : '-translate-y-full' }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <PaperHeader
          lang={lang}
          setLang={setLang}
          showNotes={showNotes && !isEditMode}
          setShowNotes={setShowNotes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          contentRef={contentRef}
          searchResultsCount={searchResults.length}
          currentSearchIndex={currentSearchIndex}
          onSearchNavigate={navigateSearch}
          isEditMode={isEditMode}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          saveError={saveError}
          onEnterEditMode={handleEnterEditMode}
          onCancelEdit={handleCancelEdit}
          onSaveChanges={handleSaveChanges}
        />
      </div>

      {showChineseWarning && (
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-40 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg shadow-md">
          <p className="text-sm">⚠️ 该论文未配置中文内容</p>
        </div>
      )}

<div className={`h-full ${isEditMode ? '' : 'flex overflow-hidden'}`}>
  {/* 阅读模式 */}
  {!isEditMode && (
    <>
      <div 
        ref={contentRef}
        className={`flex-1 overflow-y-auto ${showNotes ? 'border-r border-gray-200' : ''}`}
      >
        <div className="max-w-6xl mx-auto px-8 py-6">
          <PaperMetadata content={content} />
          <PaperContentComponent
            sections={content.sections}
            references={content.references}
            lang={lang}
            searchQuery={searchQuery}
            activeBlockId={activeBlockId}
            setActiveBlockId={setActiveBlockId}
            onBlockClick={handleBlockClick}
            highlightedRefs={highlightedRefs}
            setHighlightedRefs={setHighlightedRefs}
            contentRef={contentRef}
            blockNotes={content.blockNotes}
            setSearchResults={setSearchResults}
            setCurrentSearchIndex={setCurrentSearchIndex}
          />
        </div>
      </div>

      {/* 提示信息 */}
      {!showNotes && !activeBlockId && (
        <div className="absolute bottom-8 right-8 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse z-30">
          <StickyNote className="w-5 h-5" />
          <span className="text-sm">点击任意段落查看笔记</span>
        </div>
      )}

      {/* 笔记面板 */}
      {showNotes && activeBlockId && (
        <NotesPanel
          blockNotes={content.blockNotes || []}
          activeBlockId={activeBlockId}
          onClose={() => {
            setShowNotes(false);
            setActiveBlockId(null);
          }}
          paperId={id}
        />
      )}
    </>
  )}

  {/* 编辑模式 */}
  {isEditMode && editedContent && (
    <EditablePaperContent
      content={editedContent}
      onChange={handleContentChange}
      lang={lang}
    />
  )}
</div>
    </div>
  );
}
