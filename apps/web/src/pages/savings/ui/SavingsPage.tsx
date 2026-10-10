import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Edit3, Calendar, Sparkles } from 'lucide-react';
import { SavingsGoal } from '../../../shared/types';
import { formatVND, formatDateOnly } from '../../../shared/lib/format';
import { api } from '../../../shared/api/client';

export const SavingsPage: React.FC = () => {
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('2027-03-10');

  const loadData = async () => {
    try {
      const res = await api.getSavingsGoals().catch(() => []);
      setSavingsGoals(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('2027-03-10');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (g: SavingsGoal) => {
    setEditingGoal(g);
    setName(g.name);
    setTargetAmount(g.targetAmount.toString());
    setCurrentAmount(g.currentAmount.toString());
    setTargetDate(g.targetDate ? g.targetDate.slice(0, 10) : '2027-03-10');
    setIsAddOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || !targetDate) return;

    if (editingGoal) {
      await api.updateSavingsGoal(editingGoal.id, {
        name,
        targetAmount: parseFloat(targetAmount),
        currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
        targetDate,
      });
    } else {
      await api.createSavingsGoal({
        name,
        targetAmount: parseFloat(targetAmount),
        currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
        targetDate,
      });
    }

    setIsAddOpen(false);
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    await loadData();
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mục tiêu này?')) return;
    await api.deleteSavingsGoal(id);
    await loadData();
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải mục tiêu tích lũy...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px' }}>Mục tiêu Tích lũy & Tiết kiệm</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Lập kế hoạch tích lũy dài hạn và dự phóng tốc độ tiết kiệm cần thiết mỗi tháng
          </div>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary">
          <Plus size={16} />
          <span>Thêm mục tiêu mới</span>
        </button>
      </div>

      {/* Goals Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {savingsGoals.map((g) => (
          <div
            key={g.id}
            className="glass-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'linear-gradient(145deg, #ffffff, #f5f3ff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fef08a', padding: '8px', borderRadius: '8px' }}>
                  <Sparkles size={18} color="#ca8a04" />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px' }}>{g.name}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Calendar size={13} />
                    <span>Hạn chót: {formatDateOnly(g.targetDate)} (còn {g.daysRemaining} ngày)</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleOpenEdit(g)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 8px' }}
                  title="Chỉnh sửa mục tiêu"
                >
                  <Edit3 size={14} color="var(--primary)" />
                </button>
                <button
                  onClick={() => handleDeleteGoal(g.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 8px' }}
                  title="Xóa mục tiêu"
                >
                  <Trash2 size={14} color="var(--expense)" />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatVND(g.currentAmount)}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Mục tiêu: {formatVND(g.targetAmount)}
                </span>
              </div>

              <div style={{ height: '10px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(g.percentageAchieved, 100)}%`,
                    background: 'linear-gradient(90deg, #6366f1, #10b981)',
                    height: '100%',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                background: 'var(--bg-input)',
                padding: '12px',
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
                <span style={{ color: 'var(--text-muted)' }}>Tỷ lệ đạt được:</span>
                <div style={{ fontWeight: 700, color: 'var(--income)', marginTop: '2px' }}>
                  {g.percentageAchieved}%
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dự kiến cần tiết kiệm hàng tháng:</span>
                <div style={{ fontWeight: 800, color: '#ca8a04', fontSize: '14px', marginTop: '2px' }}>
                  ~{formatVND(g.monthlyRequiredSavings)} / tháng
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isAddOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>
              {editingGoal ? 'Chỉnh sửa mục tiêu tích lũy' : 'Thêm mục tiêu tích lũy mới'}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Tên mục tiêu (VD: Quỹ tích lũy 60 Triệu)</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Số tiền mục tiêu (VND)</label>
                <input
                  type="number"
                  className="form-input"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="60000000"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Số tiền hiện có (VND)</label>
                <input
                  type="number"
                  className="form-input"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="18000000"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hạn chót hoàn thành (Deadline)</label>
                <input
                  type="date"
                  className="form-input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                />
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
                  {editingGoal ? 'Cập nhật mục tiêu' : 'Lưu mục tiêu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
