// library/page.tsx

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { apiGetData } from '../lib/api';
import type { PaperMetadata, PaperRecord } from '@neuink/shared';
import { useTabStore } from '../store/useTabStore';
import { TABLE_COLUMNS } from './utils/paperHelpers';
import { paperRecordToMetadata, paperRecordsToMetadata} from '@/app/lib/paperConverters';

// 组件导入
import LibraryHeader from './components/LibraryHeader';
import LibraryFilters from './components/LibraryFilters';
import PaperCard from './components/PaperCard';
import PaperListItem from './components/PaperListItem';
import PaperTable from './components/PaperTable';
import ContextMenu from './components/ContextMenu';
import EmptyState from './components/EmptyState';
import PaperDialog from './components/PaperDialog';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type ViewMode = 'card' | 'table' | 'compact';

export default function LibraryPage() {
  const router = useRouter();
  const { addTab, setActiveTab, tabs, setLoading: setGlobalLoading } = useTabStore();

  // 数据加载状态
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [papers, setPapers] = React.useState<PaperMetadata[]>([]);

  // 视图和UI状态
  const [viewMode, setViewMode] = React.useState<ViewMode>('card');
  const [showAdvancedFilter, setShowAdvancedFilter] = React.useState(false);
  const [showColumnConfig, setShowColumnConfig] = React.useState(false);
  const [showPaperDialog, setShowPaperDialog] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit'>('create');
  const [selectedPaper, setSelectedPaper] = React.useState<PaperMetadata | null>(null);

  // 筛选状态
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [filterPriority, setFilterPriority] = React.useState<string>('all');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [filterQuartile, setFilterQuartile] = React.useState<string>('all');
  const [filterRating, setFilterRating] = React.useState<string>('all');
  const [filterYear, setFilterYear] = React.useState<string>('all');

  // 表格列配置
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(
    new Set(TABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.key))
  );

  // 右键菜单状态
  const [contextMenu, setContextMenu] = React.useState<{
    show: boolean;
    x: number;
    y: number;
    paper: PaperMetadata | null;
  }>({ show: false, x: 0, y: 0, paper: null });

  // 初始加载论文列表
  React.useEffect(() => {
    loadPapers();
  }, []);

  // 关闭右键菜单
  React.useEffect(() => {
    const handleClick = () => setContextMenu({ show: false, x: 0, y: 0, paper: null });
    if (contextMenu.show) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.show]);

  // 加载论文列表
  const loadPapers = async () => {
    try {
      const recordList = await apiGetData<PaperRecord[]>('/api/papers');
      // 转换为前端格式
      const metadataList = paperRecordsToMetadata(recordList);
      setPapers(metadataList);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // 获取所有年份用于筛选
  const availableYears = React.useMemo(() => {
    const years = new Set(papers.map(p => p.year).filter(Boolean));
    return Array.from(years).sort((a, b) => (b || 0) - (a || 0));
  }, [papers]);

  // 过滤逻辑
  const filteredPapers = React.useMemo(() => {
    return papers.filter(paper => {
      const matchSearch = searchTerm === '' ||
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.authors.some(a => a.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (paper.publication?.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = filterStatus === 'all' || paper.readingStatus === filterStatus;
      const matchPriority = filterPriority === 'all' || paper.priority === filterPriority;
      const matchType = filterType === 'all' || paper.articleType === filterType;
      const matchYear = filterYear === 'all' || String(paper.year) === filterYear;

      const matchQuartile = filterQuartile === 'all' ||
        paper.sciQuartile === filterQuartile ||
        paper.casQuartile === filterQuartile ||
        paper.ccfRank === filterQuartile;

      const matchRating = filterRating === 'all' ||
        (filterRating === '4+' && (paper.rating || 0) >= 4) ||
        (filterRating === '3+' && (paper.rating || 0) >= 3) ||
        (filterRating === '<3' && (paper.rating || 0) < 3);

      return matchSearch && matchStatus && matchPriority && matchType && matchQuartile && matchRating && matchYear;
    });
  }, [papers, searchTerm, filterStatus, filterPriority, filterType, filterQuartile, filterRating, filterYear]);

  // 打开论文详情
  const openPaper = async (paper: PaperMetadata) => {
    const id = `paper:${paper.id}`;
    const path = `/paper/${paper.id}`;
    setGlobalLoading(true, id);

    try {
      if (!tabs.find((t) => t.id === id)) {
        addTab({ id, type: 'paper', title: paper.title, path, data: { paperId: paper.id } });
      }
      setActiveTab(id);
      await router.push(path);
    } catch (error) {
      console.error('Navigation error:', error);
      setGlobalLoading(false, null);
    }
  };

  // 右键菜单事件处理
  const handleContextMenu = (e: React.MouseEvent, paper: PaperMetadata) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      paper
    });
  };

  const handleViewDetails = () => {
    if (contextMenu.paper) openPaper(contextMenu.paper);
  };

  const handleEdit = () => {
    if (contextMenu.paper) {
      setDialogMode('edit');
      setSelectedPaper(contextMenu.paper);
      setShowPaperDialog(true);
    }
  };

  // 成功回调
  const handlePaperDialogSuccess = async (paperId?: string) => {
    await loadPapers();
    
    // 如果是创建模式且有返回 ID，打开新创建的论文
    if (dialogMode === 'create' && paperId) {
      const newPaper = papers.find(p => p.id === paperId);
      if (newPaper) {
        openPaper(newPaper);
      }
    }
  };

  const handleDelete = async () => {
    if (contextMenu.paper) {
      if (confirm(`确定要删除论文「${contextMenu.paper.title}」吗？`)) {
        try {
          const response = await fetch(`${API_BASE}/api/papers/${contextMenu.paper.id}`, { 
            method: 'DELETE' 
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '删除失败');
          }
          
          await loadPapers(); // 重新加载列表
        } catch (error: any) {
          console.error('删除失败:', error);
          alert(`删除失败: ${error.message}`);
        }
      }
    }
  };

  // 创建论文
  const handleCreatePaper = () => {
    setDialogMode('create');
    setSelectedPaper(null);
    setShowPaperDialog(true);
  };

  // 列配置
  const toggleColumn = (key: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(key)) {
      newVisible.delete(key);
    } else {
      newVisible.add(key);
    }
    setVisibleColumns(newVisible);
  };

  // 重置所有筛选
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterType('all');
    setFilterQuartile('all');
    setFilterRating('all');
    setFilterYear('all');
  };

  // 重置高级筛选
  const resetAdvancedFilters = () => {
    setFilterQuartile('all');
    setFilterRating('all');
    setFilterYear('all');
  };

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>;
  if (error) return <div className="p-6 text-red-600 text-sm">加载失败：{error}</div>;

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <LibraryHeader
        totalCount={filteredPapers.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onCreatePaper={handleCreatePaper}
        showColumnConfig={showColumnConfig}
        onToggleColumnConfig={() => setShowColumnConfig(!showColumnConfig)}
      />

      {/* 筛选栏 */}
      <LibraryFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        filterPriority={filterPriority}
        onPriorityChange={setFilterPriority}
        filterType={filterType}
        onTypeChange={setFilterType}
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        filterQuartile={filterQuartile}
        onQuartileChange={setFilterQuartile}
        filterRating={filterRating}
        onRatingChange={setFilterRating}
        filterYear={filterYear}
        onYearChange={setFilterYear}
        availableYears={availableYears}
        onResetAdvancedFilters={resetAdvancedFilters}
        showColumnConfig={showColumnConfig && viewMode === 'table'}
        onToggleColumnConfig={() => setShowColumnConfig(false)}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
      />

      {/* 内容区域 */}
      {filteredPapers.length === 0 ? (
        <EmptyState onClearFilters={clearAllFilters} />
      ) : (
        <>
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onClick={() => openPaper(paper)}
                  onContextMenu={(e) => handleContextMenu(e, paper)}
                />
              ))}
            </div>
          )}

          {viewMode === 'compact' && (
            <div className="space-y-2">
              {filteredPapers.map((paper) => (
                <PaperListItem
                  key={paper.id}
                  paper={paper}
                  onClick={() => openPaper(paper)}
                  onContextMenu={(e) => handleContextMenu(e, paper)}
                />
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <PaperTable
              papers={filteredPapers}
              visibleColumns={visibleColumns}
              onPaperClick={openPaper}
              onContextMenu={handleContextMenu}
            />
          )}
        </>
      )}

      {/* 右键菜单 */}
      <ContextMenu
        show={contextMenu.show}
        x={contextMenu.x}
        y={contextMenu.y}
        paper={contextMenu.paper}
        onViewDetails={handleViewDetails}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <PaperDialog
        open={showPaperDialog}
        mode={dialogMode}
        paper={selectedPaper}
        onClose={() => {
          setShowPaperDialog(false);
          setSelectedPaper(null);
        }}
        onSuccess={handlePaperDialogSuccess}
      />
    </div>
  );
}