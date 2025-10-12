// lib/api.ts 或 utils/api.ts

/**
 * API 基础配置
 * - 开发环境：使用相对路径 + Next.js rewrites 转发到后端 (3001)
 * - 生产环境：使用相对路径 + api-proxy 转发到后端 (3001)
 */
const isDev = process.env.NODE_ENV === 'development';

export const API_BASE = (() => {
  // 1. 优先使用环境变量（如果需要覆盖默认配置）
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE;
  }
  
  // 2. 开发环境和生产环境都使用相对路径
  // 开发环境通过 rewrites 转发，生产环境通过 api-proxy 转发
  return '';
})();

// 打印配置信息（仅在客户端且开发环境）
if (typeof window !== 'undefined' && isDev) {
  console.log('🌐 API Base URL:', API_BASE || '(相对路径)');
  console.log('📍 Environment:', process.env.NODE_ENV);
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

/** ✅ 统一的响应处理函数 */
async function handleResponse<T>(res: Response, path: string): Promise<T> {
  let json: any;
  
  try {
    const text = await res.text();
    json = text ? JSON.parse(text) : {};
  } catch (parseError) {
    console.error(`❌ JSON 解析失败 [${path}]:`, parseError);
    throw new Error(`服务器返回了无效的数据格式: ${path}`);
  }

  // 请求失败的情况
  if (!res.ok) {
    const errorMsg = json?.error || json?.message || res.statusText || `请求失败: ${path}`;
    console.error(`❌ API 错误 [${res.status}] ${path}:`, errorMsg);
    throw new Error(errorMsg);
  }

  // 标准 API 响应格式 { success, data, error }
  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success) {
      return json.data as T;
    }
    const errorMsg = json.error || `请求失败: ${path}`;
    console.error(`❌ API 返回错误 [${path}]:`, errorMsg);
    throw new Error(errorMsg);
  }

  // 直接返回数据（兼容非标准格式）
  return json as T;
}

/**
 * 构建完整的 API URL
 */
function buildUrl(path: string): string {
  // 确保 path 以 / 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

/** 
 * GET 请求 
 */
export async function apiGetData<T>(path: string): Promise<T> {
  const url = buildUrl(path);
  
  try {
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return handleResponse<T>(res, path);
  } catch (error) {
    console.error(`❌ GET 请求失败 [${path}]:`, error);
    throw error;
  }
}

/** 
 * POST 请求 
 */
export async function apiPost<T>(
  path: string,
  body: FormData | object
): Promise<T> {
  const url = buildUrl(path);
  const isFormData = body instanceof FormData;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
      headers: isFormData ? {} : { 'Content-Type': 'application/json' }
    });

    return handleResponse<T>(res, path);
  } catch (error) {
    console.error(`❌ POST 请求失败 [${path}]:`, error);
    throw error;
  }
}

/** 
 * PUT 请求 
 */
export async function apiPut<T>(
  path: string,
  body: FormData | object
): Promise<T> {
  const url = buildUrl(path);
  const isFormData = body instanceof FormData;
  
  try {
    const res = await fetch(url, {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
      headers: isFormData ? {} : { 'Content-Type': 'application/json' }
    });

    return handleResponse<T>(res, path);
  } catch (error) {
    console.error(`❌ PUT 请求失败 [${path}]:`, error);
    throw error;
  }
}

/** 
 * PATCH 请求 
 */
export async function apiPatch<T>(
  path: string,
  body: FormData | object
): Promise<T> {
  const url = buildUrl(path);
  const isFormData = body instanceof FormData;
  
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      body: isFormData ? body : JSON.stringify(body),
      headers: isFormData ? {} : { 'Content-Type': 'application/json' }
    });

    return handleResponse<T>(res, path);
  } catch (error) {
    console.error(`❌ PATCH 请求失败 [${path}]:`, error);
    throw error;
  }
}

/** 
 * DELETE 请求 
 */
export async function apiDelete<T>(path: string): Promise<T> {
  const url = buildUrl(path);
  
  try {
    const res = await fetch(url, { 
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return handleResponse<T>(res, path);
  } catch (error) {
    console.error(`❌ DELETE 请求失败 [${path}]:`, error);
    throw error;
  }
}

/**
 * 将相对 URL 转换为绝对 URL
 * 用于图片、文件等静态资源
 */
export function toAbsoluteUrl(url: string): string {
  if (!url) return '';
  
  // 已经是完整 URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // data: URL (base64 图片等)
  if (url.startsWith('data:')) {
    return url;
  }
  
  // 相对路径转换为绝对路径
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE}${normalizedUrl}`;
}

/**
 * 上传文件的辅助函数
 */
export async function apiUploadFile<T>(
  path: string,
  file: File,
  additionalData?: Record<string, string>
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  
  // 添加额外的表单数据
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }
  
  return apiPost<T>(path, formData);
}

/**
 * 批量上传文件
 */
export async function apiUploadFiles<T>(
  path: string,
  files: File[],
  additionalData?: Record<string, string>
): Promise<T> {
  const formData = new FormData();
  
  files.forEach((file, index) => {
    formData.append(`files`, file);
  });
  
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }
  
  return apiPost<T>(path, formData);
}

/**
 * 下载文件
 */
export async function apiDownloadFile(
  path: string,
  filename?: string
): Promise<void> {
  const url = buildUrl(path);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`下载失败: ${res.statusText}`);
    }
    
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error(`❌ 文件下载失败 [${path}]:`, error);
    throw error;
  }
}

// 在 frontend/app/lib/api.ts 中添加

/**
 * 获取 Blob 数据（用于文件下载）
 */
export async function apiGetBlob(path: string): Promise<Blob> {
  const url = buildUrl(path);
  
  try {
    const res = await fetch(url, { 
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ 获取 Blob 失败 [${res.status}] ${path}:`, errorText);
      throw new Error(`下载失败: ${res.statusText}`);
    }
    
    return res.blob();
  } catch (error) {
    console.error(`❌ GET Blob 请求失败 [${path}]:`, error);
    throw error;
  }
}