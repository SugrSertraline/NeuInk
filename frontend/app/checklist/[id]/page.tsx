// app/checklist/[id]/page.tsx
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronRight, 
  Search, 
  Plus, 
  FileText, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Save,
  X,
  StickyNote,
  Trash2
} from 'lucide-react';
import { fetchChecklistNode, fetchChecklistPapers } from '@/app/lib/checklistApi';
import { fetchPaperContent, savePaperContent } from '@/app/lib/paperApi';
import type { ChecklistNode } from '@neuink/shared';
import type { PaperMetadata, ChecklistNote } from '@neuink/shared';
import { PaperContent } from '@/app/types/paper';

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

// 笔记组件
interface PaperNotesProps {
  paperId: string;
  checklistId: string;
  checklistPath: string;
  onClose: () => void;
}

function PaperNotes({ paperId, checklistId, checklistPath, onClose }: PaperNotesProps) {
  const [loading, setLoading] = React.useState(true);
  const [paperContent, setPaperContent] = React.useState<PaperContent | null>(null);
  const [notes, setNotes] = React.useState<ChecklistNote[]>([]);
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState('');
  const [isAddingNew, setIsAddingNew] = React.useState(false);
  const [newNoteContent, setNewNoteContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // 加载论文内容和笔记
  React.useEffect(() => {
    loadPaperNotes();
  }, [paperId, checklistId]);

  const loadPaperNotes = async () => {
    setLoading(true);
    try {
      const content = await fetchPaperContent(paperId);
      setPaperContent(content);
      
      // 筛选出当前清单的笔记
      const checklistNotes = (content.checklistNotes || []).filter(
        (        note: { checklistId: string; }) => note.checklistId === checklistId
      );
      setNotes(checklistNotes);
    } catch (error) {
      console.error('加载笔记失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存笔记
  const handleSaveNote = async (noteId: string, content: string) => {
    if (!paperContent) return;
    setSaving(true);
    
    try {
      // 更新笔记内容
      const updatedNotes = notes.map(note => 
        note.id === noteId 
          ? { ...note, content, updatedAt: new Date().toISOString() }
          : note
      );
      
      // 更新完整笔记列表（包括其他清单的笔记）
      const allNotes = [
        ...(paperContent.checklistNotes || []).filter(n => n.checklistId !== checklistId),
        ...updatedNotes
      ];
      
      // 保存到后端
      await savePaperContent(paperId, {
        ...paperContent,
        checklistNotes: allNotes
      });
      
      setNotes(updatedNotes);
      setEditingNoteId(null);
      setEditingContent('');
    } catch (error) {
      console.error('保存笔记失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 添加新笔记
  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !paperContent) return;
    setSaving(true);
    
    try {
      const newNote: ChecklistNote = {
        id: `note-${Date.now()}`,
        checklistId,
        checklistPath,
        content: newNoteContent,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const updatedNotes = [...notes, newNote];
      const allNotes = [
        ...(paperContent.checklistNotes || []).filter(n => n.checklistId !== checklistId),
        ...updatedNotes
      ];
      
      await savePaperContent(paperId, {
        ...paperContent,
        checklistNotes: allNotes
      });
      
      setNotes(updatedNotes);
      setNewNoteContent('');
      setIsAddingNew(false);
    } catch (error) {
      console.error('添加笔记失败:', error);
      alert('添加失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 删除笔记
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('确定要删除这条笔记吗？')) return;
    if (!paperContent) return;
    setSaving(true);
    
    try {
      const updatedNotes = notes.filter(note => note.id !== noteId);
      const allNotes = [
        ...(paperContent.checklistNotes || []).filter(
          n => n.checklistId !== checklistId || n.id !== noteId
        )
      ];
      
      await savePaperContent(paperId, {
        ...paperContent,
        checklistNotes: allNotes
      });
      
      setNotes(updatedNotes);
    } catch (error) {
      console.error('删除笔记失败:', error);
      alert('删除失败，请重试');
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
    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-t border-slate-200 dark:border-slate-700 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-emerald-600" />
          清单笔记 ({notes.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* 笔记列表 */}
      {notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map(note => (
            <div
              key={note.id}
              className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              {editingNoteId === note.id ? (
                // 编辑模式
                <div className="space-y-3">
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="w-full min-h-[120px] p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
                    placeholder="输入笔记内容..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveNote(note.id, editingContent)}
                      disabled={saving || !editingContent.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm rounded-lg transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setEditingNoteId(null);
                        setEditingContent('');
                      }}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 查看模式
                <>
                  <div className="prose prose-sm dark:prose-invert max-w-none mb-3">
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <span>
                      更新于 {new Date(note.updatedAt).toLocaleString('zh-CN')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingContent(note.content);
                        }}
                        className="flex items-center gap-1 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="flex items-center gap-1 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <StickyNote className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p>该论文在此清单下还没有笔记</p>
        </div>
      )}

      {/* 添加新笔记 */}
      {isAddingNew ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border-2 border-emerald-500 dark:border-emerald-600 shadow-sm">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            className="w-full min-h-[120px] p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-y mb-3"
            placeholder="输入新笔记内容..."
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNote}
              disabled={saving || !newNoteContent.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              添加笔记
            </button>
            <button
              onClick={() => {
                setIsAddingNew(false);
                setNewNoteContent('');
              }}
              disabled={saving}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingNew(true)}
          className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          添加新笔记
        </button>
      )}
    </div>
  );
}

// 主页面组件
export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [checklist, setChecklist] = React.useState<ChecklistNode | null>(null);
  const [papers, setPapers] = React.useState<PaperMetadata[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [expandedPaperId, setExpandedPaperId] = React.useState<string | null>(null);

  // 查询参数
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sort, setSort] = React.useState('year:desc');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nodeData, papersData] = await Promise.all([
        fetchChecklistNode(id),
        fetchChecklistPapers(id, { q, page, pageSize, sort })
      ]);

      setChecklist(nodeData);
      
      // ✅ 转换 PaperRecord 到 PaperMetadata
      const convertedPapers = papersData.items.map(item => ({
        ...item,
        authors: parseAuthors(item.authors),
        tags: item.tags && typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags
      })) as PaperMetadata[];
      
      setPapers(convertedPapers);
      setTotal(papersData.total);
    } catch (error) {
      console.error('加载清单数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [id, q, page, pageSize, sort]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const toggleNotes = (paperId: string) => {
    setExpandedPaperId(expandedPaperId === paperId ? null : paperId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 面包屑 */}
        <nav className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Link href="/checklists" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            清单管理
          </Link>
          <ChevronRight className="w-4 h-4" />
          {checklist?.parentId && (
            <>
              <span className="text-slate-400">
                {checklist.fullPath?.split('/')[0] || '分类'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
          <span className="text-slate-900 dark:text-white font-medium">
            {checklist?.name || '加载中...'}
          </span>
        </nav>

        {/* 标题栏 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                {checklist?.name || '加载中...'}
              </h1>
              {checklist?.fullPath && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  路径: {checklist.fullPath}
                </p>
              )}
              {total > 0 && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="text-slate-600 dark:text-slate-400">
                      共 <span className="font-semibold text-emerald-600">{total}</span> 篇论文
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105">
              <Plus className="w-5 h-5" />
              <span className="font-medium">添加论文</span>
            </button>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[280px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索论文标题、作者或关键词..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none min-w-[140px]"
            >
              <option value="year:desc">年份 ↓</option>
              <option value="year:asc">年份 ↑</option>
              <option value="title:asc">标题 A-Z</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors font-medium"
            >
              查询
            </button>
          </div>
        </div>

        {/* 论文列表 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden border border-slate-200 dark:border-slate-700">
          {loading ? (
            <div className="p-16 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4" />
              <p className="text-slate-500 dark:text-slate-400">加载中...</p>
            </div>
          ) : papers.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {papers.map((paper, index) => (
                <div key={paper.id} className="transition-all">
                  <div className="p-6 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                            {(page - 1) * pageSize + index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/paper/${paper.id}`}
                              className="block text-lg font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-2 mb-2"
                            >
                              {paper.title}
                            </Link>
                            {paper.authors && paper.authors.length > 0 && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                👤 {paper.authors.map(a => a.name).join(', ')}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                              {paper.year && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>{paper.year}</span>
                                </div>
                              )}
                              {paper.publication && (
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium truncate max-w-xs">
                                  {paper.publication}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleNotes(paper.id)}
                          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            expandedPaperId === paper.id
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500'
                              : 'border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <StickyNote className="w-4 h-4" />
                          <span>笔记</span>
                          {expandedPaperId === paper.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <Link
                          href={`/paper/${paper.id}`}
                          className="flex-shrink-0 px-4 py-2 text-sm font-medium border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all"
                        >
                          查看详情
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  {/* 笔记展开区域 */}
                  {expandedPaperId === paper.id && checklist && (
                    <PaperNotes
                      paperId={paper.id}
                      checklistId={id}
                      checklistPath={checklist.fullPath}
                      onClose={() => setExpandedPaperId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center">
              <FileText className="w-20 h-20 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-lg text-slate-500 dark:text-slate-400 mb-2">该清单下还没有论文</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">点击右上角"添加论文"按钮开始添加</p>
            </div>
          )}
        </div>

        {/* 分页 */}
        {total > pageSize && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              显示 <span className="font-semibold text-slate-900 dark:text-white">{Math.min((page - 1) * pageSize + 1, total)}</span> - <span className="font-semibold text-slate-900 dark:text-white">{Math.min(page * pageSize, total)}</span> / 共 <span className="font-semibold text-slate-900 dark:text-white">{total}</span> 篇
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                上一页
              </button>
              <span className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                第 <span className="text-slate-900 dark:text-white">{page}</span> 页
              </span>
              <button
                disabled={page * pageSize >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}