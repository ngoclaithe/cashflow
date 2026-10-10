import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  ShieldCheck,
  Building,
  CheckCircle2,
  Sliders,
  Globe,
  Database,
  Info,
} from 'lucide-react';
import { api } from '../../../shared/api/client';
import { User } from '../../../shared/types';

export const SettingsPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        Đang tải thông tin cài đặt...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
          }}
        >
          <Sliders size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Cài đặt hệ thống & Tài khoản
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Thông tin hồ sơ người dùng, kết nối cổng ngân hàng và cấu hình hiển thị
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="glass-card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #4f46e5, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '20px',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
            }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'N'}
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {user?.name || 'Lại Thế Ngọc'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {user?.email || 'admin@cashflow.local'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#059669',
                background: 'rgba(5, 150, 105, 0.1)',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(5, 150, 105, 0.2)',
              }}
            >
              <ShieldCheck size={14} /> Quản trị viên
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '18px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tiền tệ hiển thị</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>VND (₫) - Việt Nam Đồng</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Định dạng ngày</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>DD/MM/YYYY (Theo chuẩn VN)</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Múi giờ</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>Asia/Ho_Chi_Minh (GMT+7)</div>
          </div>
        </div>
      </div>

      {/* Bank Integration Info (Read-only summary, no useless buttons) */}
      <div className="glass-card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building size={18} color="#059669" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Cổng Ngân hàng SePay & MB Bank</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Tài khoản ngân hàng tích hợp đồng bộ tự động
              </div>
            </div>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#059669',
              background: '#ecfdf5',
              padding: '4px 10px',
              borderRadius: '20px',
              border: '1px solid #a7f3d0',
            }}
          >
            <CheckCircle2 size={13} /> Đang kết nối
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            background: 'var(--bg-input)',
            padding: '14px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ngân hàng</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>MB Bank (Quân Đội)</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Số tài khoản</div>
            <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              1468651509999
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chủ tài khoản</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>LAI THE NGOC</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phương thức</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4f46e5' }}>SePay Official API + Webhook</div>
          </div>
        </div>

        <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={14} color="#64748b" />
          <span>Để đồng bộ dữ liệu giao dịch mới nhất, bạn có thể bấm nút <b>"Sync SePay"</b> ngay trên thanh Header.</span>
        </div>
      </div>

      {/* System Information */}
      <div className="glass-card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(79, 70, 229, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Database size={18} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>Hệ thống & Phiên bản</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cashflow Enterprise Edition</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '13px' }}>
          <div style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Phiên bản ứng dụng</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>Cashflow v2.5.0</div>
          </div>
          <div style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Kiến trúc Frontend</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>Feature-Sliced Design (FSD)</div>
          </div>
          <div style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Cơ sở dữ liệu</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>PostgreSQL 16 + Prisma ORM</div>
          </div>
        </div>
      </div>
    </div>
  );
};
