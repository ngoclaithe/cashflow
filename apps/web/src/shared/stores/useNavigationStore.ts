import { create } from 'zustand';

export type NavigationTab = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'savings' | 'calendar';

interface NavigationState {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab | string, pushHistory?: boolean) => void;
  syncWithUrl: () => void;
}

const VALID_TABS: NavigationTab[] = [
  'dashboard',
  'transactions',
  'categories',
  'budgets',
  'savings',
  'calendar',
];

const getTabFromUrl = (): NavigationTab => {
  try {
    if (typeof window === 'undefined') return 'dashboard';
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as NavigationTab;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      return tabParam;
    }
  } catch {
    // fallback
  }
  return 'dashboard';
};

export const useNavigationStore = create<NavigationState>((set, get) => {
  // Sync URL when tab changes
  const updateUrlParam = (tab: NavigationTab, pushHistory = true) => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (tab === 'dashboard') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tab);
      }

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
    activeTab: getTabFromUrl(),

    setActiveTab: (tab: NavigationTab | string, pushHistory = true) => {
      const validTab = VALID_TABS.includes(tab as NavigationTab) ? (tab as NavigationTab) : 'dashboard';
      if (get().activeTab === validTab) return;
      set({ activeTab: validTab });
      updateUrlParam(validTab, pushHistory);
    },

    syncWithUrl: () => {
      const tabFromUrl = getTabFromUrl();
      if (get().activeTab !== tabFromUrl) {
        set({ activeTab: tabFromUrl });
      }
    },
  };
});

// Setup popstate listener to handle browser back / forward navigation
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    useNavigationStore.getState().syncWithUrl();
  });
}
