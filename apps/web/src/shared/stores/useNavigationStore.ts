import { useSyncExternalStore } from 'react';

export type NavigationTab = 'dashboard' | 'transactions' | 'calendar' | 'analytics' | 'budgets' | 'savings' | 'categories';

export const VALID_TABS: readonly NavigationTab[] = [
  'dashboard',
  'transactions',
  'calendar',
  'analytics',
  'budgets',
  'savings',
  'categories',
] as const;

const STORAGE_KEY = 'cashflow_active_tab';

export const getInitialTab = (): NavigationTab => {
  try {
    if (typeof window === 'undefined') return 'dashboard';

    // 1. Priority 1: URL Query Param (?tab=...)
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as NavigationTab;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      try {
        localStorage.setItem(STORAGE_KEY, tabParam);
      } catch {}
      return tabParam;
    }

    // 2. Priority 2: localStorage fallback
    const savedTab = localStorage.getItem(STORAGE_KEY) as NavigationTab;
    if (savedTab && VALID_TABS.includes(savedTab)) {
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

let currentTab: NavigationTab = getInitialTab();
const listeners = new Set<() => void>();

const syncToBrowser = (tab: NavigationTab, pushHistory = true) => {
  try {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEY, tab);
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

const notify = () => {
  listeners.forEach((listener) => listener());
};

const setActiveTab = (tab: NavigationTab | string, pushHistory = true) => {
  const validTab = VALID_TABS.includes(tab as NavigationTab) ? (tab as NavigationTab) : 'dashboard';
  if (currentTab === validTab) {
    syncToBrowser(validTab, false);
    return;
  }
  currentTab = validTab;
  syncToBrowser(validTab, pushHistory);
  notify();
};

const syncWithUrl = () => {
  const fromBrowser = getInitialTab();
  if (currentTab !== fromBrowser) {
    currentTab = fromBrowser;
    notify();
  }
};

interface NavigationStoreHook {
  (): {
    activeTab: NavigationTab;
    setActiveTab: (tab: NavigationTab | string, pushHistory?: boolean) => void;
    syncWithUrl: () => void;
  };
  getState: () => {
    activeTab: NavigationTab;
    setActiveTab: (tab: NavigationTab | string, pushHistory?: boolean) => void;
    syncWithUrl: () => void;
  };
}

export const useNavigationStore: NavigationStoreHook = (() => {
  const hook = () => {
    const activeTab = useSyncExternalStore(
      (callback) => {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      },
      () => currentTab,
      () => 'dashboard' as NavigationTab
    );

    return {
      activeTab,
      setActiveTab,
      syncWithUrl,
    };
  };

  hook.getState = () => ({
    activeTab: currentTab,
    setActiveTab,
    syncWithUrl,
  });

  return hook;
})();

// Listen for browser forward/backward navigation and cross-tab storage changes
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
