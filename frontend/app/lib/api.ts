export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || '';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

/** ✅ 统一的响应处理函数 */
async function handleResponse<T>(res: Response, path: string): Promise<T> {
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

/** GET 请求 */
export async function apiGetData<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  return handleResponse<T>(res, path);
}

/** POST 请求 */
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

  return handleResponse<T>(res, path);
}

export async function apiPut<T>(
  path: string,
  body: FormData | object
): Promise<T> {
  const isFormData = body instanceof FormData;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    body: isFormData ? body : JSON.stringify(body),
    headers: isFormData ? {} : { 'Content-Type': 'application/json' }
  });

  return handleResponse<T>(res, path);
}

/** DELETE 请求 */
export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  return handleResponse<T>(res, path);
}

export function toAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE}${url.startsWith('/') ? url : '/' + url}`;
}
