import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Trash2,
  Tag,
  ChevronLeft,
  ChevronRight,
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
}) => {
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedCatId, setSelectedCatId] = useState('');

  // Form states for manual add
  const [formAccount, setFormAccount] = useState(accounts[0]?.id || '');
  const [formAmount, setFormAmount] = useState('');
  const [formDirection, setFormDirection] = useState<TransactionDirection>('EXPENSE');
  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  const applyFilters = (overrides = {}) => {
    onFilterChange({
      search,
      direction: directionFilter || undefined,
      categoryId: categoryFilter || undefined,
      accountId: accountFilter || undefined,
      page: 1,
      ...overrides,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleSaveCategory = () => {
    if (editingTx && selectedCatId) {
      onReclassify(editingTx.id, selectedCatId);
      setEditingTx(null);
    }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header and Controls */}
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
          <h2 style={{ fontSize: '22px' }}>Sổ giao dịch</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Theo dõi và phân loại toàn bộ dòng tiền vào, ra và chuyển khoản nội bộ
          </div>
        </div>

        <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Thêm giao dịch thủ công</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div
        className="glass-card"
        style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}
      >
        <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Tìm theo nội dung, mã giao dịch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </form>

        <select
          className="form-select"
          value={directionFilter}
          onChange={(e) => {
            setDirectionFilter(e.target.value);
            applyFilters({ direction: e.target.value || undefined });
          }}
          style={{ width: '150px' }}
        >
          <option value="">Tất cả loại</option>
          <option value="INCOME">Tiền vào (Thu)</option>
          <option value="EXPENSE">Tiền ra (Chi)</option>
          <option value="TRANSFER">Chuyển nội bộ</option>
        </select>

        <select
          className="form-select"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            applyFilters({ categoryId: e.target.value || undefined });
          }}
          style={{ width: '180px' }}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          value={accountFilter}
          onChange={(e) => {
            setAccountFilter(e.target.value);
            applyFilters({ accountId: e.target.value || undefined });
          }}
          style={{ width: '180px' }}
        >
          <option value="">Tất cả tài khoản</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Transactions Table */}
      <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Thời gian</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Nội dung chuyển khoản</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Tài khoản</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Danh mục</th>
              <th style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'right' }}>Số tiền</th>
              <th style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không tìm thấy giao dịch nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {formatDate(tx.transactionDate)}
                  </td>
                  <td style={{ padding: '14px 18px', maxWidth: '340px' }}>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{tx.description}</div>
                    {tx.code && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Mã: {tx.code}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {tx.account?.displayName || 'Tài khoản chính'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <button
                      onClick={() => {
                        setEditingTx(tx);
                        setSelectedCatId(tx.categoryId || '');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title="Bấm để đổi phân loại"
                    >
                      {tx.category ? (
                        <span
                          className="badge"
                          style={{
                            background: `${tx.category.color}22`,
                            color: tx.category.color,
                            border: `1px solid ${tx.category.color}44`,
                          }}
                        >
                          <Tag size={12} />
                          {tx.category.name}
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <Tag size={12} />
                          Chưa phân loại
                        </span>
                      )}
                    </button>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        fontFamily: 'var(--font-mono)',
                        color:
                          tx.direction === 'INCOME'
                            ? 'var(--income)'
                            : tx.direction === 'EXPENSE'
                            ? 'var(--expense)'
                            : 'var(--transfer)',
                      }}
                    >
                      {tx.direction === 'INCOME' ? '+' : tx.direction === 'EXPENSE' ? '-' : ''}
                      {formatVND(tx.amount)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <button
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '6px' }}
                      title="Xóa giao dịch"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            Hiển thị trang {pagination.page} / {Math.max(pagination.totalPages, 1)} (Tổng cộng{' '}
            {pagination.total} giao dịch)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft size={15} /> Trước
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn btn-secondary btn-sm"
            >
              Sau <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Quick Edit Category */}
      {editingTx && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Chỉnh sửa phân loại</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Giao dịch: <strong>{editingTx.description}</strong> ({formatVND(editingTx.amount)})
            </p>

            <div className="form-group">
              <label className="form-label">Chọn danh mục mới</label>
              <select
                className="form-select"
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
              >
                <option value="">-- Chưa phân loại --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Hệ thống sẽ ghi nhớ phân loại này và không tự động ghi đè trong tương lai.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setEditingTx(null)} className="btn btn-secondary">
                Hủy
              </button>
              <button onClick={handleSaveCategory} className="btn btn-primary">
                Lưu phân loại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Add Transaction */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Thêm giao dịch thủ công</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="form-label">Tài khoản</label>
                <select
                  className="form-select"
                  value={formAccount}
                  onChange={(e) => setFormAccount(e.target.value)}
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName} ({formatVND(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Loại giao dịch</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormDirection('EXPENSE')}
                    className={`btn btn-sm ${formDirection === 'EXPENSE' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    Tiền ra (Chi tiêu)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDirection('INCOME')}
                    className={`btn btn-sm ${formDirection === 'INCOME' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    Tiền vào (Thu nhập)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Số tiền (VND)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ví dụ: 150000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nội dung giao dịch</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Ăn trưa bún bò"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Danh mục</label>
                <select
                  className="form-select"
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                >
                  <option value="">-- Tự động theo quy tắc --</option>
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
                  className="form-input"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Tạo giao dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
