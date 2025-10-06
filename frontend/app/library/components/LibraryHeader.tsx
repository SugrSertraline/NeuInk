// library/components/LibraryHeader.tsx

'use client';

import React from 'react';
import { Grid, List, FileText, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ViewMode = 'card' | 'table' | 'compact';

interface LibraryHeaderProps {
  totalCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCreatePaper: () => void;
  showColumnConfig?: boolean;
  onToggleColumnConfig?: () => void;
}

export default function LibraryHeader({
  totalCount,
  viewMode,
  onViewModeChange,
  onCreatePaper,
  showColumnConfig = false,
  onToggleColumnConfig,
}: LibraryHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          论文库
        </h1>
        <p className="text-sm text-slate-500 mt-1">共 {totalCount} 篇论文</p>
      </div>

      <div className="flex items-center gap-3">
        {/* 新建论文按钮 - 美化版 */}
        <Button 
          onClick={onCreatePaper} 
          className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 font-medium"
        >
          <Plus className="w-4 h-4" />
          新建论文
        </Button>

        {/* 列配置按钮 (仅表格视图) */}
        {viewMode === 'table' && onToggleColumnConfig && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleColumnConfig}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            列设置
          </Button>
        )}

<TooltipProvider>
  <div className="flex gap-2">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={viewMode === 'card' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('card')}
        >
          <Grid className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent 
        className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm shadow-lg border-0"
        sideOffset={5}
      >
        卡片视图
      </TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={viewMode === 'compact' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('compact')}
        >
          <List className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent 
        className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm shadow-lg border-0"
        sideOffset={5}
      >
        紧凑视图
      </TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('table')}
        >
          <FileText className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent 
        className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm shadow-lg border-0"
        sideOffset={5}
      >
        表格视图
      </TooltipContent>
    </Tooltip>
  </div>
</TooltipProvider>


        
      </div>
    </div>
  );
}