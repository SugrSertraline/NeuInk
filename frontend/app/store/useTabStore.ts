import { create } from 'zustand';

export type KnownTabType = 'dashboard' | 'library' | 'paper' | 'checklist' | 'settings';
// 可扩展为任意字符串
export type TabType = KnownTabType | (string & {});
export interface Tab {
  id: string;
  type: TabType;
  title: string;
  path: string;
  data?: any;
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;
  isLoading: boolean; // 新增：全局加载状态
  loadingTabId: string | null; // 新增：正在加载的tab ID
  
  addTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  setLoading: (isLoading: boolean, tabId?: string | null) => void; 
  resetToHome: () => void;
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [
    {
      id: 'dashboard',
      type: 'dashboard',
      title: '首页',
      path: '/',
    },
  ],
  activeTabId: 'dashboard',
  isLoading: false,
  loadingTabId: null,
  
  resetToHome: () => set({
    tabs: [{ id: 'dashboard', type: 'dashboard', title: '首页', path: '/' }],
    activeTabId: 'dashboard',
    loadingTabId: null
  }),

  addTab: (tab) => {
    const { tabs } = get();
    const existingTab = tabs.find(t => t.id === tab.id);
    
    if (existingTab) {
      set({ activeTabId: tab.id });
    } else {
      set({ 
        tabs: [...tabs, tab],
        activeTabId: tab.id 
      });
    }
  },
  
  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const index = tabs.findIndex(t => t.id === tabId);
    
    if (index === -1) return;
    if (tabId === 'dashboard') return;
    
    const newTabs = tabs.filter(t => t.id !== tabId);
    
    let newActiveTabId = activeTabId;
    if (activeTabId === tabId) {
      if (index > 0) {
        newActiveTabId = newTabs[index - 1].id;
      } else if (newTabs.length > 0) {
        newActiveTabId = newTabs[0].id;
      }
    }
    
    set({ 
      tabs: newTabs,
      activeTabId: newActiveTabId 
    });
  },
  
  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },
  
  updateTab: (tabId, updates) => {
    set(state => ({
      tabs: state.tabs.map(tab => 
        tab.id === tabId ? { ...tab, ...updates } : tab
      )
    }));
  },
  
  closeAllTabs: () => {
    set({ 
      tabs: [{
        id: 'dashboard',
        type: 'dashboard',
        title: '首页',
        path: '/',
      }],
      activeTabId: 'dashboard'
    });
  },
  
  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    const keepTab = tabs.find(t => t.id === tabId);
    const dashboardTab = tabs.find(t => t.id === 'dashboard');
    
    if (!keepTab) return;
    
    const newTabs = tabId === 'dashboard' 
      ? [dashboardTab!]
      : [dashboardTab!, keepTab];
    
    set({ 
      tabs: newTabs,
      activeTabId: tabId 
    });
  },
  
  setLoading: (isLoading, tabId = null) => {
    set({ isLoading, loadingTabId: tabId });
  },
}));