import React, { useState } from 'react';
import { Target, Plus, Trash2, Calendar, Sparkles, TrendingUp } from 'lucide-react';
import { SavingsGoal } from '../types';
import { formatVND, formatDateOnly } from '../utils/format';

interface SavingsViewProps {
  savingsGoals: SavingsGoal[];
  onAddGoal: (data: any) => void;
  onDeleteGoal: (id: string) => void;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  savingsGoals,
  onAddGoal,
  onDeleteGoal,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('2027-03-10');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || !targetDate) return;

    onAddGoal({
      name,
      targetAmount: parseFloat(targetAmount),
      currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
      targetDate,
    });

    setIsAddOpen(false);
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
  };

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

        <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Thêm mục tiêu mới</span>
        </button>
      </div>

      {/* Goals Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {savingsGoals.map((g) => (
          <div
            key={g.id}
            className="glass-card"
            style={{
              background: 'linear-gradient(145deg, #ffffff, #f5f3ff)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(250, 204, 21, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Target size={18} color="#eab308" />
                  </div>
                  <h3 style={{ fontSize: '17px' }}>{g.name}</h3>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hạn mục tiêu: <strong>{formatDateOnly(g.targetDate)}</strong> (Còn {g.daysRemaining} ngày)
                </div>
              </div>

              <button
                onClick={() => onDeleteGoal(g.id)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px', color: 'var(--text-muted)' }}
                title="Xóa mục tiêu"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Target Display */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tiến độ hiện tại</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {formatVND(g.currentAmount)}{' '}
                <span style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  / {formatVND(g.targetAmount)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Hoàn thành:</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{g.percentageAchieved}%</span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(g.percentageAchieved, 100)}%`,
                    background: 'linear-gradient(90deg, #6366f1, #10b981)',
                    height: '100%',
                    borderRadius: '6px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Forecast breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                background: 'var(--bg-input)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>CẦN TÍCH LŨY THÊM</span>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '3px' }}>
                  {formatVND(g.remainingAmount)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>MỤC TIÊU TIẾT KIỆM / THÁNG</span>
                <div style={{ fontWeight: 700, color: '#eab308', marginTop: '3px' }}>
                  ~{formatVND(g.monthlyRequiredSavings)}/tháng
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add Goal */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Tạo mục tiêu tích lũy mới</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Tên mục tiêu</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Mục tiêu tiết kiệm 60 triệu"
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
                  placeholder="Ví dụ: 60000000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Số tiền đã có sẵn (VND)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ví dụ: 18000000"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ngày đích đến (Target date)</label>
                <input
                  type="date"
                  className="form-input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu mục tiêu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
