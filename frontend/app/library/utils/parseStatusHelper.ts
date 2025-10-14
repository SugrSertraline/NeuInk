// app/library/utils/parseStatusHelper.ts
import { ParseStatus } from '@/app/types/paper';

export interface ParseStatusInfo {
  isParsing: boolean;
  isPending: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  progress: number;
  message: string;
  errorMessage?: string;
}

/**
 * 解析 parseStatus 和 remarks 字段，提取解析状态信息
 */
export function parseStatusInfo(
  parseStatus?: ParseStatus,
  remarks?: string
): ParseStatusInfo {
  // 默认值
  const defaultInfo: ParseStatusInfo = {
    isParsing: false,
    isPending: false,
    isCompleted: true,
    isFailed: false,
    progress: 100,
    message: '就绪',
  };

  if (!parseStatus) {
    return defaultInfo;
  }

  // 尝试从 remarks 中解析进度信息
  let progressData: {
    percentage?: number;
    message?: string;
    error?: string;
  } = {};

  if (remarks) {
    try {
      const remarksObj = typeof remarks === 'string' ? JSON.parse(remarks) : remarks;
      progressData = remarksObj?.parseProgress || {};
    } catch (e) {
      // 解析失败，忽略
    }
  }

  const percentage = progressData.percentage ?? 0;
  const message = progressData.message || getDefaultMessage(parseStatus);
  const errorMessage = progressData.error;

  switch (parseStatus) {
    case 'pending':
      return {
        isParsing: true,
        isPending: true,
        isCompleted: false,
        isFailed: false,
        progress: percentage,
        message,
      };

    case 'parsing':
      return {
        isParsing: true,
        isPending: false,
        isCompleted: false,
        isFailed: false,
        progress: percentage,
        message,
      };

    case 'failed':
      return {
        isParsing: false,
        isPending: false,
        isCompleted: false,
        isFailed: true,
        progress: 0,
        message: '解析失败',
        errorMessage: errorMessage || message,
      };

    case 'completed':
    default:
      return {
        isParsing: false,
        isPending: false,
        isCompleted: true,
        isFailed: false,
        progress: 100,
        message: '解析完成',
      };
  }
}

function getDefaultMessage(status: ParseStatus): string {
  switch (status) {
    case 'pending':
      return '等待解析...';
    case 'parsing':
      return '正在解析...';
    case 'failed':
      return '解析失败';
    case 'completed':
      return '解析完成';
    default:
      return '未知状态';
  }
}