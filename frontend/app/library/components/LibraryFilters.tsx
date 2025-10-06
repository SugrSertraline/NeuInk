// library/components/LibraryFilters.tsx

'use client';

import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TABLE_COLUMNS } from '../utils/paperHelpers';

interface LibraryFiltersProps {
  // 基础筛选
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onStatusChange: (value: string) => void;
  filterPriority: string;
  onPriorityChange: (value: string) => void;
  filterType: string;
  onTypeChange: (value: string) => void;

  // 高级筛选
  showAdvancedFilter: boolean;
  onToggleAdvancedFilter: () => void;
  filterQuartile: string;
  onQuartileChange: (value: string) => void;
  filterRating: string;
  onRatingChange: (value: string) => void;
  filterYear: string;
  onYearChange: (value: string) => void;
  availableYears: (number | undefined)[];
  onResetAdvancedFilters: () => void;

  // 列配置（仅表格视图）
  showColumnConfig?: boolean;
  onToggleColumnConfig?: () => void;
  visibleColumns?: Set<string>;
  onToggleColumn?: (key: string) => void;
}

export default function LibraryFilters({
  searchTerm,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterPriority,
  onPriorityChange,
  filterType,
  onTypeChange,
  showAdvancedFilter,
  onToggleAdvancedFilter,
  filterQuartile,
  onQuartileChange,
  filterRating,
  onRatingChange,
  filterYear,
  onYearChange,
  availableYears,
  onResetAdvancedFilters,
  showColumnConfig = false,
  onToggleColumnConfig,
  visibleColumns,
  onToggleColumn,
}: LibraryFiltersProps) {
  return (
    <div className="space-y-3">
      {/* 列配置面板 */}
      {showColumnConfig && visibleColumns && onToggleColumn && (
        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">配置表格列</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleColumnConfig}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TABLE_COLUMNS.filter(col => !col.fixed).map(col => (
              <div key={col.key} className="flex items-center space-x-2">
                <Checkbox
                  id={col.key}
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => onToggleColumn(col.key)}
                />
                <Label htmlFor={col.key} className="text-sm cursor-pointer">
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 基础筛选栏 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="搜索论文标题、作者或期刊..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filterStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[140px] bg-white dark:bg-slate-900">
            <SelectValue placeholder="阅读状态" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900">
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="unread">未读</SelectItem>
            <SelectItem value="reading">阅读中</SelectItem>
            <SelectItem value="finished">已完成</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={onPriorityChange}>
          <SelectTrigger className="w-[130px] bg-white dark:bg-slate-900">
            <SelectValue placeholder="优先级" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900">
            <SelectItem value="all">全部优先级</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="medium">中</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={onTypeChange}>
          <SelectTrigger className="w-[130px] bg-white dark:bg-slate-900">
            <SelectValue placeholder="文章类型" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900">
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="journal">期刊</SelectItem>
            <SelectItem value="conference">会议</SelectItem>
            <SelectItem value="preprint">预印本</SelectItem>
            <SelectItem value="book">书籍</SelectItem>
            <SelectItem value="thesis">论文</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showAdvancedFilter ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleAdvancedFilter}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          高级筛选
        </Button>
      </div>

      {/* 高级筛选面板 */}
      {showAdvancedFilter && (
        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">高级筛选</h3>
            <Button variant="ghost" size="sm" onClick={onResetAdvancedFilters}>
              重置
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">分区筛选</Label>
              <Select value={filterQuartile} onValueChange={onQuartileChange}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="选择分区" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  <SelectItem value="all">全部分区</SelectItem>
                  <SelectItem value="Q1">SCI Q1</SelectItem>
                  <SelectItem value="Q2">SCI Q2</SelectItem>
                  <SelectItem value="Q3">SCI Q3</SelectItem>
                  <SelectItem value="Q4">SCI Q4</SelectItem>
                  <SelectItem value="1区">中科院 1区</SelectItem>
                  <SelectItem value="2区">中科院 2区</SelectItem>
                  <SelectItem value="3区">中科院 3区</SelectItem>
                  <SelectItem value="4区">中科院 4区</SelectItem>
                  <SelectItem value="A">CCF A</SelectItem>
                  <SelectItem value="B">CCF B</SelectItem>
                  <SelectItem value="C">CCF C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-slate-600 mb-1 block">评分筛选</Label>
              <Select value={filterRating} onValueChange={onRatingChange}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="选择评分" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  <SelectItem value="all">全部评分</SelectItem>
                  <SelectItem value="4+">4星及以上</SelectItem>
                  <SelectItem value="3+">3星及以上</SelectItem>
                  <SelectItem value="<3">3星以下</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-slate-600 mb-1 block">年份筛选</Label>
              <Select value={filterYear} onValueChange={onYearChange}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="选择年份" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  <SelectItem value="all">全部年份</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}