'use client';

import React from 'react';
import { Edit3, Trash2, Plus, ChevronRight, FolderOpen, FileText, Grid, List, MoreVertical, TrendingUp, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChecklistStore } from '@/app/store/useChecklistStore';
import { useTabStore } from '@/app/store/useTabStore';
import { createChecklist, updateChecklist, deleteChecklist } from '@/app/lib/checklistApi';
import type { ChecklistNode } from '@/app/types/checklist';
import ChecklistDialog, { ChecklistDialogPayload } from './components/ChecklistDialog';
import type { DeleteChecklistResponse } from '@/app/lib/checklistApi';

export default function ChecklistsPage() {
  const router = useRouter();
  const { checklists, loadChecklists } = useChecklistStore();
  const { addTab, setActiveTab, tabs, activeTabId } = useTabStore();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ChecklistNode | null>(null);
  const [parentId, setParentId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'grid' | 'compact'>('grid');

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
      ? (node.paperCount || 0) + (node.children?.reduce((sum, child) => sum + (child.paperCount || 0), 0) || 0)
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

  const handleViewChild = (child: ChecklistNode) => {
    const tabId = `checklist-${child.id}`;
    const existingTab = tabs.find(t => t.id === tabId);
    
    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        type: 'checklist',
        title: child.name,
        path: `/checklist/${child.id}`
      });
      setActiveTab(tabId);
    }
    
    router.push(`/checklist/${child.id}`);
  };

  const totalSubCategories = checklists.reduce((sum, c) => sum + (c.children?.length || 0), 0);
  const totalPapers = checklists.reduce((sum, c) => {
    const childrenPapers = c.children?.reduce((s, child) => s + (child.paperCount || 0), 0) || 0;
    return sum + (c.paperCount || 0) + childrenPapers;
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4" />
          <p className="text-slate-600 dark:text-slate-400">加载清单中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* 精简的页头 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">清单管理</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">组织和管理你的论文清单</p>
              </div>
              {checklists.length > 0 && (
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-blue-900 dark:text-blue-300">{checklists.length}</span>
                    <span className="text-blue-600 dark:text-blue-400">分类</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300">{totalSubCategories}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">子类</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-purple-900 dark:text-purple-300">{totalPapers}</span>
                    <span className="text-purple-600 dark:text-purple-400">篇论文</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="卡片视图"
                >
                  <Grid className="w-3.5 h-3.5 inline mr-1" />
                  卡片
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === 'compact' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="紧凑视图"
                >
                  <List className="w-3.5 h-3.5 inline mr-1" />
                  紧凑
                </button>
              </div>
              <button
                onClick={onCreateTop}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">新建分类</span>
              </button>
            </div>
          </div>
        </div>

        {/* 清单列表 */}
        {checklists.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {checklists.map((node) => (
                <EnhancedCard
                  key={node.id}
                  node={node}
                  onEdit={() => onEdit(node)}
                  onDelete={() => onDelete(node)}
                  onCreateChild={() => onCreateChild(node)}
                  onEditChild={onEdit}
                  onDeleteChild={onDelete}
                  onViewChild={(child) => handleViewChild(child)}
                  isDeleting={deleting === node.id}
                  deletingChildId={deleting}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
              {checklists.map((node) => (
                <CompactCard
                  key={node.id}
                  node={node}
                  onEdit={() => onEdit(node)}
                  onDelete={() => onDelete(node)}
                  onCreateChild={() => onCreateChild(node)}
                  onEditChild={onEdit}
                  onDeleteChild={onDelete}
                  onViewChild={(child) => handleViewChild(child)}
                  isDeleting={deleting === node.id}
                  deletingChildId={deleting}
                />
              ))}
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-2 border-dashed border-slate-300 dark:border-slate-700 p-16 text-center">
            <FolderOpen className="w-20 h-20 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              还没有任何清单
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              点击右上角"新建分类"按钮开始组织你的论文
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

// 增强的卡片组件 - 展示更多信息
function EnhancedCard({
  node,
  onEdit,
  onDelete,
  onCreateChild,
  onEditChild,
  onDeleteChild,
  onViewChild,
  isDeleting,
  deletingChildId,
}: {
  node: ChecklistNode;
  onEdit: () => void;
  onDelete: () => void;
  onCreateChild: () => void;
  onEditChild: (n: ChecklistNode) => void;
  onDeleteChild: (n: ChecklistNode) => void;
  onViewChild: (n: ChecklistNode) => void;
  isDeleting: boolean;
  deletingChildId: string | null;
}) {
  const [showMenu, setShowMenu] = React.useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const totalPapers = hasChildren
    ? (node.paperCount || 0) + (node.children?.reduce((sum, child) => sum + (child.paperCount || 0), 0) || 0)
    : (node.paperCount || 0);
  const directPapers = node.paperCount || 0;
  const childrenPapers = hasChildren 
    ? node.children?.reduce((sum, child) => sum + (child.paperCount || 0), 0) || 0
    : 0;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all ${
      isDeleting ? 'opacity-50 pointer-events-none' : 'hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700'
    }`}>
      {/* 卡片头部 */}
      <div className="p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mb-1">
                {node.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3 h-3" />
                <span>一级分类</span>
              </div>
            </div>
          </div>
          
          <div className="relative">
            {isDeleting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent" />
            ) : (
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-slate-400" />
              </button>
            )}
            
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-10 min-w-[120px]">
                <button
                  onClick={() => { onEdit(); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-700">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{totalPapers}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">总论文</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-700">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{node.children?.length || 0}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">子类</div>
          </div>
        </div>
      </div>

      {/* 子分类列表 */}
      <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
        {hasChildren ? (
          <div className="max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-3 gap-2">
              {node.children!.map((child) => {
                const isChildDeleting = deletingChildId === child.id;
                return (
                  <div
                    key={child.id}
                    className={`group flex flex-col items-center gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 transition-all relative cursor-pointer ${
                      isChildDeleting
                        ? 'opacity-50'
                        : 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-sm'
                    }`}
                    onClick={() => onViewChild(child)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    
                    <div className="w-full text-center">
                      <div className="text-xs font-medium text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                        {child.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {child.paperCount || 0} 篇
                      </div>
                    </div>

                    {/* 编辑和删除按钮 */}
                    {!isChildDeleting && (
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded shadow-sm p-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditChild(child);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="编辑"
                        >
                          <Edit3 className="w-3 h-3 text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChild(child);
                          }}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    )}
                    
                    {isChildDeleting && (
                      <div className="absolute top-2 right-2 animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">
            暂无子分类
          </div>
        )}

        <button
          onClick={onCreateChild}
          disabled={isDeleting}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600">添加子分类</span>
        </button>
      </div>
    </div>
  );
}

// 紧凑卡片组件
function CompactCard({
  node,
  onEdit,
  onDelete,
  onCreateChild,
  onEditChild,
  onDeleteChild,
  onViewChild,
  isDeleting,
  deletingChildId,
}: {
  node: ChecklistNode;
  onEdit: () => void;
  onDelete: () => void;
  onCreateChild: () => void;
  onEditChild: (n: ChecklistNode) => void;
  onDeleteChild: (n: ChecklistNode) => void;
  onViewChild: (n: ChecklistNode) => void;
  isDeleting: boolean;
  deletingChildId: string | null;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const totalPapers = hasChildren
    ? (node.paperCount || 0) + (node.children?.reduce((sum, child) => sum + (child.paperCount || 0), 0) || 0)
    : (node.paperCount || 0);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all ${
      isDeleting ? 'opacity-50 pointer-events-none' : 'hover:shadow-md hover:border-blue-300'
    }`}>
      {/* 头部 */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
          <FolderOpen className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {node.name}
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {node.children?.length || 0} 子类
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {totalPapers} 论文
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isDeleting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent" />
          ) : (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 子分类网格 */}
      {hasChildren && (
        <div className="p-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
          <div className="max-h-[150px] overflow-y-auto">
            <div className="grid grid-cols-3 gap-1.5">
              {node.children!.map((child) => {
                const isChildDeleting = deletingChildId === child.id;
                return (
                  <div
                    key={child.id}
                    className={`group flex flex-col items-center gap-1 p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 transition-all relative cursor-pointer ${
                      isChildDeleting
                        ? 'opacity-50'
                        : 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-sm'
                    }`}
                    onClick={() => onViewChild(child)}
                  >
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3 h-3 text-white" />
                    </div>
                    <div className="w-full text-center">
                      <div className="text-xs font-medium text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                        {child.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {child.paperCount || 0}
                      </div>
                    </div>

                    {/* 编辑和删除按钮 */}
                    {!isChildDeleting && (
                      <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded shadow-sm p-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditChild(child);
                          }}
                          className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="编辑"
                        >
                          <Edit3 className="w-2.5 h-2.5 text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChild(child);
                          }}
                          className="p-0.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    )}
                    
                    {isChildDeleting && (
                      <div className="absolute top-1 right-1 animate-spin rounded-full h-2.5 w-2.5 border-2 border-slate-400 border-t-transparent" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <button
            onClick={onCreateChild}
            disabled={isDeleting}
            className="w-full mt-1.5 flex items-center justify-center gap-1 py-1.5 border border-dashed border-slate-300 dark:border-slate-700 rounded hover:border-blue-400 hover:bg-blue-50/50 transition-all text-xs text-slate-500 hover:text-blue-600"
          >
            <Plus className="w-3 h-3" />
            添加
          </button>
        </div>
      )}
    </div>
  );
}