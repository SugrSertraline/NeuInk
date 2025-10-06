// library/components/PaperCard.tsx

'use client';

import React from 'react';
import { Star, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PaperMetadata } from '@neuink/shared';
import { getStatusBadge, getPriorityBadge, getQuartileColor } from '../utils/paperHelpers';

interface PaperCardProps {
  paper: PaperMetadata;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function PaperCard({ paper, onClick, onContextMenu }: PaperCardProps) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group relative rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 bg-white dark:bg-slate-900 cursor-pointer"
    >
      {/* 头部：标题和评分 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-blue-600 transition-colors">
          {paper.title}
        </h3>
        {paper.rating ? (
          <div className="flex items-center gap-1 shrink-0">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{paper.rating}</span>
          </div>
        ) : null}
      </div>

      {/* 作者和年份 */}
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        {paper.authors.length > 0 ? paper.authors.map(a => a.name).join(', ') : '未知作者'}
        {paper.year && ` · ${paper.year}`}
      </p>

      {/* 期刊/会议 */}
      {paper.publication && (
        <p className="text-xs text-slate-500 mb-2 truncate" title={paper.publication}>
          📄 {paper.publication}
        </p>
      )}

      {/* 分区和影响因子 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {paper.sciQuartile && (
          <Badge className={cn('text-xs', getQuartileColor(paper.sciQuartile))}>
            SCI {paper.sciQuartile}
          </Badge>
        )}
        {paper.casQuartile && (
          <Badge className={cn('text-xs', getQuartileColor(paper.casQuartile))}>
            中科院 {paper.casQuartile}
          </Badge>
        )}
        {paper.ccfRank && (
          <Badge className="text-xs bg-purple-50 text-purple-700">
            CCF {paper.ccfRank}
          </Badge>
        )}
        {paper.impactFactor && (
          <Badge className="text-xs bg-indigo-50 text-indigo-700">
            IF {paper.impactFactor}
          </Badge>
        )}
      </div>

      {/* 标签 */}
      {paper.tags && paper.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {paper.tags.slice(0, 4).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* 阅读进度 */}
      {paper.readingPosition !== undefined && paper.readingPosition > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>阅读进度</span>
            <span>{Math.round(paper.readingPosition * 100)}%</span>
          </div>
          <Progress value={paper.readingPosition * 100} className="h-1.5" />
        </div>
      )}

      {/* 底部：状态和优先级 */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex gap-2">
          {getStatusBadge(paper.readingStatus)}
          {getPriorityBadge(paper.priority)}
        </div>
        {paper.totalReadingTime ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {Math.round(paper.totalReadingTime / 60)}min
                </div>
              </TooltipTrigger>
              <TooltipContent>总阅读时长</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
  );
}