// app/lib/paperApi.ts
import { PaperContent } from '../types/paper';
import { apiGetData, apiPost, apiPut, apiDelete } from './api';
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
  const path = `/api/papers${query ? `?${query}` : ''}`;
  
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
  return apiGetData<PaperRecord>(`/api/papers/${paperId}`);
}

/**
 * 获取论文完整内容（包含 sections, blockNotes, checklistNotes 等）
 */
export async function fetchPaperContent(paperId: string): Promise<PaperContent> {
  return apiGetData<PaperContent>(`/api/papers/${paperId}/content`);
}

/**
 * 保存论文内容
 */
export async function savePaperContent(
  paperId: string,
  content: PaperContent
): Promise<PaperContent> {
  return apiPut<PaperContent>(`/api/papers/${paperId}/content`, content);
}

/**
 * 创建新论文
 */
export async function createPaper(
  paperData: Partial<PaperMetadata>
): Promise<PaperRecord> {
  return apiPost<PaperRecord>('/api/papers', paperData);
}

/**
 * 更新论文元数据
 */
export async function updatePaperMetadata(
  paperId: string,
  updates: Partial<PaperMetadata>
): Promise<PaperRecord> {
  return apiPut<PaperRecord>(`/api/papers/${paperId}`, updates);
}

/**
 * 删除论文
 */
export async function deletePaper(paperId: string): Promise<void> {
  return apiDelete<void>(`/api/papers/${paperId}`);
}

/**
 * 获取论文所属的清单列表
 */
export async function fetchPaperChecklists(
  paperId: string
): Promise<any[]> {
  return apiGetData<any[]>(`/api/papers/${paperId}/checklists`);
}

/**
 * 批量导入论文
 */
export async function importPapers(
  papers: Partial<PaperMetadata>[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  return apiPost<{ success: number; failed: number; errors: string[] }>(
    '/api/papers/import',
    { papers }
  );
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
  return apiPut<void>(`/api/papers/${paperId}/progress`, progress);
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
  }>(`/api/papers/search?${queryString.toString()}`);

  return response.papers;
}

/**
 * 导出论文数据
 */
export async function exportPapers(
  paperIds?: string[]
): Promise<Blob> {
  const queryString = paperIds?.length 
    ? `?ids=${paperIds.join(',')}` 
    : '';
  
  const response = await fetch(`/api/papers/export${queryString}`);
  
  if (!response.ok) {
    throw new Error('导出失败');
  }
  
  return response.blob();
}

/**
 * 上传论文 PDF
 */
export async function uploadPaperPDF(
  paperId: string,
  file: File
): Promise<{ pdfPath: string }> {
  const formData = new FormData();
  formData.append('pdf', file);
  
  return apiPost<{ pdfPath: string }>(
    `/api/papers/${paperId}/pdf`,
    formData
  );
}

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
  }>('/api/papers/stats');
}