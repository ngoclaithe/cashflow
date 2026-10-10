import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Smartphone } from 'lucide-react';

export const IosInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if running on iOS Safari and not already in standalone PWA mode
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('cashflow_ios_prompt_dismissed');

    if (isIos && !isStandalone && !dismissed) {
      // Delay prompt slightly for great UX
      const timer = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('cashflow_ios_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(68px + var(--safe-bottom))',
        left: '16px',
        right: '16px',
        maxWidth: '440px',
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid #e0e7ff',
        borderRadius: '16px',
        padding: '14px 16px',
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.12)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Smartphone size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
            Cài đặt App trên iPhone
          </span>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'var(--bg-input)',
            border: 'none',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        Để tạo phím tắt mở app toàn màn hình (không có thanh địa chỉ Safari):
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#f8fafc',
          padding: '8px 10px',
          borderRadius: '10px',
          fontSize: '11.5px',
          color: 'var(--text-primary)',
        }}
      >
        <span>1. Bấm nút Chia sẻ</span>
        <Share size={15} color="var(--primary)" />
        <span>ở thanh dưới Safari</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#f8fafc',
          padding: '8px 10px',
          borderRadius: '10px',
          fontSize: '11.5px',
          color: 'var(--text-primary)',
        }}
      >
        <span>2. Chọn</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
          <PlusSquare size={15} color="#059669" />
          <span>"Thêm vào MH chính" (Add to Home Screen)</span>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="btn btn-primary btn-sm"
        style={{ width: '100%', marginTop: '4px' }}
      >
        Đã hiểu
      </button>
    </div>
  );
};
