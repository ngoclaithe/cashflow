import React, { useState } from 'react';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  ShieldCheck,
  Wallet,
  Building2,
  Sparkles,
  Save,
} from 'lucide-react';
import { SyncRun } from '../types';
import { formatDate, formatVND } from '../utils/format';

interface IntegrationsViewProps {
  syncRuns: SyncRun[];
  reconciliationStatus: any;
  onTriggerSync: () => void;
  onRunReconciliation: () => void;
  onCalibrateBalance?: (balance: number) => Promise<void>;
  isSyncing: boolean;
  isReconciling: boolean;
  currentBalance?: number;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  syncRuns,
  reconciliationStatus,
  onTriggerSync,
  onRunReconciliation,
  onCalibrateBalance,
  isSyncing,
  isReconciling,
  currentBalance = 0,
}) => {
  // Calibrate Balance Form State
  const [calibratedBalance, setCalibratedBalance] = useState(
    currentBalance > 0 ? String(currentBalance) : ''
  );
  const [calibrateFeedback, setCalibrateFeedback] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const handleCalibrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(calibratedBalance);
    if (isNaN(num)) return;

    setIsCalibrating(true);
    try {
      if (onCalibrateBalance) {
        await onCalibrateBalance(num);
      }
      setCalibrateFeedback(`✓ Đã cập nhật số dư thực MB Bank: ${formatVND(num)}`);
      setTimeout(() => setCalibrateFeedback(null), 4000);
    } catch (err: any) {
      setCalibrateFeedback(`Lỗi: ${err.message}`);
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '22px' }}>Tích hợp Ngân hàng GPM Pay & MB Bank</h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Quản lý cổng kết nối GPM Pay API, tài khoản MB Bank 1468651509999, hiệu chỉnh số dư thực tế và đối soát tự động.
        </div>
      </div>

      {/* Provider Status & Balance Calibration Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' }}>
        {/* GPM Pay Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4f46e5, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={20} color="#fff" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>GPM Pay Bank Gateway</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Official SDK & Webhook</span>
              </div>
            </div>
            <span className="badge badge-income">
              <CheckCircle2 size={12} /> Đang kết nối
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-input)',
              borderRadius: '12px',
              padding: '12px 14px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ngân hàng:</span>
              <strong style={{ color: 'var(--text-primary)' }}>MB Bank (Quân đội)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Số tài khoản:</span>
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>1468651509999</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Chủ tài khoản:</span>
              <strong style={{ color: 'var(--text-primary)' }}>LAI THE NGOC</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Trạng thái kết nối:</span>
              <span style={{ color: 'var(--income)', fontWeight: 600 }}>API_OFFICIAL • ACTIVE</span>
            </div>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li>Tự động nhận biến động số dư tức thời qua Webhook GPM Pay</li>
              <li>Định danh chuẩn qua GPM Pay SDK & MBBank API Official</li>
              <li>Chống trùng lặp tuyệt đối qua ID giao dịch ngân hàng</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', gap: '10px' }}>
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="btn btn-primary btn-sm"
              style={{ flex: 1, height: '38px' }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ API GPM Pay'}</span>
            </button>
          </div>
        </div>

        {/* Real Balance Calibration Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={20} color="#fff" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>Hiệu chỉnh số dư thực MB Bank</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chuẩn hóa số dư thực tế</span>
              </div>
            </div>
            <span className="badge badge-warning">Khuyên dùng</span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Nhập số dư thực tế hiện tại hiển thị trên app MB Bank. Hệ thống sẽ lưu làm mốc chuẩn, từ đó các giao dịch biến động sau này sẽ cộng/trừ chính xác 100%!
          </p>

          {calibrateFeedback && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: calibrateFeedback.startsWith('✓') ? 'var(--income-bg)' : 'var(--expense-bg)',
                color: calibrateFeedback.startsWith('✓') ? 'var(--income)' : 'var(--expense)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {calibrateFeedback}
            </div>
          )}

          <form onSubmit={handleCalibrateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Số dư thực tế tài khoản 1468651509999 (VNĐ)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Ví dụ: 15000000"
                value={calibratedBalance}
                onChange={(e) => setCalibratedBalance(e.target.value)}
                required
                style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <button
              type="submit"
              disabled={isCalibrating}
              className="btn btn-primary"
              style={{ height: '40px', justifyContent: 'center' }}
            >
              <Save size={16} />
              <span>{isCalibrating ? 'Đang lưu...' : 'Lưu & Khớp số dư thực tế'}</span>
            </button>
          </form>

          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            Số dư khả dụng hiển thị hiện tại: <strong>{formatVND(currentBalance)}</strong>
          </div>
        </div>
      </div>

      {/* Security & Reconciliation Banner */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={18} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px' }}>Bảo mật & Đối soát tự động (Reconciliation)</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chu kỳ kiểm tra 23:30 hàng ngày</span>
            </div>
          </div>

          <button
            onClick={onRunReconciliation}
            disabled={isReconciling}
            className="btn btn-secondary btn-sm"
          >
            <Clock size={14} />
            <span>{isReconciling ? 'Đang đối soát...' : 'Chạy đối soát ngay'}</span>
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Hệ thống tuyệt đối <strong>không lưu trữ mật khẩu, OTP hay session cookie</strong> ngân hàng. Mọi giao dịch MB Bank được nhận qua kết nối ủy quyền chuẩn GPM Pay và được đối soát định kỳ để không sót bất kỳ giao dịch nào.
        </p>

        {reconciliationStatus && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Lần đối soát gần nhất: {formatDate(reconciliationStatus.runAt)}</span>
            <span style={{ color: 'var(--income)', fontWeight: 600 }}>Trạng thái: {reconciliationStatus.status}</span>
          </div>
        )}
      </div>


      {/* Sync Runs History */}
      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '16px' }}>Lịch sử tiến trình đồng bộ (Sync Runs)</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Thời gian</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Nguồn</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Trạng thái</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Giao dịch quét</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Mới nạp</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Bỏ qua / Trùng</th>
            </tr>
          </thead>
          <tbody>
            {syncRuns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Chưa có lịch sử đồng bộ nào.
                </td>
              </tr>
            ) : (
              syncRuns.map((run) => (
                <tr key={run.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                    {formatDate(run.createdAt)}
                  </td>
                  <td style={{ padding: '12px 18px', fontWeight: 600 }}>{run.provider}</td>
                  <td style={{ padding: '12px 18px' }}>
                    <span className={`badge ${run.status === 'SUCCESS' ? 'badge-income' : 'badge-expense'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px' }}>{run.transactionsFetched}</td>
                  <td style={{ padding: '12px 18px', color: 'var(--income)', fontWeight: 600 }}>
                    +{run.transactionsInserted}
                  </td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-muted)' }}>
                    {run.transactionsSkipped}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
