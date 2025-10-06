import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'auto';
export type DisplayMode = 'english' | 'chinese' | 'bilingual';
export type BilingualLayout = 'vertical' | 'horizontal';

interface SettingsStore {
  // 外观设置
  theme: Theme;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  
  // 阅读偏好
  defaultDisplayMode: DisplayMode;
  bilingualLayout: BilingualLayout;
  
  // AI配置
  apiProvider: string;
  apiKey: string;
  apiBaseUrl: string;
  modelName: string;
  
  // 数据路径
  dataPath: string;
  
  // 更新设置的方法
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setLineHeight: (height: number) => void;
  setDefaultDisplayMode: (mode: DisplayMode) => void;
  setBilingualLayout: (layout: BilingualLayout) => void;
  setApiConfig: (config: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) => void;
  setDataPath: (path: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // 默认值
      theme: 'auto',
      fontSize: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: 1.6,
      
      defaultDisplayMode: 'bilingual',
      bilingualLayout: 'vertical',
      
      apiProvider: '',
      apiKey: '',
      apiBaseUrl: '',
      modelName: '',
      
      dataPath: '',
      
      // 更新方法
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setDefaultDisplayMode: (defaultDisplayMode) => set({ defaultDisplayMode }),
      setBilingualLayout: (bilingualLayout) => set({ bilingualLayout }),
      setApiConfig: (config) => set((state) => ({
        apiProvider: config.provider ?? state.apiProvider,
        apiKey: config.apiKey ?? state.apiKey,
        apiBaseUrl: config.baseUrl ?? state.apiBaseUrl,
        modelName: config.model ?? state.modelName,
      })),
      setDataPath: (dataPath) => set({ dataPath }),
    }),
    {
      name: 'neuink-settings',
    }
  )
);