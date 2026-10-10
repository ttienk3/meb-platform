import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw, 
  Zap, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { 
  api, 
  type CustomSchemaTable, 
  type CustomSchemaField, 
  type CustomSchemaAction, 
  type DynamicRecord,
  type Branch 
} from '../../services/api';
import { branchStore } from '../../services/branchContext';

export const DynamicEntityWorkspace: React.FC = () => {
  const [tables, setTables] = useState<CustomSchemaTable[]>([]);
  const [selectedTableCode, setSelectedTableCode] = useState<string>('');
  const [currentTableMeta, setCurrentTableMeta] = useState<{
    table: CustomSchemaTable;
    fields: CustomSchemaField[];
    actions: CustomSchemaAction[];
  } | null>(null);

  const [records, setRecords] = useState<DynamicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [branches, setBranches] = useState<Branch[]>([]);

  // Form thêm mới bản ghi động
  const [isNewRecordModalOpen, setIsNewRecordModalOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedBranchForRecord, setSelectedBranchForRecord] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load danh sách tables và branches
  useEffect(() => {
    const init = async () => {
      try {
        const [tablesRes, branchesRes] = await Promise.all([
          api.getSchemaTables(),
          api.getBranches()
        ]);
        setTables(tablesRes.data || []);
        setBranches(branchesRes.data || []);
        if (tablesRes.data?.length > 0) {
          setSelectedTableCode(tablesRes.data[0].code);
        }
      } catch (err) {
        console.error('🔥 [Workspace Init Error]:', err);
      }
    };
    init();
  }, []);

  // Load records & schema của table đang chọn
  const loadRecords = useCallback(async () => {
    if (!selectedTableCode) return;
    try {
      setLoading(true);
      const res = await api.getDynamicRecords(selectedTableCode, {
        branch_id: branchFilter,
        q: searchQuery
      });
      setCurrentTableMeta(res.meta);
      setRecords(res.data || []);
    } catch (err) {
      console.error('🔥 [Load Dynamic Records Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTableCode, branchFilter, searchQuery]);

  useEffect(() => {
    if (!selectedTableCode) return;
    let isMounted = true;
    api.getDynamicRecords(selectedTableCode, {
      branch_id: branchFilter,
      q: searchQuery
    }).then(res => {
      if (isMounted) {
        setCurrentTableMeta(res.meta);
        setRecords(res.data || []);
        setLoading(false);
      }
    }).catch(err => {
      console.error('🔥 [Load Dynamic Records Error]:', err);
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, [selectedTableCode, branchFilter, searchQuery]);

  // Handle thay đổi form input
  const handleInputChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
  };

  // Submit tạo mới bản ghi
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableCode) return;
    try {
      setSubmitting(true);
      await api.createDynamicRecord(selectedTableCode, {
        record_data: formData,
        branch_id: selectedBranchForRecord || branchStore.getActiveBranch()?.id || undefined,
        status: 'ACTIVE'
      });
      setIsNewRecordModalOpen(false);
      setFormData({});
      setActionSuccessMsg('Đã thêm bản ghi mới thành công!');
      setTimeout(() => setActionSuccessMsg(null), 3000);
      await loadRecords();
    } catch (err: any) {
      alert(`Lỗi tạo bản ghi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Kích hoạt Nút hành động tùy biến trên bản ghi
  const handleTriggerAction = async (recordId: string, actionKey: string, actionLabel: string) => {
    try {
      await api.triggerDynamicAction(selectedTableCode, recordId, actionKey, {
        note: 'Thao tác bởi Boss Quản Trị Hệ Thống'
      });
      setActionSuccessMsg(`Đã thực thi thành công: "${actionLabel}"`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      await loadRecords();
    } catch (err: any) {
      alert(`Lỗi thực thi nút: ${err.message}`);
    }
  };

  // Xóa bản ghi
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) return;
    try {
      await api.deleteDynamicRecord(selectedTableCode, recordId);
      await loadRecords();
    } catch (err: any) {
      alert(`Lỗi xóa bản ghi: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. THANH CHỌN BẢNG DỮ LIỆU & BỘ LỌC TỔNG */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 12,
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bảng CSDL Đang Chọn:</span>
              <select
                value={selectedTableCode}
                onChange={e => setSelectedTableCode(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#1e293b',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  fontSize: 14,
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {tables.map(t => (
                  <option key={t.id} value={t.code} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {currentTableMeta?.table.description || 'Hệ thống tự động đồng bộ API CRUD và Nút Thao Tác'}
            </span>
          </div>
        </div>

        {/* Nút thêm bản ghi mới */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => {
              setFormData({});
              setSelectedBranchForRecord(branchStore.getActiveBranch()?.id || '');
              setIsNewRecordModalOpen(true);
            }}
            className="btn-action"
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
              cursor: 'pointer'
            }}
          >
            <Plus size={15} />
            <span>+ Thêm Bản Ghi Mới</span>
          </button>
        </div>
      </div>

      {/* Thông báo thao tác thành công (Toast) */}
      {actionSuccessMsg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          background: 'rgba(52, 211, 153, 0.15)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          color: '#34d399',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 2. THANH BỘ LỌC TÌM KIẾM & CHI NHÁNH */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 16px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: 10,
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 8,
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          width: 300
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Tìm kiếm trong dữ liệu bản ghi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: 12,
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lọc Chi Nhánh:</span>
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Toàn bộ chi nhánh</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.code} • {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={loadRecords}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {/* 3. BẢNG DỮ LIỆU ĐỘNG TỰ SINH (DYNAMIC TABLE RENDERER) */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflowX: 'auto',
        minHeight: 300
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
            <p>Đang tải dữ liệu thực thể động...</p>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertCircle size={24} color="#f59e0b" style={{ margin: '0 auto 10px auto' }} />
            <p>Bảng này chưa có bản ghi nào. Hãy bấm <strong>"+ Thêm Bản Ghi Mới"</strong> để nhập liệu!</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--text-muted)'
              }}>
                <th style={{ padding: '12px 14px' }}>STT</th>
                <th style={{ padding: '12px 14px' }}>Chi Nhánh</th>
                {/* Render tiêu đề cột dựa trên Fields của schema */}
                {currentTableMeta?.fields.map(f => (
                  <th key={f.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {f.field_label}
                  </th>
                ))}
                <th style={{ padding: '12px 14px' }}>Trạng Thái</th>
                {/* Cột các Nút hành động tùy biến */}
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>
                  Nút Hành Động Động ({currentTableMeta?.actions.length || 0})
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec, idx) => {
                const data = rec.record_data || {};
                return (
                  <tr
                    key={rec.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '12px 14px', color: 'var(--text-dim)' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 11,
                        background: 'rgba(255,255,255,0.05)',
                        color: '#f8fafc'
                      }}>
                        {rec.branch_code || 'Toàn chuỗi'}
                      </span>
                    </td>

                    {/* Dữ liệu các cột động */}
                    {currentTableMeta?.fields.map(f => {
                      const val = data[f.field_key];
                      return (
                        <td key={f.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          {f.data_type === 'CURRENCY' && val !== undefined ? (
                            <strong style={{ color: '#34d399' }}>{Number(val || 0).toLocaleString('vi-VN')}đ</strong>
                          ) : f.data_type === 'BOOLEAN' ? (
                            val ? '✔ Có' : '✖ Không'
                          ) : val !== undefined && val !== null ? (
                            String(val)
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Trạng thái bản ghi */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: rec.status === 'ACTIVE' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: rec.status === 'ACTIVE' ? '#34d399' : '#38bdf8'
                      }}>
                        {rec.status}
                      </span>
                    </td>

                    {/* Render trực tiếp các Nút hành động tùy biến vừa tạo */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                        {currentTableMeta?.actions.map(act => (
                          <button
                            key={act.id}
                            onClick={() => handleTriggerAction(rec.id, act.action_key, act.label)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              background: act.color === 'success' ? '#059669' : act.color === 'warning' ? '#d97706' : '#0284c7',
                              border: 'none',
                              color: '#ffffff',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                            }}
                            title={`Kích hoạt hành động "${act.label}" trên bản ghi này`}
                          >
                            <Zap size={11} />
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Nút xóa */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteRecord(rec.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: 4
                        }}
                        title="Xóa bản ghi"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. MODAL TỰ ĐỘNG SINH BIỂU MẪU NHẬP LIỆU (DYNAMIC FORM GENERATOR) */}
      {isNewRecordModalOpen && currentTableMeta && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <form
            onSubmit={handleCreateRecord}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                  Thêm Bản Ghi Mới: {currentTableMeta.table.name}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Biểu mẫu tự động render chính xác theo cấu trúc các trường CSDL
                </span>
              </div>
            </div>

            {/* Chọn chi nhánh quản lý */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Chi nhánh áp dụng:
              </label>
              <select
                value={selectedBranchForRecord}
                onChange={e => setSelectedBranchForRecord(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Toàn hệ thống (HQ chung)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.code} • {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Render các ô nhập liệu động dựa trên Fields */}
            {currentTableMeta.fields.map(f => {
              const val = formData[f.field_key] || '';
              return (
                <div key={f.id}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {f.field_label} {f.is_required && <span style={{ color: '#f87171' }}>*</span>}
                  </label>

                  {f.data_type === 'SELECT' && Array.isArray(f.options) && f.options.length > 0 ? (
                    <select
                      value={val}
                      onChange={e => handleInputChange(f.field_key, e.target.value)}
                      required={f.is_required}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">-- Chọn giá trị --</option>
                      {f.options.map((opt: string, i: number) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : f.data_type === 'DATE' ? (
                    <input
                      type="date"
                      value={val}
                      onChange={e => handleInputChange(f.field_key, e.target.value)}
                      required={f.is_required}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  ) : f.data_type === 'NUMBER' || f.data_type === 'CURRENCY' ? (
                    <input
                      type="number"
                      placeholder={`Nhập ${f.field_label.toLowerCase()}...`}
                      value={val}
                      onChange={e => handleInputChange(f.field_key, Number(e.target.value))}
                      required={f.is_required}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  ) : f.data_type === 'BOOLEAN' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        id={`chk_${f.field_key}`}
                        checked={Boolean(val)}
                        onChange={e => handleInputChange(f.field_key, e.target.checked)}
                      />
                      <label htmlFor={`chk_${f.field_key}`} style={{ fontSize: 13, color: '#f8fafc', cursor: 'pointer' }}>
                        Kích hoạt thuộc tính này
                      </label>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={`Nhập ${f.field_label.toLowerCase()}...`}
                      value={val}
                      onChange={e => handleInputChange(f.field_key, e.target.value)}
                      required={f.is_required}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setIsNewRecordModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  background: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {submitting ? 'Đang lưu...' : 'Lưu Bản Ghi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
