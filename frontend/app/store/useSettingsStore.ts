import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'auto';
export type DisplayMode = 'english' | 'chinese' | 'bilingual';
export type BilingualLayout = 'vertical' | 'horizontal';
export type SortBy = 'title' | 'date' | 'author' | 'journal';
export type ViewMode = 'grid' | 'list' | 'table';

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
  
  // 图书馆设置
  defaultSortBy: SortBy;
  defaultViewMode: ViewMode;
  showAbstract: boolean;
  showKeywords: boolean;
  showDOI: boolean;
  
  // 阅读器设置
  fixedHeader: boolean;
  autoScroll: boolean;
  highlightAnnotations: boolean;
  
  // 语言偏好
  language: 'zh-CN' | 'en-US' | 'auto';
  
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
  setDefaultSortBy: (sortBy: SortBy) => void;
  setDefaultViewMode: (viewMode: ViewMode) => void;
  setShowAbstract: (show: boolean) => void;
  setShowKeywords: (show: boolean) => void;
  setShowDOI: (show: boolean) => void;
  setFixedHeader: (fixed: boolean) => void;
  setAutoScroll: (auto: boolean) => void;
  setHighlightAnnotations: (highlight: boolean) => void;
  setLanguage: (lang: 'zh-CN' | 'en-US' | 'auto') => void;
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
      
      // 图书馆设置默认值
      defaultSortBy: 'title',
      defaultViewMode: 'grid',
      showAbstract: true,
      showKeywords: true,
      showDOI: false,
      
      // 阅读器设置默认值
      fixedHeader: false,
      autoScroll: false,
      highlightAnnotations: true,
      
      // 语言偏好默认值
      language: 'auto',
      
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
      setDefaultSortBy: (defaultSortBy) => set({ defaultSortBy }),
      setDefaultViewMode: (defaultViewMode) => set({ defaultViewMode }),
      setShowAbstract: (showAbstract) => set({ showAbstract }),
      setShowKeywords: (showKeywords) => set({ showKeywords }),
      setShowDOI: (showDOI) => set({ showDOI }),
      setFixedHeader: (fixedHeader) => set({ fixedHeader }),
      setAutoScroll: (autoScroll) => set({ autoScroll }),
      setHighlightAnnotations: (highlightAnnotations) => set({ highlightAnnotations }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'neuink-settings',
    }
  )
);