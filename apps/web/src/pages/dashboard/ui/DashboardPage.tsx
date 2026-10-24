import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { DashboardSummary } from '../../../shared/types';
import { formatVND, formatDateOnly } from '../../../shared/lib/format';
import { api } from '../../../shared/api/client';

interface DashboardPageProps {
  onNavigate?: (tab: string) => void;
  summary?: DashboardSummary | null;
  cashFlowHistory?: Array<{ monthLabel: string; income: number; expense: number; net: number }>;
  refreshKey?: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  summary: propSummary,
  cashFlowHistory: propCashFlowHistory,
  refreshKey,
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(propSummary || null);
  const [cashFlowHistory, setCashFlowHistory] = useState<
    Array<{ monthLabel: string; income: number; expense: number; net: number }>
  >(propCashFlowHistory || []);
  const [loading, setLoading] = useState(!propSummary);
  const [reportData, setReportData] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<{ name: string; amount: number; percentage: number; color: string } | null>(null);

  // Date filters for flexible report view
  const [datePreset, setDatePreset] = useState<'this_month' | 'last_month' | 'last_30_days' | 'since_10th' | 'custom'>('this_month');
  
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  // Load base summary & cashflow history
  useEffect(() => {
    let isMounted = true;
    const loadBaseData = async () => {
      try {
        const [sumRes, cfRes] = await Promise.all([
          api.getDashboardSummary().catch(() => null),
          api.getCashFlow(6).catch(() => []),
        ]);
        if (isMounted) {
          if (sumRes) setSummary(sumRes);
          if (cfRes) setCashFlowHistory(cfRes);
        }
      } catch (err) {
        console.warn('Dashboard load failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadBaseData();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  // Load report data for selected date range
  useEffect(() => {
    let isMounted = true;
    const loadReport = async () => {
      setLoadingReport(true);
      try {
        const res = await api.getCategoryReport(startDate, endDate);
        if (isMounted && res) {
          setReportData(res);
        }
      } catch (err) {
        console.warn('Category report fetch error:', err);
      } finally {
        if (isMounted) setLoadingReport(false);
      }
    };

    loadReport();
    return () => {
      isMounted = false;
    };
  }, [startDate, endDate, refreshKey]);

  // Handle Quick filter preset click
  const applyPreset = (preset: 'this_month' | 'last_month' | 'last_30_days' | 'since_10th') => {
    setDatePreset(preset);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toIso(start));
      setEndDate(toIso(now));
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(toIso(start));
      setEndDate(toIso(end));
    } else if (preset === 'last_30_days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      setStartDate(toIso(start));
      setEndDate(toIso(now));
    } else if (preset === 'since_10th') {
      const start = new Date(now.getFullYear(), now.getMonth(), 10);
      setStartDate(toIso(start));
      setEndDate(toIso(now));
    }
  };

  // Derive categories breakdown for chart
  const categoriesList = useMemo(() => {
    if (reportData?.categoryReport && reportData.categoryReport.length > 0) {
      return reportData.categoryReport
        .filter((c: any) => c.spent > 0)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          color: c.color || '#4f46e5',
          amount: c.spent,
          percentage: c.percentOfTotal,
          txCount: c.txCount,
          dailyAverage: c.dailyAverage,
          budgetAmount: c.budgetAmount,
          percentOfBudget: c.percentOfBudget,
          status: c.status,
        }))
        .sort((a: any, b: any) => b.amount - a.amount);
    }
    if (summary?.categoryBreakdown?.items) {
      return summary.categoryBreakdown.items.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color || '#4f46e5',
        amount: c.amount,
        percentage: c.percentage,
        txCount: 0,
        dailyAverage: 0,
        budgetAmount: 0,
        percentOfBudget: 0,
        status: 'NO_BUDGET',
      }));
    }
    return [];
  }, [reportData, summary]);

  const totalExpenseAmount = useMemo(() => {
    if (reportData?.stats?.livingExpense !== undefined) {
      return reportData.stats.livingExpense;
    }
    if (reportData?.stats?.totalExpense !== undefined) {
      return reportData.stats.totalExpense;
    }
    return summary?.currentMonth?.expenses || 0;
  }, [reportData, summary]);

  const totalIncomeAmount = useMemo(() => {
    if (reportData?.stats?.livingIncome !== undefined) {
      return reportData.stats.livingIncome;
    }
    if (reportData?.stats?.totalIncome !== undefined) {
      return reportData.stats.totalIncome;
    }
    return summary?.currentMonth?.income || 0;
  }, [reportData, summary]);

  const netCashFlowAmount = useMemo(() => {
    return totalIncomeAmount - totalExpenseAmount;
  }, [totalIncomeAmount, totalExpenseAmount]);

  // Compute SVG Donut Chart Slices
  const donutSlices = useMemo(() => {
    if (categoriesList.length === 0 || totalExpenseAmount <= 0) return [];

    let currentAngle = -Math.PI / 2; // Start from 12 o'clock
    const cx = 130;
    const cy = 130;
    const outerR = 100;
    const innerR = 66;

    return categoriesList.map((cat: any) => {
      const sliceAngle = (cat.amount / totalExpenseAmount) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);

      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(startAngle);
      const y4 = cy + innerR * Math.sin(startAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const pathData = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        ...cat,
        pathData,
      };
    });
  }, [categoriesList, totalExpenseAmount]);

  if (loading && !summary) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        Đang tải dữ liệu báo cáo tài chính...
      </div>
    );
  }

  const availableCash = summary?.availableCash || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '30px' }}>
      {/* 1. Header & Interactive Date Filter Bar */}
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(5, 150, 105, 0.04) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            }}
          >
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Báo Cáo Tài Chính & Phân Bổ Chi Tiêu
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Theo dõi cơ cấu chi tiêu thực tế, dòng tiền và so sánh qua các kỳ
            </div>
          </div>
        </div>

        {/* Quick Date Presets & Custom Date Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '3px', borderRadius: '10px' }}>
            <button
              onClick={() => applyPreset('this_month')}
              className={`btn btn-sm ${datePreset === 'this_month' ? 'btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
            >
              Tháng này
            </button>
            <button
              onClick={() => applyPreset('last_month')}
              className={`btn btn-sm ${datePreset === 'last_month' ? 'btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
            >
              Tháng trước
            </button>
            <button
              onClick={() => applyPreset('last_30_days')}
              className={`btn btn-sm ${datePreset === 'last_30_days' ? 'btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
            >
              30 ngày qua
            </button>
            <button
              onClick={() => applyPreset('since_10th')}
              className={`btn btn-sm ${datePreset === 'since_10th' ? 'btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
            >
              Từ mùng 10
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset('custom');
                setStartDate(e.target.value);
              }}
              className="form-input"
              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset('custom');
                setEndDate(e.target.value);
              }}
              className="form-input"
              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
            />
          </div>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards (Retained and Enhanced) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: '14px',
        }}
      >
        {/* Available Cash */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              SỐ DƯ KHẢ DỤNG
            </span>
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                padding: '7px',
                borderRadius: '8px',
              }}
            >
              <Wallet size={16} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            {formatVND(availableCash)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            MB Bank & tiền mặt khả dụng
          </div>
        </div>

        {/* Income */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              THU NHẬP TRONG KỲ
            </span>
            <div
              style={{
                background: 'var(--income-bg)',
                padding: '7px',
                borderRadius: '8px',
              }}
            >
              <TrendingUp size={16} color="var(--income)" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--income)' }}>
            {formatVND(totalIncomeAmount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {datePreset === 'this_month' ? `Tháng ${summary?.currentMonth?.month || new Date().getMonth() + 1}` : 'Theo kỳ chọn'} (không tính nội bộ)
          </div>
        </div>

        {/* Expenses */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              CHI TIÊU TRONG KỲ
            </span>
            <div
              style={{
                background: 'var(--expense-bg)',
                padding: '7px',
                borderRadius: '8px',
              }}
            >
              <TrendingDown size={16} color="var(--expense)" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--expense)' }}>
            {formatVND(totalExpenseAmount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {categoriesList.length} hạng mục phát sinh
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              DÒNG TIỀN RÒNG (NET)
            </span>
            <div
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                padding: '7px',
                borderRadius: '8px',
              }}
            >
              <Scale size={16} color="var(--transfer)" />
            </div>
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 800,
              marginTop: '8px',
              color: netCashFlowAmount >= 0 ? 'var(--income)' : 'var(--expense)',
            }}
          >
            {formatVND(netCashFlowAmount)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {netCashFlowAmount >= 0 ? 'Thặng dư dòng tiền (+)' : 'Thâm hụt chi tiêu (-)'}
          </div>
        </div>
      </div>

      {/* 3. Charts Row: Biểu đồ tròn (Donut) bên trái + Biểu đồ cột phân bổ bên phải */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))',
          gap: '18px',
        }}
      >
        {/* DONUT PIE CHART: Phân bổ chi tiêu theo danh mục */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <PieChartIcon size={18} color="var(--primary)" />
              Biểu đồ tròn phân bổ chi tiêu
            </h3>
            {loadingReport && (
              <RefreshCw size={14} className="spin" color="var(--primary)" />
            )}
          </div>

          {categoriesList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Không có dữ liệu chi tiêu trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              {/* SVG Interactive Donut Chart */}
              <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                <svg width="260" height="260" viewBox="0 0 260 260">
                  {donutSlices.map((slice: any, idx: number) => {
                    const isHovered = hoveredSlice?.name === slice.name;
                    return (
                      <path
                        key={idx}
                        d={slice.pathData}
                        fill={slice.color}
                        stroke="#fff"
                        strokeWidth={isHovered ? '3' : '1.5'}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: hoveredSlice && !isHovered ? 0.45 : 1,
                          transformOrigin: '130px 130px',
                          transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                        }}
                        onMouseEnter={() =>
                          setHoveredSlice({
                            name: slice.name,
                            amount: slice.amount,
                            percentage: slice.percentage,
                            color: slice.color,
                          })
                        }
                        onMouseLeave={() => setHoveredSlice(null)}
                      />
                    );
                  })}
                </svg>

                {/* Center Hole Text Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    width: '120px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {hoveredSlice ? hoveredSlice.name : 'Tổng chi'}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: hoveredSlice ? hoveredSlice.color : 'var(--text-primary)', marginTop: '2px' }}>
                    {formatVND(hoveredSlice ? hoveredSlice.amount : totalExpenseAmount)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginTop: '1px' }}>
                    {hoveredSlice ? `${hoveredSlice.percentage}%` : `${categoriesList.length} hạng mục`}
                  </div>
                </div>
              </div>

              {/* Top Categories Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {categoriesList.map((cat: any) => {
                  const isHovered = hoveredSlice?.name === cat.name;
                  return (
                    <div
                      key={cat.id}
                      onMouseEnter={() =>
                        setHoveredSlice({
                          name: cat.name,
                          amount: cat.amount,
                          percentage: cat.percentage,
                          color: cat.color,
                        })
                      }
                      onMouseLeave={() => setHoveredSlice(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        background: isHovered ? 'var(--bg-input)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: cat.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: isHovered ? 700 : 500,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cat.name}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
                        <strong style={{ fontSize: '12px' }}>{formatVND(cat.amount)}</strong>{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({cat.percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BAR CHART: Biểu đồ cột xếp hạng Top chi tiêu nhiều nhất */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart3 size={18} color="var(--expense)" />
            Biểu đồ cột: Xếp hạng tiêu hao lớn nhất
          </h3>

          {categoriesList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Không có dữ liệu chi tiêu.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {categoriesList.slice(0, 7).map((cat: any, idx: number) => {
                const maxAmount = categoriesList[0]?.amount || 1;
                const barWidth = Math.max(5, Math.min(100, (cat.amount / maxAmount) * 100));

                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', width: '16px' }}>
                          #{idx + 1}
                        </span>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</span>
                      </div>
                      <div>
                        <strong>{formatVND(cat.amount)}</strong>{' '}
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({cat.percentage}%)</span>
                      </div>
                    </div>

                    {/* Animated Bar with gradient */}
                    <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${barWidth}%`,
                          background: `linear-gradient(90deg, ${cat.color}, ${cat.color}dd)`,
                          height: '100%',
                          borderRadius: '6px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Monthly Trend Bar Chart: Biểu đồ cột so sánh Thu vs Chi (6 tháng gần nhất) */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <TrendingUp size={18} color="var(--primary)" />
          Biểu đồ cột: So sánh Thu nhập & Chi tiêu qua các tháng
        </h3>

        {cashFlowHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Chưa có đủ lịch sử dữ liệu các tháng.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cashFlowHistory.length}, 1fr)`,
                gap: '12px',
                alignItems: 'flex-end',
                minHeight: '180px',
                paddingTop: '20px',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '10px',
              }}
            >
              {cashFlowHistory.map((item, idx) => {
                const maxVal = Math.max(
                  ...cashFlowHistory.map((h) => Math.max(h.income, h.expense, 1000000))
                );
                const incHeight = Math.max(4, (item.income / maxVal) * 140);
                const expHeight = Math.max(4, (item.expense / maxVal) * 140);

                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    {/* Dual Bars: Income vs Expense */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px' }}>
                      {/* Income Column */}
                      <div
                        title={`Thu: ${formatVND(item.income)}`}
                        style={{
                          width: '18px',
                          height: `${incHeight}px`,
                          background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.4s ease',
                          cursor: 'pointer',
                        }}
                      />
                      {/* Expense Column */}
                      <div
                        title={`Chi: ${formatVND(item.expense)}`}
                        style={{
                          width: '18px',
                          height: `${expHeight}px`,
                          background: 'linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.4s ease',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    {/* Month label */}
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {item.monthLabel}
                    </span>
                    {/* Net indicator */}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: item.net >= 0 ? 'var(--income)' : 'var(--expense)',
                      }}
                    >
                      {item.net >= 0 ? '+' : ''}{Math.round(item.net / 1000000)}Tr
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend for monthly chart */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                <span>Tiền vào (Thu nhập)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e11d48' }} />
                <span>Tiền ra (Chi tiêu)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Detailed Category Table with Integrated Budget Info */}
      <div className="glass-card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Bảng Chi Tiết Phân Bổ Từng Danh Mục
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Kỳ từ {formatDateOnly(startDate)} đến {formatDateOnly(endDate)}
            </p>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('budgets')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Xem quản lý ngân sách</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {categoriesList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Không có dữ liệu trong khoảng thời gian này.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categoriesList.map((cat: any) => {
              const hasBudget = cat.budgetAmount && cat.budgetAmount > 0;
              return (
                <div
                  key={cat.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: cat.color,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {cat.name}
                        </div>
                        {cat.txCount > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {cat.txCount} giao dịch • Bình quân {formatVND(cat.dailyAverage)}/ngày
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatVND(cat.amount)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {cat.percentage}% tổng chi
                      </div>
                    </div>
                  </div>

                  {/* Integrated Budget indicator if set */}
                  {hasBudget && (
                    <div style={{ marginTop: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Hạn mức: {formatVND(cat.budgetAmount)}</span>
                        <span style={{ fontWeight: 700, color: cat.percentOfBudget > 100 ? 'var(--expense)' : 'var(--income)' }}>
                          {cat.percentOfBudget > 100 ? `Vượt ${cat.percentOfBudget}%` : `Đã dùng ${cat.percentOfBudget}%`}
                        </span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(cat.percentOfBudget, 100)}%`,
                            background: cat.percentOfBudget > 100 ? 'var(--expense)' : cat.percentOfBudget >= 80 ? 'var(--warning)' : 'var(--primary)',
                            height: '100%',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
