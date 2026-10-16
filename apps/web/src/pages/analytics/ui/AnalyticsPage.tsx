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
} from 'lucide-react';
import { api } from '../../../shared/api/client';
import { formatVND, formatDateOnly } from '../../../shared/lib/format';

interface AnalyticsPageProps {
  onNavigate?: (tab: string) => void;
  refreshKey?: number;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onNavigate, refreshKey }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'baseline' | 'optimized' | 'conservative'>('baseline');
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsReanalyzing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await api.getForecast(forceRefresh);
      if (res) {
        setData(res);
      }
    } catch (err: any) {
      console.error('Error fetching forecast:', err);
      setError(err.message || 'Không thể tải báo cáo phân tích AI');
    } finally {
      setLoading(false);
      setIsReanalyzing(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [refreshKey]);

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '16px' }}>
        <div style={{ position: 'relative' }}>
          <RefreshCw size={36} className="spin" color="var(--primary)" />
          <Sparkles size={18} color="#f59e0b" style={{ position: 'absolute', top: -4, right: -4 }} />
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Đang tổng hợp dữ liệu giao dịch & Gọi Gemini AI phân tích...
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Đang tính toán tốc độ tiêu hao ròng và lập 3 kịch bản dự báo đến mùng 10 tháng sau
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="glass-card" style={{ padding: '32px', textAlign: 'center', maxWidth: '500px', margin: '40px auto' }}>
        <AlertTriangle size={40} color="#ef4444" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Lỗi tải báo cáo dự báo</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>{error}</p>
        <button onClick={() => fetchForecast(true)} className="btn btn-primary" style={{ margin: '0 auto' }}>
          <RefreshCw size={14} />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { account, cycle, stats, categories, anomalies, historicalSalary, projections, aiAnalysis } = data;
  const currentScenario = projections[activeScenario];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* 1. Header Banner */}
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
                Báo cáo & Dự báo Dòng tiền AI
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
                Google Gemini
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: aiAnalysis.verdict === 'AN_TOAN' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  color: aiAnalysis.verdict === 'AN_TOAN' ? '#059669' : '#d97706',
                }}
              >
                {aiAnalysis.verdict === 'AN_TOAN' ? '● Dòng tiền an toàn' : '● Cần chú ý chi tiêu'}
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Chu kỳ lương: <b>{cycle.startDateFormatted}</b> → <b>{cycle.targetDateFormatted}</b> • Đã qua {cycle.daysElapsed} ngày • Còn lại <b>{cycle.daysRemaining} ngày</b>
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchForecast(true)}
          disabled={isReanalyzing}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '9px',
            fontSize: '13px',
            fontWeight: 600,
          }}
          title="Yêu cầu Gemini phân tích lại với dữ liệu mới nhất"
        >
          <RefreshCw size={14} className={isReanalyzing ? 'spin' : ''} />
          <span>{isReanalyzing ? 'Đang phân tích...' : 'Phân tích lại AI'}</span>
        </button>
      </div>

      {/* 2. Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {/* Card 1: Số dư hiện tại */}
        <div className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Số dư thực tế hiện tại</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} color="#4f46e5" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatVND(account.balance)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{account.displayName} ({account.accountNumber})</span>
          </div>
        </div>

        {/* Card 2: Tiến độ chu kỳ lương */}
        <div className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Tiến độ kỳ lương</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Còn {cycle.daysRemaining} ngày <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {cycle.totalDays} ngày</span>
          </div>
          {/* Progress bar */}
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${cycle.progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #4f46e5)', borderRadius: '3px' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Đã trôi qua {cycle.daysElapsed} ngày ({cycle.progressPercent}%)</span>
            <span>Đến ngày {cycle.targetDateFormatted}</span>
          </div>
        </div>

        {/* Card 3: Tốc độ hao hụt ròng */}
        <div className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Tiêu hao ròng (Net Burn)</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={16} color="#ef4444" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#ef4444' }}>
            -{formatVND(stats.dailyNetBurnAvg)}<span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>/ngày</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Chi {formatVND(stats.totalExpense)} • Thu lại {formatVND(stats.totalIncome)} ({stats.txCount} GD)
          </div>
        </div>

        {/* Card 4: Hạn mức chi tiêu an toàn hàng ngày */}
        <div className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Hạn mức chi an toàn / ngày</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669' }}>
            {formatVND(stats.safeDailySpendingAllowance)}<span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>/ngày</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Chi tiêu dưới mức này sẽ không bao giờ cạn tiền
          </div>
        </div>
      </div>

      {/* 3. GEMINI AI INSIGHTS BOX */}
      <div
        className="glass-card"
        style={{
          padding: '22px 24px',
          borderLeft: '4px solid #7c3aed',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Đánh giá chuyên sâu từ Cố vấn Tài chính AI
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '3px 8px', borderRadius: '6px' }}>
            Model: {aiAnalysis.modelUsed}
          </span>
        </div>

        {/* AI Summary */}
        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            background: 'rgba(124, 58, 237, 0.04)',
            padding: '14px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(124, 58, 237, 0.12)',
          }}
        >
          {aiAnalysis.summary}
        </div>

        {/* Projection Assessment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowRight size={14} />
            <span>Đánh giá số dư dự báo đến ngày {cycle.targetDateFormatted}:</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '20px' }}>
            {aiAnalysis.projectionAssessment}
          </div>
        </div>

        {/* Key Observations & Recommendations 2-Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '4px' }}>
          {/* Key Observations */}
          <div style={{ background: 'var(--bg-input)', padding: '14px 16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} color="#6366f1" />
              <span>Điểm quan sát đáng chú ý</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {aiAnalysis.keyObservations.map((obs: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '6px' }}>{obs}</li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '14px 16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>Khuyến nghị hành động tối ưu số dư</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {aiAnalysis.recommendations.map((rec: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 4. THREE SCENARIOS PROJECTION CARDS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
              Ước lượng Số dư đến ngày mùng 10 tháng sau ({cycle.targetDateFormatted})
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              So sánh 3 kịch bản chi tiêu trước và sau khi nhận lương tháng mới (~{formatVND(historicalSalary.amount)})
            </p>
          </div>

          {/* Scenario Tab Pills */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: '8px', gap: '4px' }}>
            {(['baseline', 'optimized', 'conservative'] as const).map((key) => {
              const isActive = activeScenario === key;
              const labels = {
                baseline: 'Thực tế (Base)',
                optimized: 'Tiết kiệm',
                conservative: 'Thận trọng',
              };
              return (
                <button
                  key={key}
                  onClick={() => setActiveScenario(key)}
                  style={{
                    border: 'none',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {labels[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scenario Detailed Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '14px' }}>
          {/* Card: Baseline */}
          <div
            onClick={() => setActiveScenario('baseline')}
            className="glass-card"
            style={{
              padding: '18px 20px',
              cursor: 'pointer',
              border: activeScenario === 'baseline' ? '2px solid #4f46e5' : '1px solid var(--border-subtle)',
              background: activeScenario === 'baseline' ? 'rgba(79, 70, 229, 0.03)' : 'var(--bg-card)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#4f46e5' }}>Kịch bản 1: Thực tế (Khả dĩ nhất)</span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
                Đề xuất
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {projections.baseline.description}
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Tiêu hao 25 ngày tới:</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>-{formatVND(projections.baseline.projectedExpense)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Số dư trước lương (10/11):</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#4f46e5' }}>
                  {formatVND(projections.baseline.projectedBalanceBeforeSalary)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.06)', padding: '6px 10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>Sau khi nhận lương tháng mới:</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                  ~{formatVND(projections.baseline.projectedBalanceAfterSalary)}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Optimized */}
          <div
            onClick={() => setActiveScenario('optimized')}
            className="glass-card"
            style={{
              padding: '18px 20px',
              cursor: 'pointer',
              border: activeScenario === 'optimized' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
              background: activeScenario === 'optimized' ? 'rgba(16, 185, 129, 0.03)' : 'var(--bg-card)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>Kịch bản 2: Tối ưu (Tiết kiệm)</span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                Tiết kiệm
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {projections.optimized.description}
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Tiêu hao 25 ngày tới:</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>-{formatVND(projections.optimized.projectedExpense)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Số dư trước lương (10/11):</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>
                  {formatVND(projections.optimized.projectedBalanceBeforeSalary)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.06)', padding: '6px 10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>Sau khi nhận lương tháng mới:</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                  ~{formatVND(projections.optimized.projectedBalanceAfterSalary)}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Conservative */}
          <div
            onClick={() => setActiveScenario('conservative')}
            className="glass-card"
            style={{
              padding: '18px 20px',
              cursor: 'pointer',
              border: activeScenario === 'conservative' ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
              background: activeScenario === 'conservative' ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-card)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#d97706' }}>Kịch bản 3: Thận trọng (Chi nhiều)</span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
                Dự phòng
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {projections.conservative.description}
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Tiêu hao 25 ngày tới:</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>-{formatVND(projections.conservative.projectedExpense)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Số dư trước lương (10/11):</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#d97706' }}>
                  {formatVND(projections.conservative.projectedBalanceBeforeSalary)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.06)', padding: '6px 10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>Sau khi nhận lương tháng mới:</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                  ~{formatVND(projections.conservative.projectedBalanceAfterSalary)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. CATEGORIES BREAKDOWN & ANOMALIES SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {/* Categories Bar Chart */}
        <div className="glass-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChartIcon size={16} color="#4f46e5" />
              <span>Cơ cấu chi tiêu từ ngày {cycle.startDateFormatted}</span>
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Tổng chi: {formatVND(stats.totalExpense)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {categories.map((c: any) => (
              <div key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.color }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({c.count} GD)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatVND(c.amount)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>{c.percent}%</span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${c.percent}%`, height: '100%', background: c.color, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomalies & Key Outflows */}
        <div className="glass-card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <span>Giao dịch phát sinh lớn cần theo dõi</span>
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Từ 500.000 đ</span>
          </div>

          {anomalies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Không có giao dịch đột xuất bất thường trong kỳ này.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {anomalies.map((a: any) => (
                <div
                  key={a.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.description}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                      <span>Ngày {a.date}</span>
                      <span>•</span>
                      <span style={{ color: '#4f46e5', fontWeight: 600 }}>{a.categoryName}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>
                    -{formatVND(a.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Salary Information Note */}
          <div
            style={{
              marginTop: 'auto',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(79, 70, 229, 0.05)',
              border: '1px solid rgba(79, 70, 229, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <DollarSign size={20} color="#4f46e5" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <b>Lương định kỳ tháng:</b> ~{formatVND(historicalSalary.amount)} dự kiến sẽ cộng vào tài khoản đúng ngày <b>{cycle.targetDateFormatted}</b> từ công ty {historicalSalary.companyName}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
