// app/library/utils/parseStatusHelper.ts
export interface ParseStatusInfo {
  isCompleted: boolean;
  isPending: boolean;
  isFailed: boolean;
  isParsing: boolean;
  progress: number;
  message: string;
  errorMessage?: string;
}

/**
 * 解析 parseStatus 字符串
 * - "completed" -> 已完成
 * - "pending" -> 等待中
 * - "15% 正在验证PDF文件" -> 解析中
 * - "failed: 错误信息" -> 失败
 */
export function parseStatusInfo(parseStatus?: string): ParseStatusInfo {
  if (!parseStatus) {
    return {
      isCompleted: true,
      isPending: false,
      isFailed: false,
      isParsing: false,
      progress: 100,
      message: '已完成'
    };
  }

  // 已完成
  if (parseStatus === 'completed') {
    return {
      isCompleted: true,
      isPending: false,
      isFailed: false,
      isParsing: false,
      progress: 100,
      message: '已完成'
    };
  }

  // 等待中
  if (parseStatus === 'pending') {
    return {
      isCompleted: false,
      isPending: true,
      isFailed: false,
      isParsing: true,
      progress: 0,
      message: '等待处理'
    };
  }

  // 失败：格式为 "failed: 错误信息"
  if (parseStatus.startsWith('failed:')) {
    const errorMessage = parseStatus.substring(7).trim();
    return {
      isCompleted: false,
      isPending: false,
      isFailed: true,
      isParsing: false,
      progress: 0,
      message: '解析失败',
      errorMessage
    };
  }

  // 解析中：格式为 "15% 正在验证PDF文件"
  const match = parseStatus.match(/^(\d+)%\s*(.+)$/);
  if (match) {
    const progress = parseInt(match[1], 10);
    const message = match[2].trim();
    return {
      isCompleted: false,
      isPending: false,
      isFailed: false,
      isParsing: true,
      progress,
      message
    };
  }

  // 默认：当作解析中
  return {
    isCompleted: false,
    isPending: false,
    isFailed: false,
    isParsing: true,
    progress: 0,
    message: parseStatus
  };
}