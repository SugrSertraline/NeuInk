// app/library/hooks/useParseProgress.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { apiGetData } from '@/app/lib/api';
import { ParseStatus } from '@/app/types/paper';

export interface ParseProgressInfo {
  status: ParseStatus;
  percentage: number;
  message: string;
  lastUpdate?: string;
}

interface ParseProgressResponse {
  paperId: string;
  parseStatus: ParseStatus;
  progress: ParseProgressInfo;
  title: string;
  updatedAt: string;
}

/**
 * 轮询单个论文的解析进度
 */
export function useParseProgress(
  paperId: string | null,
  options: {
    enabled?: boolean;
    interval?: number;
    onComplete?: () => void;
    onError?: (error: string) => void;
  } = {}
) {
  const {
    enabled = true,
    interval = 2000, // 默认2秒轮询一次
    onComplete,
    onError,
  } = options;

  const [progress, setProgress] = useState<ParseProgressInfo | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCompleteRef = useRef(false);

  useEffect(() => {
    if (!paperId || !enabled) {
      setIsPolling(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const response = await apiGetData<ParseProgressResponse>(
          `/api/papers/${paperId}/parse-progress`
        );

        const progressInfo = response.progress;
        setProgress(progressInfo);

        // 检查是否完成或失败
        if (progressInfo.status === 'completed' || progressInfo.status === 'failed') {
          setIsPolling(false);
          
          if (!isCompleteRef.current) {
            isCompleteRef.current = true;
            
            if (progressInfo.status === 'completed' && onComplete) {
              onComplete();
            } else if (progressInfo.status === 'failed' && onError) {
              onError(progressInfo.message || '解析失败');
            }
          }
        } else {
          // 继续轮询
          timeoutRef.current = setTimeout(fetchProgress, interval);
        }
      } catch (error) {
        console.error('获取解析进度失败:', error);
        setIsPolling(false);
        
        if (onError && !isCompleteRef.current) {
          onError(error instanceof Error ? error.message : '获取进度失败');
        }
      }
    };

    setIsPolling(true);
    isCompleteRef.current = false;
    fetchProgress();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [paperId, enabled, interval, onComplete, onError]);

  return { progress, isPolling };
}

/**
 * 批量轮询多个论文的解析进度
 */
export function useBatchParseProgress(
  paperIds: string[],
  options: {
    enabled?: boolean;
    interval?: number;
    onAnyComplete?: () => void;
  } = {}
) {
  const {
    enabled = true,
    interval = 3000, // 批量轮询间隔稍长
    onAnyComplete,
  } = options;

  const [progressMap, setProgressMap] = useState<Map<string, ParseProgressInfo>>(new Map());
  const [isPolling, setIsPolling] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevPaperIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!enabled || paperIds.length === 0) {
      setIsPolling(false);
      return;
    }

    const fetchAllProgress = async () => {
      const newProgressMap = new Map<string, ParseProgressInfo>();
      let hasActiveParsing = false;
      let completedInThisCycle = false;

      await Promise.all(
        paperIds.map(async (paperId) => {
          try {
            const response = await apiGetData<ParseProgressResponse>(
              `/api/papers/${paperId}/parse-progress`
            );

            const progressInfo = response.progress;
            newProgressMap.set(paperId, progressInfo);

            // 检查是否有正在进行的解析
            if (progressInfo.status === 'parsing' || progressInfo.status === 'pending') {
              hasActiveParsing = true;
            }

            // 检查是否有刚完成的
            const prevProgress = progressMap.get(paperId);
            if (prevProgress && 
                (prevProgress.status === 'parsing' || prevProgress.status === 'pending') &&
                (progressInfo.status === 'completed' || progressInfo.status === 'failed')) {
              completedInThisCycle = true;
            }
          } catch (error) {
            console.error(`获取论文 ${paperId} 解析进度失败:`, error);
          }
        })
      );

      setProgressMap(newProgressMap);

      // 如果有完成的，触发回调
      if (completedInThisCycle && onAnyComplete) {
        onAnyComplete();
      }

      // 继续轮询或停止
      if (hasActiveParsing) {
        timeoutRef.current = setTimeout(fetchAllProgress, interval);
      } else {
        setIsPolling(false);
      }
    };

    // 检查 paperIds 是否变化
    const idsChanged = JSON.stringify(prevPaperIdsRef.current.sort()) !== 
                       JSON.stringify([...paperIds].sort());
    
    if (idsChanged || !isPolling) {
      prevPaperIdsRef.current = [...paperIds];
      setIsPolling(true);
      fetchAllProgress();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [paperIds, enabled, interval, onAnyComplete, isPolling, progressMap]);

  return { progressMap, isPolling };
}