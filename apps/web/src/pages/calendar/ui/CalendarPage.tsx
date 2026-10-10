import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Eye,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { Transaction } from '../../../shared/types';
import { formatCompactVND, formatVNDAmount, formatVND } from '../../../shared/lib/format';
import { api } from '../../../shared/api/client';

interface CalendarPageProps {
  onNavigate?: (tab: string) => void;
  initialTransactions?: Transaction[];
}

type CalendarTab = 'spending' | 'cashflow';
type FilterPill = 'IN' | 'OUT' | 'ALL';

export const CalendarPage: React.FC<CalendarPageProps> = ({
  onNavigate,
  initialTransactions = [],
}) => {
  // Current view date (year & month)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  // Selected date in calendar (defaults to today)
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  
  // Tabs: 'spending' (Lịch chi tiêu) or 'cashflow' (Lịch dòng tiền)
  const [activeTab, setActiveTab] = useState<CalendarTab>('cashflow');
  
  // Eye mask toggle for balances
  const [isMasked, setIsMasked] = useState(false);
  
  // Filter pills: 'IN' (Tiền vào), 'OUT' (Tiền ra), 'ALL' (Dòng tiền)
  const [filterPill, setFilterPill] = useState<FilterPill>('IN');

  // Month transactions state
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>(initialTransactions);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Fetch transactions for the active month
  useEffect(() => {
    let isMounted = true;
    const fetchMonthData = async () => {
      try {
        const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const res = await api.getTransactions({
          startDate: startOfMonth.toISOString(),
          endDate: endOfMonth.toISOString(),
          limit: 1000,
        });

        if (isMounted && res && res.items) {
          setMonthTransactions(res.items);
        }
      } catch (err) {
        console.warn('Error fetching month transactions:', err);
      }
    };

    fetchMonthData();
    return () => {
      isMounted = false;
    };
  }, [year, month]);

  // Aggregate monthly amounts
  const monthSummary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    monthTransactions.forEach((tx) => {
      const amt = Number(tx.amount);
      if (tx.direction === 'INCOME') {
        totalIn += amt;
      } else if (tx.direction === 'EXPENSE') {
        totalOut += amt;
      }
    });

    const net = totalIn - totalOut;
    return {
      totalIn,
      totalOut,
      net,
    };
  }, [monthTransactions]);

  // Group transactions by date string (YYYY-MM-DD)
  const dailyData = useMemo(() => {
    const map = new Map<string, { inAmount: number; outAmount: number; txs: Transaction[] }>();

    monthTransactions.forEach((tx) => {
      const d = new Date(tx.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

      const existing = map.get(key) || { inAmount: 0, outAmount: 0, txs: [] };
      const amt = Number(tx.amount);
      if (tx.direction === 'INCOME') {
        existing.inAmount += amt;
      } else if (tx.direction === 'EXPENSE') {
        existing.outAmount += amt;
      }
      existing.txs.push(tx);
      map.set(key, existing);
    });

    return map;
  }, [monthTransactions]);

  // Generate calendar days grid
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const numDays = lastDayOfMonth.getDate();

    // In VN: T2 = Monday (1), ..., CN = Sunday (0)
    // Map getDay() (0=Sun, 1=Mon...) to Monday-first (0=Mon, 6=Sun)
    const firstDayWeekday = firstDayOfMonth.getDay();
    const startOffset = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

    // Previous month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: Array<{
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      dateKey: string;
    }> = [];

    // Fill previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dNum);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        dNum
      ).padStart(2, '0')}`;
      days.push({
        date: d,
        dayNumber: dNum,
        isCurrentMonth: false,
        dateKey: key,
      });
    }

    // Fill current month days
    for (let i = 1; i <= numDays; i++) {
      const d = new Date(year, month, i);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: true,
        dateKey: key,
      });
    }

    // Fill next month days up to 35 or 42 cells
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        i
      ).padStart(2, '0')}`;
      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: false,
        dateKey: key,
      });
    }

    return days;
  }, [year, month]);

  // Selected date key
  const selectedDateKey = `${selectedDate.getFullYear()}-${String(
    selectedDate.getMonth() + 1
  ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  const selectedDayInfo = dailyData.get(selectedDateKey);
  const selectedDayTransactions = selectedDayInfo?.txs || [];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (d: Date) => {
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', paddingBottom: '30px' }}>
      {/* 1. Header Bar: Back, Title, Home */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0 16px 0',
        }}
      >
        <button
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="btn btn-ghost"
          style={{
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Quay lại"
        >
          <ChevronLeft size={24} color="#111827" />
        </button>

        <h1
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          Chi tiêu của bạn
        </h1>

        <button
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="btn btn-ghost"
          style={{
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Trang chủ"
        >
          <Home size={22} color="#111827" />
        </button>
      </div>

      {/* 2. Top Switcher Tabs: Lịch chi tiêu | Lịch dòng tiền */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '1px solid #E5E7EB',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setActiveTab('spending')}
          style={{
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: activeTab === 'spending' ? 700 : 500,
            color: activeTab === 'spending' ? '#111827' : '#6B7280',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'spending' ? '2.5px solid #111827' : '2.5px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            textAlign: 'center',
          }}
        >
          Lịch chi tiêu
        </button>
        <button
          onClick={() => setActiveTab('cashflow')}
          style={{
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: activeTab === 'cashflow' ? 700 : 500,
            color: activeTab === 'cashflow' ? '#111827' : '#6B7280',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'cashflow' ? '2.5px solid #111827' : '2.5px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            textAlign: 'center',
          }}
        >
          Lịch dòng tiền
        </button>
      </div>

      {/* 3. Overview Card: Month dropdown, Total, Tiền vào / Tiền ra */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '18px 16px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          border: '1px solid #E5E7EB',
          marginBottom: '20px',
        }}
      >
        {/* Month Selector Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F0F5FF',
            borderRadius: '16px',
            padding: '10px 14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* MB Bank Star Emblem */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              <span style={{ color: '#EF4444', fontSize: '18px', fontWeight: 900 }}>★</span>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#4B5563', fontWeight: 500 }}>
                {activeTab === 'spending' ? 'Chi tiêu của bạn trong' : 'Dòng tiền của bạn trong'}
              </div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>🗓</span> Tháng {month + 1}, {year}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={handlePrevMonth}
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: '8px' }}
              title="Tháng trước"
            >
              <ChevronLeft size={18} color="#4B5563" />
            </button>
            <button
              onClick={handleNextMonth}
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: '8px' }}
              title="Tháng sau"
            >
              <ChevronRight size={18} color="#4B5563" />
            </button>
          </div>
        </div>

        {/* Big Balance Number with Eye Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            padding: '0 4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {activeTab === 'spending' ? (
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626' }}>(-)</span>
            ) : monthSummary.net >= 0 ? (
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>(+)</span>
            ) : (
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626' }}>(-)</span>
            )}
            <div
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#111827',
                letterSpacing: '-0.02em',
              }}
            >
              {isMasked
                ? '****** VND'
                : activeTab === 'spending'
                ? formatVNDAmount(monthSummary.totalOut)
                : formatVNDAmount(Math.abs(monthSummary.net))}
            </div>
          </div>

          <button
            onClick={() => setIsMasked(!isMasked)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
            }}
            title={isMasked ? 'Hiện số tiền' : 'Ẩn số tiền'}
          >
            {isMasked ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {/* Two Side-by-Side Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {/* Card: Tiền vào */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              padding: '12px 14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  background: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowDownLeft size={13} color="#FFFFFF" strokeWidth={2.8} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>Tiền vào</span>
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              {isMasked ? '****** VND' : formatVNDAmount(monthSummary.totalIn)}
            </div>
          </div>

          {/* Card: Tiền ra */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              padding: '12px 14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  background: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowUpRight size={13} color="#FFFFFF" strokeWidth={2.8} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>Tiền ra</span>
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              {isMasked ? '****** VND' : formatVNDAmount(monthSummary.totalOut)}
            </div>
          </div>
        </div>

        {/* Xem biến động ↗ Button */}
        <button
          onClick={() => onNavigate && onNavigate('transactions')}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'transparent',
            border: '1.5px solid #2563EB',
            color: '#2563EB',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#EFF6FF')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span>Xem biến động</span>
          <span>↗</span>
        </button>
      </div>

      {/* 4. Section: Chi tiết lịch & Filter Pills */}
      <div style={{ marginBottom: '14px' }}>
        <h2
          style={{
            fontSize: '17px',
            fontWeight: 700,
            color: '#111827',
            marginBottom: '12px',
          }}
        >
          Chi tiết lịch
        </h2>

        {/* 3 Pills: Tiền vào | Tiền ra | Dòng tiền */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilterPill('IN')}
            style={{
              padding: '8px 18px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: filterPill === 'IN' ? '#FCD34D' : '#F3F4F6',
              color: '#1F2937',
              transition: 'all 0.15s ease',
            }}
          >
            Tiền vào
          </button>

          <button
            onClick={() => setFilterPill('OUT')}
            style={{
              padding: '8px 18px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: filterPill === 'OUT' ? '#FCD34D' : '#F3F4F6',
              color: '#1F2937',
              transition: 'all 0.15s ease',
            }}
          >
            Tiền ra
          </button>

          <button
            onClick={() => setFilterPill('ALL')}
            style={{
              padding: '8px 18px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: filterPill === 'ALL' ? '#FCD34D' : '#F3F4F6',
              color: '#1F2937',
              transition: 'all 0.15s ease',
            }}
          >
            Dòng tiền
          </button>
        </div>
      </div>

      {/* 5. Calendar Card */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E5E7EB',
          padding: '18px 12px 14px 12px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
          marginBottom: '20px',
        }}
      >
        {/* Month Title inside calendar */}
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: '#111827',
            marginBottom: '16px',
            paddingLeft: '6px',
          }}
        >
          Tháng {month + 1}, {year}
        </div>

        {/* Weekday Row: T2 T3 T4 T5 T6 T7 CN */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '10px',
          }}
        >
          <div>T2</div>
          <div>T3</div>
          <div>T4</div>
          <div>T5</div>
          <div>T6</div>
          <div>T7</div>
          <div>CN</div>
        </div>

        {/* Days Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            rowGap: '10px',
            columnGap: '2px',
          }}
        >
          {calendarDays.map((item, idx) => {
            const dayData = dailyData.get(item.dateKey);
            const inAmt = dayData?.inAmount || 0;
            const outAmt = dayData?.outAmount || 0;
            const netAmt = inAmt - outAmt;

            const selected = isSelected(item.date);
            const today = isToday(item.date);

            // Determine what badge amount to show under date
            let badgeText = '';
            let badgeColor = '';

            if (filterPill === 'IN' && inAmt > 0) {
              badgeText = formatCompactVND(inAmt, true);
              badgeColor = '#059669'; // Green
            } else if (filterPill === 'OUT' && outAmt > 0) {
              badgeText = formatCompactVND(-outAmt, true);
              badgeColor = '#DC2626'; // Red
            } else if (filterPill === 'ALL') {
              if (netAmt !== 0) {
                badgeText = formatCompactVND(netAmt, true);
                badgeColor = netAmt > 0 ? '#059669' : '#DC2626';
              } else if (inAmt > 0) {
                badgeText = formatCompactVND(inAmt, true);
                badgeColor = '#059669';
              }
            }

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDate(item.date);
                  // If tapping outside month, also switch view date
                  if (!item.isCurrentMonth) {
                    setCurrentDate(new Date(item.date.getFullYear(), item.date.getMonth(), 1));
                  }
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minHeight: '52px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {/* Day Number Box */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: selected || today ? 700 : 500,
                    color: !item.isCurrentMonth
                      ? '#D1D5DB'
                      : selected
                      ? '#1D4ED8'
                      : today
                      ? '#2563EB'
                      : '#111827',
                    // Rounded dashed border for selected day (matching screenshot)
                    border: selected
                      ? '1.5px dashed #2563EB'
                      : today
                      ? '1px solid #93C5FD'
                      : '1.5px solid transparent',
                    background: selected
                      ? '#EFF6FF'
                      : today
                      ? '#F8FAFC'
                      : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {String(item.dayNumber).padStart(2, '0')}
                </div>

                {/* Daily Badge Amount */}
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: badgeColor || 'transparent',
                    marginTop: '2px',
                    lineHeight: '12px',
                    height: '14px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {badgeText || ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Section: Phân loại giao dịch (Selected Day Breakdown) */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E5E7EB',
          padding: '18px 16px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#111827',
              margin: 0,
            }}
          >
            Phân loại giao dịch
          </h3>
          <span
            style={{
              fontSize: '12px',
              color: '#6B7280',
              fontWeight: 600,
              background: '#F3F4F6',
              padding: '4px 8px',
              borderRadius: '8px',
            }}
          >
            Ngày {String(selectedDate.getDate()).padStart(2, '0')}/
            {String(selectedDate.getMonth() + 1).padStart(2, '0')}/{selectedDate.getFullYear()}
          </span>
        </div>

        {selectedDayTransactions.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: '13px',
              background: '#F9FAFB',
              borderRadius: '12px',
            }}
          >
            Không có biến động giao dịch nào trong ngày này.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selectedDayTransactions.map((tx) => {
              const isIncome = tx.direction === 'INCOME';
              const amtNum = Number(tx.amount);

              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#F9FAFB',
                    borderRadius: '12px',
                    border: '1px solid #F3F4F6',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isIncome ? '#ECFDF5' : '#FEF2F2',
                        color: isIncome ? '#059669' : '#DC2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isIncome ? (
                        <ArrowDownLeft size={16} strokeWidth={2.5} />
                      ) : (
                        <ArrowUpRight size={16} strokeWidth={2.5} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#111827',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {tx.description || (isIncome ? 'Tiền vào' : 'Tiền ra')}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#6B7280',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '2px',
                        }}
                      >
                        {tx.category && (
                          <span
                            style={{
                              background: '#E0E7FF',
                              color: '#3730A3',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            {tx.category.name}
                          </span>
                        )}
                        <span>
                          {new Date(tx.transactionDate).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: isIncome ? '#059669' : '#DC2626',
                      flexShrink: 0,
                      textAlign: 'right',
                    }}
                  >
                    {isMasked
                      ? '****** VND'
                      : `${isIncome ? '+' : '-'}${formatVND(amtNum)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
