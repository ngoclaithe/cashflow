import React, { useState, useEffect, useMemo } from 'react';
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
  List,
  Edit3,
} from 'lucide-react';
import { Transaction, Category, Account, TransactionDirection } from '../../../shared/types';
import { formatVND, formatDate } from '../../../shared/lib/format';
import { api } from '../../../shared/api/client';
import { CalendarPage } from '../../calendar';

interface TransactionsPageProps {
  onNavigate?: (tab: string) => void;
  initialView?: 'list' | 'calendar';
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ onNavigate, initialView = 'list' }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(initialView);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);

  // Bottom Sheet / Detail Modal
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Edit states for existing transaction
  const [isEditingTx, setIsEditingTx] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editDirection, setEditDirection] = useState<TransactionDirection>('EXPENSE');

  // Form states for manual add
  const [formAccount, setFormAccount] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDirection, setFormDirection] = useState<TransactionDirection>('EXPENSE');
  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadData = async (filters: any = {}) => {
    setLoading(true);
    try {
      const [txRes, catRes, accRes] = await Promise.all([
        api.getTransactions(filters).catch(() => ({ items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } })),
        categories.length > 0 ? Promise.resolve(categories) : api.getCategories().catch(() => []),
        accounts.length > 0 ? Promise.resolve(accounts) : api.getAccounts().catch(() => []),
      ]);
      setTransactions(txRes.items);
      setPagination(txRes.pagination);
      setCategories(catRes);
      setAccounts(accRes);
      if (!formAccount && accRes.length > 0) {
        setFormAccount(accRes[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    loadData(filters);
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

  const handleQuickReclassify = async (categoryId: string) => {
    if (!activeTx) return;
    await api.reclassifyTransaction(activeTx.id, categoryId);
    setActiveTx({
      ...activeTx,
      categoryId,
      category: categories.find((c) => c.id === categoryId),
    });
    await loadData({ page: pagination.page });
  };

  const handleCreateRuleFromTx = async () => {
    if (!activeTx) return;
    const cleanWord = activeTx.description.split(' ').slice(0, 3).join(' ');
    const ruleKeywords = prompt('Nhập từ khóa nhận diện tự động cho giao dịch này:', cleanWord);
    if (!ruleKeywords) return;
    
    if (!activeTx.categoryId) {
      alert('Vui lòng chọn danh mục cho giao dịch này trước khi tạo quy tắc!');
      return;
    }

    await api.createRule({
      name: `Quy tắc: ${ruleKeywords.trim().toUpperCase()}`,
      field: 'DESCRIPTION',
      operator: 'CONTAINS',
      value: ruleKeywords.trim().toUpperCase(),
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount || !formAmount || !formDesc) return;

    await api.createTransaction({
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
    await loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
    await api.deleteTransaction(id);
    setActiveTx(null);
    setIsEditingTx(false);
    await loadData({ page: pagination.page });
  };

  const handleStartEditTx = () => {
    if (!activeTx) return;
    setEditAmount(activeTx.amount.toString());
    setEditDesc(activeTx.description);
    setEditDate(activeTx.transactionDate ? activeTx.transactionDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditCat(activeTx.categoryId || '');
    setEditDirection(activeTx.direction);
    setIsEditingTx(true);
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTx) return;
    await api.updateTransaction(activeTx.id, {
      amount: parseFloat(editAmount),
      description: editDesc,
      transactionDate: new Date(editDate).toISOString(),
      categoryId: editCat || undefined,
      direction: editDirection,
    });
    setActiveTx({
      ...activeTx,
      amount: parseFloat(editAmount),
      description: editDesc,
      transactionDate: new Date(editDate).toISOString(),
      categoryId: editCat || null,
      direction: editDirection,
      category: categories.find((c) => c.id === editCat),
    });
    setIsEditingTx(false);
    await loadData({ page: pagination.page });
  };

  // Group transactions by date for high density feed
  const groupedTransactions = useMemo(() => {
    const groups: { [dateStr: string]: { dateStr: string; label: string; items: Transaction[]; netTotal: number } } = {};
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    transactions.forEach((tx) => {
      const key = tx.transactionDate ? tx.transactionDate.slice(0, 10) : todayStr;

      if (!groups[key]) {
        let label = key;
        if (key === todayStr) {
          label = 'Hôm nay';
        } else if (key === yesterdayStr) {
          label = 'Hôm qua';
        } else {
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
      const amt = Number(tx.amount);
      if (tx.direction === 'INCOME') {
        groups[key].netTotal += amt;
      } else if (tx.direction === 'EXPENSE') {
        groups[key].netTotal -= amt;
      }
    });

    return Object.values(groups).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [transactions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '880px', margin: '0 auto' }}>
      {/* Top Bar: Title & Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Sổ giao dịch
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {viewMode === 'calendar'
              ? 'Xem dòng tiền theo từng ngày'
              : `Tổng cộng ${pagination.total} giao dịch được ghi nhận`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Segmented Switcher for List vs Calendar */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-input)',
              padding: '3px',
              borderRadius: '9px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={() => setViewMode('list')}
              style={{
                border: 'none',
                background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: viewMode === 'list' ? 700 : 500,
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <List size={14} />
              <span>Danh sách</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                border: 'none',
                background: viewMode === 'calendar' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: viewMode === 'calendar' ? 700 : 500,
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Calendar size={14} />
              <span>Dạng lịch</span>
            </button>
          </div>

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

      {viewMode === 'calendar' ? (
        <CalendarPage onNavigate={onNavigate} />
      ) : (
        <>
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
            style={{ paddingLeft: '36px', paddingRight: search ? '36px' : '12px', height: '38px', fontSize: '13px' }}
            placeholder="Tìm theo nội dung, đối tác, số tiền..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              }}
            >
              <X size={15} />
            </button>
          )}
        </form>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          <button
            onClick={() => handleDirectionFilterClick('INCOME')}
            style={{
              padding: '5px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: selectedDirection === 'INCOME' ? 'var(--income)' : 'var(--bg-input)',
              color: selectedDirection === 'INCOME' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <ArrowDownLeft size={13} />
            <span>Tiền vào</span>
          </button>

          <button
            onClick={() => handleDirectionFilterClick('EXPENSE')}
            style={{
              padding: '5px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: selectedDirection === 'EXPENSE' ? 'var(--expense)' : 'var(--bg-input)',
              color: selectedDirection === 'EXPENSE' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <ArrowUpRight size={13} />
            <span>Tiền ra</span>
          </button>

          <button
            onClick={handleUncategorizedToggle}
            style={{
              padding: '5px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: onlyUncategorized ? '#f59e0b' : 'var(--bg-input)',
              color: onlyUncategorized ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <AlertCircle size={13} />
            <span>Chưa phân loại</span>
          </button>

          {/* Category Dropdown */}
          <select
            className="form-select"
            style={{ height: '30px', fontSize: '12px', padding: '0 8px', borderRadius: '20px', width: 'auto' }}
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              applyFilters({ categoryId: e.target.value || undefined });
            }}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* High-density Transaction List grouped by date */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải danh sách giao dịch...</div>
      ) : groupedTransactions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <Tag size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
          <div>Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groupedTransactions.map((group) => (
            <div key={group.dateStr} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Group Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                <div style={{ color: 'var(--text-primary)' }}>{group.label}</div>
                <div
                  style={{
                    color: group.netTotal > 0 ? 'var(--income)' : group.netTotal < 0 ? 'var(--expense)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                  }}
                >
                  {group.netTotal > 0 ? '+' : ''}
                  {formatVND(group.netTotal)}
                </div>
              </div>

              {/* Transactions in Group */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.items.map((tx) => {
                  const isIncome = tx.direction === 'INCOME';
                  const isExpense = tx.direction === 'EXPENSE';

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setActiveTx(tx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                        gap: '12px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: isIncome ? 'var(--income-bg)' : isExpense ? 'var(--expense-bg)' : 'var(--transfer-bg)',
                            color: isIncome ? 'var(--income)' : isExpense ? 'var(--expense)' : 'var(--transfer)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isIncome ? <ArrowDownLeft size={16} /> : isExpense ? <ArrowUpRight size={16} /> : <ArrowLeftRight size={16} />}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
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
                            {tx.description}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            {tx.category ? (
                              <span style={{ color: tx.category.color || 'var(--text-secondary)', fontWeight: 600 }}>
                                {tx.category.name}
                              </span>
                            ) : (
                              <span style={{ color: '#d97706', fontWeight: 600 }}>• Chưa phân loại</span>
                            )}
                            {tx.code && <span>• Ref: {tx.code}</span>}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: isIncome ? 'var(--income)' : isExpense ? 'var(--expense)' : 'var(--transfer)',
                          flexShrink: 0,
                          textAlign: 'right',
                        }}
                      >
                        {isIncome ? '+' : isExpense ? '-' : ''}
                        {formatVND(tx.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
          <button
            onClick={() => loadData({ page: pagination.page - 1 })}
            disabled={pagination.page <= 1}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft size={16} /> Trang trước
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Trang {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => loadData({ page: pagination.page + 1 })}
            disabled={pagination.page >= pagination.totalPages}
            className="btn btn-secondary btn-sm"
          >
            Trang sau <ChevronRight size={16} />
          </button>
        </div>
      )}
        </>
      )}

      {/* Detail Bottom Sheet / Modal */}
      {activeTx && (
        <div className="modal-overlay" onClick={() => { setActiveTx(null); setIsEditingTx(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                  {isEditingTx ? 'Chỉnh sửa giao dịch' : 'Chi tiết giao dịch'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(activeTx.transactionDate)}</div>
              </div>
              <button onClick={() => { setActiveTx(null); setIsEditingTx(false); }} className="btn btn-ghost" style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {isEditingTx ? (
              <form onSubmit={handleSaveEditTx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Loại giao dịch</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setEditDirection('EXPENSE')}
                      className={`btn ${editDirection === 'EXPENSE' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Tiền ra (Chi)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDirection('INCOME')}
                      className={`btn ${editDirection === 'INCOME' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Tiền vào (Thu)
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Số tiền (VND)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nội dung giao dịch</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Ngày giao dịch</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Danh mục</label>
                  <select
                    className="form-select"
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value)}
                  >
                    <option value="">-- Chưa phân loại --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingTx(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-input)', borderRadius: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: activeTx.direction === 'INCOME' ? 'var(--income)' : 'var(--expense)',
                    }}
                  >
                    {activeTx.direction === 'INCOME' ? '+' : '-'}
                    {formatVND(activeTx.amount)}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '6px', fontWeight: 600 }}>
                    {activeTx.description}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '16px' }}>
                  {activeTx.code && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Mã tham chiếu:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeTx.code}</span>
                        <button onClick={() => handleCopyCode(activeTx.code!)} className="btn btn-ghost" style={{ padding: '4px' }}>
                          {copiedId ? <CheckCircle2 size={13} color="var(--income)" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Danh mục hiện tại:</span>
                    <span className="badge" style={{ background: `${activeTx.category?.color || '#94a3b8'}22`, color: activeTx.category?.color || 'var(--text-primary)' }}>
                      {activeTx.category?.name || 'Chưa phân loại'}
                    </span>
                  </div>
                </div>

                {/* Quick Reclassify Palette */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Đổi danh mục nhanh:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleQuickReclassify(c.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          border: activeTx.categoryId === c.id ? `2px solid ${c.color || 'var(--primary)'}` : '1px solid var(--border-subtle)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={handleStartEditTx} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <Edit3 size={14} />
                    <span>Sửa</span>
                  </button>
                  <button onClick={handleCreateRuleFromTx} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <Sparkles size={14} color="#f59e0b" />
                    <span>Tạo quy tắc</span>
                  </button>
                  <button onClick={() => handleDelete(activeTx.id)} className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <Trash2 size={14} />
                    <span>Xóa</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Thêm giao dịch thủ công</h3>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Loại giao dịch</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFormDirection('EXPENSE')}
                    className={`btn ${formDirection === 'EXPENSE' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Chi tiêu (Tiền ra)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDirection('INCOME')}
                    className={`btn ${formDirection === 'INCOME' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Thu nhập (Tiền vào)
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Số tiền (VND)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="50000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nội dung / Mô tả</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ăn tối, Mua sách..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Danh mục</label>
                <select className="form-select" value={formCat} onChange={(e) => setFormCat(e.target.value)}>
                  <option value="">-- Chưa phân loại --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Ngày giao dịch</label>
                <input
                  type="date"
                  className="form-input"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
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
