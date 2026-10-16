import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Flame,
  Info,
  DollarSign,
  PieChart as PieChartIcon,
  HelpCircle,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Sliders,
  MessageSquare,
  Home,
  Gift,
  Zap,
  Tag,
  CreditCard,
  BarChart3,
  Layers,
  Check,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../../shared/api/client';
import { formatVND, formatDateOnly } from '../../../shared/lib/format';

interface UpcomingItem {
  id: string;
  name: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  dueDate: string;
  enabled: boolean;
  category?: string;
  isQuickPreset?: boolean;
}

interface CategoryReportItem {
  id: string;
  name: string;
  color: string;
  icon?: string;
  spent: number;
  percentOfTotal: number;
  txCount: number;
  dailyAverage: number;
  budgetAmount: number;
  remainingBudget: number | null;
  percentOfBudget: number;
  status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET';
}

interface AnalyticsPageProps {
  onNavigate?: (tab: string) => void;
  refreshKey?: number;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onNavigate, refreshKey }) => {
  // Navigation inside Analytics tab: Forecast vs Category Budget Report
  const [activeMainTab, setActiveMainTab] = useState<'forecast' | 'report'>('forecast');

  // Config & Form State
  const [initialLoading, setInitialLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [expectedIncome, setExpectedIncome] = useState<number>(20300000);
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([]);

  // Custom new item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState<number | ''>('');
  const [newItemDate, setNewItemDate] = useState('');
  const [newItemType, setNewItemType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Analysis result state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [activeScenario, setActiveScenario] = useState<'baseline' | 'optimized' | 'conservative'>('baseline');
  const [error, setError] = useState<string | null>(null);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

  // 1. Load initial config from database without calling Gemini AI
  const loadConfig = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const cfg = await api.getAnalyticsConfig();
      if (cfg) {
        setAccountInfo(cfg.account);
        setStartDate(cfg.defaults.startDate);
        setEndDate(cfg.defaults.endDate);
        setTargetDate(cfg.defaults.targetDate);
        setExpectedIncome(cfg.defaults.expectedIncome);
        setUpcomingItems(cfg.suggestedUpcomingItems || []);
      }
    } catch (err: any) {
      console.error('Error loading analytics config:', err);
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      setStartDate(todayStr);
      setEndDate(todayStr);
      setTargetDate(todayStr);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [refreshKey]);

  // 2. Trigger analysis with user-configured parameters
  const handleRunAnalysis = async () => {
    if (!startDate || !endDate || !targetDate) {
      setError('Vui lòng chọn đầy đủ ngày bắt đầu, ngày kết thúc và ngày mục tiêu dự báo.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const payload = {
        startDate,
        endDate,
        targetDate,
        expectedIncome: Number(expectedIncome) || 0,
        customQuestion: customQuestion.trim() || undefined,
        upcomingItems,
      };

      const res = await api.runAnalytics(payload);
      if (res) {
        setData(res);
        setIsSettingsExpanded(false);
      }
    } catch (err: any) {
      console.error('Error running analytics:', err);
      setError(err.message || 'Không thể tạo báo cáo phân tích AI. Vui lòng thử lại.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle enable/disable upcoming item
  const toggleUpcomingItem = (id: string) => {
    setUpcomingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
    );
  };

  // Switch rent due date between Day 5 and Day 7
  const setRentDay = (day: 5 | 7) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    setUpcomingItems((prev) =>
      prev.map((item) => {
        const isRent =
          item.name.toLowerCase().includes('nhà') || item.name.toLowerCase().includes('phòng');
        if (isRent) {
          const parts = item.dueDate.split('-');
          if (parts.length === 3) {
            const newDate = `${parts[0]}-${parts[1]}-${pad(day)}`;
            return { ...item, dueDate: newDate, enabled: true };
          }
        }
        return item;
      }),
    );
  };

  // Delete upcoming item
  const deleteUpcomingItem = (id: string) => {
    setUpcomingItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Add custom item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemAmount || !newItemDate) {
      return;
    }

    const newItem: UpcomingItem = {
      id: `custom_${Date.now()}`,
      name: newItemName.trim(),
      amount: Number(newItemAmount),
      type: newItemType,
      dueDate: newItemDate,
      enabled: true,
      isQuickPreset: false,
    };

    setUpcomingItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemAmount('');
    setNewItemDate('');
    setShowAddModal(false);
  };

  // Quick Preset Adders
  const addQuickPreset = (type: 'gift_20_10' | 'utility_bills') => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const nextMonth = now.getDate() >= 10 ? currentMonth + 1 : currentMonth;

    if (type === 'gift_20_10') {
      const exists = upcomingItems.find((i) => i.id === 'gift_20_10');
      if (exists) {
        setUpcomingItems((prev) =>
          prev.map((i) => (i.id === 'gift_20_10' ? { ...i, enabled: true } : i)),
        );
      } else {
        setUpcomingItems((prev) => [
          ...prev,
          {
            id: 'gift_20_10',
            name: '🎁 Tiền quà 20/10 Phụ Nữ Việt Nam',
            amount: 1000000,
            type: 'EXPENSE',
            dueDate: `${currentYear}-10-20`,
            enabled: true,
            isQuickPreset: true,
          },
        ]);
      }
    } else if (type === 'utility_bills') {
      const exists = upcomingItems.find((i) => i.id === 'utility_bills');
      if (exists) {
        setUpcomingItems((prev) =>
          prev.map((i) => (i.id === 'utility_bills' ? { ...i, enabled: true } : i)),
        );
      } else {
        setUpcomingItems((prev) => [
          ...prev,
          {
            id: 'utility_bills',
            name: '⚡ Hóa đơn Điện / Nước / Mạng',
            amount: 1200000,
            type: 'EXPENSE',
            dueDate: `${currentYear}-${pad(nextMonth + 1)}-02`,
            enabled: true,
            isQuickPreset: true,
          },
        ]);
      }
    }
  };

  // Date Presets
  const setRangePreset = (type: 'since_10th' | 'last_7_days' | 'this_month' | 'last_30_days') => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const endStr = toIso(now);
    setEndDate(endStr);

    if (type === 'since_10th') {
      const startD = new Date(now.getFullYear(), now.getMonth(), 10);
      setStartDate(toIso(startD));
    } else if (type === 'last_7_days') {
      const startD = new Date(now);
      startD.setDate(startD.getDate() - 7);
      setStartDate(toIso(startD));
    } else if (type === 'this_month') {
      const startD = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toIso(startD));
    } else if (type === 'last_30_days') {
      const startD = new Date(now);
      startD.setDate(startD.getDate() - 30);
      setStartDate(toIso(startD));
    }
  };

  const setTargetPreset = (type: 'next_10th' | 'next_5th' | 'next_7th' | 'end_of_month') => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === 'next_10th') {
      const nextMonth = now.getDate() >= 10 ? now.getMonth() + 1 : now.getMonth();
      const targetD = new Date(now.getFullYear(), nextMonth, 10);
      setTargetDate(toIso(targetD));
    } else if (type === 'next_5th') {
      const nextMonth = now.getDate() >= 5 ? now.getMonth() + 1 : now.getMonth();
      const targetD = new Date(now.getFullYear(), nextMonth, 5);
      setTargetDate(toIso(targetD));
    } else if (type === 'next_7th') {
      const nextMonth = now.getDate() >= 7 ? now.getMonth() + 1 : now.getMonth();
      const targetD = new Date(now.getFullYear(), nextMonth, 7);
      setTargetDate(toIso(targetD));
    } else if (type === 'end_of_month') {
      const targetD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setTargetDate(toIso(targetD));
    }
  };

  // Find user's rent item
  const rentItem = upcomingItems.find(
    (i) => i.name.toLowerCase().includes('nhà') || i.name.toLowerCase().includes('phòng'),
  );
  const rentDueDay = rentItem ? new Date(rentItem.dueDate).getDate() : 5;

  // Calculate live upcoming totals before targetDate
  const targetDateObj = targetDate ? new Date(targetDate) : null;
  if (targetDateObj) targetDateObj.setHours(23, 59, 59, 999);

  const activeUpcomingExpenses = upcomingItems
    .filter(
      (i) => i.enabled && i.type === 'EXPENSE' && (!targetDateObj || new Date(i.dueDate) <= targetDateObj),
    )
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const activeUpcomingIncomes = upcomingItems
    .filter(
      (i) => i.enabled && i.type === 'INCOME' && (!targetDateObj || new Date(i.dueDate) <= targetDateObj),
    )
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '14px' }}>
        <RefreshCw size={32} className="spin" color="var(--primary)" />
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Đang tải dữ liệu ngân sách & tài khoản...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* 1. Header Card */}
      <div
        className="glass-card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(147, 51, 234, 0.05) 50%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid rgba(79, 70, 229, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
            }}
          >
            <Sparkles size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Báo cáo Hạng mục & Dự báo Dòng tiền AI
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(79, 70, 229, 0.12)',
                  color: '#4f46e5',
                  border: '1px solid rgba(79, 70, 229, 0.25)',
                }}
              >
                Gemini 3.6 / 3.8 Flash
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Báo cáo thực chi so với Ngân sách đã lập & Dự báo số dư chính xác
            </div>
          </div>
        </div>

        {accountInfo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Wallet size={18} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {accountInfo.displayName} ({accountInfo.accountNumber})
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatVND(accountInfo.balance)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Interactive Parameter Configuration Panel */}
      <div className="glass-card" style={{ padding: '22px', border: '1px solid rgba(79, 70, 229, 0.25)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isSettingsExpanded ? '18px' : '0',
            cursor: 'pointer',
          }}
          onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Bộ Tham Số Phân Tích & Các Khoản Sắp Tới
            </h3>
            {data && !isSettingsExpanded && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                (Từ {formatDateOnly(startDate)} đến {formatDateOnly(endDate)} → Dự báo đến {formatDateOnly(targetDate)})
              </span>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isSettingsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{isSettingsExpanded ? 'Thu gọn thiết lập' : 'Mở rộng / Đổi tham số'}</span>
          </button>
        </div>

        {isSettingsExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Grid 1: Dates & Expected Income */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {/* Range Analysis */}
              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="var(--primary)" />
                  <span>1. Kỳ báo cáo & phân tích (Lịch sử)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Từ ngày</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Đến ngày</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setRangePreset('since_10th')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Từ mùng 10 đến nay
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangePreset('last_7_days')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    7 ngày qua
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangePreset('this_month')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Tháng này
                  </button>
                </div>
              </div>

              {/* Target Forecast Date */}
              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={15} color="#059669" />
                  <span>2. Ngày mục tiêu dự báo số dư</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Dự báo số dư đến ngày</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setTargetPreset('next_10th')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Mùng 10 tháng sau (Lương)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetPreset('next_5th')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Mùng 5 (Hạn tiền nhà)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetPreset('next_7th')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Mùng 7 (Hạn tiền nhà)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetPreset('end_of_month')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Cuối tháng
                  </button>
                </div>
              </div>

              {/* Expected Income */}
              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={15} color="#059669" />
                  <span>3. Thu nhập dự kiến (Lương công ty)</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Số tiền VND nhận thêm trước ngày mục tiêu</label>
                  <input
                    type="number"
                    value={expectedIncome}
                    onChange={(e) => setExpectedIncome(Number(e.target.value))}
                    className="form-input"
                    style={{ width: '100%', fontSize: '13px', padding: '6px 8px', fontWeight: 600 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setExpectedIncome(20300000)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Lương chuẩn DB: 20.300.000 đ
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpectedIncome(0)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    0 đ
                  </button>
                </div>
              </div>
            </div>

            {/* Section 4: Upcoming Planned Items (Khoản dự kiến sắp tới - 1 khoản tiền nhà duy nhất + tùy chọn ngày 5 hoặc 7, quà 20/10...) */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.03) 0%, rgba(245, 158, 11, 0.03) 100%)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid rgba(79, 70, 229, 0.15)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Home size={16} color="var(--primary)" />
                    <span>4. Các khoản cam kết & dự kiến sắp tới</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Đã tự động lấy đúng từ Ngân sách / Định kỳ của bạn (Không bị trùng lặp).
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-expense" style={{ fontSize: '12px', padding: '4px 10px' }}>
                    Tổng chi sắp tới: {formatVND(activeUpcomingExpenses)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} />
                    <span>Thêm khoản mới</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons for Special Milestones & Rent Day selection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {rentItem && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(79, 70, 229, 0.08)', padding: '3px 8px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>Hạn tiền nhà:</span>
                    <button
                      type="button"
                      onClick={() => setRentDay(5)}
                      className="btn btn-sm"
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        background: rentDueDay === 5 ? 'var(--primary)' : 'transparent',
                        color: rentDueDay === 5 ? '#fff' : 'var(--text-primary)',
                      }}
                    >
                      Mùng 5
                    </button>
                    <button
                      type="button"
                      onClick={() => setRentDay(7)}
                      className="btn btn-sm"
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        background: rentDueDay === 7 ? 'var(--primary)' : 'transparent',
                        color: rentDueDay === 7 ? '#fff' : 'var(--text-primary)',
                      }}
                    >
                      Mùng 7
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => addQuickPreset('gift_20_10')}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '11px',
                    padding: '3px 9px',
                    borderColor: upcomingItems.some((i) => i.id === 'gift_20_10' && i.enabled) ? '#ec4899' : 'var(--border-subtle)',
                    background: upcomingItems.some((i) => i.id === 'gift_20_10' && i.enabled) ? 'rgba(236, 72, 153, 0.08)' : undefined,
                  }}
                >
                  🎁 Thêm Quà 20/10 (1tr)
                </button>

                <button
                  type="button"
                  onClick={() => addQuickPreset('utility_bills')}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '11px',
                    padding: '3px 9px',
                    borderColor: upcomingItems.some((i) => i.id === 'utility_bills' && i.enabled) ? '#f59e0b' : 'var(--border-subtle)',
                    background: upcomingItems.some((i) => i.id === 'utility_bills' && i.enabled) ? 'rgba(245, 158, 11, 0.08)' : undefined,
                  }}
                >
                  ⚡ Hóa đơn Điện/Nước/Mạng
                </button>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcomingItems.map((item) => {
                  const isBeyondTarget = targetDateObj && new Date(item.dueDate) > targetDateObj;
                  const isRent =
                    item.name.toLowerCase().includes('nhà') || item.name.toLowerCase().includes('phòng');
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: item.enabled ? '#fff' : 'rgba(241, 245, 249, 0.6)',
                        border: `1px solid ${item.enabled ? 'rgba(79, 70, 229, 0.25)' : 'var(--border-subtle)'}`,
                        opacity: item.enabled ? 1 : 0.6,
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: '220px' }}
                        onClick={() => toggleUpcomingItem(item.id)}
                      >
                        {item.enabled ? (
                          <CheckSquare size={18} color="var(--primary)" />
                        ) : (
                          <Square size={18} color="var(--text-muted)" />
                        )}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: item.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Hạn đến: {formatDateOnly(item.dueDate)}</span>
                            {isBeyondTarget && (
                              <span style={{ color: '#d97706', fontWeight: 600 }}>
                                (Sau ngày mục tiêu {formatDateOnly(targetDate)} - không tính vào kỳ này)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isRent && (
                          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '2px 4px', borderRadius: '6px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRentDay(5);
                              }}
                              className="btn btn-sm"
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                background: new Date(item.dueDate).getDate() === 5 ? 'var(--primary)' : 'transparent',
                                color: new Date(item.dueDate).getDate() === 5 ? '#fff' : 'var(--text-secondary)',
                              }}
                            >
                              Mùng 5
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRentDay(7);
                              }}
                              className="btn btn-sm"
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                background: new Date(item.dueDate).getDate() === 7 ? 'var(--primary)' : 'transparent',
                                color: new Date(item.dueDate).getDate() === 7 ? '#fff' : 'var(--text-secondary)',
                              }}
                            >
                              Mùng 7
                            </button>
                          </div>
                        )}

                        <span
                          className={item.type === 'INCOME' ? 'badge badge-income' : 'badge badge-expense'}
                          style={{ fontWeight: 700, fontSize: '12px' }}
                        >
                          {item.type === 'INCOME' ? '+' : '-'}{formatVND(item.amount)}
                        </span>

                        <button
                          type="button"
                          onClick={() => deleteUpcomingItem(item.id)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                          title="Xóa khoản này"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 5: Custom Prompt / Question for Gemini AI */}
            <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={15} color="var(--primary)" />
                <span>5. Câu hỏi riêng cho Gemini AI (Tùy chọn)</span>
              </div>
              <textarea
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="Ví dụ: Liệu tôi có đủ tiền trả tiền nhà và mua quà 20/10 không? Mỗi ngày còn dư bao nhiêu tiền tiêu?"
                className="form-input"
                rows={2}
                style={{ width: '100%', fontSize: '13px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setCustomQuestion('Tôi có đủ tiền trả tiền nhà và quà 20/10 mà vẫn đủ chi tiêu sinh hoạt không?')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  💡 Đủ tiền trả tiền nhà & quà 20/10 không?
                </button>
                <button
                  type="button"
                  onClick={() => setCustomQuestion('Hạn mức ăn uống và tiêu vặt an toàn mỗi ngày của tôi là bao nhiêu?')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  💡 Hạn mức ăn tiêu an toàn mỗi ngày?
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--expense-bg)',
                  border: '1px solid rgba(225, 29, 72, 0.25)',
                  color: 'var(--expense)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Main Action Button */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '6px' }}>
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="btn btn-primary"
                style={{
                  fontSize: '15px',
                  padding: '12px 28px',
                  borderRadius: '12px',
                  minWidth: '280px',
                  boxShadow: '0 4px 16px rgba(79, 70, 229, 0.35)',
                }}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    <span>Gemini AI đang phân tích dòng tiền & lập báo cáo...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>{data ? 'Cập nhật Báo cáo & Dự báo AI' : 'Chạy Phân Tích & Lập Báo Cáo'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Add Custom Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '90%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)' }}>
              Thêm khoản dự kiến sắp tới
            </h3>
            <form onSubmit={handleAddCustomItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">Tên khoản chi/thu</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Quà 20/10, Đóng học, Tiệc cưới..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Loại</label>
                  <select
                    value={newItemType}
                    onChange={(e: any) => setNewItemType(e.target.value)}
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    <option value="EXPENSE">Khoản chi (-)</option>
                    <option value="INCOME">Khoản thu (+)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Số tiền (VND)</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 1000000"
                    value={newItemAmount}
                    onChange={(e) => setNewItemAmount(e.target.value ? Number(e.target.value) : '')}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Ngày đến hạn</label>
                <input
                  type="date"
                  required
                  value={newItemDate}
                  onChange={(e) => setNewItemDate(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Thêm khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Display Loading State when analysis is running */}
      {isAnalyzing && (
        <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
          <div style={{ display: 'inline-block', position: 'relative', marginBottom: '14px' }}>
            <RefreshCw size={36} className="spin" color="var(--primary)" />
            <Sparkles size={18} color="#f59e0b" style={{ position: 'absolute', top: -4, right: -4 }} />
          </div>
          <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Đang gọi Gemini AI phân tích dòng tiền & đối chiếu ngân sách...
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto' }}>
            Đang tính toán mức độ thực hiện ngân sách của từng hạng mục và lập 3 kịch bản số dư đến ngày {formatDateOnly(targetDate)}.
          </p>
        </div>
      )}

      {/* 5. Render Full Analytics & Report Results when Available */}
      {data && !isAnalyzing && (
        <>
          {/* Main View Switcher: Dự Báo Dòng Tiền AI vs Báo Cáo Hạng Mục & Ngân Sách */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'var(--bg-input)',
              padding: '4px',
              borderRadius: '12px',
              maxWidth: '520px',
              margin: '0 auto',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMainTab('forecast')}
              className="btn"
              style={{
                flex: 1,
                fontSize: '13px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: activeMainTab === 'forecast' ? '#fff' : 'transparent',
                color: activeMainTab === 'forecast' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeMainTab === 'forecast' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Sparkles size={16} />
              <span>Dự Báo Dòng Tiền AI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('report')}
              className="btn"
              style={{
                flex: 1,
                fontSize: '13px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: activeMainTab === 'report' ? '#fff' : 'transparent',
                color: activeMainTab === 'report' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeMainTab === 'report' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <BarChart3 size={16} />
              <span>Báo Cáo Hạng Mục & Ngân Sách</span>
            </button>
          </div>

          {/* VIEW 1: DỰ BÁO DÒNG TIỀN AI */}
          {activeMainTab === 'forecast' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* AI Summary Card */}
              <div
                className="glass-card"
                style={{
                  padding: '24px',
                  border:
                    data.aiAnalysis.verdict === 'AN_TOAN'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : data.aiAnalysis.verdict === 'CAN_CHU_Y'
                      ? '1px solid rgba(245, 158, 11, 0.3)'
                      : '1px solid rgba(239, 68, 68, 0.3)',
                  background:
                    data.aiAnalysis.verdict === 'AN_TOAN'
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(255, 255, 255, 0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(255, 255, 255, 0.95) 100%)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 800,
                        background:
                          data.aiAnalysis.verdict === 'AN_TOAN'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : data.aiAnalysis.verdict === 'CAN_CHU_Y'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          data.aiAnalysis.verdict === 'AN_TOAN'
                            ? '#059669'
                            : data.aiAnalysis.verdict === 'CAN_CHU_Y'
                            ? '#d97706'
                            : '#dc2626',
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>
                        {data.aiAnalysis.verdict === 'AN_TOAN'
                          ? 'DÒNG TIỀN AN TOÀN'
                          : data.aiAnalysis.verdict === 'CAN_CHU_Y'
                          ? 'CẦN KIỂM SOÁT CHI TIÊU'
                          : 'NGUY CƠ THÂM HỤT SỐ DƯ'}
                      </span>
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Model: {data.aiAnalysis.modelUsed}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Thời gian lập: {new Date(data.aiAnalysis.generatedAt).toLocaleTimeString('vi-VN')} {new Date(data.aiAnalysis.generatedAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>

                <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--text-primary)', fontWeight: 600, marginBottom: '12px' }}>
                  {data.aiAnalysis.summary}
                </p>

                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(79, 70, 229, 0.05)',
                    borderLeft: '4px solid #4f46e5',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <strong>Đánh giá số dư mục tiêu ({data.timeframe.targetDateFormatted}):</strong> {data.aiAnalysis.projectionAssessment}
                </div>

                {/* Custom Answer if user asked question */}
                {data.aiAnalysis.customAnswer && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(79, 70, 229, 0.05) 100%)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#d97706', marginBottom: '4px' }}>
                      <MessageSquare size={15} />
                      <span>Giải đáp câu hỏi của bạn: "{data.customQuestion}"</span>
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {data.aiAnalysis.customAnswer}
                    </div>
                  </div>
                )}
              </div>

              {/* Key Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wallet size={15} color="var(--primary)" />
                    <span>Số dư hiện tại</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {formatVND(data.account.balance)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tài khoản MB Bank chính
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Flame size={15} color="#e11d48" />
                    <span>Tiêu hao ròng thực tế</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#e11d48', marginTop: '4px' }}>
                    {formatVND(data.stats.dailyNetBurnAvg)} / ngày
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Thâm hụt: {formatVND(data.stats.netBurn)} ({data.timeframe.analysisDays} ngày)
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Home size={15} color="#d97706" />
                    <span>Chi sắp tới đã chọn</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                    {formatVND(data.upcoming?.totalExpenses || 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tiền nhà, quà 20/10, hóa đơn...
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={15} color="#059669" />
                    <span>Hạn mức ăn tiêu an toàn</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                    {formatVND(data.stats.safeDailySpendingAllowance)} / ngày
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Sau khi đã trừ tiền các khoản sắp tới
                  </div>
                </div>
              </div>

              {/* 3 Projection Scenarios Cards */}
              <div className="glass-card" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      3 Kịch Bản Số Dư Dự Báo Đến Ngày {data.timeframe.targetDateFormatted}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Trong {data.timeframe.forecastDays} ngày tới (đã trừ {formatVND(data.upcoming?.totalExpenses || 0)} các khoản dự kiến)
                    </div>
                  </div>

                  <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: '10px', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveScenario('baseline')}
                      className="btn btn-sm"
                      style={{
                        background: activeScenario === 'baseline' ? '#fff' : 'transparent',
                        color: activeScenario === 'baseline' ? 'var(--primary)' : 'var(--text-secondary)',
                        boxShadow: activeScenario === 'baseline' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      Cơ sở (Thực tế)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveScenario('optimized')}
                      className="btn btn-sm"
                      style={{
                        background: activeScenario === 'optimized' ? '#fff' : 'transparent',
                        color: activeScenario === 'optimized' ? '#059669' : 'var(--text-secondary)',
                        boxShadow: activeScenario === 'optimized' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      Tối ưu (Tiết kiệm)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveScenario('conservative')}
                      className="btn btn-sm"
                      style={{
                        background: activeScenario === 'conservative' ? '#fff' : 'transparent',
                        color: activeScenario === 'conservative' ? '#d97706' : 'var(--text-secondary)',
                        boxShadow: activeScenario === 'conservative' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      Thận trọng (Chi nhiều)
                    </button>
                  </div>
                </div>

                {(() => {
                  const cur = data.projections[activeScenario];
                  return (
                    <div
                      style={{
                        padding: '20px',
                        borderRadius: '14px',
                        background:
                          activeScenario === 'baseline'
                            ? 'rgba(79, 70, 229, 0.04)'
                            : activeScenario === 'optimized'
                            ? 'rgba(5, 150, 105, 0.04)'
                            : 'rgba(217, 119, 6, 0.04)',
                        border: `1px solid ${
                          activeScenario === 'baseline'
                            ? 'rgba(79, 70, 229, 0.2)'
                            : activeScenario === 'optimized'
                            ? 'rgba(5, 150, 105, 0.2)'
                            : 'rgba(217, 119, 6, 0.2)'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            {cur.label}
                          </h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                            {cur.description}
                          </p>
                        </div>
                        <span
                          className={
                            cur.status === 'EXCELLENT'
                              ? 'badge badge-income'
                              : cur.status === 'SAFE'
                              ? 'badge badge-income'
                              : cur.status === 'WARNING'
                              ? 'badge badge-warning'
                              : 'badge badge-expense'
                          }
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          {cur.status === 'EXCELLENT'
                            ? 'RẤT TỐT'
                            : cur.status === 'SAFE'
                            ? 'AN TOÀN'
                            : cur.status === 'WARNING'
                            ? 'CẢNH BÁO'
                            : 'NGUY CƠ'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '14px' }}>
                        <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Số dư ban đầu</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {formatVND(data.account.balance)}
                          </div>
                        </div>

                        <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '11px', color: '#e11d48' }}>(-) Chi sinh hoạt {data.timeframe.forecastDays} ngày</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#e11d48', marginTop: '2px' }}>
                            -{formatVND(cur.regularProjectedExpense)}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>~{formatVND(cur.dailyBurn)}/ngày</div>
                        </div>

                        <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '11px', color: '#d97706' }}>(-) Các khoản dự kiến sắp tới</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                            -{formatVND(cur.upcomingExpense)}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tiền nhà, quà 20/10...</div>
                        </div>

                        <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '2px solid rgba(79, 70, 229, 0.4)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>(=) Số dư trước lương</div>
                          <div style={{ fontSize: '17px', fontWeight: 900, color: cur.projectedBalanceBeforeSalary >= 0 ? 'var(--primary)' : '#e11d48', marginTop: '2px' }}>
                            {cur.projectedBalanceBeforeSalaryFormatted}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Trước ngày nhận lương</div>
                        </div>

                        <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>(+) Sau nhận lương</div>
                          <div style={{ fontSize: '17px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                            {cur.projectedBalanceAfterSalaryFormatted}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Đã cộng {formatVND(data.expectedIncome)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* AI Key Observations & Recommendations */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <div className="glass-card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingDown size={16} color="var(--primary)" />
                    <span>Nhận Xét Trọng Yếu Của AI</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.aiAnalysis.keyObservations?.map((obs: string, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          fontSize: '13px',
                          lineHeight: 1.5,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'rgba(79, 70, 229, 0.1)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span>{obs}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="#059669" />
                    <span>Khuyến Nghị Hành Động Thiết Thực</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.aiAnalysis.recommendations?.map((rec: string, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          fontSize: '13px',
                          lineHeight: 1.5,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: BÁO CÁO HẠNG MỤC THU CHI & NGÂN SÁCH (CATEGORY BUDGET REPORT) */}
          {activeMainTab === 'report' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Budget Performance Summary Banner */}
              {data.budgetSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Tổng ngân sách đã lập</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                      {formatVND(data.budgetSummary.totalBudget)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Hạn mức các danh mục đã cài đặt
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Đã chi trong các hạng mục</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {formatVND(data.budgetSummary.totalSpentInBudgeted)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Tỷ lệ dùng: {data.budgetSummary.budgetUtilizationPercent}%
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Trong ngân sách an toàn</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                      {data.budgetSummary.categoriesSafe} hạng mục
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Chi tiêu dưới 80% hạn mức
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Vượt / Sắp chạm trần</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: data.budgetSummary.categoriesOverBudget > 0 ? '#e11d48' : '#d97706', marginTop: '4px' }}>
                      {data.budgetSummary.categoriesOverBudget} vượt / {data.budgetSummary.categoriesNearLimit} cận
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Cần thắt chặt chi tiêu
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Category Table */}
              <div className="glass-card" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Chi Tiết Báo Cáo Từng Hạng Mục (Từ {data.timeframe.startDateFormatted} đến {data.timeframe.endDateFormatted})
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Đối chiếu trực tiếp chi tiêu thực tế với Hạn mức Ngân sách đã thiết lập trong hệ thống
                    </p>
                  </div>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('budgets')}
                      className="btn btn-secondary btn-sm"
                    >
                      <span>Cài đặt lại ngân sách</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.categoryReport?.map((cat: CategoryReportItem) => {
                    const hasBudget = cat.budgetAmount > 0;
                    return (
                      <div
                        key={cat.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: 'var(--bg-main)',
                          border: `1px solid ${
                            cat.status === 'OVER_BUDGET'
                              ? 'rgba(225, 29, 72, 0.3)'
                              : cat.status === 'NEAR_LIMIT'
                              ? 'rgba(217, 119, 6, 0.3)'
                              : 'var(--border-subtle)'
                          }`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: cat.color || 'var(--primary)',
                              }}
                            />
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {cat.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {cat.txCount} giao dịch • Bình quân {formatVND(cat.dailyAverage)}/ngày
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {formatVND(cat.spent)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {cat.percentOfTotal}% tổng chi trong kỳ
                            </div>
                          </div>
                        </div>

                        {/* Budget Bar & Status */}
                        {hasBudget ? (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Ngân sách: {formatVND(cat.budgetAmount)} (Còn lại: {formatVND(cat.remainingBudget || 0)})
                              </span>
                              <span
                                className={
                                  cat.status === 'OVER_BUDGET'
                                    ? 'badge badge-expense'
                                    : cat.status === 'NEAR_LIMIT'
                                    ? 'badge badge-warning'
                                    : 'badge badge-income'
                                }
                              >
                                {cat.status === 'OVER_BUDGET'
                                  ? `VƯỢT ${cat.percentOfBudget}%`
                                  : cat.status === 'NEAR_LIMIT'
                                  ? `CẬN TRẦN ${cat.percentOfBudget}%`
                                  : `ĐÃ DÙNG ${cat.percentOfBudget}%`}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, cat.percentOfBudget)}%`,
                                  height: '100%',
                                  background:
                                    cat.status === 'OVER_BUDGET'
                                      ? '#e11d48'
                                      : cat.status === 'NEAR_LIMIT'
                                      ? '#d97706'
                                      : '#059669',
                                  borderRadius: '4px',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Info size={13} />
                            <span>Chưa đặt hạn mức ngân sách tháng cho hạng mục này</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
