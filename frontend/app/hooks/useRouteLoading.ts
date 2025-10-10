'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTabStore } from '@/app/store/useTabStore';

/**
 * 全局路由加载状态管理 Hook
 * 监听路由变化，自动管理加载状态
 */
export function useRouteLoading() {
  const pathname = usePathname();
  const router = useRouter();
  const { setLoading, isLoading, loadingTabId } = useTabStore();

  // 监听路由变化
  useEffect(() => {
    // 路由变化时设置加载状态
    const handleRouteChangeStart = () => {
      setLoading(true, 'route');
    };

    // 路由变化完成时清除加载状态
    const handleRouteChangeComplete = () => {
      // 延迟一点时间，确保页面已经渲染
      setTimeout(() => {
        setLoading(false, null);
      }, 300);
    };

    // 当路径变化时，触发加载状态
    handleRouteChangeStart();

    // 页面加载完成后，清除加载状态
    // 使用 requestAnimationFrame 确保在下一帧执行
    const timer = requestAnimationFrame(() => {
      handleRouteChangeComplete();
    });

    return () => {
      cancelAnimationFrame(timer);
    };
  }, [pathname, setLoading]);

  return {
    isLoading,
    loadingTabId
  };
}