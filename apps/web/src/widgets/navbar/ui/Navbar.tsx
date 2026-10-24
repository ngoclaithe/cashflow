import React from 'react';
import {
  Wallet,
  LayoutDashboard,
  Calendar,
  Receipt,
  PieChart,
  Target,
  RefreshCw,
  LogOut,
  LogIn,
  Sparkles,
  Tags,
  BarChart3,
} from 'lucide-react';
import { User } from '../../../shared/types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onSync: () => void;
  isSyncing: boolean;
  totalBalance?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenAuth,
  onLogout,
  onSync,
  isSyncing,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Báo cáo', icon: BarChart3 },
    { id: 'transactions', label: 'Giao dịch', icon: Receipt },
    { id: 'budgets', label: 'Ngân sách', icon: PieChart },
    { id: 'analytics', label: 'Dự báo AI', icon: Sparkles },
    { id: 'categories', label: 'Danh mục', icon: Tags },
    { id: 'savings', label: 'Mục tiêu', icon: Target },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          padding: '10px 16px',
          paddingTop: 'calc(10px + var(--safe-top))',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Brand */}
          <div
            onClick={() => setActiveTab('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 8px rgba(79, 70, 229, 0.25)',
              }}
            >
              <Wallet size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Cashflow<span style={{ color: '#059669' }}>.</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <nav
            className="desktop-nav"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-input)',
              padding: '3px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              gap: '2px',
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 2px 8px rgba(79, 70, 229, 0.25)' : 'none',
                  }}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user ? (
              <>
                <button
                  onClick={onSync}
                  disabled={isSyncing}
                  className="btn btn-secondary btn-sm"
                  title="Đồng bộ SePay MB Bank"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                  }}
                >
                  <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
                  <span className="sync-btn-text">{isSyncing ? 'Đang sync...' : 'Sync SePay'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#059669',
                      }}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name ? user.name.split(' ')[0] : 'Admin'}</span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="btn btn-secondary btn-sm"
                    title="Đăng xuất"
                    style={{ padding: '6px 8px' }}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px' }}
              >
                <LogIn size={14} />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* iOS Mobile Bottom Navigation Bar (Visible only on mobile screen) */}
      <nav className="mobile-tab-bar" aria-label="Mobile Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`tab-bar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.7} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
