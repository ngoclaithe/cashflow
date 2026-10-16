import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, PieChart, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { BudgetStatus, Category } from '../../../shared/types';
import { formatVND } from '../../../shared/lib/format';
import { api } from '../../../shared/api/client';

interface BudgetsPageProps {
  onNavigate?: (tab: string) => void;
  refreshKey?: number;
}

export const BudgetsPage: React.FC<BudgetsPageProps> = ({ onNavigate, refreshKey }) => {
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetStatus | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState<'MONTHLY' | 'CUSTOM'>('MONTHLY');

  const loadData = async () => {
    try {
      const [budRes, catRes] = await Promise.all([
        api.getBudgets().catch(() => []),
        api.getCategories().catch(() => []),
      ]);
      setBudgets(budRes);
      setCategories(catRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const handleOpenAdd = () => {
    setEditingBudget(null);
    setName('');
    setAmount('');
    setCategoryId('');
    setPeriod('MONTHLY');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (b: BudgetStatus) => {
    setEditingBudget(b);
    setName(b.name);
    setAmount(b.limitAmount.toString());
    setCategoryId(b.categoryId || '');
    setPeriod(b.period || 'MONTHLY');
    setIsAddOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    if (editingBudget) {
      await api.updateBudget(editingBudget.id, {
        name,
        amount: parseFloat(amount),
        categoryId: categoryId || undefined,
        period,
      });
    } else {
      await api.createBudget({
        name,
        amount: parseFloat(amount),
        categoryId: categoryId || undefined,
        period,
      });
    }

    setIsAddOpen(false);
    setEditingBudget(null);
    setName('');
    setAmount('');
    setCategoryId('');
    await loadData();
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ngân sách này?')) return;
    await api.deleteBudget(id);
    await loadData();
  };

  const totalLimit = budgets.reduce((acc, b) => acc + b.limitAmount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spentAmount, 0);
  const overallPercentage = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải ngân sách...</div>;
  }

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

        <button onClick={handleOpenAdd} className="btn btn-primary">
          <Plus size={16} />
          <span>Tạo ngân sách mới</span>
        </button>
      </div>

      {/* Overview Metric */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '8px', borderRadius: '8px' }}>
              <PieChart size={20} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tổng ngân sách đã cam kết</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>
                {formatVND(totalSpent)} / {formatVND(totalLimit)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: overallPercentage > 90 ? 'var(--expense)' : 'var(--income)' }}>
            {overallPercentage}%
          </div>
        </div>

        <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(overallPercentage, 100)}%`,
              background: overallPercentage > 90 ? 'var(--expense)' : overallPercentage > 70 ? 'var(--warning)' : 'var(--primary)',
              height: '100%',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>

      {/* Budget Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {budgets.map((b) => (
          <div key={b.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '16px' }}>{b.name}</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {b.categoryName ? `Danh mục: ${b.categoryName}` : 'Tất cả các danh mục'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleOpenEdit(b)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 8px' }}
                  title="Chỉnh sửa ngân sách"
                >
                  <Edit3 size={14} color="var(--primary)" />
                </button>
                <button
                  onClick={() => handleDeleteBudget(b.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 8px' }}
                  title="Xóa ngân sách"
                >
                  <Trash2 size={14} color="var(--expense)" />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tiến độ:</span>
                <strong>
                  {formatVND(b.spentAmount)} / {formatVND(b.limitAmount)}
                </strong>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Còn lại: {formatVND(b.remainingAmount)}</span>
              <span className={`badge ${b.alertLevel === 'CRITICAL' ? 'badge-expense' : b.alertLevel === 'WARNING' ? 'badge-warning' : 'badge-income'}`}>
                {b.percentageUsed}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isAddOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>
              {editingBudget ? 'Chỉnh sửa ngân sách' : 'Tạo ngân sách mới'}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Tên ngân sách (VD: Chi tiêu ăn uống tháng 10)</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hạn mức tối đa (VND)</label>
                <input
                  type="number"
                  className="form-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="3560000"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Danh mục áp dụng (để trống nếu áp dụng chung)</label>
                <select
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">-- Tất cả danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddOpen(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {editingBudget ? 'Cập nhật ngân sách' : 'Lưu ngân sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
