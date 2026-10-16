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
  Plus,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Sliders,
  MessageSquare,
  Home,
  BarChart3,
  Clock,
  RotateCcw,
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

interface AnalyticsPageProps {
  onNavigate?: (tab: string) => void;
  refreshKey?: number;
}

const STORAGE_PROMPT_KEY = 'cashflow_ai_forecast_prompt_v2';
const STORAGE_RESULT_KEY = 'cashflow_ai_forecast_result_v2';

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onNavigate, refreshKey }) => {
  // Config & Form State
  const [initialLoading, setInitialLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [expectedIncome, setExpectedIncome] = useState<number>(20300000);

  // Persistent prompt state: loaded from localStorage immediately
  const [customQuestion, setCustomQuestion] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_PROMPT_KEY) || '';
    } catch {
      return '';
    }
  });

  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([]);

  // Persistent Analysis Result State
  const [data, setData] = useState<any | null>(null);
  const [cachedTime, setCachedTime] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'baseline' | 'optimized' | 'conservative'>('baseline');
  const [error, setError] = useState<string | null>(null);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

  // Custom new item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState<number | ''>('');
  const [newItemDate, setNewItemDate] = useState('');
  const [newItemType, setNewItemType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Handle prompt change & persist to localStorage
  const handlePromptChange = (val: string) => {
    setCustomQuestion(val);
    try {
      localStorage.setItem(STORAGE_PROMPT_KEY, val);
    } catch (e) {
      console.warn('Failed to save prompt to localStorage', e);
    }
  };

  // 1. Load initial config from database without calling Gemini AI
  const loadConfigAndRestoreCache = async () => {
    setInitialLoading(true);
    setError(null);

    // Step A: Restore cached AI result if available
    try {
      const savedResult = localStorage.getItem(STORAGE_RESULT_KEY);
      if (savedResult) {
        const parsed = JSON.parse(savedResult);
        if (parsed && parsed.data) {
          setData(parsed.data);
          setCachedTime(parsed.timestamp || null);
          setIsSettingsExpanded(false); // Collapse settings to showcase cached forecast

          // Also restore dates if available
          if (parsed.params) {
            if (parsed.params.startDate) setStartDate(parsed.params.startDate);
            if (parsed.params.endDate) setEndDate(parsed.params.endDate);
            if (parsed.params.targetDate) setTargetDate(parsed.params.targetDate);
            if (parsed.params.expectedIncome !== undefined) setExpectedIncome(parsed.params.expectedIncome);
            if (parsed.params.upcomingItems) setUpcomingItems(parsed.params.upcomingItems);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read cached AI forecast', e);
    }

    // Step B: Load database config (account balance, real rent, salary)
    try {
      const cfg = await api.getAnalyticsConfig();
      if (cfg) {
        setAccountInfo(cfg.account);
        // Only set default form values if not already populated from cache
        setStartDate((prev) => prev || cfg.defaults.startDate);
        setEndDate((prev) => prev || cfg.defaults.endDate);
        setTargetDate((prev) => prev || cfg.defaults.targetDate);
        setExpectedIncome((prev) => (prev !== undefined && prev !== null ? prev : cfg.defaults.expectedIncome));
        setUpcomingItems((prev) => (prev && prev.length > 0 ? prev : cfg.suggestedUpcomingItems || []));
      }
    } catch (err: any) {
      console.error('Error loading analytics config:', err);
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      setStartDate((prev) => prev || todayStr);
      setEndDate((prev) => prev || todayStr);
      setTargetDate((prev) => prev || todayStr);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadConfigAndRestoreCache();
  }, [refreshKey]);

  // 2. Trigger Gemini AI analysis with user-configured parameters
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
        const nowStr = new Date().toLocaleString('vi-VN');
        setCachedTime(nowStr);
        setIsSettingsExpanded(false);

        // PERSIST RESULT TO LOCALSTORAGE SO TAB SWITCHING NEVER WASTES API
        try {
          localStorage.setItem(
            STORAGE_RESULT_KEY,
            JSON.stringify({
              data: res,
              timestamp: nowStr,
              params: payload,
            }),
          );
        } catch (e) {
          console.warn('Failed to persist AI forecast to localStorage', e);
        }
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

  // Date Range Presets (for history window)
  const setRangePreset = (type: 'since_10th' | 'last_7_days' | 'this_month') => {
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
    }
  };

  // Target Forecast Date Presets
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

  // Calculate live upcoming totals before targetDate
  const targetDateObj = targetDate ? new Date(targetDate) : null;
  if (targetDateObj) targetDateObj.setHours(23, 59, 59, 999);

  const activeUpcomingExpenses = upcomingItems
    .filter(
      (i) => i.enabled && i.type === 'EXPENSE' && (!targetDateObj || new Date(i.dueDate) <= targetDateObj),
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
                Dự Báo Dòng Tiền & Kịch Bản AI
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
              Ước tính số dư tài khoản đến ngày mục tiêu dựa trên dữ liệu giao dịch & các cam kết sắp tới
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('report')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Xem Báo cáo thực chi so sánh với ngân sách"
            >
              <BarChart3 size={15} color="var(--primary)" />
              <span>Xem Báo Cáo Hạng Mục</span>
            </button>
          )}
        </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Sliders size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Bộ Tham Số Dự Báo AI
            </h3>
            {data && !isSettingsExpanded && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                (Dữ liệu {formatDateOnly(startDate)} → {formatDateOnly(endDate)} | Dự báo đến {formatDateOnly(targetDate)})
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
                  <span>1. Dữ liệu lịch sử đối chiếu</span>
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

            {/* Section 4: Upcoming Planned Items */}
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
                    Tự động lấy đúng từ Ngân sách / Định kỳ của bạn (Không bị trùng lặp).
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

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Thêm nhanh:</span>

                {rentItem && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(79, 70, 229, 0.08)', padding: '2px 8px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>Tiền nhà (7tr) hạn:</span>
                    <button
                      type="button"
                      onClick={() => setRentDay(5)}
                      className="btn btn-sm"
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: new Date(rentItem.dueDate).getDate() === 5 ? 'var(--primary)' : 'transparent',
                        color: new Date(rentItem.dueDate).getDate() === 5 ? '#fff' : 'var(--text-secondary)',
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
                        padding: '2px 6px',
                        background: new Date(rentItem.dueDate).getDate() === 7 ? 'var(--primary)' : 'transparent',
                        color: new Date(rentItem.dueDate).getDate() === 7 ? '#fff' : 'var(--text-secondary)',
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
                  🎁 Tiền quà 20/10 (1.000.000 đ)
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

            {/* Section 5: Custom Prompt / Question for Gemini AI (Auto-saved to localStorage) */}
            <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={15} color="var(--primary)" />
                  <span>5. Câu hỏi / Yêu cầu riêng cho Gemini AI</span>
                </div>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                  ✓ Đã tự động lưu prompt (chuyển tab không mất)
                </span>
              </div>
              <textarea
                value={customQuestion}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Ví dụ: Liệu tôi có đủ tiền trả tiền nhà và mua quà 20/10 không? Mỗi ngày còn dư bao nhiêu tiền tiêu?"
                className="form-input"
                rows={2}
                style={{ width: '100%', fontSize: '13px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handlePromptChange('Tôi có đủ tiền trả tiền nhà và quà 20/10 mà vẫn đủ chi tiêu sinh hoạt không?')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  💡 Đủ tiền trả tiền nhà & quà 20/10 không?
                </button>
                <button
                  type="button"
                  onClick={() => handlePromptChange('Hạn mức ăn uống và tiêu vặt an toàn mỗi ngày của tôi là bao nhiêu?')}
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
                    <span>Gemini AI đang tính toán & dự báo dòng tiền...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>{data ? 'Cập Nhật & Phân Tích Lại (Gemini AI)' : 'Chạy Phân Tích & Dự Báo Dòng Tiền AI'}</span>
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
            Đang gọi Gemini AI phân tích dòng tiền & lập 3 kịch bản...
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto' }}>
            Đang tính toán mức độ tiêu dùng hàng ngày và ước lượng số dư chính xác đến ngày {formatDateOnly(targetDate)}.
          </p>
        </div>
      )}

      {/* 5. Render Full Analytics Results when Available */}
      {data && !isAnalyzing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Cache Info & Re-run Action Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={20} color="#059669" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#065f46' }}>
                  Kết quả dự báo đã được lưu trong trình duyệt {cachedTime ? `(Lúc ${cachedTime})` : ''}
                </div>
                <div style={{ fontSize: '11px', color: '#047857' }}>
                  Chuyển tab hoặc F5 tải lại ngay lập tức — Không tốn thêm lượt gọi API Gemini!
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsSettingsExpanded(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
              >
                <RotateCcw size={14} />
                <span>Đổi tham số & Chạy lại</span>
              </button>
            </div>
          </div>

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

          {/* Key Metric Highlights Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Số dư hiện tại</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {data.currentAccount.balanceFormatted}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Tài khoản {data.currentAccount.bankName}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Tốc độ chi tiêu thực tế</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--expense)', marginTop: '4px' }}>
                {data.spendingVelocity.dailyBurnRateFormatted}/ngày
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Trung bình {data.timeframe.historicalDaysCount} ngày qua
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Số ngày đến mục tiêu</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                {data.timeframe.daysUntilTarget} ngày
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Đến {data.timeframe.targetDateFormatted}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Hạn mức tiêu an toàn AI</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {formatVND(data.aiAnalysis.safeDailySpendingLimit)}/ngày
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Để bảo toàn số dư cam kết
              </div>
            </div>
          </div>

          {/* 3 Scenario Projection Cards */}
          <div className="glass-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  3 Kịch Bản Số Dư Đến {data.timeframe.targetDateFormatted}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Dự báo theo tốc độ chi tiêu thực tế, các khoản cam kết sắp tới & lương
                </p>
              </div>

              {/* Scenario Switcher Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveScenario('baseline')}
                  className="btn btn-sm"
                  style={{
                    background: activeScenario === 'baseline' ? 'var(--primary)' : 'transparent',
                    color: activeScenario === 'baseline' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  Cơ sở (Thực tế)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScenario('optimized')}
                  className="btn btn-sm"
                  style={{
                    background: activeScenario === 'optimized' ? '#059669' : 'transparent',
                    color: activeScenario === 'optimized' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  Tối ưu (Tiết kiệm)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScenario('conservative')}
                  className="btn btn-sm"
                  style={{
                    background: activeScenario === 'conservative' ? '#d97706' : 'transparent',
                    color: activeScenario === 'conservative' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  Thận trọng (Phát sinh)
                </button>
              </div>
            </div>

            {/* Active Scenario Card Detail */}
            {(() => {
              const cur = data.scenarios[activeScenario];
              if (!cur) return null;
              const isNegative = cur.projectedBalanceBeforeSalary < 0;
              return (
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '14px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {cur.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{cur.description}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Tốc độ chi tiêu giả định</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {cur.assumedDailyBurnFormatted}/ngày
                      </div>
                    </div>

                    <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Tổng chi tiêu thường xuyên</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--expense)', marginTop: '2px' }}>
                        -{cur.totalProjectedDailyExpensesFormatted}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Cho {data.timeframe.daysUntilTarget} ngày tới</div>
                    </div>

                    <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Các khoản cam kết sắp tới</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                        -{cur.upcomingItemsTotalFormatted}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tiền nhà, hóa đơn, quà...</div>
                    </div>

                    <div
                      style={{
                        background: isNegative ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: isNegative ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: isNegative ? '#b91c1c' : '#047857', fontWeight: 700 }}>
                        Số dư TRƯỚC khi có lương
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: isNegative ? '#dc2626' : '#059669', marginTop: '2px' }}>
                        {cur.projectedBalanceBeforeSalaryFormatted}
                      </div>
                      <div style={{ fontSize: '10px', color: isNegative ? '#b91c1c' : '#047857' }}>
                        {isNegative ? '⚠️ Cần bù tiền trước ngày mục tiêu' : '✓ Đủ tiền chi tiêu'}
                      </div>
                    </div>

                    <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Số dư SAU khi nhận lương
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
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

          {/* Banner directing to dedicated Báo Cáo tab */}
          {onNavigate && (
            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(79, 70, 229, 0.05) 100%)',
                border: '1px solid rgba(2, 132, 199, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={24} color="#0284c7" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Muốn xem đối chiếu chi tiết thực chi so với 9 hạn mức ngân sách?
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Hệ thống đã tách riêng một tab <strong>Báo Cáo</strong> độc lập, tính toán tức thì khi chọn nhanh bộ lọc (không tốn API).
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('report')}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Mở Tab Báo Cáo</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
