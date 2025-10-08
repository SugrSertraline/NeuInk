// app/paper/[id]/components/ChecklistNotesPanel.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { X, Save, Tag, FolderOpen } from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'easymde/dist/easymde.min.css';
import 'highlight.js/styles/github.css';
import type { ChecklistNote, PaperContent } from '../../../types/paper';

// 动态导入 Markdown 编辑器
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), {
  ssr: false,
});

interface ChecklistNotesPanelProps {
  content: PaperContent;
  checklistId: string;
  checklistName: string;
  checklistPath: string;
  onClose: () => void;
  onContentUpdate: (content: PaperContent) => Promise<boolean>;
  isSaving: boolean;
}

export default function ChecklistNotesPanel({
  content,
  checklistId,
  checklistName,
  checklistPath,
  onClose,
  onContentUpdate,
  isSaving,
}: ChecklistNotesPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // 获取当前清单的笔记
  const currentNote = useMemo(() => {
    return (content.checklistNotes || []).find(note => note.checklistId === checklistId);
  }, [content.checklistNotes, checklistId]);

  // Markdown 编辑器配置
  const editorOptions = useMemo(() => {
    return {
      spellChecker: false,
      placeholder: '在此输入清单笔记（支持 Markdown）...',
      status: false,
      toolbar: [
        'bold', 'italic', 'heading', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', 'image', 'code', 'table', '|',
        'preview', 'side-by-side', 'fullscreen',
      ] as any,
      autofocus: true,
      minHeight: '300px',
    } as any;
  }, []);

  // 开始编辑
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditContent(currentNote?.content || '');
    setEditTags(currentNote?.tags || []);
  };

  // 添加标签
  const handleAddTag = () => {
    if (newTag.trim() && !editTags.includes(newTag.trim())) {
      setEditTags([...editTags, newTag.trim()]);
      setNewTag('');
    }
  };

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  // 保存笔记
  const handleSaveNote = async () => {
    if (!editContent.trim()) {
      alert('笔记内容不能为空');
      return;
    }

    let updatedChecklistNotes: ChecklistNote[];

    if (currentNote) {
      // 更新已有笔记
      updatedChecklistNotes = (content.checklistNotes || []).map(note =>
        note.checklistId === checklistId
          ? {
              ...note,
              content: editContent,
              tags: editTags,
              updatedAt: new Date().toISOString(),
            }
          : note
      );
    } else {
      // 创建新笔记
      const newNote: ChecklistNote = {
        id: `checklist-note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        checklistId,
        checklistPath,
        content: editContent,
        tags: editTags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedChecklistNotes = [...(content.checklistNotes || []), newNote];
    }

    // 更新完整 content 并保存
    const updatedContent: PaperContent = {
      ...content,
      checklistNotes: updatedChecklistNotes,
    };

    const success = await onContentUpdate(updatedContent);
    
    if (success) {
      setIsEditing(false);
      alert('✓ 笔记保存成功！');
    } else {
      alert('❌ 保存失败，请重试');
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    if (editContent.trim() && !confirm('有未保存的更改，确定要放弃吗？')) {
      return;
    }
    setIsEditing(false);
  };

  return (
    <div className="w-96 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">清单笔记</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {checklistPath}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isEditing ? (
          <>
            {/* 查看模式 */}
            {currentNote ? (
              <div>
                {/* 标签 */}
                {currentNote.tags && currentNote.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentNote.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Markdown 渲染 */}
                <div className="prose prose-sm max-w-none mb-4 dark:prose-invert">
                  <ReactMarkdown rehypePlugins={[rehypeHighlight, rehypeRaw]}>
                    {currentNote.content}
                  </ReactMarkdown>
                </div>

                {/* 元信息 */}
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  更新于 {new Date(currentNote.updatedAt).toLocaleString('zh-CN')}
                </div>

                <button
                  onClick={handleStartEdit}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  编辑笔记
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400 mb-4">该清单下暂无笔记</p>
                <button
                  onClick={handleStartEdit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  添加笔记
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 编辑模式 */}
            <div className="space-y-4">
              {/* 标签编辑 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  标签
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editTags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-full flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-emerald-900 dark:hover:text-emerald-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="输入标签后按回车"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Markdown 编辑器 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  笔记内容
                </label>
                <SimpleMDE
                  value={editContent}
                  onChange={setEditContent}
                  options={editorOptions}
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNote}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}