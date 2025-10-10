'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChecklistTree, ChecklistNode } from '@/app/types/checklist';
import { fetchChecklistTree } from '@/app/lib/checklistApi';

interface ChecklistStoreState {
  checklists: ChecklistTree;
  expandedIds: Record<string, true>; // Set 的可序列化替代
  isTreeOpen: boolean;               // Sidebar 中“清单管理”展开/收起
  loading: boolean;
  lastLoadedAt?: number;

  loadChecklists: () => Promise<void>;
  setTreeOpen: (open: boolean) => void;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  replaceNode: (node: ChecklistNode) => void;
  removeNode: (id: string) => void;
}

export const useChecklistStore = create<ChecklistStoreState>()(
  persist(
    (set, get) => ({
      checklists: [],
      expandedIds: {},
      isTreeOpen: false,
      loading: false,
      lastLoadedAt: undefined,

      async loadChecklists() {
        set({ loading: true });
        try {
          const tree = await fetchChecklistTree();
          set({ checklists: tree, lastLoadedAt: Date.now() });
        } finally {
          set({ loading: false });
        }
      },

      setTreeOpen(open) {
        set({ isTreeOpen: open });
      },

      toggleExpand(id) {
        const map = { ...get().expandedIds };
        if (map[id]) delete map[id]; else map[id] = true;
        set({ expandedIds: map });
      },

      expandAll() {
        const { checklists } = get();
        const allIds: Record<string, true> = {};
        
        const collectIds = (nodes: ChecklistNode[]) => {
          nodes.forEach(node => {
            allIds[node.id] = true;
            if (node.children?.length) {
              collectIds(node.children);
            }
          });
        };
        
        collectIds(checklists);
        set({ expandedIds: allIds });
      },

      collapseAll() {
        set({ expandedIds: {} });
      },

      replaceNode(node) {
        const replace = (arr: ChecklistNode[]): ChecklistNode[] =>
          arr.map(n => {
            if (n.id === node.id) return node;
            if (n.children?.length) return { ...n, children: replace(n.children) };
            return n;
          });
        set({ checklists: replace(get().checklists) });
      },

      removeNode(id) {
        const remove = (arr: ChecklistNode[]): ChecklistNode[] =>
          arr.filter(n => n.id !== id).map(n =>
            n.children?.length ? { ...n, children: remove(n.children) } : n
          );
        set({ checklists: remove(get().checklists) });
      },
    }),
    {
      name: 'checklist-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        expandedIds: s.expandedIds,
        isTreeOpen: s.isTreeOpen,
        lastLoadedAt: s.lastLoadedAt,
      }),
    }
  )
);
