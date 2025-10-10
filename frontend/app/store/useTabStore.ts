import { create } from 'zustand';

export type KnownTabType = 'dashboard' | 'library' | 'paper' | 'checklist' | 'settings';
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
  isLoading: boolean;
  loadingTabId: string | null;
  
  addTab: (tab: Tab, activateImmediately?: boolean) => void; // ✅ 添加可选参数
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

  // ✅ 修改 addTab 方法
  addTab: (tab, activateImmediately = true) => {
    const { tabs } = get();
    const existingTab = tabs.find(t => t.id === tab.id);
    
    if (existingTab) {
      // 如果tab已存在，根据参数决定是否激活
      if (activateImmediately) {
        set({ activeTabId: tab.id });
      }
    } else {
      // 添加新tab，根据参数决定是否激活
      set({ 
        tabs: [...tabs, tab],
        activeTabId: activateImmediately ? tab.id : get().activeTabId
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