import React, { useState, useEffect } from 'react';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Wallet,
  Save,
} from 'lucide-react';
import { SyncRun } from '../../../shared/types';
import { formatDate, formatVND } from '../../../shared/lib/format';
import { api } from '../../../shared/api/client';

export const IntegrationsPage: React.FC = () => {
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [reconciliationStatus, setReconciliationStatus] = useState<any>(null);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Calibrate Balance Form State
  const [calibratedBalance, setCalibratedBalance] = useState('');
  const [calibrateFeedback, setCalibrateFeedback] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const loadData = async () => {
    try {
      const [runsRes, reconRes, sumRes, statusRes] = await Promise.all([
        api.getSyncRuns().catch(() => []),
        api.getReconciliationStatus().catch(() => null),
        api.getDashboardSummary().catch(() => null),
        api.getIntegrationStatus().catch(() => null),
      ]);
      setSyncRuns(runsRes);
      setReconciliationStatus(reconRes);
      setIntegrationStatus(statusRes);
      if (sumRes) {
        setCurrentBalance(sumRes.availableCash || 0);
        if (!calibratedBalance && sumRes.availableCash > 0) {
          setCalibratedBalance(String(sumRes.availableCash));
        }
      }
    } catch (e) {
      console.warn('Error loading integrations:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      await api.triggerSync(1);
      await loadData();
    } catch (e: any) {
      alert(`Đồng bộ thất bại: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunReconciliation = async () => {
    setIsReconciling(true);
    try {
      await api.runReconciliation(2);
      await loadData();
    } catch (e: any) {
      alert(`Đối soát thất bại: ${e.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleCalibrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(calibratedBalance);
    if (isNaN(num)) return;

    setIsCalibrating(true);
    try {
      await api.calibrateBalance(num, accountNumber);
      await loadData();
      setCalibrateFeedback(`✓ Đã cập nhật số dư thực MB Bank: ${formatVND(num)}`);
      setTimeout(() => setCalibrateFeedback(null), 4000);
    } catch (err: any) {
      setCalibrateFeedback(`Lỗi: ${err.message}`);
    } finally {
      setIsCalibrating(false);
    }
  };

  const providerData = integrationStatus?.providers?.[0];
  const activeBank = providerData?.bankAccounts?.[0] || providerData?.localAccount;
  const bankName = activeBank?.bankName || 'MB Bank (Quân đội)';
  const accountNumber = activeBank?.accountNumber || '1468651509999';
  const accountHolder = activeBank?.accountHolder || activeBank?.accountName || 'LAI THE NGOC';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '22px' }}>Tích hợp Ngân hàng SePay & MB Bank</h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Quản lý cổng kết nối SePay Open API, tài khoản MB Bank, hiệu chỉnh số dư thực tế và đối soát tự động.
        </div>
      </div>

      {/* Provider Status & Balance Calibration Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' }}>
        {/* SePay Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={20} color="#fff" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px' }}>SePay Bank Gateway</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Official Open API & Webhook</span>
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
              <strong style={{ color: 'var(--text-primary)' }}>{bankName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Số tài khoản:</span>
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{accountNumber}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Chủ tài khoản:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{accountHolder}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Trạng thái kết nối:</span>
              <span style={{ color: 'var(--income)', fontWeight: 600 }}>API_CONNECTED • ACTIVE</span>
            </div>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li>Tự động nhận biến động số dư tức thời qua Webhook SePay</li>
              <li>Đồng bộ lịch sử giao dịch tiền vào & tiền ra qua SePay API</li>
              <li>Chống trùng lặp tuyệt đối qua ID giao dịch ngân hàng</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', display: 'flex', gap: '10px' }}>
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="btn btn-primary btn-sm"
              style={{ flex: 1, height: '38px' }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ API SePay'}</span>
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
                placeholder="Nhập số dư app MBBank (VD: 18000000)"
                value={calibratedBalance}
                onChange={(e) => setCalibratedBalance(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Số dư app ghi nhận hiện tại:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatVND(currentBalance)}</strong>
            </div>

            <button
              type="submit"
              disabled={isCalibrating}
              className="btn btn-primary"
              style={{ height: '40px', justifyContent: 'center' }}
            >
              <Save size={15} />
              <span>{isCalibrating ? 'Đang lưu...' : 'Lưu & Khớp số dư thực tế'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Daily Reconciliation Card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--primary)" />
              Đối soát số dư cuối ngày (End-of-day Reconciliation)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Kiểm tra tính khớp lệnh giữa số dư lũy kế ngân hàng và các giao dịch đã ghi sổ
            </span>
          </div>

          <button
            onClick={handleRunReconciliation}
            disabled={isReconciling}
            className="btn btn-secondary btn-sm"
          >
            <Clock size={14} className={isReconciling ? 'spin' : ''} />
            <span>{isReconciling ? 'Đang kiểm tra...' : 'Chạy đối soát ngay'}</span>
          </button>
        </div>

        {reconciliationStatus ? (
          <div
            style={{
              background: reconciliationStatus.isDiscrepancy ? 'rgba(244, 63, 94, 0.05)' : 'rgba(16, 185, 129, 0.05)',
              border: `1px solid ${reconciliationStatus.isDiscrepancy ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: reconciliationStatus.isDiscrepancy ? 'var(--expense)' : 'var(--income)' }}>
              {reconciliationStatus.isDiscrepancy ? (
                <>
                  <AlertCircle size={18} />
                  <span>Phát hiện chênh lệch ({formatVND(reconciliationStatus.discrepancyAmount)})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Số dư đối soát hoàn toàn khớp chuẩn! (Không có sai lệch)</span>
                </>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Lần đối soát gần nhất: {formatDate(reconciliationStatus.lastCheckedAt)} • Trạng thái: {reconciliationStatus.status}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Chưa có thông tin đối soát. Hãy bấm "Chạy đối soát ngay" để hệ thống kiểm tra đối chiếu.
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
