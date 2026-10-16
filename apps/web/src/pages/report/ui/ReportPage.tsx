import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Info,
  DollarSign,
  PieChart as PieChartIcon,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../../shared/api/client';
import { formatVND, formatDateOnly } from '../../../shared/lib/format';

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

interface ReportPageProps {
  onNavigate?: (tab: string) => void;
  refreshKey?: number;
}

export const ReportPage: React.FC<ReportPageProps> = ({ onNavigate, refreshKey }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (now.getDate() >= 10) {
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-10`;
    }
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  // Fast fetch purely from database (no Gemini call!)
  const fetchReport = async (start = startDate, end = endDate) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCategoryReport(start, end);
      if (res) {
        setData(res);
      }
    } catch (err: any) {
      console.error('Error fetching category report:', err);
      setError(err.message || 'Không thể tải dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount & whenever startDate or endDate changes
  useEffect(() => {
    fetchReport(startDate, endDate);
  }, [startDate, endDate, refreshKey]);

  // Quick filter presets - IMMEDIATELY updates state which triggers auto-fetch
  const applyQuickFilter = (type: 'since_10th' | 'last_7_days' | 'this_month' | 'last_month' | 'last_30_days') => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const endStr = toIso(now);

    if (type === 'since_10th') {
      const startD = new Date(now.getFullYear(), now.getMonth(), 10);
      setStartDate(toIso(startD));
      setEndDate(endStr);
    } else if (type === 'last_7_days') {
      const startD = new Date(now);
      startD.setDate(startD.getDate() - 7);
      setStartDate(toIso(startD));
      setEndDate(endStr);
    } else if (type === 'this_month') {
      const startD = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toIso(startD));
      setEndDate(endStr);
    } else if (type === 'last_month') {
      const startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endD = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(toIso(startD));
      setEndDate(toIso(endD));
    } else if (type === 'last_30_days') {
      const startD = new Date(now);
      startD.setDate(startD.getDate() - 30);
      setStartDate(toIso(startD));
      setEndDate(endStr);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* 1. Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(14, 165, 233, 0.05) 50%, rgba(16, 185, 129, 0.05) 100%)',
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
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            }}
          >
            <BarChart3 size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Báo Cáo Hạng Mục & Ngân Sách
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Đối chiếu chi tiêu thực tế từng danh mục với hạn mức ngân sách đã thiết lập
            </div>
          </div>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('budgets')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Quản lý hạn mức ngân sách</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* 2. Interactive Instant Filter Bar */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Kỳ báo cáo:</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '13px', padding: '6px 10px' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '13px', padding: '6px 10px' }}
              />
            </div>
          </div>

          {/* Quick Filter Chips - Clicking IMMEDIATELY updates the report without buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => applyQuickFilter('since_10th')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              Từ mùng 10 đến nay
            </button>
            <button
              type="button"
              onClick={() => applyQuickFilter('last_7_days')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => applyQuickFilter('this_month')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => applyQuickFilter('last_month')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              Tháng trước
            </button>
            <button
              type="button"
              onClick={() => applyQuickFilter('last_30_days')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              30 ngày qua
            </button>
          </div>
        </div>
      </div>

      {/* 3. Loading or Error or Report Content */}
      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
          <RefreshCw size={32} className="spin" color="var(--primary)" />
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Đang tổng hợp dữ liệu giao dịch & đối chiếu ngân sách...
          </div>
        </div>
      )}

      {error && !data && (
        <div className="glass-card" style={{ padding: '30px', textAlign: 'center', maxWidth: '480px', margin: '20px auto' }}>
          <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Lỗi tải báo cáo</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{error}</p>
          <button onClick={() => fetchReport()} className="btn btn-primary" style={{ margin: '0 auto' }}>
            <RefreshCw size={14} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {data && (
        <>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Tổng ngân sách đã lập</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                {formatVND(data.budgetSummary.totalBudget)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Hạn mức tổng các hạng mục
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Thực chi trong kỳ</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#e11d48', marginTop: '4px' }}>
                {formatVND(data.stats.totalExpense)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {data.stats.txCount} giao dịch ({data.timeframe.analysisDays} ngày)
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Tiến độ dùng ngân sách</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: data.budgetSummary.budgetUtilizationPercent > 100 ? '#e11d48' : '#059669', marginTop: '4px' }}>
                {data.budgetSummary.budgetUtilizationPercent}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {data.budgetSummary.categoriesSafe} an toàn / {data.budgetSummary.categoriesOverBudget} vượt hạn mức
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Tiêu hao bình quân</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {formatVND(data.stats.dailyExpenseAvg)} / ngày
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Thu bình quân: {formatVND(data.stats.dailyIncomeAvg)}/ngày
              </div>
            </div>
          </div>

          {/* Detailed Category Table */}
          <div className="glass-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Bảng Chi Tiết Từng Hạng Mục
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Kỳ từ {data.timeframe.startDateFormatted} đến {data.timeframe.endDateFormatted} ({data.timeframe.analysisDays} ngày)
                </p>
              </div>

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={14} className="spin" />
                  <span>Đang cập nhật...</span>
                </div>
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

                    {/* Budget Progress Bar */}
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

          {/* Large Transactions (≥ 500k) */}
          {data.anomalies && data.anomalies.length > 0 && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <span>Các Khoản Chi Lớn Trong Kỳ (≥ 500k)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.anomalies.map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-main)',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.description}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatDateOnly(a.date)} • {a.categoryName}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#e11d48' }}>
                      -{formatVND(a.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
