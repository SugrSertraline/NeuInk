import { Theme } from '@/app/store/useSettingsStore';

/**
 * 获取系统主题偏好
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 根据主题设置和系统偏好获取实际应用的主题
 */
export function getAppliedTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    return getSystemTheme();
  }
  return theme;
}

/**
 * 应用主题到文档元素
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const appliedTheme = getAppliedTheme(theme);
  const root = document.documentElement;
  
  if (appliedTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * 监听系统主题变化
 */
export function watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = () => {
    callback(mediaQuery.matches ? 'dark' : 'light');
  };
  
  mediaQuery.addEventListener('change', handleChange);
  
  // 返回清理函数
  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}