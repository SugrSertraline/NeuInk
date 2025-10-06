export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

/** 直接返回 data，适配 {success,data}，失败抛错 */
export async function apiGetData<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Invalid JSON from ${path}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || res.statusText || `Request failed: ${path}`);
  }

  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success) return json.data as T;
    throw new Error(json.error || `Request failed: ${path}`);
  }

  // 兜底（如果你以后改成直接返回 data 本体）
  return json as T;
}
export async function apiPost<T>(
  path: string,
  body: FormData | object
): Promise<T> {
  const isFormData = body instanceof FormData;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
    headers: isFormData ? {} : { 'Content-Type': 'application/json' }
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Invalid JSON from ${path}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || res.statusText || `Request failed: ${path}`);
  }

  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success) return json.data as T;
    throw new Error(json.error || `Request failed: ${path}`);
  }

  return json as T;
}

/** DELETE 请求 */
export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE'
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Invalid JSON from ${path}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || res.statusText || `Request failed: ${path}`);
  }

  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success) return (json.data || {}) as T;
    throw new Error(json.error || `Request failed: ${path}`);
  }

  return json as T;
}
export function toAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url; // 已经是绝对路径
  }
  // 相对路径转绝对路径
  return `${API_BASE}${url.startsWith('/') ? url : '/' + url}`;
}