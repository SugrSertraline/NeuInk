// 📁 app/paper/[id]/components/NotesPanel.tsx

'use client';

import React, { useState, useMemo } from 'react';
import { X, Save, Plus, Trash2, Tag, Edit3 } from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'easymde/dist/easymde.min.css';
import 'highlight.js/styles/github.css';
import type { BlockNote, PaperContent } from '../../../types/paper';

// 动态导入 Markdown 编辑器
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), {
  ssr: false,
});

interface NotesPanelProps {
  content: PaperContent;                                    // ✅ 接收完整 content
  activeBlockId: string;
  onClose: () => void;
  onContentUpdate: (content: PaperContent) => Promise<boolean>;  // ✅ 统一更新方法
  isSaving: boolean;
}

export default function NotesPanel({
  content,
  activeBlockId,
  onClose,
  onContentUpdate,
  isSaving,
}: NotesPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // 获取当前 block 的所有笔记
  const currentNotes = useMemo(() => {
    return (content.blockNotes || []).filter(note => note.blockId === activeBlockId);
  }, [content.blockNotes, activeBlockId]);

  // Markdown 编辑器配置
  const editorOptions = useMemo(() => {
    return {
      spellChecker: false,
      placeholder: '在此输入笔记内容（支持 Markdown）...',
      status: false,
      toolbar: [
        'bold', 'italic', 'heading', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', 'image', 'code', 'table', '|',
        'preview', 'side-by-side', 'fullscreen',
      ] as any,  // ✅ 添加 as any 绕过类型检查
      autofocus: true,
      minHeight: '200px',
    } as any;  // ✅ 或者在这里添加
  }, []);
  

  // 创建新笔记
  const handleCreateNote = () => {
    setIsEditing(true);
    setEditingNoteId(null);
    setEditContent('');
    setEditTags([]);
  };

  // 编辑已有笔记
  const handleEditNote = (note: BlockNote) => {
    setIsEditing(true);
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditTags(note.tags || []);
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

  // ✅ 保存笔记（统一走 content 更新）
  const handleSaveNote = async () => {
    if (!editContent.trim()) {
      alert('笔记内容不能为空');
      return;
    }

    let updatedBlockNotes: BlockNote[];

    if (editingNoteId) {
      // 更新已有笔记
      updatedBlockNotes = (content.blockNotes || []).map(note =>
        note.id === editingNoteId
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
      const newNote: BlockNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        blockId: activeBlockId,
        content: editContent,
        tags: editTags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedBlockNotes = [...(content.blockNotes || []), newNote];
    }

    // ✅ 更新完整 content 并保存
    const updatedContent: PaperContent = {
      ...content,
      blockNotes: updatedBlockNotes,
    };

    const success = await onContentUpdate(updatedContent);
    
    if (success) {
      setIsEditing(false);
      setEditingNoteId(null);
      alert('✓ 笔记保存成功！');
    } else {
      alert('❌ 保存失败，请重试');
    }
  };

  // ✅ 删除笔记（统一走 content 更新）
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('确定要删除这条笔记吗？')) return;

    const updatedBlockNotes = (content.blockNotes || []).filter(
      note => note.id !== noteId
    );

    const updatedContent: PaperContent = {
      ...content,
      blockNotes: updatedBlockNotes,
    };

    const success = await onContentUpdate(updatedContent);
    
    if (success) {
      alert('✓ 笔记已删除！');
    } else {
      alert('❌ 删除失败，请重试');
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    if (editContent.trim() && !confirm('有未保存的更改，确定要放弃吗？')) {
      return;
    }
    setIsEditing(false);
    setEditingNoteId(null);
  };

  return (
    <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">段落笔记</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isEditing ? (
          <>
            {/* 笔记列表 */}
            {currentNotes.length > 0 ? (
              <div className="space-y-4">
                {currentNotes.map(note => (
                  <div
                    key={note.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition"
                  >
                    {/* 标签 */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {note.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Markdown 渲染 */}
                    <div className="prose prose-sm max-w-none mb-3">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight, rehypeRaw]}>
                        {note.content}
                      </ReactMarkdown>
                    </div>

                    {/* 元信息 */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        更新于 {new Date(note.updatedAt).toLocaleString('zh-CN')}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditNote(note)}
                          disabled={isSaving}
                          className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={isSaving}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <p className="mb-2">暂无笔记</p>
                <p className="text-sm">点击下方按钮添加第一条笔记</p>
              </div>
            )}

            {/* 添加笔记按钮 */}
            <button
              onClick={handleCreateNote}
              disabled={isSaving}
              className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              添加笔记
            </button>
          </>
        ) : (
          <>
            {/* 编辑器 */}
            <div className="space-y-4">
              {/* 标签编辑 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  标签
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editTags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-blue-900"
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Markdown 编辑器 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
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
