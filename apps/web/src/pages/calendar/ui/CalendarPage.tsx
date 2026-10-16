import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Transaction } from '../../../shared/types';
import { formatCompactVND, formatVNDAmount, formatVND } from '../../../shared/lib/format';
import { api } from '../../../shared/api/client';

interface CalendarPageProps {
  onNavigate?: (tab: string) => void;
  initialTransactions?: Transaction[];
  refreshKey?: number;
}

type CalendarTab = 'spending' | 'cashflow';
type FilterPill = 'IN' | 'OUT' | 'ALL';

export const CalendarPage: React.FC<CalendarPageProps> = ({
  onNavigate,
  initialTransactions = [],
  refreshKey,
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
  }, [year, month, refreshKey]);

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

    // Monday-first offset (0=Mon, 6=Sun)
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
    for (let dNum = 1; dNum <= numDays; dNum++) {
      const d = new Date(year, month, dNum);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        date: d,
        dayNumber: dNum,
        isCurrentMonth: true,
        dateKey: key,
      });
    }

    // Fill next month days to complete 7-day rows
    const totalSlots = Math.ceil(days.length / 7) * 7;
    const remainingSlots = totalSlots - days.length;
    for (let dNum = 1; dNum <= remainingSlots; dNum++) {
      const d = new Date(year, month + 1, dNum);
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

    return days;
  }, [year, month]);

  // Selected date key
  const selectedDateKey = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  }, [selectedDate]);

  // Transactions on the selected day
  const selectedDayTransactions = useMemo(() => {
    const data = dailyData.get(selectedDateKey);
    return data?.txs || [];
  }, [dailyData, selectedDateKey]);

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
    <div style={{ width: '100%', paddingBottom: '30px' }}>
      {/* Responsive Grid: 2 columns on desktop, 1 column on mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Overview & Calendar Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. Overview Card: Month selector, Total Net, In / Out */}
          <div
            className="glass-card"
            style={{
              padding: '18px 20px',
              borderRadius: '16px',
            }}
          >
            {/* Month Selector Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-input)',
                borderRadius: '12px',
                padding: '8px 14px',
                marginBottom: '16px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <CalendarIcon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {activeTab === 'spending' ? 'Chi tiêu theo tháng' : 'Dòng tiền theo tháng'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Tháng {month + 1}, {year}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={handlePrevMonth}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px', borderRadius: '8px' }}
                  title="Tháng trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px', borderRadius: '8px' }}
                  title="Tháng sau"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Net Amount with Eye Toggle */}
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
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--expense)' }}>(-)</span>
                ) : monthSummary.net >= 0 ? (
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--income)' }}>(+)</span>
                ) : (
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--expense)' }}>(-)</span>
                )}
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
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
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 8px' }}
                title={isMasked ? 'Hiện số tiền' : 'Ẩn số tiền'}
              >
                {isMasked ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Tiền vào / Tiền ra cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              {/* Tiền vào */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      background: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowDownLeft size={12} color="#fff" strokeWidth={2.8} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tiền vào</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--income)' }}>
                  {isMasked ? '****** VND' : formatVNDAmount(monthSummary.totalIn)}
                </div>
              </div>

              {/* Tiền ra */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      background: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowUpRight size={12} color="#fff" strokeWidth={2.8} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tiền ra</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--expense)' }}>
                  {isMasked ? '****** VND' : formatVNDAmount(monthSummary.totalOut)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Calendar Grid Card */}
          <div
            className="glass-card"
            style={{
              padding: '18px 16px',
              borderRadius: '16px',
            }}
          >
            {/* Filter Pills row: Tiền vào | Tiền ra | Dòng tiền */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Hiển thị trên lịch:
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setFilterPill('IN')}
                  className={`btn btn-sm ${filterPill === 'IN' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}
                >
                  Tiền vào
                </button>
                <button
                  onClick={() => setFilterPill('OUT')}
                  className={`btn btn-sm ${filterPill === 'OUT' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}
                >
                  Tiền ra
                </button>
                <button
                  onClick={() => setFilterPill('ALL')}
                  className={`btn btn-sm ${filterPill === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}
                >
                  Dòng tiền
                </button>
              </div>
            </div>

            {/* Weekdays Row: T2 - CN */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
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
                rowGap: '8px',
                columnGap: '4px',
              }}
            >
              {calendarDays.map((item, idx) => {
                const dayData = dailyData.get(item.dateKey);
                const inAmt = dayData?.inAmount || 0;
                const outAmt = dayData?.outAmount || 0;
                const netAmt = inAmt - outAmt;

                const selected = isSelected(item.date);
                const today = isToday(item.date);

                // Determine badge amount text and color
                let badgeText = '';
                let badgeColor = '';

                if (filterPill === 'IN' && inAmt > 0) {
                  badgeText = formatCompactVND(inAmt, true);
                  badgeColor = 'var(--income)';
                } else if (filterPill === 'OUT' && outAmt > 0) {
                  badgeText = formatCompactVND(-outAmt, true);
                  badgeColor = 'var(--expense)';
                } else if (filterPill === 'ALL') {
                  if (netAmt !== 0) {
                    badgeText = formatCompactVND(netAmt, true);
                    badgeColor = netAmt > 0 ? 'var(--income)' : 'var(--expense)';
                  } else if (inAmt > 0) {
                    badgeText = formatCompactVND(inAmt, true);
                    badgeColor = 'var(--income)';
                  }
                }

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(item.date);
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
                      borderRadius: '8px',
                      padding: '2px',
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
                        fontSize: '13px',
                        fontWeight: selected || today ? 700 : 500,
                        color: !item.isCurrentMonth
                          ? 'var(--text-muted)'
                          : selected
                          ? '#fff'
                          : today
                          ? 'var(--primary)'
                          : 'var(--text-primary)',
                        background: selected
                          ? 'var(--primary)'
                          : today
                          ? 'rgba(79, 70, 229, 0.1)'
                          : 'transparent',
                        border: today && !selected ? '1px solid var(--primary)' : '1px solid transparent',
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
        </div>

        {/* RIGHT COLUMN: Selected Day Breakdown */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            borderRadius: '16px',
            position: 'sticky',
            top: '80px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Chi tiết giao dịch trong ngày
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Ngày {String(selectedDate.getDate()).padStart(2, '0')}/
                {String(selectedDate.getMonth() + 1).padStart(2, '0')}/{selectedDate.getFullYear()}
              </div>
            </div>

            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                background: 'var(--bg-input)',
                color: 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {selectedDayTransactions.length} giao dịch
            </div>
          </div>

          {selectedDayTransactions.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
                background: 'var(--bg-main)',
                borderRadius: '12px',
                border: '1px dashed var(--border-subtle)',
              }}
            >
              Không có biến động giao dịch nào trong ngày này.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto' }}>
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
                      background: 'var(--bg-main)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isIncome ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: isIncome ? '#059669' : '#dc2626',
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
                            color: 'var(--text-primary)',
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
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '2px',
                          }}
                        >
                          {tx.category && (
                            <span
                              style={{
                                background: `${tx.category.color || '#4f46e5'}18`,
                                color: tx.category.color || 'var(--primary)',
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
                        color: isIncome ? 'var(--income)' : 'var(--expense)',
                        flexShrink: 0,
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {isMasked ? '****** VND' : `${isIncome ? '+' : '-'}${formatVND(amtNum)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
