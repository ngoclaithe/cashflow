import React, { useState } from 'react';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  ShieldCheck,
  Info,
  Server,
} from 'lucide-react';
import { SyncRun } from '../types';
import { formatDate } from '../utils/format';

interface IntegrationsViewProps {
  syncRuns: SyncRun[];
  reconciliationStatus: any;
  onTriggerSync: () => void;
  onRunReconciliation: () => void;
  onSendMockWebhook: (data: any) => void;
  isSyncing: boolean;
  isReconciling: boolean;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  syncRuns,
  reconciliationStatus,
  onTriggerSync,
  onRunReconciliation,
  onSendMockWebhook,
  isSyncing,
  isReconciling,
}) => {
  // Mock Webhook Form
  const [mockAmount, setMockAmount] = useState('5000000');
  const [mockType, setMockType] = useState<'in' | 'out'>('in');
  const [mockContent, setMockContent] = useState('CTY ABC THANH TOAN LUONG THANG 10');
  const [mockGateway, setMockGateway] = useState('MBBank');
  const [mockFeedback, setMockFeedback] = useState<string | null>(null);

  const handleMockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockAmount || !mockContent) return;

    try {
      await onSendMockWebhook({
        transferAmount: parseFloat(mockAmount),
        transferType: mockType,
        content: mockContent,
        gateway: mockGateway,
      });
      setMockFeedback('Đã nạp webhook thử nghiệm thành công! Kiểm tra sổ giao dịch.');
      setTimeout(() => setMockFeedback(null), 4000);
    } catch (err: any) {
      setMockFeedback(`Lỗi: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '22px' }}>Tích hợp Ngân hàng & Đối soát</h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Quản lý kết nối SePay, đối soát giao dịch định kỳ 23:30 và lịch sử đồng bộ
        </div>
      </div>

      {/* Provider Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* SePay Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={18} color="#fff" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>SePay Bank Gateway</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>API v2 & Webhook</span>
              </div>
            </div>
            <span className="badge badge-income">
              <CheckCircle2 size={12} /> Đang kết nối
            </span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <ul style={{ paddingLeft: '20px' }}>
              <li>Nhận biến động số dư tức thời qua Webhook URL bảo mật</li>
              <li>Chống trùng lặp tuyệt đối qua ID SePay & chữ ký SHA-256</li>
              <li>Hỗ trợ đồng bộ giao dịch SePay API v2</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', gap: '10px' }}>
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="btn btn-primary btn-sm"
              style={{ flex: 1 }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ API SePay'}</span>
            </button>
          </div>
        </div>

        {/* MB Bank Policy Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={18} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>MB Bank - Kênh an toàn</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chính sách bảo mật</span>
              </div>
            </div>
            <span className="badge badge-neutral">Tuân thủ bảo mật</span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p>
              Hệ thống tuyệt đối <strong>không lưu trữ mật khẩu, OTP hay session cookie</strong> ngân hàng để
              tránh rủi ro an ninh mạng. Mọi giao dịch MB Bank được nhận qua kết nối ủy quyền chuẩn SePay và
              đối soát tự động 23:30 hàng ngày.
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', gap: '10px' }}>
            <button
              onClick={onRunReconciliation}
              disabled={isReconciling}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
            >
              <Clock size={14} />
              <span>{isReconciling ? 'Đang đối soát...' : 'Chạy đối soát (Reconciliation)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reconciliation Status */}
      {reconciliationStatus && (
        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                Lần đối soát gần nhất: {formatDate(reconciliationStatus.runAt)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Trạng thái: <strong style={{ color: 'var(--income)' }}>{reconciliationStatus.status}</strong> • Lỗi phát hiện: {reconciliationStatus.discrepanciesCount}
              </div>
            </div>
          </div>
          <span className="badge badge-income">Chu kỳ: 23:30 Asia/Ho_Chi_Minh</span>
        </div>
      )}

      {/* Simulator: Test Webhook */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send size={16} color="var(--warning)" />
          Bộ thử nghiệm SePay Webhook (Staging / Demo)
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Gửi thử nghiệm một gói tin biến động số dư giả lập để kiểm tra tính năng tự động ghi sổ và phân loại quy tắc.
        </p>

        {mockFeedback && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.15)', color: 'var(--income)', fontSize: '13px', marginBottom: '14px' }}>
            {mockFeedback}
          </div>
        )}

        <form onSubmit={handleMockSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Loại giao dịch</label>
            <select
              className="form-select"
              value={mockType}
              onChange={(e) => setMockType(e.target.value as any)}
            >
              <option value="in">Tiền vào (Thu nhập)</option>
              <option value="out">Tiền ra (Chi tiêu)</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Số tiền (VND)</label>
            <input
              type="number"
              className="form-input"
              value={mockAmount}
              onChange={(e) => setMockAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
            <label className="form-label">Nội dung chuyển khoản (Ví dụ: TIEN NHA, LUONG, GYM)</label>
            <input
              type="text"
              className="form-input"
              value={mockContent}
              onChange={(e) => setMockContent(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
            <Send size={15} /> Gửi Webhook
          </button>
        </form>
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
