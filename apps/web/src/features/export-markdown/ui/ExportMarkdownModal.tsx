import React, { useState, useEffect } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  Sparkles,
  Bot,
  Calendar,
  X,
  ExternalLink,
  FileCode,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Receipt,
  Scale,
} from 'lucide-react';
import { api } from '../../../shared/api/client';
import { MarkdownReportResponse } from '../../../shared/types';
import { formatVND } from '../../../shared/lib/format';

interface ExportMarkdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string;
  initialEndDate?: string;
}

export const ExportMarkdownModal: React.FC<ExportMarkdownModalProps> = ({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
}) => {
  // Date states
  const [startDate, setStartDate] = useState<string>(() => {
    if (initialStartDate) return initialStartDate;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    if (initialEndDate) return initialEndDate;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  const [datePreset, setDatePreset] = useState<'this_month' | 'last_month' | 'last_30_days' | 'since_10th' | 'custom'>('this_month');

  // Options toggles
  const [includePrompt, setIncludePrompt] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includeUpcoming, setIncludeUpcoming] = useState(true);
  const [includeSavings, setIncludeSavings] = useState(true);

  // Data & loading states
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MarkdownReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');

  // Clipboard copy status
  const [copied, setCopied] = useState(false);
  const [copiedPromptOnly, setCopiedPromptOnly] = useState(false);

  // Sync initial dates if modal opens with props
  useEffect(() => {
    if (isOpen) {
      if (initialStartDate) setStartDate(initialStartDate);
      if (initialEndDate) setEndDate(initialEndDate);
    }
  }, [isOpen, initialStartDate, initialEndDate]);

  // Fetch report function
  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMarkdownReport({
        startDate,
        endDate,
        includeTransactions,
        includeUpcoming,
        includeSavings,
        includePrompt,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to generate markdown report:', err);
      setError(err.message || 'Không thể tạo báo cáo Markdown. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when modal opens or filter parameters change
  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, startDate, endDate, includeTransactions, includeUpcoming, includeSavings, includePrompt]);

  // Handle Quick filter presets
  const applyPreset = (preset: 'this_month' | 'last_month' | 'last_30_days' | 'since_10th') => {
    setDatePreset(preset);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toIso(start));
      setEndDate(toIso(now));
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(toIso(start));
      setEndDate(toIso(end));
    } else if (preset === 'last_30_days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      setStartDate(toIso(start));
      setEndDate(toIso(now));
    } else if (preset === 'since_10th') {
      const start = new Date(now.getFullYear(), now.getMonth(), 10);
      setStartDate(toIso(start));
      setEndDate(toIso(now));
    }
  };

  // Copy full markdown to clipboard
  const handleCopyMarkdown = async () => {
    if (!data?.markdown) return;
    try {
      await navigator.clipboard.writeText(data.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard write failed, fallbacking...', err);
      const textArea = document.createElement('textarea');
      textArea.value = data.markdown;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Copy Prompt Only
  const handleCopyPrompt = async () => {
    if (!data?.markdown) return;
    const promptMatch = data.markdown.match(/```text\n([\s\S]*?)\n```/);
    const textToCopy = promptMatch ? promptMatch[1] : data.markdown;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPromptOnly(true);
      setTimeout(() => setCopiedPromptOnly(false), 2500);
    } catch {
      // fallback
    }
  };

  // Download markdown file
  const handleDownload = () => {
    if (!data?.markdown) return;
    const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.filename || `Bao_cao_tai_chinh_${startDate}_den_${endDate}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          borderRadius: '20px',
          padding: 0,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid rgba(79, 70, 229, 0.25)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(14, 165, 233, 0.05) 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
              }}
            >
              <Bot size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Xuất Báo Cáo Tài Chính (Markdown)
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(79, 70, 229, 0.12)',
                    color: '#4f46e5',
                    border: '1px solid rgba(79, 70, 229, 0.25)',
                  }}
                >
                  Dành cho AI ngoài (Claude, ChatGPT...)
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Trích xuất dữ liệu dòng tiền có cấu trúc để AI đọc, phát hiện rò rỉ và đề xuất giải pháp tối ưu
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-sm"
            style={{
              padding: '6px',
              borderRadius: '50%',
              background: 'var(--bg-input)',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Controls / Filters */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Row 1: Date Presets & Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color="var(--primary)" />
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Kỳ báo cáo:</span>
              </div>

              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '3px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => applyPreset('this_month')}
                  className={`btn btn-sm ${datePreset === 'this_month' ? 'btn-primary' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
                >
                  Tháng này
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('last_month')}
                  className={`btn btn-sm ${datePreset === 'last_month' ? 'btn-primary' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
                >
                  Tháng trước
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('last_30_days')}
                  className={`btn btn-sm ${datePreset === 'last_30_days' ? 'btn-primary' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
                >
                  30 ngày qua
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('since_10th')}
                  className={`btn btn-sm ${datePreset === 'since_10th' ? 'btn-primary' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
                >
                  Từ mùng 10
                </button>
              </div>
            </div>

            {/* Custom Dates */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setStartDate(e.target.value);
                }}
                className="form-input"
                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>→ Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setEndDate(e.target.value);
                }}
                className="form-input"
                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
              />
              <button
                type="button"
                onClick={fetchReport}
                className="btn btn-secondary btn-sm"
                style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Tải lại báo cáo"
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Row 2: Content Option Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px dashed var(--border-subtle)', fontSize: '12px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Nội dung xuất:</span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={includePrompt}
                onChange={(e) => setIncludePrompt(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>System Prompt cho AI</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={includeTransactions}
                onChange={(e) => setIncludeTransactions(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>Sổ nhật ký giao dịch</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={includeUpcoming}
                onChange={(e) => setIncludeUpcoming(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>Khoản cam kết sắp tới</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={includeSavings}
                onChange={(e) => setIncludeSavings(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>Mục tiêu tiết kiệm</span>
            </label>
          </div>
        </div>

        {/* Quick Summary Pill Bar when Data is Available */}
        {data && (
          <div
            style={{
              padding: '10px 24px',
              background: 'var(--bg-main)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Thời gian:</span>{' '}
                <strong>{data.timeframe.analysisDays} ngày</strong>
              </div>
              <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Chi sinh hoạt:</span>{' '}
                <strong style={{ color: 'var(--expense)' }}>{formatVND(data.summary.livingExpense)}</strong>{' '}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({formatVND(data.summary.dailyExpenseAvg)}/ngày)</span>
              </div>
              <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Thu nhập:</span>{' '}
                <strong style={{ color: 'var(--income)' }}>{formatVND(data.summary.totalIncome)}</strong>
              </div>
              <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Dòng tiền ròng:</span>{' '}
                <strong style={{ color: data.summary.netCashflow >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                  {data.summary.netCashflow >= 0 ? '+' : ''}{formatVND(data.summary.netCashflow)}
                </strong>
              </div>
            </div>

            {/* View Mode Switcher */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '2px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : ''}`}
                style={{ padding: '3px 10px', fontSize: '11.5px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Eye size={12} />
                <span>Xem trước</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`btn btn-sm ${activeTab === 'raw' ? 'btn-primary' : ''}`}
                style={{ padding: '3px 10px', fontSize: '11.5px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <FileCode size={12} />
                <span>Mã Markdown</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: Scrollable Report Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            background: activeTab === 'raw' ? '#0f172a' : 'var(--bg-surface)',
            color: activeTab === 'raw' ? '#f8fafc' : 'var(--text-primary)',
            minHeight: '280px',
            maxHeight: '52vh',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px', gap: '12px' }}>
              <RefreshCw size={28} className="spin" color="var(--primary)" />
              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Đang tổng hợp báo cáo tài chính Markdown từ {data?.timeframe?.startDateFormatted || startDate} đến {data?.timeframe?.endDateFormatted || endDate}...
              </div>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px', gap: '10px' }}>
              <AlertCircle size={32} color="var(--expense)" />
              <div style={{ fontSize: '14px', color: 'var(--expense)', fontWeight: 600 }}>{error}</div>
              <button onClick={fetchReport} className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }}>
                Thử lại
              </button>
            </div>
          ) : activeTab === 'raw' ? (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: '8px',
                  zIndex: 10,
                }}
              >
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="btn btn-sm"
                  style={{
                    background: copied ? '#059669' : 'rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '11.5px',
                    padding: '4px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Đã sao chép!' : 'Sao chép Markdown'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#e2e8f0',
                }}
              >
                {data?.markdown}
              </pre>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Pro Tip Alert */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(14, 165, 233, 0.04) 100%)',
                  border: '1px solid rgba(79, 70, 229, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={18} color="var(--primary)" />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>Cách dùng tốt nhất:</strong> Nhấn <strong>"Sao chép vào Clipboard"</strong> rồi mở <strong>Claude 3.5 Sonnet</strong> hoặc <strong>ChatGPT Plus</strong> dán vào để nhận đề xuất tài chính chuyên sâu nhất!
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <a
                    href="https://claude.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Claude</span>
                    <ExternalLink size={11} />
                  </a>
                  <a
                    href="https://chatgpt.com"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>ChatGPT</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Formatted Render of the Markdown Sections */}
              {includePrompt && (
                <div
                  style={{
                    background: 'var(--bg-main)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bot size={16} />
                      <span>Hướng dẫn / Prompt phân tích cho AI (Đã bao gồm trong file)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {copiedPromptOnly ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                      <span>{copiedPromptOnly ? 'Đã sao chép prompt' : 'Sao chép riêng Prompt'}</span>
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      background: '#fff',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    Yêu cầu AI phân tích: 1. Chẩn đoán sức khỏe dòng tiền & Tốc độ đốt tiền sinh hoạt • 2. Nhận diện các lỗ rò rỉ & chi tiêu bất thường • 3. Kế hoạch hành động cắt giảm cụ thể & đặt hạn mức/ngày • 4. Chiến lược cho các khoản định kỳ sắp tới.
                  </div>
                </div>
              )}

              {/* Preview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="glass-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG CHI TIÊU</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--expense)', marginTop: '2px' }}>
                    {formatVND(data?.summary?.totalExpense || 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Sinh hoạt: {formatVND(data?.summary?.livingExpense || 0)}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG THU NHẬP</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--income)', marginTop: '2px' }}>
                    {formatVND(data?.summary?.totalIncome || 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Lương & sinh hoạt: {formatVND(data?.summary?.livingIncome || 0)}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TIÊU HAO SINH HOẠT TB</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatVND(data?.summary?.dailyExpenseAvg || 0)}/ngày
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Đã bóc tách riêng cho vay
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DÒNG TIỀN RÒNG (NET)</div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: (data?.summary?.netCashflow || 0) >= 0 ? 'var(--income)' : 'var(--expense)',
                      marginTop: '2px',
                    }}
                  >
                    {(data?.summary?.netCashflow || 0) >= 0 ? '+' : ''}{formatVND(data?.summary?.netCashflow || 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {(data?.summary?.netCashflow || 0) >= 0 ? '✓ Thặng dư dòng tiền' : '⚠️ Thâm hụt dòng tiền'}
                  </div>
                </div>
              </div>

              {/* Data Checklist Preview */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Dữ liệu đã sẵn sàng trong file Markdown:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                    <CheckCircle2 size={14} />
                    <span>Thông tin số dư tài khoản ({formatVND(data?.summary?.totalCash || 0)})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                    <CheckCircle2 size={14} />
                    <span>Phân bổ chi tiêu danh mục & Đối chiếu ngân sách</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                    <CheckCircle2 size={14} />
                    <span>{data?.summary?.anomaliesCount || 0} giao dịch chi lớn (≥ 200k)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                    <CheckCircle2 size={14} />
                    <span>{data?.summary?.txCount || 0} giao dịch chi tiết kèm nội dung CK</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                    <CheckCircle2 size={14} />
                    <span>Các khoản cam kết cố định sắp tới (Tiền nhà,...)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                    <CheckCircle2 size={14} />
                    <span>Tiến độ các mục tiêu tiết kiệm</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {data ? (
              <span>
                Tệp: <code>{data.filename}</code> • {data.markdown.length.toLocaleString('vi-VN')} ký tự
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!data || loading}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Download size={15} />
              <span>Tải file .md</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={!data || loading}
              className="btn btn-primary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                background: copied ? '#059669' : 'linear-gradient(135deg, #4f46e5, #0284c7)',
                boxShadow: copied ? '0 4px 12px rgba(5, 150, 105, 0.3)' : '0 4px 14px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? '✓ Đã sao chép! Dán ngay vào AI' : 'Sao chép vào Clipboard'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
