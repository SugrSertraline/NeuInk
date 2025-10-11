'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  FileText,
  Calendar,
  Edit3,
  Save,
  X,
  StickyNote,
  Trash2,
  AlertCircle,
  RefreshCw,
  Tag,
  MessageSquare,
  Eye,
  ExternalLink,
  Clock
} from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'easymde/dist/easymde.min.css';
import 'highlight.js/styles/github.css';
import { fetchChecklistNode, fetchChecklistPapers } from '@/app/lib/checklistApi';
import { fetchPaperContent, savePaperContent } from '@/app/lib/paperApi';
import type { ChecklistNode } from '@neuink/shared';
import type { PaperMetadata, ChecklistNote } from '@neuink/shared';
import { PaperContent } from '@/app/types/paper';
import { useTabStore } from '@/app/store/useTabStore';

// 动态导入 Markdown 编辑器
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), {
  ssr: false,
});

// ✅ 辅助函数：解析 authors 字符串
function parseAuthors(authors: any): { name: string }[] {
  if (!authors) return [];
  if (Array.isArray(authors)) return authors;
  if (typeof authors === 'string') {
    try {
      const parsed = JSON.parse(authors);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// 🆕 精简笔记摘要组件
interface PaperNotesSummaryProps {
  paperId: string;
  checklistId: string;
  checklistPath: string;
  onExpand: () => void;
}

function PaperNotesSummary({ paperId, checklistId, checklistPath, onExpand }: PaperNotesSummaryProps) {
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState<ChecklistNote[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadPaperNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, checklistId]);

  const loadPaperNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await fetchPaperContent(paperId);
      const checklistNotes = (content.checklistNotes || []).filter(
        (note: { checklistId: string }) => note.checklistId === checklistId
      );
      setNotes(checklistNotes);
    } catch (err) {
      console.error('加载笔记失败:', err);
      setError('加载笔记失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <div className="animate-spin rounded-full h-3 w-3 border border-emerald-600 border-t-transparent" />
        <span>加载笔记中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        <span>加载失败</span>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <button
        onClick={onExpand}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 transition-colors"
      >
        <StickyNote className="w-3 h-3" />
        <span>添加笔记</span>
      </button>
    );
  }

  const latestNote = notes[0];
  const contentPreview = latestNote.content.replace(/[#*`\[\]]/g, '').substring(0, 60);

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onExpand}
        className="flex items-center gap-2 text-left flex-1 min-w-0 group"
      >
        <div className="flex items-center gap-1 flex-shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-600">{notes.length}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate group-hover:text-slate-800 dark:group-hover:text-slate-200">
            {contentPreview}{latestNote.content.length > 60 ? '...' : ''}
          </p>
        </div>
        <Eye className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
      </button>
    </div>
  );
}

// 🆕 完整笔记组件（展开模式）
interface PaperNotesFullProps {
  paperId: string;
  checklistId: string;
  checklistPath: string;
  onClose: () => void;
  onNotesUpdated?: () => void;
}

function PaperNotesFull({ paperId, checklistId, checklistPath, onClose, onNotesUpdated }: PaperNotesFullProps) {
  const [loading, setLoading] = React.useState(true);
  const [paperContent, setPaperContent] = React.useState<PaperContent | null>(null);
  const [notes, setNotes] = React.useState<ChecklistNote[]>([]);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [editTags, setEditTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // ✅ 核心修复：使用 ref 存储编辑器实例和初始值
  const mdeInstanceRef = React.useRef<any>(null);
  const initialContentRef = React.useRef<string>('');
  const [editorKey, setEditorKey] = React.useState(0);

  // 标签输入相关
  const tagInputRef = React.useRef<HTMLInputElement>(null);
  const isComposingRef = React.useRef(false);
  const enterPressedDuringCompositionRef = React.useRef(false);

  // 检查路径是否过期
  const hasOutdatedPaths = React.useMemo(() => {
    return notes.some(note => note.checklistPath !== checklistPath);
  }, [notes, checklistPath]);

  // Markdown 编辑器配置
  const editorOptions = React.useMemo(() => {
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
      autofocus: false,
      autoDownloadFontAwesome: true,
      renderingConfig: {
        singleLineBreaks: false,
        codeSyntaxHighlighting: true,
      }
    } as any;
  }, []);

  // 加载论文内容和笔记
  React.useEffect(() => {
    loadPaperNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, checklistId]);

  const loadPaperNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await fetchPaperContent(paperId);
      setPaperContent(content);
      const checklistNotes = (content.checklistNotes || []).filter(
        (note: { checklistId: string }) => note.checklistId === checklistId
      );
      setNotes(checklistNotes);
    } catch (err) {
      console.error('加载笔记失败:', err);
      setError('加载笔记失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 保存笔记（合并逻辑）
  const saveNotesToBackend = async (updatedNotes: ChecklistNote[]) => {
    if (!paperContent) return;
    const allNotes = [
      ...(paperContent.checklistNotes || []).filter(n => n.checklistId !== checklistId),
      ...updatedNotes
    ];
    await savePaperContent(paperId, {
      ...paperContent,
      checklistNotes: allNotes
    });
    setPaperContent({
      ...paperContent,
      checklistNotes: allNotes
    });
    onNotesUpdated?.();
  };

  // 开始编辑笔记
  const handleEditNote = (note: ChecklistNote) => {
    setIsEditing(true);
    setEditingNoteId(note.id);
    setEditTags(note.tags || []);
    initialContentRef.current = note.content;
    setEditorKey(prev => prev + 1);
    setTimeout(() => tagInputRef.current?.focus(), 100);
  };

  // 开始添加新笔记
  const handleAddNote = () => {
    setIsEditing(true);
    setEditingNoteId(null);
    setEditTags([]);
    initialContentRef.current = '';
    setEditorKey(prev => prev + 1);
    setTimeout(() => tagInputRef.current?.focus(), 100);
  };

  // 进入编辑模式时的焦点处理
  React.useEffect(() => {
    if (isEditing) {
      setTimeout(() => tagInputRef.current?.focus(), 100);
    }
  }, [isEditing]);

  // 添加标签
  const handleAddTag = () => {
    if (newTag.trim() && !editTags.includes(newTag.trim())) {
      setEditTags([...editTags, newTag.trim()]);
      setNewTag('');
      setTimeout(() => tagInputRef.current?.focus(), 0);
    }
  };

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  // ✅ 核心修复：保存笔记时从编辑器实例读取内容
  const handleSaveNote = async () => {
    if (!paperContent) return;

    // 从编辑器实例获取最新内容
    const currentContent = mdeInstanceRef.current?.value() || '';

    if (!currentContent.trim()) {
      alert('笔记内容不能为空');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let updatedNotes: ChecklistNote[];

      if (editingNoteId) {
        updatedNotes = notes.map(note =>
          note.id === editingNoteId
            ? {
                ...note,
                content: currentContent,
                tags: editTags,
                checklistPath,
                updatedAt: new Date().toISOString()
              }
            : note
        );
      } else {
        const newNote: ChecklistNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          checklistId,
          checklistPath,
          content: currentContent,
          tags: editTags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        updatedNotes = [...notes, newNote];
      }

      await saveNotesToBackend(updatedNotes);
      setNotes(updatedNotes);
      setIsEditing(false);
      setEditingNoteId(null);
      setEditTags([]);
      initialContentRef.current = '';
    } catch (err) {
      console.error('保存笔记失败:', err);
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 删除笔记
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('确定要删除这条笔记吗？')) return;
    if (!paperContent) return;

    setSaving(true);
    setError(null);

    try {
      const updatedNotes = notes.filter(note => note.id !== noteId);
      await saveNotesToBackend(updatedNotes);
      setNotes(updatedNotes);
    } catch (err) {
      console.error('删除笔记失败:', err);
      setError('删除失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    const currentContent = mdeInstanceRef.current?.value() || '';
    if (currentContent.trim() && !confirm('有未保存的更改，确定要放弃吗？')) {
      return;
    }
    setIsEditing(false);
    setEditingNoteId(null);
    setEditTags([]);
    initialContentRef.current = '';
  };

  // 同步所有笔记的路径
  const handleSyncPaths = async () => {
    if (!paperContent) return;
    setSaving(true);
    setError(null);

    try {
      const updatedNotes = notes.map(note => ({
        ...note,
        checklistPath,
        updatedAt: new Date().toISOString()
      }));

      await saveNotesToBackend(updatedNotes);
      setNotes(updatedNotes);
    } catch (err) {
      console.error('同步路径失败:', err);
      setError('同步失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent" />
          <span className="text-slate-600 dark:text-slate-400">加载笔记中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-l-4 border-emerald-500 dark:border-emerald-600 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-emerald-600" />
          清单笔记 ({notes.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* 路径过期提示 */}
      {hasOutdatedPaths && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-800 dark:text-amber-200 font-medium mb-1">
              检测到路径变化
            </p>
            <button
              onClick={handleSyncPaths}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs rounded transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${saving ? 'animate-spin' : ''}`} />
              {saving ? '同步中' : '同步路径'}
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-800 dark:text-red-200 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded"
          >
            <X className="w-3 h-3 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* 编辑模式 */}
      {isEditing ? (
        <div className="bg-white dark:bg-slate-800 rounded p-3 border-2 border-emerald-500 dark:border-emerald-600 shadow-sm space-y-3">
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
                ref={tagInputRef}
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  isComposingRef.current = false;
                  const finalValue = (e.target as HTMLInputElement).value;
                  setNewTag(finalValue);
                  
                  if (enterPressedDuringCompositionRef.current) {
                    enterPressedDuringCompositionRef.current = false;
                    setTimeout(() => {
                      if (finalValue.trim()) {
                        handleAddTag();
                      }
                    }, 0);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (isComposingRef.current) {
                      enterPressedDuringCompositionRef.current = true;
                      return;
                    }
                    
                    if (newTag.trim()) {
                      handleAddTag();
                    }
                  }
                }}
                placeholder="输入标签后按回车"
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-900 dark:text-white text-sm"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                <Tag className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ✅ 核心修复：Markdown 编辑器 - 移除 onChange 中的状态更新 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              笔记内容
            </label>
            <SimpleMDE
              key={`mde-${editorKey}`}
              value={initialContentRef.current}
              getMdeInstance={(mde) => {
                mdeInstanceRef.current = mde;
              }}
              options={{
                ...editorOptions,
                minHeight: '150px',
              }}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm rounded transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? '保存中...' : editingNoteId ? '保存' : '添加笔记'}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 笔记列表 */}
          {notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map(note => {
                const isPathOutdated = note.checklistPath !== checklistPath;

                return (
                  <div
                    key={note.id}
                    className={`bg-white dark:bg-slate-800 rounded p-3 border shadow-sm transition-all ${isPathOutdated
                      ? 'border-amber-300 dark:border-amber-700'
                      : 'border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    {/* 路径过期标记 */}
                    {isPathOutdated && (
                      <div className="mb-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>路径: {note.checklistPath}</span>
                      </div>
                    )}

                    {/* 标签 */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {note.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Markdown 渲染 */}
                    <div className="prose prose-xs dark:prose-invert max-w-none mb-2">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight, rehypeRaw]}>
                        {note.content}
                      </ReactMarkdown>
                    </div>

                    {/* 元信息和操作 */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span>
                        {new Date(note.updatedAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditNote(note)}
                          disabled={saving}
                          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                        >
                          <Edit3 className="w-3 h-3" />
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">
              <StickyNote className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">该论文在此清单下还没有笔记</p>
            </div>
          )}

          {/* 添加新笔记按钮 */}
          <button
            onClick={handleAddNote}
            disabled={saving}
            className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Plus className="w-4 h-4" />
            添加新笔记
          </button>
        </>
      )}
    </div>
  );
}

// 主页面组件
export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addTab, setActiveTab, setLoading: setTabLoading } = useTabStore();
  // 先定义所有状态
  const [checklist, setChecklist] = React.useState<ChecklistNode | null>(null);
  const [papers, setPapers] = React.useState<PaperMetadata[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [expandedPaperId, setExpandedPaperId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [papersLoading, setPapersLoading] = React.useState(false);

  // 分页参数
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);


  const loadChecklistData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nodeData = await fetchChecklistNode(id);
      setChecklist(nodeData);
    } catch (err) {
      console.error('加载清单数据失败:', err);
      setError('加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadPapersData = React.useCallback(async () => {
    setPapersLoading(true);
    try {
      const papersData = await fetchChecklistPapers(id, { page, pageSize });

      // ✅ 转换 PaperRecord 到 PaperMetadata
      const convertedPapers = papersData.items.map(item => ({
        ...item,
        authors: parseAuthors(item.authors),
        tags: item.tags && typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags
      })) as PaperMetadata[];

      setPapers(convertedPapers);
      setTotal(papersData.total);
    } catch (err) {
      console.error('加载论文数据失败:', err);
    } finally {
      setPapersLoading(false);
    }
  }, [id, page, pageSize]);

  const load = React.useCallback(async () => {
    await Promise.all([
      loadChecklistData(),
      loadPapersData()
    ]);
  }, [loadChecklistData, loadPapersData]);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleNotes = (paperId: string) => {
    // 如果点击的是已经展开的论文，则关闭；否则展开新的论文
    setExpandedPaperId(expandedPaperId === paperId ? null : paperId);
  };

  // 笔记更新后的回调
  const handleNotesUpdated = () => {
    console.log('笔记已更新');
  };

// 在新标签页中打开论文详情
const handleOpenPaperInNewTab = async (paper: PaperMetadata) => {
  const paperTab = {
    id: `paper-${paper.id}`,
    type: 'paper' as const,
    title: paper.title.length > 30 ? paper.title.substring(0, 30) + '...' : paper.title,
    path: `/paper/${paper.id}`,
    data: { paper }
  };

  // 先添加tab但不激活
  addTab(paperTab, false);
  
  // 设置加载状态
  setTabLoading(true, paperTab.id);
  
  try {
    // 导航到目标URL
    await router.push(paperTab.path);
    
    // 导航完成后再激活tab
    setActiveTab(paperTab.id);
    
    // ✅ 不立即清除loading，让页面级的 useEffect 处理
  } catch (error) {
    console.error('Navigation error:', error);
    setTabLoading(false, null);
  }
};

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4" />
          <p className="text-slate-600 dark:text-slate-400">加载清单数据中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">加载失败</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => load()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="flex h-screen">
        {/* 左侧边栏 - 精简的清单信息 */}
        <div className="w-80 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          {/* 标题栏 */}
          <div className="p-4 pt-4 pb-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2 truncate">
              {checklist?.name || '加载中...'}
            </h1>
            {checklist?.fullPath && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate" title={checklist.fullPath}>
                路径: {checklist.fullPath}
              </p>
            )}
            {total > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-600 dark:text-slate-400">
                  共 <span className="font-semibold text-emerald-600">{total}</span> 篇论文
                </span>
              </div>
            )}
          </div>


          {/* 论文列表 - 紧凑模式 */}
          <div className="flex-1 overflow-y-auto p-4 pt-0">
            {papersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
                <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">加载中...</span>
              </div>
            ) : papers.length > 0 ? (
              <div className="space-y-2">
                {papers.map((paper, index) => (
                  <div
                    key={paper.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${expandedPaperId === paper.id
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                      : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    onClick={() => toggleNotes(paper.id)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-200 dark:bg-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {(page - 1) * pageSize + index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate mb-1">
                          {paper.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {paper.authors && paper.authors.length > 0 && (
                            <span className="truncate">
                              {paper.authors[0].name}{paper.authors.length > 1 ? ' 等' : ''}
                            </span>
                          )}
                          {paper.year && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{paper.year}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPaperInNewTab(paper);
                        }}
                        className="flex-shrink-0 p-2 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                        title="在新标签页中打开"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  该清单下还没有论文
                </p>
              </div>
            )}
          </div>

          {/* 分页 */}
          {total > pageSize && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <div className="text-slate-600 dark:text-slate-400">
                  {Math.min((page - 1) * pageSize + 1, total)}-{Math.min(page * pageSize, total)} / {total}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => {
                      setPage(p => p - 1);
                      setExpandedPaperId(null);
                    }}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs"
                  >
                    上一页
                  </button>
                  <span className="px-2 text-slate-600 dark:text-slate-400">
                    {page}/{Math.ceil(total / pageSize)}
                  </span>
                  <button
                    disabled={page * pageSize >= total}
                    onClick={() => {
                      setPage(p => p + 1);
                      setExpandedPaperId(null);
                    }}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧主内容区 - 笔记阅读区域 */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
          {expandedPaperId && checklist ? (
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                  <PaperNotesFull
                    paperId={expandedPaperId}
                    checklistId={id}
                    checklistPath={checklist.fullPath}
                    onClose={() => setExpandedPaperId(null)}
                    onNotesUpdated={handleNotesUpdated}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <StickyNote className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  选择论文查看笔记
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  点击左侧列表中的论文来查看和编辑笔记
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function setActiveTab(id: string) {
  throw new Error('Function not implemented.');
}

