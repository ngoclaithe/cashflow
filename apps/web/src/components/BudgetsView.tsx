import React, { useState } from 'react';
import { Plus, Trash2, PieChart, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { BudgetStatus, Category } from '../types';
import { formatVND } from '../utils/format';

interface BudgetsViewProps {
  budgets: BudgetStatus[];
  categories: Category[];
  onAddBudget: (data: any) => void;
  onDeleteBudget: (id: string) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgets,
  categories,
  onAddBudget,
  onDeleteBudget,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState<'MONTHLY' | 'CUSTOM'>('MONTHLY');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    onAddBudget({
      name,
      amount: parseFloat(amount),
      categoryId: categoryId || undefined,
      period,
    });

    setIsAddOpen(false);
    setName('');
    setAmount('');
    setCategoryId('');
  };

  const totalLimit = budgets.reduce((acc, b) => acc + b.limitAmount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spentAmount, 0);
  const overallPercentage = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px' }}>Quản lý Ngân sách</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Thiết lập hạn mức chi tiêu hàng tháng và theo dõi các cảnh báo vượt ngưỡng (70%, 90%, 100%)
          </div>
        </div>

        <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Tạo ngân sách mới</span>
        </button>
      </div>

      {/* Overview Stat Banner */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(16, 185, 129, 0.08))',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
        }}
      >
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>TỔNG HẠN MỨC NGÂN SÁCH</span>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
            {formatVND(totalLimit)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>ĐÃ SỬ DỤNG</span>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--expense)' }}>
            {formatVND(totalSpent)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>CÒN LẠI</span>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--income)' }}>
            {formatVND(Math.max(0, totalLimit - totalSpent))}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>TỶ LỆ ĐÃ DÙNG</span>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#eab308' }}>
            {overallPercentage}%
          </div>
        </div>
      </div>

      {/* Budgets Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {budgets.map((b) => {
          let badgeClass = 'badge-income';
          let badgeText = 'An toàn';
          let barColor = 'var(--income)';

          if (b.alertLevel === 'CRITICAL') {
            badgeClass = 'badge-expense';
            badgeText = 'Vượt 100%';
            barColor = 'var(--expense)';
          } else if (b.alertLevel === 'WARNING') {
            badgeClass = 'badge-warning';
            badgeText = 'Cảnh báo 90%';
            barColor = 'var(--warning)';
          } else if (b.alertLevel === 'INFO') {
            badgeClass = 'badge-neutral';
            badgeText = 'Chạm 70%';
            barColor = 'var(--primary)';
          }

          return (
            <div key={b.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px' }}>{b.name}</h3>
                    <span className={`badge ${badgeClass}`}>{badgeText}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {b.categoryName ? `Danh mục: ${b.categoryName}` : 'Ngân sách tổng thể'} • Chu kỳ:{' '}
                    {b.period === 'MONTHLY' ? 'Hàng tháng' : 'Tùy chỉnh'}
                  </div>
                </div>

                <button
                  onClick={() => onDeleteBudget(b.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px', color: 'var(--text-muted)' }}
                  title="Xóa ngân sách"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tiến độ chi tiêu</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.percentageUsed}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(b.percentageUsed, 100)}%`,
                      background: barColor,
                      height: '100%',
                      borderRadius: '6px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              {/* Amount stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: 'var(--bg-input)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>ĐÃ CHI TIÊU</span>
                  <div style={{ fontWeight: 700, color: 'var(--expense)', marginTop: '2px' }}>
                    {formatVND(b.spentAmount)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>HẠN MỨC TỐI ĐA</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatVND(b.limitAmount)}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Số tiền còn lại:</span>
                  <strong style={{ color: b.remainingAmount > 0 ? 'var(--income)' : 'var(--expense)' }}>
                    {formatVND(b.remainingAmount)}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Budget */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Tạo ngân sách mới</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Tên ngân sách</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Ăn uống & Sinh hoạt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hạn mức tiền (VND)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ví dụ: 3560000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gắn với danh mục</label>
                <select
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">-- Toàn bộ chi tiêu (Tổng thể) --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Chu kỳ áp dụng</label>
                <select
                  className="form-select"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                >
                  <option value="MONTHLY">Hàng tháng (Tự động lặp lại)</option>
                  <option value="CUSTOM">Khoản chi một lần (Tùy chỉnh)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu ngân sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
