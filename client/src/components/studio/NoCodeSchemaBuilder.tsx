import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Columns, 
  MousePointerClick,
  ChevronRight
} from 'lucide-react';
import { 
  api, 
  type CustomSchemaTable, 
  type CustomSchemaField, 
  type CustomSchemaAction 
} from '../../services/api';

export const NoCodeSchemaBuilder: React.FC = () => {
  const [tables, setTables] = useState<CustomSchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<CustomSchemaTable | null>(null);
  const [fields, setFields] = useState<CustomSchemaField[]>([]);
  const [actions, setActions] = useState<CustomSchemaAction[]>([]);

  // Modal states
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [newTableCode, setNewTableCode] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newTableDesc, setNewTableDesc] = useState('');
  const [newTableCategory, setNewTableCategory] = useState('GENERAL');

  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<any>('TEXT');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [newActionKey, setNewActionKey] = useState('');
  const [newActionLabel, setNewActionLabel] = useState('');
  const [newActionColor, setNewActionColor] = useState('primary');
  const [newActionType, setNewActionType] = useState('UPDATE_STATUS');

  // Load danh sách tables
  const loadTables = useCallback(async () => {
    try {
      const res = await api.getSchemaTables();
      setTables(res.data || []);
      if (res.data?.length && !selectedTable) {
        setSelectedTable(res.data[0]);
      }
    } catch (err) {
      console.error('🔥 [Load Schema Tables Error]:', err);
    }
  }, [selectedTable]);

  // Load fields & actions của table đang chọn
  const loadTableDetails = useCallback(async (tableCode: string) => {
    try {
      const [fieldsRes, actionsRes] = await Promise.all([
        api.getSchemaFields(tableCode),
        api.getSchemaActions(tableCode)
      ]);
      setFields(fieldsRes.data || []);
      setActions(actionsRes.data || []);
    } catch (err) {
      console.error('🔥 [Load Table Details Error]:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.getSchemaTables().then(res => {
      if (isMounted) {
        setTables(res.data || []);
        if (res.data?.length > 0) setSelectedTable(res.data[0]);
      }
    }).catch(console.error);
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    let isMounted = true;
    Promise.all([
      api.getSchemaFields(selectedTable.code),
      api.getSchemaActions(selectedTable.code)
    ]).then(([fieldsRes, actionsRes]) => {
      if (isMounted) {
        setFields(fieldsRes.data || []);
        setActions(actionsRes.data || []);
      }
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [selectedTable]);

  // Tạo Table mới
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableCode.trim() || !newTableName.trim()) {
      alert('Vui lòng nhập Mã và Tên bảng');
      return;
    }
    try {
      const res = await api.createSchemaTable({
        code: newTableCode.trim().toLowerCase(),
        name: newTableName.trim(),
        description: newTableDesc.trim(),
        category: newTableCategory
      });
      setIsTableModalOpen(false);
      setNewTableCode('');
      setNewTableName('');
      setNewTableDesc('');
      await loadTables();
      setSelectedTable(res.data);
    } catch (err: any) {
      alert(`Lỗi tạo bảng: ${err.message}`);
    }
  };

  // Xóa Table
  const handleDeleteTable = async (table: CustomSchemaTable) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Bảng CSDL "${table.name}" (${table.code})? Mọi dữ liệu bản ghi sẽ bị xóa!`)) {
      return;
    }
    try {
      await api.deleteSchemaTable(table.id);
      setSelectedTable(null);
      await loadTables();
    } catch (err: any) {
      alert(`Lỗi xóa bảng: ${err.message}`);
    }
  };

  // Thêm Field mới
  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !newFieldKey.trim() || !newFieldLabel.trim()) {
      alert('Vui lòng nhập Mã và Tên trường dữ liệu');
      return;
    }
    try {
      let optionsArray: string[] = [];
      if (newFieldType === 'SELECT' && newFieldOptions.trim()) {
        optionsArray = newFieldOptions.split(',').map(s => s.trim()).filter(Boolean);
      }

      await api.createSchemaField(selectedTable.code, {
        field_key: newFieldKey.trim().toLowerCase(),
        field_label: newFieldLabel.trim(),
        data_type: newFieldType,
        is_required: newFieldRequired,
        options: optionsArray,
        sort_order: fields.length + 1
      });

      setIsFieldModalOpen(false);
      setNewFieldKey('');
      setNewFieldLabel('');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      await loadTableDetails(selectedTable.code);
    } catch (err: any) {
      alert(`Lỗi thêm trường: ${err.message}`);
    }
  };

  // Xóa Field
  const handleDeleteField = async (fieldId: string) => {
    if (!selectedTable || !window.confirm('Bạn có chắc muốn xóa trường dữ liệu này?')) return;
    try {
      await api.deleteSchemaField(selectedTable.code, fieldId);
      await loadTableDetails(selectedTable.code);
    } catch (err: any) {
      alert(`Lỗi xóa trường: ${err.message}`);
    }
  };

  // Thêm Action Button mới
  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !newActionKey.trim() || !newActionLabel.trim()) {
      alert('Vui lòng nhập Mã nút và Nhãn nút');
      return;
    }
    try {
      await api.createSchemaAction(selectedTable.code, {
        action_key: newActionKey.trim().toLowerCase(),
        label: newActionLabel.trim(),
        color: newActionColor,
        action_type: newActionType as any,
        sort_order: actions.length + 1
      });

      setIsActionModalOpen(false);
      setNewActionKey('');
      setNewActionLabel('');
      await loadTableDetails(selectedTable.code);
    } catch (err: any) {
      alert(`Lỗi thêm nút: ${err.message}`);
    }
  };

  // Xóa Action Button
  const handleDeleteAction = async (actionId: string) => {
    if (!selectedTable || !window.confirm('Bạn có chắc muốn xóa nút hành động này?')) return;
    try {
      await api.deleteSchemaAction(selectedTable.code, actionId);
      await loadTableDetails(selectedTable.code);
    } catch (err: any) {
      alert(`Lỗi xóa nút: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
      {/* 1. CỘT TRÁI: DANH SÁCH BẢNG CSDL TÙY TẠO */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color="#38bdf8" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Bảng CSDL Động</span>
          </div>
          <button
            onClick={() => setIsTableModalOpen(true)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Plus size={13} />
            <span>Tạo Bảng</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          {tables.map(table => {
            const isSelected = selectedTable?.id === table.id;
            return (
              <div
                key={table.id}
                onClick={() => setSelectedTable(table)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.04)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: isSelected ? '#38bdf8' : '#f8fafc', display: 'block' }}>
                    {table.name}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <code>{table.code}</code> • {table.fields_count || 0} cột
                  </span>
                </div>
                <ChevronRight size={14} color={isSelected ? '#38bdf8' : 'var(--text-dim)'} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CỘT PHẢI: CHI TIẾT CẤU TRÚC BẢNG (TRƯỜNG DỮ LIỆU & NÚT THAO TÁC) */}
      {selectedTable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bảng đang chọn */}
          <div style={{
            padding: '16px 20px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                  {selectedTable.name}
                </h2>
                <code style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38bdf8',
                  fontSize: 12
                }}>
                  {selectedTable.code}
                </code>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {selectedTable.description || 'Chưa có mô tả nghiệp vụ'} • Tự động ánh xạ REST API: <code>/api/dynamic/{selectedTable.code}</code>
              </p>
            </div>

            <button
              onClick={() => handleDeleteTable(selectedTable)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Trash2 size={13} />
              <span>Xóa Bảng Này</span>
            </button>
          </div>

          {/* Khối 1: Danh sách các Trường dữ liệu (Fields) */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Columns size={16} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
                  Cấu Trúc Các Trường Dữ Liệu ({fields.length} trường)
                </h3>
              </div>
              <button
                onClick={() => setIsFieldModalOpen(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Plus size={13} />
                <span>+ Thêm Trường Mới</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>STT</th>
                    <th style={{ padding: '8px 10px' }}>Mã Trường (Key)</th>
                    <th style={{ padding: '8px 10px' }}>Tên Hiển Thị (Label)</th>
                    <th style={{ padding: '8px 10px' }}>Kiểu Dữ Liệu</th>
                    <th style={{ padding: '8px 10px' }}>Bắt Buộc</th>
                    <th style={{ padding: '8px 10px' }}>Tùy Chọn / Chi Tiết</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, idx) => (
                    <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 10px', color: 'var(--text-dim)' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <code>{f.field_key}</code>
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: 600, color: '#f8fafc' }}>
                        {f.field_label}
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'rgba(255,255,255,0.05)',
                          color: '#38bdf8'
                        }}>
                          {f.data_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        {f.is_required ? (
                          <span style={{ color: '#f87171', fontWeight: 600 }}>Bắt buộc</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Không</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {Array.isArray(f.options) && f.options.length > 0 ? f.options.join(', ') : '-'}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteField(f.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            padding: 4
                          }}
                          title="Xóa trường"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Khối 2: Thiết kế Nút hành động tùy biến (Action Buttons) */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MousePointerClick size={16} color="#fbbf24" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
                  Nút Hành Động Tùy Biến Cho Giao Diện ({actions.length} nút)
                </h3>
              </div>
              <button
                onClick={() => setIsActionModalOpen(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(251, 191, 36, 0.12)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  color: '#fbbf24',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Plus size={13} />
                <span>+ Thiết Kế Nút Mới</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {actions.map(act => (
                <div
                  key={act.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: act.color === 'success' ? '#059669' : act.color === 'warning' ? '#d97706' : '#2563eb',
                    color: '#ffffff'
                  }}>
                    {act.label}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Mã: <code>{act.action_key}</code> ({act.action_type})
                  </div>
                  <button
                    onClick={() => handleDeleteAction(act.id)}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Chọn một bảng hoặc tạo bảng mới để cấu hình.</p>
        </div>
      )}

      {/* MODAL 1: TẠO BẢNG CSDL MỚI */}
      {isTableModalOpen && (
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
            onSubmit={handleCreateTable}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Tạo Bảng Dữ Liệu CSDL Mới (Không Cần Code)
            </h3>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Mã bảng (Dùng làm Endpoint API / Chữ thường không dấu):
              </label>
              <input
                type="text"
                placeholder="ví dụ: warranty_tickets, service_contracts"
                value={newTableCode}
                onChange={e => setNewTableCode(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Tên bảng hiển thị trên giao diện:
              </label>
              <input
                type="text"
                placeholder="ví dụ: Phiếu Bảo Hành Thiết Bị"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Mô tả nghiệp vụ:
              </label>
              <textarea
                placeholder="Mô tả mục đích sử dụng bảng..."
                value={newTableDesc}
                onChange={e => setNewTableDesc(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Phân loại danh mục:
              </label>
              <select
                value={newTableCategory}
                onChange={e => setNewTableCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              >
                <option value="GENERAL">Chung (GENERAL)</option>
                <option value="ASSET">Tài Sản & Thiết Bị (ASSET)</option>
                <option value="LOGISTICS">Vận Tải & Kho Bãi (LOGISTICS)</option>
                <option value="SERVICE">Dịch Vụ & Bảo Hành (SERVICE)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
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
                Lưu & Khởi Tạo Bảng
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: THÊM TRƯỜNG DỮ LIỆU MỚI (FIELD BUILDER) */}
      {isFieldModalOpen && selectedTable && (
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
            onSubmit={handleCreateField}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 460,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Thêm Trường Dữ Liệu vào {selectedTable.name}
            </h3>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Mã trường (Field Key):
              </label>
              <input
                type="text"
                placeholder="ví dụ: customer_name, serial_number, due_date"
                value={newFieldKey}
                onChange={e => setNewFieldKey(e.target.value)}
                required
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
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Tên hiển thị (Label):
              </label>
              <input
                type="text"
                placeholder="ví dụ: Tên Khách Hàng, Số Seri, Hạn Hoàn Thành"
                value={newFieldLabel}
                onChange={e => setNewFieldLabel(e.target.value)}
                required
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
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Kiểu dữ liệu:
              </label>
              <select
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value)}
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
                <option value="TEXT">Văn bản (TEXT)</option>
                <option value="NUMBER">Số lượng (NUMBER)</option>
                <option value="CURRENCY">Tiền tệ VND (CURRENCY)</option>
                <option value="DATE">Ngày tháng (DATE)</option>
                <option value="SELECT">Lựa chọn Dropdown (SELECT)</option>
                <option value="BOOLEAN">Bật / Tắt (BOOLEAN)</option>
              </select>
            </div>

            {newFieldType === 'SELECT' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Các tùy chọn (cách nhau bởi dấu phẩy):
                </label>
                <input
                  type="text"
                  placeholder="Mới tạo, Đang xử lý, Hoàn thành, Hủy bỏ"
                  value={newFieldOptions}
                  onChange={e => setNewFieldOptions(e.target.value)}
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
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="reqCheck"
                checked={newFieldRequired}
                onChange={e => setNewFieldRequired(e.target.checked)}
              />
              <label htmlFor="reqCheck" style={{ fontSize: 13, color: '#f8fafc', cursor: 'pointer' }}>
                Bắt buộc nhập khi tạo bản ghi mới
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
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
                Thêm Trường
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: THIẾT KẾ NÚT HÀNH ĐỘNG MỚI (ACTION BUILDER) */}
      {isActionModalOpen && selectedTable && (
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
            onSubmit={handleCreateAction}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 440,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Thiết Kế Nút Hành Động Cho {selectedTable.name}
            </h3>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Mã nút (Action Key):
              </label>
              <input
                type="text"
                placeholder="ví dụ: act_complete, act_dispatch, act_notify"
                value={newActionKey}
                onChange={e => setNewActionKey(e.target.value)}
                required
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
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Nhãn nút hiển thị (Label):
              </label>
              <input
                type="text"
                placeholder="ví dụ: Duyệt Hồ Sơ, Xuất Bến, Hoàn Tất"
                value={newActionLabel}
                onChange={e => setNewActionLabel(e.target.value)}
                required
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
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Màu sắc nút:
              </label>
              <select
                value={newActionColor}
                onChange={e => setNewActionColor(e.target.value)}
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
                <option value="primary">Xanh Dương (Primary)</option>
                <option value="success">Xanh Lá (Success)</option>
                <option value="warning">Vàng Cam (Warning)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Loại hành vi (Action Behavior):
              </label>
              <select
                value={newActionType}
                onChange={e => setNewActionType(e.target.value)}
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
                <option value="UPDATE_STATUS">Cập nhật trạng thái bản ghi</option>
                <option value="WEBHOOK">Bắn Webhook gửi dữ liệu ra ngoài</option>
                <option value="NOTIFICATION">Tạo thông báo nghiệp vụ</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setIsActionModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
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
                Tạo Nút
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
