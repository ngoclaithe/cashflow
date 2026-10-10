import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  Tag,
  ArrowUpDown,
  BellRing,
} from 'lucide-react';
import { CategorizationRule, Category } from '../types';

interface SettingsViewProps {
  rules: CategorizationRule[];
  categories: Category[];
  onAddRule: (data: any) => void;
  onDeleteRule: (id: string) => void;
  onAddCategory: (data: any) => void;
  onDeleteCategory: (id: string) => void;
  onTestTelegram: () => Promise<{ success: boolean; message: string }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  rules,
  categories,
  onAddRule,
  onDeleteRule,
  onAddCategory,
  onDeleteCategory,
  onTestTelegram,
}) => {
  // New Rule Form Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [rulePriority, setRulePriority] = useState('50');
  const [ruleField, setRuleField] = useState<'DESCRIPTION' | 'COUNTERPARTY'>('DESCRIPTION');
  const [ruleOp, setRuleOp] = useState<'CONTAINS' | 'EQUALS' | 'STARTS_WITH'>('CONTAINS');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState(categories[0]?.id || '');

  // New Category Form Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [catColor, setCatColor] = useState('#6366f1');

  // Telegram test feedback
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !ruleValue || !ruleCategoryId) return;

    onAddRule({
      name: ruleName,
      priority: parseInt(rulePriority, 10),
      field: ruleField,
      operator: ruleOp,
      value: ruleValue,
      categoryId: ruleCategoryId,
    });

    setIsRuleModalOpen(false);
    setRuleName('');
    setRuleValue('');
  };

  const handleCreateCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;

    onAddCategory({
      name: catName,
      type: catType,
      color: catColor,
    });

    setIsCatModalOpen(false);
    setCatName('');
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramStatus('Đang gửi tin nhắn thử nghiệm tới Telegram...');
    try {
      const res = await onTestTelegram();
      setTelegramStatus(res.message);
    } catch (e: any) {
      setTelegramStatus(`Lỗi: ${e.message}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '22px' }}>Cấu hình & Quy tắc phân loại tự động</h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Thiết lập thứ tự ưu tiên phân loại giao dịch ngân hàng và quản lý danh mục chi tiêu
        </div>
      </div>

      {/* Telegram Notification Config */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BellRing size={20} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>Thông báo Telegram Bot</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Nhận thông báo khi chạm ngưỡng ngân sách (70%, 90%, 100%), nhắc nộp tiền nhà trước ngày 5, và báo cáo đối soát 23:30.
            </div>
            {telegramStatus && (
              <div style={{ fontSize: '12px', color: 'var(--income)', marginTop: '4px' }}>
                {telegramStatus}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleTestTelegram}
          disabled={isTestingTelegram}
          className="btn btn-secondary btn-sm"
        >
          <Send size={14} />
          <span>{isTestingTelegram ? 'Đang gửi...' : 'Gửi thử nghiệm Telegram'}</span>
        </button>
      </div>

      {/* Categorization Rules Section */}
      <div className="glass-card" style={{ padding: 0 }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '16px' }}>Quy tắc phân loại tự động (Categorization Rules)</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Quy tắc có độ ưu tiên cao hơn (Priority) sẽ được khớp trước.
            </div>
          </div>

          <button onClick={() => setIsRuleModalOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={14} /> Thêm quy tắc
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Ưu tiên</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Tên quy tắc</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Điều kiện khớp</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Từ khóa</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Gán vào Danh mục</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Chưa có quy tắc nào.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                        {rule.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>{rule.name}</td>
                    <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                      {rule.field} {rule.operator}
                    </td>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', color: '#b45309' }}>
                      "{rule.value}"
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span
                        className="badge"
                        style={{
                          background: `${rule.category?.color || '#94a3b8'}22`,
                          color: rule.category?.color || 'var(--text-primary)',
                        }}
                      >
                        {rule.category?.name || 'Danh mục'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                      <button
                        onClick={() => onDeleteRule(rule.id)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '6px' }}
                        title="Xóa quy tắc"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Categories Manager */}
      <div className="glass-card" style={{ padding: 0 }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '16px' }}>Danh mục thu chi (Categories)</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Danh mục hệ thống và tùy chỉnh của người dùng
            </div>
          </div>

          <button onClick={() => setIsCatModalOpen(true)} className="btn btn-secondary btn-sm">
            <Plus size={14} /> Thêm danh mục
          </button>
        </div>

        <div
          style={{
            padding: '18px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {categories.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: c.color || '#6366f1',
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</span>
              </div>

              {!c.isSystem && (
                <button
                  onClick={() => onDeleteCategory(c.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Rule */}
      {isRuleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Tạo quy tắc phân loại mới</h3>
            <form onSubmit={handleCreateRule}>
              <div className="form-group">
                <label className="form-label">Tên quy tắc</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Lương tháng công ty"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Độ ưu tiên (Priority)</label>
                <input
                  type="number"
                  className="form-input"
                  value={rulePriority}
                  onChange={(e) => setRulePriority(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Số càng cao thì càng được so khớp trước (Ví dụ: 100 cao hơn 50).
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Trường dữ liệu kiểm tra</label>
                <select
                  className="form-select"
                  value={ruleField}
                  onChange={(e) => setRuleField(e.target.value as any)}
                >
                  <option value="DESCRIPTION">Nội dung chuyển khoản (Description)</option>
                  <option value="COUNTERPARTY">Đối tác chuyển tiền (Counterparty)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Phép so sánh</label>
                <select
                  className="form-select"
                  value={ruleOp}
                  onChange={(e) => setRuleOp(e.target.value as any)}
                >
                  <option value="CONTAINS">Chứa từ khóa (Contains)</option>
                  <option value="EQUALS">Chính xác bằng (Equals)</option>
                  <option value="STARTS_WITH">Bắt đầu bằng (Starts with)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Từ khóa cần khớp (Không phân biệt hoa thường)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: LUONG, TIEN NHA, GYM..."
                  value={ruleValue}
                  onChange={(e) => setRuleValue(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tự động gán vào danh mục</label>
                <select
                  className="form-select"
                  value={ruleCategoryId}
                  onChange={(e) => setRuleCategoryId(e.target.value)}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsRuleModalOpen(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu quy tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Category */}
      {isCatModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Thêm danh mục mới</h3>
            <form onSubmit={handleCreateCat}>
              <div className="form-group">
                <label className="form-label">Tên danh mục</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Mua sắm đồ công nghệ"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Loại thu / chi</label>
                <select
                  className="form-select"
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                >
                  <option value="EXPENSE">Chi tiêu (Tiền ra)</option>
                  <option value="INCOME">Thu nhập (Tiền vào)</option>
                  <option value="TRANSFER">Chuyển khoản nội bộ</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Màu sắc nhận diện</label>
                <input
                  type="color"
                  className="form-input"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  style={{ height: '44px', padding: '4px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu danh mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
