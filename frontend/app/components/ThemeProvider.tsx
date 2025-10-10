'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/app/store/useSettingsStore';
import { applyTheme, watchSystemTheme } from '@/app/lib/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme } = useSettingsStore();

  useEffect(() => {
    // 初始应用主题
    applyTheme(theme);

    // 如果主题设置为自动，监听系统主题变化
    if (theme === 'auto') {
      const unwatch = watchSystemTheme(() => {
        applyTheme(theme);
      });

      return unwatch;
    }
  }, [theme]);

  return <>{children}</>;
}