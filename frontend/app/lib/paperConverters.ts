// library/utils/paperConverters.ts

import type { PaperRecord, PaperMetadata, Author } from '../types/paper';

/**
 * 安全解析 JSON 字符串
 */
function safeJsonParse<T>(json: string | undefined | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * 将 PaperRecord (后端格式) 转换为 PaperMetadata (前端格式)
 */
export function paperRecordToMetadata(record: PaperRecord): PaperMetadata {
  return {
    ...record,
    authors: safeJsonParse<Author[]>(record.authors, []),
    tags: safeJsonParse<string[]>(record.tags, [])
  };
}

/**
 * 将 PaperMetadata (前端格式) 转换为 PaperRecord (后端格式)
 */
export function paperMetadataToRecord(metadata: PaperMetadata): PaperRecord {
  return {
    ...metadata,
    authors: JSON.stringify(metadata.authors),
    tags: metadata.tags ? JSON.stringify(metadata.tags) : undefined
  };
}

/**
 * 批量转换 PaperRecord 数组为 PaperMetadata 数组
 */
export function paperRecordsToMetadata(records: PaperRecord[]): PaperMetadata[] {
  return records.map(paperRecordToMetadata);
}

/**
 * 批量转换 PaperMetadata 数组为 PaperRecord 数组
 */
export function paperMetadataToRecords(metadata: PaperMetadata[]): PaperRecord[] {
  return metadata.map(paperMetadataToRecord);
}