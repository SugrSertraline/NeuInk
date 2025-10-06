// library/components/PaperListItem.tsx

'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PaperMetadata } from '@neuink/shared';
import { getStatusBadge, getQuartileColor } from '../utils/paperHelpers';

interface PaperListItemProps {
  paper: PaperMetadata;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function PaperListItem({ paper, onClick, onContextMenu }: PaperListItemProps) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{paper.title}</h4>
        <p className="text-sm text-slate-500 truncate">
          {paper.authors.length > 0 ? paper.authors.map(a => a.name).join(', ') : '未知作者'}
          {paper.year && ` · ${paper.year}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {paper.sciQuartile && (
          <Badge className={cn('text-xs', getQuartileColor(paper.sciQuartile))}>
            {paper.sciQuartile}
          </Badge>
        )}
        {getStatusBadge(paper.readingStatus)}
        {paper.rating && (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm">{paper.rating}</span>
          </div>
        )}
      </div>
    </div>
  );
}