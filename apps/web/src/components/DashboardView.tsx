import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Sparkles,
  ShieldCheck,
  PieChart,
} from 'lucide-react';
import { DashboardSummary } from '../types';
import { formatVND, formatDate } from '../utils/format';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  cashFlowHistory: Array<{ monthLabel: string; income: number; expense: number; net: number }>;
  onViewAllTransactions: () => void;
  onOpenAddTransaction: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  cashFlowHistory,
  onViewAllTransactions,
  onOpenAddTransaction,
}) => {
  if (!summary) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        Đang tải dữ liệu tổng quan tài chính...
      </div>
    );
  }

  const {
    availableCash,
    currentMonth,
    categoryBreakdown,
    budgetsSummary,
    upcomingObligations,
    savingsGoals,
    recentTransactions,
  } = summary;

  // Check if any rent obligation is due soon or insufficient funds
  const urgentObligation = upcomingObligations.find((o) => o.isObligation);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Rent & Obligation Warning Banner if needed */}
      {urgentObligation && (
        <div
          style={{
            background: urgentObligation.isInsufficientFunds
              ? 'rgba(244, 63, 94, 0.15)'
              : 'rgba(99, 102, 241, 0.12)',
            border: `1px solid ${
              urgentObligation.isInsufficientFunds ? 'rgba(244, 63, 94, 0.4)' : 'rgba(99, 102, 241, 0.3)'
            }`,
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {urgentObligation.isInsufficientFunds ? (
              <AlertTriangle size={22} color="var(--expense)" />
            ) : (
              <ShieldCheck size={22} color="var(--primary)" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                Nghĩa vụ cố định: {urgentObligation.name} ({formatVND(urgentObligation.amount)})
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Hạn thanh toán: còn {urgentObligation.daysRemaining} ngày. Số dư khả dụng hiện tại:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{formatVND(availableCash)}</strong> (
                {urgentObligation.isInsufficientFunds
                  ? 'Cảnh báo: Chưa đủ số dư thanh toán!'
                  : 'Đã sẵn sàng dự phòng chi trả an toàn'}
                )
              </div>
            </div>
          </div>
          <button onClick={onOpenAddTransaction} className="btn btn-secondary btn-sm">
            + Thêm khoản chi / thu
          </button>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: '12px',
        }}
      >
        {/* Available Cash */}
        <div className="glass-card">
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
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              THU NHẬP THÁNG {currentMonth.month}
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
            {formatVND(currentMonth.income)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Đã ghi nhận (không tính nội bộ)
          </div>
        </div>

        {/* Expenses */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              CHI TIÊU THÁNG {currentMonth.month}
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
            {formatVND(currentMonth.expenses)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Hạch toán chi trong tháng
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="glass-card">
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
              color: currentMonth.netCashFlow >= 0 ? 'var(--income)' : 'var(--expense)',
            }}
          >
            {formatVND(currentMonth.netCashFlow)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Thu nhập trừ Chi phí thực tế
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Analytics & Transactions) - Right (Obligations & Budgets & Goals) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: '16px',
        }}
      >
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Cash Flow Trends (6 Months) */}
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--primary)" />
              Biểu đồ dòng tiền (6 tháng gần nhất)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {cashFlowHistory.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  Chưa có dữ liệu lịch sử các tháng trước
                </div>
              ) : (
                cashFlowHistory.map((item, idx) => {
                  const maxVal = Math.max(...cashFlowHistory.map((h) => Math.max(h.income, h.expense, 1000000)));
                  const incPercent = (item.income / maxVal) * 100;
                  const expPercent = (item.expense / maxVal) * 100;

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{item.monthLabel}</span>
                        <span>
                          Thu: <strong style={{ color: 'var(--income)' }}>{formatVND(item.income)}</strong> | Chi:{' '}
                          <strong style={{ color: 'var(--expense)' }}>{formatVND(item.expense)}</strong>
                        </span>
                      </div>
                      <div style={{ display: 'flex', height: '10px', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${incPercent}%`,
                            background: 'var(--income)',
                            borderRadius: '4px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                        <div
                          style={{
                            width: `${expPercent}%`,
                            background: 'var(--expense)',
                            borderRadius: '4px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Spending by Category */}
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={18} color="var(--warning)" />
              Phân bổ chi tiêu theo danh mục (Tháng {currentMonth.month})
            </h3>
            {categoryBreakdown.items.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                Chưa có phát sinh chi tiêu trong tháng này
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {categoryBreakdown.items.map((cat) => (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: cat.color || '#94a3b8',
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                      </div>
                      <div>
                        <strong>{formatVND(cat.amount)}</strong>{' '}
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>({cat.percentage}%)</span>
                      </div>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(cat.percentage, 100)}%`,
                          background: cat.color || 'var(--primary)',
                          height: '100%',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px' }}>Giao dịch gần nhất</h3>
              <button onClick={onViewAllTransactions} className="btn btn-secondary btn-sm">
                Xem tất cả ({summary.recentTransactions.length})
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
                Chưa có giao dịch nào được ghi nhận. Bạn có thể bấm "Đồng bộ SePay" hoặc thêm thủ công.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={onViewAllTransactions}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          flexShrink: 0,
                          background:
                            tx.direction === 'INCOME'
                              ? 'var(--income-bg)'
                              : tx.direction === 'EXPENSE'
                              ? 'var(--expense-bg)'
                              : 'var(--transfer-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {tx.direction === 'INCOME' ? (
                          <ArrowDownLeft size={15} color="var(--income)" />
                        ) : tx.direction === 'EXPENSE' ? (
                          <ArrowUpRight size={15} color="var(--expense)" />
                        ) : (
                          <ArrowLeftRight size={15} color="var(--transfer)" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {tx.description}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                          {formatDate(tx.transactionDate)} •{' '}
                          <span style={{ color: tx.category?.color || 'var(--text-secondary)' }}>
                            {tx.category?.name || 'Chưa phân loại'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        flexShrink: 0,
                        color:
                          tx.direction === 'INCOME'
                            ? 'var(--income)'
                            : tx.direction === 'EXPENSE'
                            ? '#fff'
                            : 'var(--transfer)',
                      }}
                    >
                      {tx.direction === 'INCOME' ? '+' : tx.direction === 'EXPENSE' ? '-' : ''}
                      {formatVND(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Budgets & Obligations & Savings Target */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Monthly Budgets Progress */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary)" />
                Tiến độ ngân sách chi tiêu
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Đã dùng {formatVND(budgetsSummary.totalSpent)} / {formatVND(budgetsSummary.totalLimit)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {budgetsSummary.items.map((b) => (
                <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{b.name}</span>
                      {b.alertLevel === 'CRITICAL' && (
                        <span className="badge badge-expense">Vượt 100%</span>
                      )}
                      {b.alertLevel === 'WARNING' && (
                        <span className="badge badge-warning">Cảnh báo 90%</span>
                      )}
                      {b.alertLevel === 'INFO' && (
                        <span className="badge badge-neutral">70%</span>
                      )}
                    </div>
                    <div>
                      <strong>{formatVND(b.spentAmount)}</strong> / {formatVND(b.limitAmount)}
                    </div>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(b.percentageUsed, 100)}%`,
                        background:
                          b.alertLevel === 'CRITICAL'
                            ? 'var(--expense)'
                            : b.alertLevel === 'WARNING'
                            ? 'var(--warning)'
                            : 'var(--primary)',
                        height: '100%',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Còn lại: {formatVND(b.remainingAmount)}</span>
                    <span>{b.percentageUsed}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Obligations (Rent, Salary, etc.) */}
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="var(--primary)" />
              Khoản cố định & Nghĩa vụ sắp tới
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingObligations.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: item.isObligation
                      ? 'rgba(244, 63, 94, 0.05)'
                      : 'rgba(16, 185, 129, 0.05)',
                    border: `1px solid ${
                      item.isObligation ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Hạn: còn {item.daysRemaining} ngày ({item.isObligation ? 'Nghĩa vụ bắt buộc' : 'Dự kiến'})
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '14px',
                      color: item.isObligation ? 'var(--expense)' : 'var(--income)',
                    }}
                  >
                    {item.isObligation ? '-' : '+'}
                    {formatVND(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Savings Target (60M target) */}
          <div className="glass-card" style={{ background: 'linear-gradient(145deg, #ffffff, #f5f3ff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#facc15" />
                Mục tiêu tích lũy cá nhân
              </h3>
              <span className="badge badge-warning">Hạn: 10/03/2027</span>
            </div>

            {savingsGoals.map((g) => (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{g.name}</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {formatVND(g.currentAmount)}{' '}
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      / {formatVND(g.targetAmount)}
                    </span>
                  </div>
                </div>

                <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(g.percentageAchieved, 100)}%`,
                      background: 'linear-gradient(90deg, #6366f1, #10b981)',
                      height: '100%',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    background: 'var(--bg-input)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Cần tích lũy thêm:</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {formatVND(g.remainingAmount)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Mỗi tháng cần dành:</span>
                    <div style={{ fontWeight: 700, color: '#eab308', marginTop: '2px' }}>
                      ~{formatVND(g.monthlyRequiredSavings)}/tháng
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
