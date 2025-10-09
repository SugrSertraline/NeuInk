// app/lib/checklistApi.ts
import { apiGetData, apiPost, apiPut, apiDelete } from '@/app/lib/api';
import type { ChecklistTree, ChecklistNode } from '@/app/types/checklist';
import type { PaperRecord as ApiPaperRecord } from '@neuink/shared';

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
// 🆕 添加这个接口定义
export interface DeleteChecklistResponse {
  deletedChecklists: number;
  affectedPapers: number;
}
// ============ 路由 ============
const routes = {
  list:        '/api/checklists',                            // GET 列表（树）
  node:        (id: string) => `/api/checklists/${id}`,      // GET/PUT/DELETE
  reorder:     '/api/checklists/batch-reorder',              // PUT
  papers:      (id: string) => `/api/checklists/${id}/papers`,           // GET/POST
  paper:       (id: string, paperId: string) => `/api/checklists/${id}/papers/${paperId}`, // DELETE
  papersOrder: (id: string) => `/api/checklists/${id}/papers/reorder`,   // PUT
};

// ============ 清单树 ============
export async function fetchChecklistTree(): Promise<ChecklistTree> {
  return apiGetData<ChecklistTree>(routes.list);
}

export async function fetchChecklistNode(id: string): Promise<ChecklistNode> {
  return apiGetData<ChecklistNode>(routes.node(id));
}

export interface CreateChecklistDto {
  name: string;
  parentId?: string | null;
  level: 1 | 2;  // ✅ 必填字段
  order?: number | null;
}

export async function createChecklist(dto: CreateChecklistDto): Promise<ChecklistNode> {
  return apiPost<ChecklistNode>(routes.list, dto);
}

export interface UpdateChecklistDto {
  name?: string;
  parentId?: string | null;
  level?: 1 | 2;  // ✅ 可选字段
  order?: number | null;
}

export async function updateChecklist(id: string, dto: UpdateChecklistDto): Promise<ChecklistNode> {
  return apiPut<ChecklistNode>(routes.node(id), dto);
}

export async function deleteChecklist(id: string): Promise<DeleteChecklistResponse> {
  return apiDelete<DeleteChecklistResponse>(routes.node(id));
}

export interface BatchReorderItem {
  id: string;
  order: number;
  parentId?: string | null;
}

export async function batchReorderChecklists(items: BatchReorderItem[]): Promise<{ success: true }> {
  return apiPut<{ success: true }>(routes.reorder, { items });
}

// ============ 清单内论文 ============
export interface FetchChecklistPapersParams {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;          // e.g. "year:desc"
  filters?: Record<string, any>;
}

// ✅ 后端返回的原始结构
interface BackendPapersResponse {
  papers: ApiPaperRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function fetchChecklistPapers(
  id: string,
  params: FetchChecklistPapersParams = {}
): Promise<PagedResult<ApiPaperRecord>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('limit', String(params.pageSize)); // ✅ 后端用的是 limit 而不是 pageSize
  if (params.q) qs.set('q', params.q);
  if (params.sort) qs.set('sort', params.sort);
  if (params.filters) qs.set('filters', JSON.stringify(params.filters));
  
  const path = `${routes.papers(id)}${qs.toString() ? `?${qs.toString()}` : ''}`;
  const backendData = await apiGetData<BackendPapersResponse>(path);
  
  // ✅ 转换为前端期望的 PagedResult 格式
  return {
    items: backendData.papers || [],
    total: backendData.pagination?.total || 0,
    page: backendData.pagination?.page || 1,
    pageSize: backendData.pagination?.limit || 20,
  };
}

/** 批量/单个添加论文都支持 */
export async function addPapersToChecklist(
  id: string,
  paperIds: string | string[]
): Promise<{ success: true }> {
  const list = Array.isArray(paperIds) ? paperIds : [paperIds];
  return apiPost<{ success: true }>(routes.papers(id), { paperIds: list });
}

export async function removePaperFromChecklist(id: string, paperId: string): Promise<{ success: true }> {
  return apiDelete<{ success: true }>(routes.paper(id, paperId));
}

/** 建议后端 body: { paperIds: string[] } 表示最终顺序 */
export async function reorderChecklistPapers(
  id: string,
  paperIds: string[]
): Promise<{ success: true }> {
  return apiPut<{ success: true }>(routes.papersOrder(id), { paperIds });
}

// ============ 论文清单关联 ============

/**
 * 获取论文所在的所有清单
 */
export async function fetchPaperChecklists(paperId: string): Promise<ChecklistNode[]> {
  return apiGetData<ChecklistNode[]>(`/api/papers/${paperId}/checklists`);
}