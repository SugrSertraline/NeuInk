'use client';

import React from 'react';
import { Edit3, Trash2, Plus, ChevronRight, ChevronDown, FolderOpen, FileText, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChecklistStore } from '@/app/store/useChecklistStore';
import { createChecklist, updateChecklist, deleteChecklist } from '@/app/lib/checklistApi';
import type { ChecklistNode } from '@/app/types/checklist';
import ChecklistDialog, { ChecklistDialogPayload } from './components/ChecklistDialog';
import type { DeleteChecklistResponse } from '@/app/lib/checklistApi';  // 🆕 添加这行

export default function ChecklistsPage() {
  const router = useRouter();
  const { checklists, loadChecklists } = useChecklistStore();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ChecklistNode | null>(null);
  const [parentId, setParentId] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadChecklistsData();
  }, [loadChecklists]);

  const loadChecklistsData = async () => {
    setLoading(true);
    try {
      await loadChecklists();
    } catch (error) {
      console.error('加载清单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onCreateTop = () => {
    setParentId(null);
    setEditing(null);
    setDialogOpen(true);
  };

  const onCreateChild = (p: ChecklistNode) => {
    setParentId(p.id);
    setEditing(null);
    setDialogOpen(true);
  };

  const onEdit = (node: ChecklistNode) => {
    setEditing(node);
    setParentId(node.parentId ?? null);
    setDialogOpen(true);
  };

  const onDelete = async (node: ChecklistNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const totalPapers = hasChildren 
      ? (node.paperCount || 0) + node.children!.reduce((sum, child) => sum + (child.paperCount || 0), 0)
      : (node.paperCount || 0);
    
    let confirmMsg = `确定删除「${node.name}」吗？\n\n`;
    
    if (hasChildren) {
      confirmMsg += `• 将同时删除 ${node.children!.length} 个子分类\n`;
    }
    
    if (totalPapers > 0) {
      confirmMsg += `• 涉及 ${totalPapers} 篇论文的清单笔记将被清理\n`;
    }
    
    confirmMsg += `\n此操作不可恢复！`;

    if (!confirm(confirmMsg)) return;

    setDeleting(node.id);
    
    try {
  // 🔧 直接解构，不需要 .data
  const { deletedChecklists, affectedPapers } = await deleteChecklist(node.id);
  
  alert(
    `删除成功！\n\n` +
    `• 已删除 ${deletedChecklists} 个清单\n` +
    `• 已清理 ${affectedPapers} 篇论文的相关笔记`
  );
  
  await loadChecklists();
} catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    } finally {
      setDeleting(null);
    }
  };

  const onSubmit = async (payload: ChecklistDialogPayload) => {
    try {
      if (editing) {
        await updateChecklist(editing.id, {
          name: payload.name,
          parentId: payload.parentId ?? null,
          level: payload.level,
        });
      } else {
        await createChecklist({
          name: payload.name,
          parentId: payload.parentId ?? null,
          level: payload.level ?? 1,
        });
      }
      setDialogOpen(false);
      setEditing(null);
      setParentId(null);
      await loadChecklists();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4" />
          <p className="text-slate-600 dark:text-slate-400">加载清单中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 页头 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">清单管理</h1>
              <p className="text-slate-600 dark:text-slate-400">
                组织和管理你的论文清单，支持二级分类
              </p>
              {checklists.length > 0 && (
                <div className="flex items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
                  <span>共 {checklists.length} 个一级分类</span>
                  <span>·</span>
                  <span>
                    {checklists.reduce((sum, c) => sum + (c.children?.length || 0), 0)} 个二级分类
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onCreateTop}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">创建一级分类</span>
            </button>
          </div>
        </div>

        {/* 清单列表 */}
        {checklists.length > 0 ? (
          <div className="space-y-4">
            {checklists.map((node) => (
              <CardLevel1
                key={node.id}
                node={node}
                isExpanded={expandedIds.has(node.id)}
                isDeleting={deleting === node.id}
                onToggleExpand={() => toggleExpand(node.id)}
                onEdit={() => onEdit(node)}
                onDelete={() => onDelete(node)}
                onCreateChild={() => onCreateChild(node)}
                onEditChild={onEdit}
                onDeleteChild={onDelete}
                onViewChild={(child) => router.push(`/checklist/${child.id}`)}
                deletingChildId={deleting}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-16 border-2 border-dashed border-slate-300 dark:border-slate-700 text-center">
            <FolderOpen className="w-20 h-20 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              还没有任何清单
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              点击右上角"创建一级分类"按钮开始组织你的论文
            </p>
            <button
              onClick={onCreateTop}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">立即创建</span>
            </button>
          </div>
        )}

        {dialogOpen && (
          <ChecklistDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            defaults={{
              id: editing?.id,
              parentId: parentId ?? undefined,
              name: editing?.name ?? '',
              level: parentId ? 2 : (editing?.level ?? 1),
            }}
            onSubmit={onSubmit}
          />
        )}
      </div>
    </div>
  );
}

function CardLevel1({
  node,
  isExpanded,
  isDeleting,
  onToggleExpand,
  onEdit,
  onDelete,
  onCreateChild,
  onEditChild,
  onDeleteChild,
  onViewChild,
  deletingChildId,
}: {
  node: ChecklistNode;
  isExpanded: boolean;
  isDeleting: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateChild: () => void;
  onEditChild: (n: ChecklistNode) => void;
  onDeleteChild: (n: ChecklistNode) => void;
  onViewChild: (n: ChecklistNode) => void;
  deletingChildId: string | null;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const totalPapers = hasChildren
    ? (node.paperCount || 0) + node.children!.reduce((sum, child) => sum + (child.paperCount || 0), 0)
    : (node.paperCount || 0);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden transition-all ${
      isDeleting ? 'opacity-50 pointer-events-none' : 'hover:shadow-lg'
    }`}>
      {/* 一级分类头部 */}
      <div className="p-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-750">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={onToggleExpand}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              disabled={isDeleting}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              )}
            </button>
            <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {node.name}
              </h3>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {hasChildren && (
                  <>
                    <span>{node.children!.length} 个子分类</span>
                    <span className="text-slate-400">·</span>
                  </>
                )}
                {totalPapers > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {totalPapers} 篇论文
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDeleting && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mr-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent" />
                <span>删除中...</span>
              </div>
            )}
            <button
              onClick={onEdit}
              disabled={isDeleting}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              title="编辑"
            >
              <Edit3 className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              title="删除"
            >
              <Trash2 className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 二级分类列表 */}
      {isExpanded && (
        <div className="p-4 space-y-2 bg-slate-50 dark:bg-slate-900/50">
          {hasChildren ? (
            node.children!.map((child) => {
              const isChildDeleting = deletingChildId === child.id;
              return (
                <div
                  key={child.id}
                  className={`flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-all group ${
                    isChildDeleting 
                      ? 'opacity-50 pointer-events-none' 
                      : 'hover:border-emerald-300 dark:hover:border-emerald-700'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onViewChild(child)}
                        disabled={isChildDeleting}
                        className="text-sm font-medium text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block mb-1 disabled:cursor-not-allowed"
                      >
                        {child.name}
                      </button>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {typeof child.paperCount === 'number' && (
                          <>
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {child.paperCount} 篇论文
                            </span>
                            <span className="text-slate-400 dark:text-slate-600">·</span>
                          </>
                        )}
                        <span className="truncate">{child.fullPath}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isChildDeleting ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent" />
                        <span>删除中</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onViewChild(child)}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                        >
                          查看
                        </button>
                        <button
                          onClick={() => onEditChild(child)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </button>
                        <button
                          onClick={() => onDeleteChild(child)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
              还没有子分类
            </div>
          )}

          <button
            onClick={onCreateChild}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 p-3 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              添加子分类
            </span>
          </button>
        </div>
      )}
    </div>
  );
}