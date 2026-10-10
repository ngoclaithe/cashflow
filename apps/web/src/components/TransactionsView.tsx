import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Trash2,
  Tag,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { Transaction, Category, Account, TransactionDirection } from '../types';
import { formatVND, formatDate } from '../utils/format';

interface TransactionsViewProps {
  transactions: Transaction[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  categories: Category[];
  accounts: Account[];
  onPageChange: (page: number) => void;
  onFilterChange: (filters: any) => void;
  onReclassify: (txId: string, categoryId: string) => void;
  onDeleteTransaction: (txId: string) => void;
  onAddTransaction: (data: any) => void;
  onAddRule?: (data: any) => void;
  onOpenCalendar?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  pagination,
  categories,
  accounts,
  onPageChange,
  onFilterChange,
  onReclassify,
  onDeleteTransaction,
  onAddTransaction,
  onAddRule,
  onOpenCalendar,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);

  // Bottom Sheet / Detail Modal
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Form states for manual add
  const [formAccount, setFormAccount] = useState(accounts[0]?.id || '');
  const [formAmount, setFormAmount] = useState('');
  const [formDirection, setFormDirection] = useState<TransactionDirection>('EXPENSE');
  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  const applyFilters = (overrides: Record<string, any> = {}) => {
    const filters: any = {
      search: search.trim() || undefined,
      direction: selectedDirection || undefined,
      categoryId: selectedCategory || undefined,
      accountId: selectedAccount || undefined,
      uncategorized: onlyUncategorized || undefined,
      page: 1,
      ...overrides,
    };
    onFilterChange(filters);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleClearSearch = () => {
    setSearch('');
    applyFilters({ search: undefined });
  };

  const handleDirectionFilterClick = (direction: string) => {
    const next = selectedDirection === direction ? '' : direction;
    setSelectedDirection(next);
    applyFilters({ direction: next || undefined });
  };

  const handleUncategorizedToggle = () => {
    const next = !onlyUncategorized;
    setOnlyUncategorized(next);
    applyFilters({ uncategorized: next ? true : undefined, categoryId: undefined });
  };

  const handleQuickReclassify = (categoryId: string) => {
    if (!activeTx) return;
    onReclassify(activeTx.id, categoryId);
    setActiveTx({
      ...activeTx,
      categoryId,
      category: categories.find((c) => c.id === categoryId),
    });
  };

  const handleCreateRuleFromTx = () => {
    if (!activeTx || !onAddRule) return;
    const cleanWord = activeTx.description.split(' ').slice(0, 3).join(' ');
    const ruleKeywords = prompt('Nhập từ khóa nhận diện tự động cho giao dịch này:', cleanWord);
    if (!ruleKeywords) return;
    
    if (!activeTx.categoryId) {
      alert('Vui lòng chọn danh mục cho giao dịch này trước khi tạo quy tắc!');
      return;
    }

    onAddRule({
      keyword: ruleKeywords.trim().toUpperCase(),
      categoryId: activeTx.categoryId,
      priority: 50,
      isActive: true,
    });
    alert(`Đã lưu quy tắc tự động cho từ khóa "${ruleKeywords.trim().toUpperCase()}"!`);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount || !formAmount || !formDesc) return;

    onAddTransaction({
      accountId: formAccount,
      amount: parseFloat(formAmount),
      direction: formDirection,
      description: formDesc,
      categoryId: formCat || undefined,
      transactionDate: formDate,
    });

    setIsAddOpen(false);
    setFormAmount('');
    setFormDesc('');
  };

