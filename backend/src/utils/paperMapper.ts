// backend/src/utils/paperMapper.ts
import { PaperMetadata, PaperRecord } from '@neuink/shared';

/**
 * 数据库记录（PaperRecord）→ 前端元数据（PaperMetadata）
 * 将 JSON 字符串字段解析为数组
 */
export function recordToMetadata(record: PaperRecord): PaperMetadata {
  return {
    ...record,
    authors: record.authors ? JSON.parse(record.authors) : [],
    tags: record.tags ? JSON.parse(record.tags) : undefined,
  };
}

/**
 * 前端元数据（PaperMetadata）→ 数据库记录（PaperRecord）
 * 将数组字段序列化为 JSON 字符串
 */
export function metadataToRecord(
  metadata: Partial<PaperMetadata>
): Partial<PaperRecord> {
  const { authors, tags, ...rest } = metadata;
  
  return {
    ...rest,
    ...(authors !== undefined && { authors: JSON.stringify(authors) }),
    ...(tags !== undefined && { tags: JSON.stringify(tags) }),
  } as Partial<PaperRecord>;
}
