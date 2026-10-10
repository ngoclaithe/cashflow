import { create } from 'zustand';

export type NavigationTab = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'savings' | 'calendar';

export const VALID_TABS: readonly NavigationTab[] = [
  'dashboard',
  'transactions',
  'categories',
  'budgets',
  'savings',
  'calendar',
] as const;

const STORAGE_KEY = 'cashflow_active_tab';

export const getInitialTab = (): NavigationTab => {
  try {
    if (typeof window === 'undefined') return 'dashboard';

    // 1. Highest priority: URL Query Param (?tab=...)
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as NavigationTab;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      try {
        localStorage.setItem(STORAGE_KEY, tabParam);
      } catch {}
      return tabParam;
    }

    // 2. Secondary priority: localStorage
    const savedTab = localStorage.getItem(STORAGE_KEY) as NavigationTab;
    if (savedTab && VALID_TABS.includes(savedTab)) {
      // Sync URL address bar immediately so F5 or bookmark retains it
      const url = new URL(window.location.href);
      url.searchParams.set('tab', savedTab);
      window.history.replaceState({ tab: savedTab }, '', url.toString());
      return savedTab;
    }
  } catch {
    // fallback
  }
  return 'dashboard';
};

interface NavigationState {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab | string, pushHistory?: boolean) => void;
  syncWithUrl: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => {
  const syncToBrowser = (tab: NavigationTab, pushHistory = true) => {
    try {
      if (typeof window === 'undefined') return;

      // 1. Persist to localStorage
      localStorage.setItem(STORAGE_KEY, tab);

      // 2. Persist to URL search params
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);

      if (pushHistory) {
        window.history.pushState({ tab }, '', url.toString());
      } else {
        window.history.replaceState({ tab }, '', url.toString());
      }
    } catch {
      // ignore
    }
  };

  return {
    activeTab: getInitialTab(),

    setActiveTab: (tab: NavigationTab | string, pushHistory = true) => {
      const validTab = VALID_TABS.includes(tab as NavigationTab) ? (tab as NavigationTab) : 'dashboard';
      if (get().activeTab === validTab) {
        // Ensure browser URL and localStorage are synced even if clicking active tab
        syncToBrowser(validTab, false);
        return;
      }
      set({ activeTab: validTab });
      syncToBrowser(validTab, pushHistory);
    },

    syncWithUrl: () => {
      const currentTab = getInitialTab();
      if (get().activeTab !== currentTab) {
        set({ activeTab: currentTab });
      }
    },
  };
});

// Setup popstate listener to handle browser back / forward navigation
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    useNavigationStore.getState().syncWithUrl();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      useNavigationStore.getState().syncWithUrl();
    }
  });
}
