import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

// ==========================================
// 1. MEMOIZED TRANSACTION ROW COMPONENT
// Zero re-renders for unchanged items in feed!
// ==========================================
interface TransactionRowProps {
  tx: Transaction;
  onSelect: (tx: Transaction) => void;
}

export const TransactionRow = React.memo<TransactionRowProps>(
  ({ tx, onSelect }) => {
    const isIncome = tx.direction === 'INCOME';
    const isExpense = tx.direction === 'EXPENSE';

    return (
      <div
        onClick={() => onSelect(tx)}
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
  },
  (prev, next) => {
    // Exact shallow field equality check to strictly prevent re-render unless THIS specific item mutated
    return (
      prev.tx.id === next.tx.id &&
      prev.tx.amount === next.tx.amount &&
      prev.tx.direction === next.tx.direction &&
      prev.tx.description === next.tx.description &&
      prev.tx.categoryId === next.tx.categoryId &&
      prev.tx.transactionDate === next.tx.transactionDate &&
      prev.tx.code === next.tx.code &&
      prev.tx.userCategoryOverride === next.tx.userCategoryOverride &&
      prev.tx.category?.name === next.tx.category?.name &&
      prev.tx.category?.color === next.tx.category?.color &&
      prev.onSelect === next.onSelect
    );
  }
);

// ==========================================
// 2. ISOLATED TRANSACTION DETAIL MODAL
// All edit state & inputs live strictly here!
// Prevents typing & actions from re-rendering feed
// ==========================================
interface TransactionDetailModalProps {
  tx: Transaction;
  categories: Category[];
  onClose: () => void;
  onQuickReclassify: (categoryId: string) => void;
  onSaveEdit: (updatedFields: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
  onCreateRule: (tx: Transaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  tx,
  categories,
  onClose,
  onQuickReclassify,
  onSaveEdit,
  onDelete,
  onCreateRule,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Form states isolated inside modal
  const [editAmount, setEditAmount] = useState(() => tx.amount.toString());
  const [editDesc, setEditDesc] = useState(() => tx.description);
  const [editDate, setEditDate] = useState(() =>
    tx.transactionDate ? tx.transactionDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [editCat, setEditCat] = useState(() => tx.categoryId || '');
  const [editDirection, setEditDirection] = useState<TransactionDirection>(() => tx.direction);

  useEffect(() => {
    setEditAmount(tx.amount.toString());
    setEditDesc(tx.description);
    setEditDate(tx.transactionDate ? tx.transactionDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditCat(tx.categoryId || '');
    setEditDirection(tx.direction);
  }, [tx]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveEdit({
      amount: parseFloat(editAmount),
      description: editDesc,
      transactionDate: new Date(editDate).toISOString(),
      categoryId: editCat || null,
      direction: editDirection,
      category: categories.find((c) => c.id === editCat),
    });
    setIsEditing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
              {isEditing ? 'Chỉnh sửa giao dịch' : 'Chi tiết giao dịch'}
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(tx.transactionDate)}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                onClick={() => setIsEditing(false)}
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
                  color: tx.direction === 'INCOME' ? 'var(--income)' : 'var(--expense)',
                }}
              >
                {tx.direction === 'INCOME' ? '+' : '-'}
                {formatVND(tx.amount)}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '6px', fontWeight: 600 }}>
                {tx.description}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '16px' }}>
              {tx.code && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Mã tham chiếu:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{tx.code}</span>
                    <button onClick={() => handleCopyCode(tx.code!)} className="btn btn-ghost" style={{ padding: '4px' }}>
                      {copiedId ? <CheckCircle2 size={13} color="var(--income)" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Danh mục hiện tại:</span>
                <span className="badge" style={{ background: `${tx.category?.color || '#94a3b8'}22`, color: tx.category?.color || 'var(--text-primary)' }}>
                  {tx.category?.name || 'Chưa phân loại'}
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
                    onClick={() => onQuickReclassify(c.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: tx.categoryId === c.id ? `2px solid ${c.color || 'var(--primary)'}` : '1px solid var(--border-subtle)',
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
              <button onClick={() => setIsEditing(true)} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                <Edit3 size={14} />
                <span>Sửa</span>
              </button>
              <button onClick={() => onCreateRule(tx)} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                <Sparkles size={14} color="#f59e0b" />
                <span>Tạo quy tắc</span>
              </button>
              <button onClick={() => onDelete(tx.id)} className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                <Trash2 size={14} />
                <span>Xóa</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. ISOLATED MANUAL ADD TRANSACTION MODAL
// ==========================================
interface AddTransactionModalProps {
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onSubmit: (data: {
    accountId: string;
    amount: number;
    direction: TransactionDirection;
    description: string;
    categoryId?: string;
    transactionDate: string;
  }) => Promise<void>;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  categories,
  accounts,
  onClose,
  onSubmit,
}) => {
  const [formAccount, setFormAccount] = useState(() => (accounts.length > 0 ? accounts[0].id : ''));
  const [formAmount, setFormAmount] = useState('');
  const [formDirection, setFormDirection] = useState<TransactionDirection>('EXPENSE');
  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount || !formAmount || !formDesc) return;
    await onSubmit({
      accountId: formAccount,
      amount: parseFloat(formAmount),
      direction: formDirection,
      description: formDesc,
      categoryId: formCat || undefined,
      transactionDate: formDate,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Thêm giao dịch thủ công</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              Lưu giao dịch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 4. MAIN TRANSACTIONS PAGE
// ==========================================
interface TransactionsPageProps {
  onNavigate?: (tab: string) => void;
  initialView?: 'list' | 'calendar';
  refreshKey?: number;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ onNavigate, initialView = 'list', refreshKey }) => {
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

  // Active Transaction for Detail Modal
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Sync initial view mode if changed from prop
  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  const loadData = async (filters: any = {}, isSilent = false, forceRefresh = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [txRes, catRes, accRes] = await Promise.all([
        api.getTransactions(filters).catch(() => ({ items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } })),
        !forceRefresh && categories.length > 0 ? Promise.resolve(categories) : api.getCategories().catch(() => []),
        !forceRefresh && accounts.length > 0 ? Promise.resolve(accounts) : api.getAccounts().catch(() => []),
      ]);
      setTransactions(txRes.items);
      setPagination(txRes.pagination);
      setCategories(catRes);
      setAccounts(accRes);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (refreshKey) {
      const currentFilters: any = {
        search: search.trim() || undefined,
        direction: selectedDirection || undefined,
        categoryId: selectedCategory || undefined,
        accountId: selectedAccount || undefined,
        uncategorized: onlyUncategorized || undefined,
        page: pagination.page,
      };
      loadData(currentFilters, true, true);
    }
  }, [refreshKey]);

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

  // Switch view mode and update URL query param so F5 retains view
  const handleSwitchView = (mode: 'list' | 'calendar') => {
    setViewMode(mode);
    if (mode === 'calendar') {
      onNavigate?.('calendar');
    } else {
      onNavigate?.('transactions');
    }
  };

  // Stable row selection callback to preserve React.memo on TransactionRow
  const handleSelectRow = useCallback((tx: Transaction) => {
    setActiveTx(tx);
  }, []);

  // In-place Quick Reclassify: Only the 1 affected transaction item is updated
  const handleQuickReclassify = useCallback(
    async (categoryId: string) => {
      if (!activeTx) return;
      const targetCat = categories.find((c) => c.id === categoryId);
      const updatedTx: Transaction = {
        ...activeTx,
        categoryId,
        category: targetCat,
        userCategoryOverride: true,
      };

      // 1. Update active modal
      setActiveTx(updatedTx);

      // 2. In-place update in transactions array: only the matching item reference changes!
      // All other items keep identical references, so TransactionRow's React.memo bails out!
      setTransactions((prev) => prev.map((t) => (t.id === activeTx.id ? updatedTx : t)));

      // 3. Fire API asynchronously without blocking UI or reloading entire feed
      api.reclassifyTransaction(activeTx.id, categoryId).catch((err) => {
        console.error('Reclassify failed:', err);
        loadData({ page: pagination.page }, true);
      });
    },
    [activeTx, categories, pagination.page]
  );

  // In-place Edit Save: updates only the 1 modified transaction item
  const handleSaveEdit = useCallback(
    async (updatedFields: Partial<Transaction>) => {
      if (!activeTx) return;
      const updatedTx: Transaction = {
        ...activeTx,
        ...updatedFields,
      };

      // 1. Update modal and row in-place
      setActiveTx(updatedTx);
      setTransactions((prev) => prev.map((t) => (t.id === activeTx.id ? updatedTx : t)));

      // 2. Fire API asynchronously
      try {
        await api.updateTransaction(activeTx.id, {
          amount: updatedFields.amount,
          description: updatedFields.description,
          transactionDate: updatedFields.transactionDate,
          categoryId: updatedFields.categoryId || undefined,
          direction: updatedFields.direction,
        });
      } catch (err) {
        console.error('Update failed:', err);
        loadData({ page: pagination.page }, true);
      }
    },
    [activeTx, pagination.page]
  );

  // Delete transaction in-place
  const handleDeleteTx = useCallback(
    async (id: string) => {
      if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setActiveTx(null);

      try {
        await api.deleteTransaction(id);
        loadData({ page: pagination.page }, true);
      } catch (err) {
        console.error('Delete failed:', err);
        loadData({ page: pagination.page }, false);
      }
    },
    [pagination.page]
  );

  // Create rule from transaction
  const handleCreateRuleFromTx = useCallback(async (tx: Transaction) => {
    const cleanWord = tx.description.split(' ').slice(0, 3).join(' ');
    const ruleKeywords = prompt('Nhập từ khóa nhận diện tự động cho giao dịch này:', cleanWord);
    if (!ruleKeywords) return;

    if (!tx.categoryId) {
      alert('Vui lòng chọn danh mục cho giao dịch này trước khi tạo quy tắc!');
      return;
    }

    try {
      await api.createRule({
        name: `Quy tắc: ${ruleKeywords.trim().toUpperCase()}`,
        field: 'DESCRIPTION',
        operator: 'CONTAINS',
        value: ruleKeywords.trim().toUpperCase(),
        categoryId: tx.categoryId,
        priority: 50,
        isActive: true,
      });
      alert(`Đã lưu quy tắc tự động cho từ khóa "${ruleKeywords.trim().toUpperCase()}"!`);
    } catch (err: any) {
      alert(`Lỗi lưu quy tắc: ${err.message || 'Thất bại'}`);
    }
  }, []);

  // Add transaction callback
  const handleCreateSubmit = async (data: {
    accountId: string;
    amount: number;
    direction: TransactionDirection;
    description: string;
    categoryId?: string;
    transactionDate: string;
  }) => {
    await api.createTransaction(data);
    setIsAddOpen(false);
    await loadData({}, true);
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
              onClick={() => handleSwitchView('list')}
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
              onClick={() => handleSwitchView('calendar')}
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
        <CalendarPage onNavigate={onNavigate} refreshKey={refreshKey} />
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
                  background: selectedDirection === 'INCOME' ? 'var(--income)' : 'var(--bg-input)',
                  color: selectedDirection === 'INCOME' ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
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
                  background: selectedDirection === 'EXPENSE' ? 'var(--expense)' : 'var(--bg-input)',
                  color: selectedDirection === 'EXPENSE' ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
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
                  background: onlyUncategorized ? '#f59e0b' : 'var(--bg-input)',
                  color: onlyUncategorized ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
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

                  {/* Transactions in Group: each item is wrapped in React.memo */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.items.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        onSelect={handleSelectRow}
                      />
                    ))}
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

      {/* Detail Bottom Sheet / Modal (Isolated component) */}
      {activeTx && (
        <TransactionDetailModal
          tx={activeTx}
          categories={categories}
          onClose={() => setActiveTx(null)}
          onQuickReclassify={handleQuickReclassify}
          onSaveEdit={handleSaveEdit}
          onDelete={handleDeleteTx}
          onCreateRule={handleCreateRuleFromTx}
        />
      )}

      {/* Add Transaction Modal (Isolated component) */}
      {isAddOpen && (
        <AddTransactionModal
          categories={categories}
          accounts={accounts}
          onClose={() => setIsAddOpen(false)}
          onSubmit={handleCreateSubmit}
        />
      )}
    </div>
  );
};
export default TransactionsPage;
