import React, { useState, useEffect } from 'react';
import { 
  api, 
  type CustomSchemaTable, 
  type CustomSchemaField 
} from '../../services/api';
import { branchStore } from '../../services/branchContext';
import { 
  Zap, 
  Database, 
  Plus, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface PosDynamicActionsBarProps {
  onRecordCreated?: () => void;
}

export const PosDynamicActionsBar: React.FC<PosDynamicActionsBarProps> = ({ onRecordCreated }) => {
  const [tables, setTables] = useState<CustomSchemaTable[]>([]);
  const [activeTable, setActiveTable] = useState<CustomSchemaTable | null>(null);
  const [fields, setFields] = useState<CustomSchemaField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTables = async () => {
      try {
        const res = await api.getSchemaTables();
        if (isMounted && res.data) {
          setTables(res.data);
        }
      } catch (err) {
        console.error('Lỗi tải bảng động:', err);
      }
    };
    fetchTables();
    return () => { isMounted = false; };
  }, []);

  const handleOpenTableForm = async (table: CustomSchemaTable) => {
    setActiveTable(table);
    setFormData({});
    setFeedback(null);
    try {
      const fieldsRes = await api.getSchemaFields(table.code);
      setFields(fieldsRes.data || []);
      setIsModalOpen(true);
    } catch (err: any) {
      alert(`Không thể tải cấu trúc bảng ${table.name}: ${err.message}`);
    }
  };

  const handleInputChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable) return;

    try {
      setSubmitting(true);
      setFeedback(null);
      const currentBranch = branchStore.getCurrentBranch();

      const res = await api.createDynamicRecord(activeTable.code, {
        branch_id: currentBranch?.id || undefined,
        record_data: formData
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `Đã lưu bản ghi mới vào [${activeTable.name}] thành công!` });
        setTimeout(() => {
          setIsModalOpen(false);
          if (onRecordCreated) onRecordCreated();
        }, 1000);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Không thể lưu bản ghi.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi lưu dữ liệu.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (tables.length === 0) return null;

  return (
    <>
      {/* THANH TIỆN ÍCH NO-CODE TRÊN MÀN HÌNH BÁN HÀNG */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 8,
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        marginBottom: 10,
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          <Zap size={13} />
          <span>TIỆN ÍCH NO-CODE:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {tables.map(table => (
            <button
              key={table.id}
              type="button"
              onClick={() => handleOpenTableForm(table)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#e0f2fe',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
              }}
            >
              <Plus size={11} color="#38bdf8" />
              <span>{table.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MODAL NHẬP LIỆU BẢNG ĐỘNG TẠI QUẦY POS */}
      {isModalOpen && activeTable && (
        <div 
          className="modal-overlay"
          style={{
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div 
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, #0f172a 0%, #090d16 100%)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden'
            }}
          >
            {/* HEADER */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(56, 189, 248, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Database size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                    + Thêm Bản Ghi: {activeTable.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                    Tự động lưu vào CSDL No-Code chi nhánh
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* FORM FIELDS */}
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                {fields.map(field => {
                  const val = formData[field.field_key] || '';
                  return (
                    <div key={field.id}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                        {field.field_label} {field.is_required && <span style={{ color: '#fb7185' }}>*</span>}
                      </label>
                      {field.data_type === 'BOOLEAN' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#f8fafc' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) => handleInputChange(field.field_key, e.target.checked)}
                          />
                          <span>{field.field_label}</span>
                        </label>
                      ) : (
                        <input
                          type={field.data_type === 'NUMBER' || field.data_type === 'CURRENCY' ? 'number' : field.data_type === 'DATE' ? 'date' : 'text'}
                          value={val}
                          onChange={(e) => handleInputChange(field.field_key, field.data_type === 'NUMBER' || field.data_type === 'CURRENCY' ? parseFloat(e.target.value) || 0 : e.target.value)}
                          required={field.is_required}
                          placeholder={`Nhập ${field.field_label.toLowerCase()}...`}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#f8fafc',
                            fontSize: 12,
                            outline: 'none'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {feedback && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  color: feedback.type === 'success' ? '#34d399' : '#f87171',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 14
                }}>
                  {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{feedback.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(6, 182, 212, 0.35)'
                  }}
                >
                  {submitting ? 'Đang Lưu...' : '✓ Lưu Bản Ghi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
