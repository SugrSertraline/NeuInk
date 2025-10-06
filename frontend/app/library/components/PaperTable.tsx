// library/components/PaperTable.tsx

'use client';

import React from 'react';
import { Star, Clock, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PaperMetadata } from '@neuink/shared';
import {
  getStatusBadge,
  getPriorityBadge,
  getArticleTypeBadge,
  getQuartileColor,
  TABLE_COLUMNS
} from '../utils/paperHelpers';

interface PaperTableProps {
  papers: PaperMetadata[];
  visibleColumns: Set<string>;
  onPaperClick: (paper: PaperMetadata) => void;
  onContextMenu: (e: React.MouseEvent, paper: PaperMetadata) => void;
}

export default function PaperTable({
  papers,
  visibleColumns,
  onPaperClick,
  onContextMenu
}: PaperTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b sticky top-0">
            <tr>
              {TABLE_COLUMNS.filter(col => visibleColumns.has(col.key)).map(col => (
                <th key={col.key} className={cn("text-left p-3 text-sm font-semibold whitespace-nowrap", col.width)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {papers.map((p) => {
              return (
                <tr
                  key={p.id}
                  onClick={() => onPaperClick(p)}
                  onContextMenu={(e) => onContextMenu(e, p)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  {visibleColumns.has('title') && (
                    <td className="p-3 max-w-md">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate font-medium">{p.title}</div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <p>{p.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {p.tags && p.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {p.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                  {visibleColumns.has('authors') && (
                    <td className="p-3 max-w-xs">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate text-sm text-slate-600 dark:text-slate-400">
                              {p.authors.length > 0 ? p.authors.map(a => a.name).join(', ') : '-'}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{p.authors.length > 0 ? p.authors.map(a => a.name).join(', ') : '未知作者'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  )}
                  {visibleColumns.has('year') && (
                    <td className="p-3 text-sm">{p.year || '-'}</td>
                  )}
                  {visibleColumns.has('publication') && (
                    <td className="p-3 max-w-xs">
                      {p.publication ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate text-sm text-slate-600 dark:text-slate-400">
                                {p.publication}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent><p>{p.publication}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : <span className="text-slate-400 text-sm">-</span>}
                    </td>
                  )}
                  {visibleColumns.has('articleType') && (
                    <td className="p-3">{getArticleTypeBadge(p.articleType)}</td>
                  )}
                  {visibleColumns.has('quartile') && (
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {p.sciQuartile && (
                          <Badge className={cn('text-xs w-fit', getQuartileColor(p.sciQuartile))}>
                            SCI {p.sciQuartile}
                          </Badge>
                        )}
                        {p.casQuartile && (
                          <Badge className={cn('text-xs w-fit', getQuartileColor(p.casQuartile))}>
                            中科院 {p.casQuartile}
                          </Badge>
                        )}
                        {p.ccfRank && (
                          <Badge className="text-xs w-fit bg-purple-50 text-purple-700">
                            CCF {p.ccfRank}
                          </Badge>
                        )}
                        {!p.sciQuartile && !p.casQuartile && !p.ccfRank && (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                  )}
                  {visibleColumns.has('impactFactor') && (
                    <td className="p-3 text-sm">
                      {p.impactFactor ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-indigo-600 font-medium">{p.impactFactor}</span>
                            </TooltipTrigger>
                            <TooltipContent>影响因子: {p.impactFactor}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : '-'}
                    </td>
                  )}
                  {visibleColumns.has('status') && (
                    <td className="p-3">{getStatusBadge(p.readingStatus)}</td>
                  )}
                  {visibleColumns.has('priority') && (
                    <td className="p-3">{getPriorityBadge(p.priority)}</td>
                  )}
                  {visibleColumns.has('progress') && (
                    <td className="p-3">
                      {p.readingPosition !== undefined && p.readingPosition > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-20">
                                <Progress value={p.readingPosition * 100} className="h-2" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{Math.round(p.readingPosition * 100)}%</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.has('rating') && (
                    <td className="p-3">
                      {p.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{p.rating}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.has('readingTime') && (
                    <td className="p-3">
                      {p.totalReadingTime ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-xs text-slate-600">
                                <Clock className="w-3 h-3" />
                                {Math.round(p.totalReadingTime / 60)}min
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>总阅读时长</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : <span className="text-slate-400 text-sm">-</span>}
                    </td>
                  )}
                  {visibleColumns.has('actions') && (
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onContextMenu(e as any, p);
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}