  // Group transactions by date for high density feed
  const groupedTransactions = useMemo(() => {
    const groups: { [dateStr: string]: { dateStr: string; label: string; items: Transaction[]; netTotal: number } } = {};
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    transactions.forEach((tx) => {
      const d = new Date(tx.transactionDate);
      const key = tx.transactionDate ? tx.transactionDate.slice(0, 10) : todayStr;

      if (!groups[key]) {
        let label = key;
        if (key === todayStr) {
          label = 'Hôm nay';
        } else if (key === yesterdayStr) {
          label = 'Hôm qua';
        } else {
          // Format as Thứ X, dd/MM
          try {
            label = formatDate(tx.transactionDate);
          } catch {
            label = key;
          }
        }

        groups[key] = {
          dateStr: key,
          label,
          items: [],
          netTotal: 0,
        };
      }

      groups[key].items.push(tx);
      const amt = Number(tx.amount) || 0;
      if (tx.direction === 'INCOME') {
        groups[key].netTotal += amt;
      } else if (tx.direction === 'EXPENSE') {
        groups[key].netTotal -= amt;
      }
    });

    return Object.values(groups);
  }, [transactions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '880px', margin: '0 auto' }}>
      {/* Top Bar: Title & Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Sổ giao dịch
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Tổng cộng {pagination.total} giao dịch được ghi nhận
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Calendar size={15} />
              <span>Dạng lịch</span>
            </button>
          )}
          <button
            onClick={() => setIsAddOpen(true)}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            <Plus size={16} />
            <span>Thêm GD</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div
        className="glass-card"
        style={{
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '100%' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Tìm theo nội dung, mã GD GPM Pay, số tiền..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '36px',
              paddingRight: search ? '36px' : '12px',
              height: '38px',
              fontSize: '13px',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
              }}
            >
              <X size={15} />
            </button>
          )}
        </form>

        {/* Scrollable Filter Chips (Mobile-optimized) */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectedDirection('');
              setOnlyUncategorized(false);
              applyFilters({ direction: undefined, uncategorized: undefined });
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: !selectedDirection && !onlyUncategorized ? 'none' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              background: !selectedDirection && !onlyUncategorized ? 'var(--primary)' : 'var(--bg-input)',
              color: !selectedDirection && !onlyUncategorized ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Tất cả ({pagination.total})
          </button>

          <button
            type="button"
            onClick={() => handleDirectionFilterClick('EXPENSE')}
            style={{
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: selectedDirection === 'EXPENSE' ? 'none' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              background: selectedDirection === 'EXPENSE' ? 'var(--expense)' : 'var(--bg-input)',
              color: selectedDirection === 'EXPENSE' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Chi tiêu (-)
          </button>

          <button
            type="button"
            onClick={() => handleDirectionFilterClick('INCOME')}
            style={{
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: selectedDirection === 'INCOME' ? 'none' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              background: selectedDirection === 'INCOME' ? 'var(--income)' : 'var(--bg-input)',
              color: selectedDirection === 'INCOME' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Thu nhập (+)
          </button>

          <button
            type="button"
            onClick={() => handleDirectionFilterClick('TRANSFER')}
            style={{
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: selectedDirection === 'TRANSFER' ? 'none' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              background: selectedDirection === 'TRANSFER' ? 'var(--transfer)' : 'var(--bg-input)',
              color: selectedDirection === 'TRANSFER' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Nội bộ (⇄)
          </button>

          <button
            type="button"
            onClick={handleUncategorizedToggle}
            style={{
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: onlyUncategorized ? 'none' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              background: onlyUncategorized ? 'var(--warning)' : 'var(--bg-input)',
              color: onlyUncategorized ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Chưa phân loại
          </button>
        </div>

        {/* Secondary Filters Dropdowns */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              applyFilters({ categoryId: e.target.value || undefined });
            }}
            style={{ flex: 1, height: '34px', fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="">Tất cả danh mục ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              applyFilters({ accountId: e.target.value || undefined });
            }}
            style={{ flex: 1, height: '34px', fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="">Tất cả tài khoản ({accounts.length})</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DENSE TRANSACTION LIST (Grouped by Date) */}
      <div className="tx-feed">
        {groupedTransactions.length === 0 ? (
          <div
            className="glass-card"
            style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}
          >
            <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Không có giao dịch nào
            </div>
            <div style={{ fontSize: '13px' }}>
              Thử tìm với từ khóa khác hoặc bấm "Sync GPM Pay" trên thanh tiêu đề.
            </div>
          </div>
        ) : (
          groupedTransactions.map((group) => (
            <div key={group.dateStr} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Date Group Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 6px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {group.label}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: group.netTotal >= 0 ? 'var(--income)' : 'var(--text-muted)',
                  }}
                >
                  {group.netTotal > 0 ? `+${formatVND(group.netTotal)}` : formatVND(group.netTotal)}
                </span>
              </div>

              {/* Transactions in this Date */}
              <div className="tx-group-card">
                {group.items.map((tx) => {
                  const isInc = tx.direction === 'INCOME';
                  const isExp = tx.direction === 'EXPENSE';

                  return (
                    <div
                      key={tx.id}
                      className="tx-row"
                      onClick={() => setActiveTx(tx)}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Left: Category Icon or Direction Pill */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          flexShrink: 0,
                          background: tx.category?.color
                            ? `${tx.category.color}15`
                            : isInc
                            ? 'var(--income-bg)'
                            : isExp
                            ? 'var(--expense-bg)'
                            : 'var(--transfer-bg)',
                          border: `1px solid ${
                            tx.category?.color ? `${tx.category.color}35` : 'var(--border-subtle)'
                          }`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isInc ? (
                          <ArrowDownLeft size={16} color="var(--income)" />
                        ) : isExp ? (
                          <ArrowUpRight size={16} color="var(--expense)" />
                        ) : (
                          <ArrowLeftRight size={16} color="var(--transfer)" />
                        )}
                      </div>

                      {/* Middle: Content (Truncated clean text, Subtitle) */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {tx.description}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          <span>{tx.account?.displayName || 'MB Bank'}</span>
                          <span>•</span>
                          {tx.category ? (
                            <span style={{ color: tx.category.color, fontWeight: 600 }}>
                              {tx.category.name}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                              Chưa phân loại
                            </span>
                          )}
                          {tx.code && (
                            <>
                              <span>•</span>
                              <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                                {tx.code.slice(0, 8)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Amount */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            fontFamily: 'var(--font-mono)',
                            color: isInc ? 'var(--income)' : isExp ? 'var(--expense)' : 'var(--transfer)',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {isInc ? '+' : isExp ? '-' : ''}
                          {formatVND(tx.amount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            Trang {pagination.page} / {pagination.totalPages} ({pagination.total} giao dịch)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 12px' }}
            >
              <ChevronLeft size={14} /> Trước
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 12px' }}
            >
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* TRANSACTION DETAIL BOTTOM SHEET / MODAL */}
      {activeTx && (
        <div className="modal-overlay" onClick={() => setActiveTx(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              padding: '24px 20px',
              borderRadius: '20px',
            }}
          >
            {/* Header: Close & Title */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Chi tiết giao dịch
              </span>
              <button
                onClick={() => setActiveTx(null)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Big Amount Card */}
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                background: 'var(--bg-input)',
                borderRadius: '16px',
                marginBottom: '20px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color:
                    activeTx.direction === 'INCOME'
                      ? 'var(--income)'
                      : activeTx.direction === 'EXPENSE'
                      ? 'var(--expense)'
                      : 'var(--transfer)',
                }}
              >
                {activeTx.direction === 'INCOME' ? '+' : activeTx.direction === 'EXPENSE' ? '-' : ''}
                {formatVND(activeTx.amount)}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>{activeTx.account?.displayName || 'Tài khoản chính'}</span>
                <span>•</span>
                <span>{formatDate(activeTx.transactionDate)}</span>
              </div>
            </div>

            {/* Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>NỘI DUNG CHUYỂN KHOẢN</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '3px', wordBreak: 'break-word' }}>
                  {activeTx.description}
                </div>
              </div>

              {activeTx.code && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>MÃ GIAO DỊCH (GPM PAY / MBBANK)</div>
                    <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {activeTx.code}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyCode(activeTx.code || '')}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    <Copy size={12} />
                    <span>{copiedId ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
              )}

              {/* Quick Category Selector */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                  PHÂN LOẠI DANH MỤC (BẤM ĐỔI NGAY)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {categories.map((c) => {
                    const isSelected = activeTx.categoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleQuickReclassify(c.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isSelected ? `${c.color}18` : 'var(--bg-input)',
                          border: `1px solid ${isSelected ? c.color : 'var(--border-subtle)'}`,
                          color: isSelected ? c.color : 'var(--text-secondary)',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: c.color,
                          }}
                        />
                        <span>{c.name}</span>
                        {isSelected && <CheckCircle2 size={13} color={c.color} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {onAddRule && (
                <button
                  onClick={handleCreateRuleFromTx}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                >
                  <Sparkles size={15} color="var(--primary)" />
                  <span>Tự động phân loại từ khóa này lần sau</span>
                </button>
              )}

              <button
                onClick={() => {
                  onDeleteTransaction(activeTx.id);
                  setActiveTx(null);
                }}
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                <Trash2 size={15} />
                <span>Xóa giao dịch này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TRANSACTION MODAL */}
      {isAddOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Thêm giao dịch thủ công</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="form-label">Loại giao dịch</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormDirection('EXPENSE')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: formDirection === 'EXPENSE' ? 'none' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: formDirection === 'EXPENSE' ? 'var(--expense)' : 'var(--bg-input)',
                      color: formDirection === 'EXPENSE' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    Chi tiêu
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDirection('INCOME')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: formDirection === 'INCOME' ? 'none' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: formDirection === 'INCOME' ? 'var(--income)' : 'var(--bg-input)',
                      color: formDirection === 'INCOME' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    Thu nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDirection('TRANSFER')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: formDirection === 'TRANSFER' ? 'none' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: formDirection === 'TRANSFER' ? 'var(--transfer)' : 'var(--bg-input)',
                      color: formDirection === 'TRANSFER' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    Chuyển khoản
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Số tiền (VNĐ)</label>
                <input
                  type="number"
                  required
                  placeholder="Ví dụ: 150000"
                  className="form-input"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nội dung chuyển khoản / ghi chú</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Ăn trưa phở cuốn, Đóng tiền mạng..."
                  className="form-input"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tài khoản</label>
                <select
                  className="form-select"
                  value={formAccount}
                  onChange={(e) => setFormAccount(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName} ({formatVND(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Danh mục chi tiêu</label>
                <select
                  className="form-select"
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                >
                  <option value="">-- Chưa phân loại --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ngày giao dịch</label>
                <input
                  type="date"
                  required
                  className="form-input"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Lưu giao dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
