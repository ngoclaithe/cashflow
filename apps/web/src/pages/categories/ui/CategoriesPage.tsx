import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Tags,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  RefreshCw,
  FolderTree,
  Zap,
} from 'lucide-react';
import { CategorizationRule, Category } from '../../../shared/types';
import { api } from '../../../shared/api/client';

const COLOR_PRESETS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#dc2626', // Red
  '#d97706', // Amber
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#475569', // Slate
];

export const CategoriesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'rules'>('categories');
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [catSearch, setCatSearch] = useState('');
  const [catTypeFilter, setCatTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME' | 'TRANSFER'>('ALL');
  const [ruleSearch, setRuleSearch] = useState('');

  // Status feedback
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isApplyingRules, setIsApplyingRules] = useState(false);

  // Rule Form Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CategorizationRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [rulePriority, setRulePriority] = useState('50');
  const [ruleField, setRuleField] = useState<CategorizationRule['field']>('DESCRIPTION');
  const [ruleOp, setRuleOp] = useState<CategorizationRule['operator']>('CONTAINS');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState('');

  // Category Form Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [catColor, setCatColor] = useState('#4f46e5');

  const loadData = async () => {
    try {
      setLoading(true);
      const [rRes, cRes] = await Promise.all([
        api.getRules().catch(() => []),
        api.getCategories().catch(() => []),
      ]);
      setRules(rRes);
      setCategories(cRes);
      if (!ruleCategoryId && cRes.length > 0) {
        setRuleCategoryId(cRes[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 5000);
  };

  // ---------------- CATEGORY CRUD ----------------
  const handleOpenAddCat = () => {
    setEditingCategory(null);
    setCatName('');
    setCatType('EXPENSE');
    setCatColor('#4f46e5');
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (c: Category) => {
    setEditingCategory(c);
    setCatName(c.name);
    setCatType(c.type);
    setCatColor(c.color || '#4f46e5');
    setIsCatModalOpen(true);
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: catName.trim(),
          type: catType,
          color: catColor,
        });
        showFeedback(`Đã cập nhật danh mục "${catName}" thành công!`);
      } else {
        await api.createCategory({
          name: catName.trim(),
          type: catType,
          color: catColor,
        });
        showFeedback(`Đã thêm danh mục mới "${catName}"!`);
      }
      setIsCatModalOpen(false);
      setEditingCategory(null);
      setCatName('');
      await loadData();
    } catch (err: any) {
      showFeedback(`Lỗi: ${err.message || 'Không thể lưu danh mục'}`, 'error');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${name}"? Các giao dịch liên quan sẽ được chuyển về chưa phân loại.`)) return;
    try {
      await api.deleteCategory(id);
      showFeedback(`Đã xóa danh mục "${name}"!`);
      await loadData();
    } catch (err: any) {
      showFeedback(`Lỗi xóa: ${err.message || 'Không thể xóa'}`, 'error');
    }
  };

  // ---------------- RULES CRUD ----------------
  const handleOpenAddRule = () => {
    setEditingRule(null);
    setRuleName('');
    setRulePriority('60');
    setRuleField('DESCRIPTION');
    setRuleOp('CONTAINS');
    setRuleValue('');
    if (categories.length > 0) setRuleCategoryId(categories[0].id);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (r: CategorizationRule) => {
    setEditingRule(r);
    setRuleName(r.name);
    setRulePriority(r.priority.toString());
    setRuleField(r.field);
    setRuleOp(r.operator);
    setRuleValue(r.value);
    setRuleCategoryId(r.categoryId);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleValue.trim() || !ruleCategoryId) return;

    try {
      const payload = {
        name: ruleName.trim(),
        priority: parseInt(rulePriority, 10) || 50,
        field: ruleField,
        operator: ruleOp,
        value: ruleValue.trim(),
        categoryId: ruleCategoryId,
      };

      if (editingRule) {
        await api.updateRule(editingRule.id, payload);
        showFeedback(`Đã cập nhật quy tắc "${ruleName}"!`);
      } else {
        await api.createRule(payload);
        showFeedback(`Đã tạo quy tắc mới "${ruleName}"!`);
      }

      setIsRuleModalOpen(false);
      setEditingRule(null);
      setRuleName('');
      setRuleValue('');
      await loadData();
    } catch (err: any) {
      showFeedback(`Lỗi: ${err.message || 'Không thể lưu quy tắc'}`, 'error');
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa quy tắc "${name}"?`)) return;
    try {
      await api.deleteRule(id);
      showFeedback(`Đã xóa quy tắc "${name}"!`);
      await loadData();
    } catch (err: any) {
      showFeedback(`Lỗi: ${err.message || 'Không thể xóa quy tắc'}`, 'error');
    }
  };

  const handleApplyRulesAll = async () => {
    setIsApplyingRules(true);
    try {
      const res = await api.applyRules();
      showFeedback(`⚡ Thành công! Đã quét và tự động phân loại ${res.updatedCount || 0} giao dịch theo các quy tắc hiện tại.`);
    } catch (err: any) {
      showFeedback(`Lỗi áp dụng quy tắc: ${err.message || 'Thất bại'}`, 'error');
    } finally {
      setIsApplyingRules(false);
    }
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchType = catTypeFilter === 'ALL' || c.type === catTypeFilter;
      const matchSearch = !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase());
      return matchType && matchSearch;
    });
  }, [categories, catTypeFilter, catSearch]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules
      .filter((r) => {
        if (!ruleSearch) return true;
        const q = ruleSearch.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.value.toLowerCase().includes(q) ||
          (r.category?.name || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.priority - a.priority);
  }, [rules, ruleSearch]);

  // Stats
  const expenseCount = categories.filter((c) => c.type === 'EXPENSE').length;
  const incomeCount = categories.filter((c) => c.type === 'INCOME').length;
  const transferCount = categories.filter((c) => c.type === 'TRANSFER').length;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
        <div>Đang tải danh mục và quy tắc phân loại...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
              }}
            >
              <Tags size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Danh mục & Phân loại giao dịch
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Quản lý hệ thống danh mục thu chi văn phòng, công nghệ và các quy tắc tự động nhận diện
              </div>
            </div>
          </div>
        </div>

        {/* Tab switch buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-input)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setActiveTab('categories')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeTab === 'categories' ? 600 : 500,
              color: activeTab === 'categories' ? '#fff' : 'var(--text-secondary)',
              background: activeTab === 'categories' ? 'var(--primary)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <FolderTree size={14} />
            <span>Danh mục thu chi ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeTab === 'rules' ? 600 : 500,
              color: activeTab === 'rules' ? '#fff' : 'var(--text-secondary)',
              background: activeTab === 'rules' ? 'var(--primary)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Quy tắc tự động ({rules.length})</span>
          </button>
        </div>
      </div>

      {/* Action feedback alert */}
      {actionMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: actionMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${actionMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: actionMessage.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Stat Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div className="glass-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tổng danh mục</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            {categories.length}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Khoản chi tiêu</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--expense)', marginTop: '2px' }}>
            {expenseCount}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Khoản thu nhập</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--income)', marginTop: '2px' }}>
            {incomeCount}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quy tắc tự khớp</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5', marginTop: '2px' }}>
            {rules.length} quy tắc
          </div>
        </div>
      </div>

      {/* VIEW 1: CATEGORIES MANAGER */}
      {activeTab === 'categories' && (
        <div className="glass-card" style={{ padding: 0 }}>
          {/* Controls Bar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            {/* Filter buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'ALL', label: `Tất cả (${categories.length})` },
                  { id: 'EXPENSE', label: `Chi tiêu (${expenseCount})` },
                  { id: 'INCOME', label: `Thu nhập (${incomeCount})` },
                  { id: 'TRANSFER', label: `Nội bộ (${transferCount})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCatTypeFilter(f.id)}
                  className={`btn btn-sm ${catTypeFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '20px', padding: '5px 12px' }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search + Add */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Tìm danh mục..."
                  className="form-input"
                  style={{ paddingLeft: '30px', width: '180px', height: '36px', fontSize: '13px' }}
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                />
              </div>

              <button onClick={handleOpenAddCat} className="btn btn-primary btn-sm">
                <Plus size={14} /> Thêm danh mục
              </button>
            </div>
          </div>

          {/* Categories Grid */}
          <div
            style={{
              padding: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px',
            }}
          >
            {filteredCategories.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Không tìm thấy danh mục phù hợp.
              </div>
            ) : (
              filteredCategories.map((c) => {
                const typeLabel =
                  c.type === 'EXPENSE' ? 'Chi tiêu' : c.type === 'INCOME' ? 'Thu nhập' : 'Nội bộ';
                const typeColor =
                  c.type === 'EXPENSE' ? 'var(--expense)' : c.type === 'INCOME' ? 'var(--income)' : '#64748b';

                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: c.color || '#4f46e5',
                          flexShrink: 0,
                          boxShadow: `0 0 0 3px ${c.color || '#4f46e5'}22`,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              color: typeColor,
                            }}
                          >
                            {typeLabel}
                          </span>
                          {c.isSystem && (
                            <span
                              style={{
                                fontSize: '10px',
                                background: 'var(--border-subtle)',
                                color: 'var(--text-muted)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                            >
                              Mặc định
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleOpenEditCat(c)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 7px' }}
                        title="Chỉnh sửa danh mục"
                      >
                        <Edit3 size={13} color="var(--primary)" />
                      </button>
                      {!c.isSystem && (
                        <button
                          onClick={() => handleDeleteCategory(c.id, c.name)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '5px 7px' }}
                          title="Xóa danh mục"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: CATEGORIZATION RULES */}
      {activeTab === 'rules' && (
        <div className="glass-card" style={{ padding: 0 }}>
          {/* Rules Action Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Quy tắc tự động khớp danh mục
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Khi ngân hàng đồng bộ về, hệ thống duyệt theo thứ tự ưu tiên (Priority từ cao xuống thấp) để tự gán danh mục
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Tìm quy tắc / từ khóa..."
                  className="form-input"
                  style={{ paddingLeft: '30px', width: '200px', height: '36px', fontSize: '13px' }}
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                />
              </div>

              <button
                onClick={handleApplyRulesAll}
                disabled={isApplyingRules}
                className="btn btn-secondary btn-sm"
                title="Áp dụng quy tắc cho tất cả giao dịch chưa phân loại"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f8fafc',
                  borderColor: '#cbd5e1',
                  color: '#1e293b',
                  fontWeight: 600,
                }}
              >
                <Zap size={14} color="#f59e0b" className={isApplyingRules ? 'spin' : ''} />
                <span>{isApplyingRules ? 'Đang áp dụng...' : 'Quét & Áp dụng quy tắc'}</span>
              </button>

              <button onClick={handleOpenAddRule} className="btn btn-primary btn-sm">
                <Plus size={14} /> Thêm quy tắc mới
              </button>
            </div>
          </div>

          {/* Rules Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 600, width: '90px' }}>Ưu tiên</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Tên quy tắc</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Điều kiện khớp</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Từ khóa nhận diện</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Tự gán Danh mục</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'center', width: '110px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không có quy tắc nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr
                      key={rule.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 18px' }}>
                        <span
                          className="badge"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: rule.priority >= 80 ? 'rgba(79, 70, 229, 0.12)' : 'var(--bg-input)',
                            color: rule.priority >= 80 ? 'var(--primary)' : 'var(--text-secondary)',
                            border: `1px solid ${rule.priority >= 80 ? 'rgba(79, 70, 229, 0.25)' : 'var(--border-subtle)'}`,
                          }}
                        >
                          P{rule.priority}
                        </span>
                      </td>

                      <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {rule.name}
                      </td>

                      <td style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {rule.field === 'DESCRIPTION' ? 'Nội dung ck' : 'Đối tác ck'}{' '}
                        <span style={{ color: 'var(--text-muted)' }}>
                          {rule.operator === 'CONTAINS'
                            ? 'chứa'
                            : rule.operator === 'EQUALS'
                            ? 'bằng'
                            : 'bắt đầu'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 18px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '3px 7px',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                          }}
                        >
                          "{rule.value}"
                        </span>
                      </td>

                      <td style={{ padding: '12px 18px' }}>
                        <span
                          className="badge"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: `${rule.category?.color || '#94a3b8'}18`,
                            color: rule.category?.color || 'var(--text-primary)',
                            border: `1px solid ${rule.category?.color || '#94a3b8'}40`,
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: rule.category?.color || '#94a3b8',
                            }}
                          />
                          {rule.category?.name || 'Chưa rõ'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenEditRule(rule)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 8px' }}
                            title="Sửa quy tắc"
                          >
                            <Edit3 size={13} color="var(--primary)" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '6px 8px' }}
                            title="Xóa quy tắc"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Category */}
      {isCatModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCatModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              {editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
            </h3>
            <form onSubmit={handleSaveCat}>
              <div className="form-group">
                <label className="form-label">Tên danh mục</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Ăn trưa văn phòng, Cà phê & nước uống..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  autoFocus
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="color"
                    className="form-input"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    style={{ width: '46px', height: '36px', padding: '2px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {catColor}
                  </span>
                </div>

                {/* Color presets palette */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setCatColor(col)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: col,
                        border: catColor.toLowerCase() === col.toLowerCase() ? '2px solid #000' : 'none',
                        cursor: 'pointer',
                        transform: catColor.toLowerCase() === col.toLowerCase() ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.1s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? 'Lưu thay đổi' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Rule */}
      {isRuleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRuleModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              {editingRule ? 'Chỉnh sửa quy tắc phân loại' : 'Tạo quy tắc tự động khớp mới'}
            </h3>
            <form onSubmit={handleSaveRule}>
              <div className="form-group">
                <label className="form-label">Tên quy tắc</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Cà phê Highland, Ăn trưa Baemin, Grab..."
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Độ ưu tiên (Priority 1 - 100)</label>
                <input
                  type="number"
                  className="form-input"
                  value={rulePriority}
                  onChange={(e) => setRulePriority(e.target.value)}
                  min="1"
                  max="100"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Số càng cao được so khớp trước (Quy tắc đặc thù nên để 80-95, quy tắc chung để 30-50).
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Trường kiểm tra</label>
                  <select
                    className="form-select"
                    value={ruleField}
                    onChange={(e) => setRuleField(e.target.value as any)}
                  >
                    <option value="DESCRIPTION">Nội dung ck (Description)</option>
                    <option value="COUNTERPARTY">Đối tác ck (Counterparty)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Kiểu so khớp</label>
                  <select
                    className="form-select"
                    value={ruleOp}
                    onChange={(e) => setRuleOp(e.target.value as any)}
                  >
                    <option value="CONTAINS">Chứa từ khóa</option>
                    <option value="EQUALS">Chính xác bằng</option>
                    <option value="STARTS_WITH">Bắt đầu bằng</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Từ khóa cần khớp (Không phân biệt hoa thường)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: HIGHLAND, AN TRUA, SHOPEE, GRAB..."
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
                      {c.name} ({c.type === 'EXPENSE' ? 'Chi' : c.type === 'INCOME' ? 'Thu' : 'Nội bộ'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                <button type="button" onClick={() => setIsRuleModalOpen(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRule ? 'Cập nhật quy tắc' : 'Lưu quy tắc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
