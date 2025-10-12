// app/lib/paperApi.ts
import { PaperContent } from '../types/paper';
import { apiGetData, apiPost, apiPut, apiDelete, apiGetBlob } from './api';
import type {
  PaperMetadata,
  PaperRecord
} from '@neuink/shared';

/** 分页响应类型 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 查询参数 */
interface PaperQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  status?: string;
  priority?: string;
  year?: number;
  tags?: string[];
}

// ============ 路由定义 ============
const routes = {
  list: '/api/papers',
  item: (id: string) => `/api/papers/${id}`,
  content: (id: string) => `/api/papers/${id}/content`,
  checklists: (id: string) => `/api/papers/${id}/checklists`,
  progress: (id: string) => `/api/papers/${id}/progress`,
  search: '/api/papers/search',
  import: '/api/papers/import',
  export: '/api/papers/export',
  stats: '/api/papers/stats',
  pdf: (id: string) => `/api/papers/${id}/pdf`,
  parseStatus: (id: string) => `/api/papers/${id}/parse-status`,
};

// ============ 论文基础操作 ============

/**
 * 获取论文列表
 */
export async function fetchPapers(
  params?: PaperQueryParams
): Promise<PaginatedResponse<PaperRecord>> {
  const queryString = new URLSearchParams();
  
  if (params?.page) queryString.set('page', params.page.toString());
  if (params?.limit) queryString.set('limit', params.limit.toString());
  if (params?.sort) queryString.set('sort', params.sort);
  if (params?.search) queryString.set('search', params.search);
  if (params?.status) queryString.set('status', params.status);
  if (params?.priority) queryString.set('priority', params.priority);
  if (params?.year) queryString.set('year', params.year.toString());
  if (params?.tags?.length) queryString.set('tags', params.tags.join(','));

  const query = queryString.toString();
  const path = `${routes.list}${query ? `?${query}` : ''}`;
  
  const response = await apiGetData<{
    papers: PaperRecord[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>(path);

  return {
    items: response.papers,
    total: response.pagination.total,
    page: response.pagination.page,
    pageSize: response.pagination.limit
  };
}

/**
 * 获取单篇论文元数据
 */
export async function fetchPaperMetadata(paperId: string): Promise<PaperRecord> {
  return apiGetData<PaperRecord>(routes.item(paperId));
}

/**
 * 创建新论文
 */
export async function createPaper(
  paperData: Partial<PaperMetadata>
): Promise<PaperRecord> {
  return apiPost<PaperRecord>(routes.list, paperData);
}

/**
 * 更新论文元数据
 */
export async function updatePaperMetadata(
  paperId: string,
  updates: Partial<PaperMetadata>
): Promise<PaperRecord> {
  return apiPut<PaperRecord>(routes.item(paperId), updates);
}

/**
 * 删除论文
 */
export async function deletePaper(paperId: string): Promise<void> {
  return apiDelete<void>(routes.item(paperId));
}

// ============ 论文内容操作 ============

/**
 * 获取论文完整内容（包含 sections, blockNotes, checklistNotes 等）
 */
export async function fetchPaperContent(paperId: string): Promise<PaperContent> {
  return apiGetData<PaperContent>(routes.content(paperId));
}

/**
 * 保存论文内容
 */
export async function savePaperContent(
  paperId: string,
  content: PaperContent
): Promise<PaperContent> {
  return apiPut<PaperContent>(routes.content(paperId), content);
}

/**
 * 更新论文阅读进度
 */
export async function updateReadingProgress(
  paperId: string,
  progress: {
    readingPosition?: number;
    totalReadingTime?: number;
    lastReadTime?: string;
  }
): Promise<void> {
  return apiPut<void>(routes.progress(paperId), progress);
}

// ============ 论文关联操作 ============

/**
 * 获取论文所属的清单列表
 */
export async function fetchPaperChecklists(
  paperId: string
): Promise<any[]> {
  return apiGetData<any[]>(routes.checklists(paperId));
}

// ============ 批量操作 ============

/**
 * 批量导入论文
 */
export async function importPapers(
  papers: Partial<PaperMetadata>[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  return apiPost<{ success: number; failed: number; errors: string[] }>(
    routes.import,
    { papers }
  );
}

/**
 * 搜索论文
 */
export async function searchPapers(
  query: string,
  filters?: {
    status?: string;
    priority?: string;
    tags?: string[];
  }
): Promise<PaperRecord[]> {
  const queryString = new URLSearchParams();
  queryString.set('search', query);
  
  if (filters?.status) queryString.set('status', filters.status);
  if (filters?.priority) queryString.set('priority', filters.priority);
  if (filters?.tags?.length) queryString.set('tags', filters.tags.join(','));

  const response = await apiGetData<{
    papers: PaperRecord[];
  }>(`${routes.search}?${queryString.toString()}`);

  return response.papers;
}

/**
 * 获取论文解析状态
 */
export async function getPaperParseStatus(paperId: string): Promise<{
  parseStatus: string;
  job?: {
    id: string;
    status: string;
    error?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
  };
}> {
  return apiGetData<any>(routes.parseStatus(paperId));
}
/**
 * 导出论文数据
 */

export async function exportPapers(paperIds?: string[]): Promise<Blob> {
  const queryString = paperIds?.length ? `?ids=${paperIds.join(',')}` : '';
  const path = `${routes.export}${queryString}`;
  
  // ✅ 使用封装好的 apiGetBlob
  return apiGetBlob(path);
}

// ============ 统计信息 ============

/**
 * 获取论文统计信息
 */
export async function fetchPaperStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byYear: Record<number, number>;
}> {
  return apiGetData<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byYear: Record<number, number>;
  }>(routes.stats);
}