import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { branchStore } from '../../services/branchContext';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Zap, 
  AlertCircle, 
  RefreshCw, 
  X
} from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  trigger_event: string;
  condition_config: Record<string, any>;
  action_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export const WorkflowRulesTab: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('ON_CHECKOUT');
  const [conditionField, setConditionField] = useState('total_amount');
  const [conditionOperator, setConditionOperator] = useState('GREATER_THAN');
  const [conditionValue, setConditionValue] = useState('2000000');
  const [actionType, setActionType] = useState('DISCOUNT');
  const [actionParam, setActionParam] = useState('5');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getWorkflows();
      if (res.success) {
        setRules(res.data || []);
      }
    } catch (err: any) {
      console.error('Lỗi tải workflows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchRules = async () => {
      try {
        const res = await api.getWorkflows();
        if (isMounted && res.success) {
          setRules(res.data || []);
        }
      } catch (err: any) {
        console.error('Lỗi tải workflows:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRules();

    const unsubscribe = branchStore.subscribe(() => {
      if (isMounted) {
        fetchRules();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleToggle = async (ruleId: string) => {
    try {
      const res = await api.toggleWorkflow(ruleId);
      if (res.success) {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !r.is_active } : r));
      }
    } catch (err: any) {
      alert(`Không thể thay đổi trạng thái: ${err.message}`);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Bạn có chắc muốn xóa luật tự động hóa này?')) return;
    try {
      const res = await api.deleteWorkflow(ruleId);
      if (res.success) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
      }
    } catch (err: any) {
      alert(`Không thể xóa: ${err.message}`);
    }
  };

  // Chọn mẫu luật có sẵn (Presets)
  const handleApplyPreset = (presetType: 'LOW_STOCK' | 'DEBT_LIMIT' | 'DISCOUNT' | 'TRANSFER_SUGGEST') => {
    switch (presetType) {
      case 'LOW_STOCK':
        setRuleName('Cảnh báo tồn kho khi số lượng < 10 món');
        setTriggerEvent('LOW_STOCK_DETECTED');
        setConditionField('available_qty');
        setConditionOperator('LESS_THAN');
        setConditionValue('10');
        setActionType('NOTIFY_MANAGER');
        setActionParam('Cảnh báo hàng sắp hết');
        break;
      case 'DEBT_LIMIT':
        setRuleName('Khóa xuất nợ khi khách nợ vượt hạn mức');
        setTriggerEvent('ON_CHECKOUT');
        setConditionField('customer_debt');
        setConditionOperator('GREATER_THAN');
        setConditionValue('debt_limit');
        setActionType('BLOCK_CHECKOUT');
        setActionParam('Chặn xuất đơn nợ');
        break;
      case 'DISCOUNT':
        setRuleName('Tự động chiết khấu 5% cho hóa đơn >= 2 triệu');
        setTriggerEvent('ON_CHECKOUT');
        setConditionField('total_amount');
        setConditionOperator('GREATER_THAN_OR_EQUAL');
        setConditionValue('2000000');
        setActionType('DISCOUNT');
        setActionParam('5');
        break;
      case 'TRANSFER_SUGGEST':
        setRuleName('Gợi ý lập phiếu điều chuyển từ Kho Tổng khi tồn = 0');
        setTriggerEvent('LOW_STOCK_DETECTED');
        setConditionField('available_qty');
        setConditionOperator('EQUALS');
        setConditionValue('0');
        setActionType('SUGGEST_TRANSFER');
        setActionParam('Kho Tổng CN-Q1');
        break;
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      setFeedback({ type: 'error', message: 'Tên luật không được để trống' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);

      const condition_config = {
        field: conditionField,
        operator: conditionOperator,
        value: conditionValue
      };

      const action_config = {
        action: actionType,
        parameter: actionParam
      };

      const res = await api.createWorkflow({
        name: ruleName.trim(),
        trigger_event: triggerEvent,
        condition_config,
        action_config
      });

      if (res.success) {
        setIsNewModalOpen(false);
        setRuleName('');
        loadRules();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Không thể tạo luật' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi tạo luật' });
    } finally {
      setSubmitting(false);
    }
  };

  const getTriggerLabel = (event: string) => {
    switch (event) {
      case 'ON_CHECKOUT': return '🛒 Khi Thanh Toán Đơn POS';
      case 'LOW_STOCK_DETECTED': return '📦 Khi Tồn Kho Thay Đổi';
      case 'DEBT_RECORDED': return '💳 Khi Ghi Nhận Công Nợ';
      case 'SHIFT_CLOSED': return '🔒 Khi Chốt Ca Bán Hàng';
      default: return event;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* HEADER BANNER */}
      <div className="glass-panel" style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(6, 182, 212, 0.4)'
            }}>
              <GitBranch size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                Động Cơ Luật Tự Động Hóa (No-Code Rule Engine)
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                Định nghĩa các quy tắc Nếu - Thì (If-This-Then-That) tự động thực thi mà không cần viết code.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={loadRules}
            className="btn-action"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Làm Mới</span>
          </button>

          <button
            onClick={() => {
              handleApplyPreset('LOW_STOCK');
              setIsNewModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(6, 182, 212, 0.35)'
            }}
          >
            <Plus size={15} />
            <span>+ Tạo Quy Tắc Mới</span>
          </button>
        </div>
      </div>

      {/* DANH SÁCH CÁC QUY TẮC ĐANG HOẠT ĐỘNG */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rules.length === 0 ? (
          <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontSize: 14 }}>Chưa có quy tắc tự động hóa nào được thiết lập.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Bấm "+ Tạo Quy Tắc Mới" để kích hoạt các kịch bản If-Then cho hệ thống.</p>
          </div>
        ) : (
          rules.map(rule => (
            <div
              key={rule.id}
              className="glass-panel"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                border: rule.is_active ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                background: rule.is_active ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: rule.is_active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: rule.is_active ? '#38bdf8' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2
                }}>
                  <Zap size={18} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: rule.is_active ? '#f8fafc' : '#94a3b8' }}>
                      {rule.name}
                    </span>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      fontWeight: 700
                    }}>
                      {getTriggerLabel(rule.trigger_event)}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      color: rule.is_active ? '#34d399' : '#64748b'
                    }}>
                      {rule.is_active ? '● ĐANG CHẠY' : '○ TẠM DỪNG'}
                    </span>
                  </div>

                  {/* Mô tả điều kiện & hành động */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                    <span><strong>NẾU:</strong> {JSON.stringify(rule.condition_config)}</span>
                    <span>➔</span>
                    <span><strong>THÌ:</strong> {JSON.stringify(rule.action_config)}</span>
                  </div>
                </div>
              </div>

              {/* Nút bật/tắt & Xóa */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => handleToggle(rule.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    background: rule.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: rule.is_active ? '#f87171' : '#34d399',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: rule.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {rule.is_active ? 'Tạm Dừng' : 'Kích Hoạt'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(rule.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 6
                  }}
                  title="Xóa luật này"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL TẠO QUY TẮC MỚI */}
      {isNewModalOpen && (
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
              maxWidth: '580px',
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
                  <GitBranch size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                    Thiết Lập Quy Tắc Tự Động Hóa Mới
                  </h3>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                    Chọn mẫu có sẵn hoặc tự định nghĩa luật If-Then
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} style={{ padding: '20px' }}>
              {/* CHỌN NHANH MẪU CÓ SẴN (PRESETS) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 6, textTransform: 'uppercase' }}>
                  ⚡ Gợi Ý Mẫu Thực Chiến (1-Click Presets):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('LOW_STOCK')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: '#e0f2fe',
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    📦 Cảnh báo tồn kho &lt; 10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('DEBT_LIMIT')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#fee2e2',
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    🚫 Khóa bán nợ vượt hạn mức
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('DISCOUNT')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: '#d1fae5',
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    🎁 Chiết khấu 5% đơn &gt;= 2tr
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('TRANSFER_SUGGEST')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(168, 85, 247, 0.08)',
                      border: '1px solid rgba(168, 85, 247, 0.25)',
                      color: '#f3e8ff',
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    🚛 Gợi ý điều chuyển kho khi hết
                  </button>
                </div>
              </div>

              {/* TÊN LUẬT */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  Tên Quy Tắc *
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="VD: Cảnh báo tồn kho khi sản phẩm dưới 10 món..."
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
              </div>

              {/* SỰ KIỆN KÍCH HOẠT (TRIGGER) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  Khi Sự Kiện Xảy Ra (Trigger Event)
                </label>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 13,
                    outline: 'none'
                  }}
                >
                  <option value="ON_CHECKOUT">🛒 Khi Thu Ngân Tạo Đơn Hàng POS</option>
                  <option value="LOW_STOCK_DETECTED">📦 Khi Tồn Kho Sản Phẩm Thay Đổi</option>
                  <option value="DEBT_RECORDED">💳 Khi Phát Sinh Công Nợ Khách Hàng</option>
                  <option value="SHIFT_CLOSED">🔒 Khi Nhân Viên Đóng Ca & Chốt Két</option>
                </select>
              </div>

              {/* ĐIỀU KIỆN (IF) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  Điều Kiện Kiểm Tra (If Condition)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8 }}>
                  <input
                    type="text"
                    value={conditionField}
                    onChange={(e) => setConditionField(e.target.value)}
                    placeholder="Trường kiểm tra"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: 12
                    }}
                  />
                  <select
                    value={conditionOperator}
                    onChange={(e) => setConditionOperator(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: 12
                    }}
                  >
                    <option value="LESS_THAN">&lt; Nhỏ Hơn</option>
                    <option value="GREATER_THAN">&gt; Lớn Hơn</option>
                    <option value="GREATER_THAN_OR_EQUAL">&gt;= Lớn Hơn Hoặc Bằng</option>
                    <option value="EQUALS">= Bằng</option>
                  </select>
                  <input
                    type="text"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="Giá trị"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: 12
                    }}
                  />
                </div>
              </div>

              {/* HÀNH ĐỘNG (THEN) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  Hành Động Tự Động Kích Hoạt (Then Action)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: 12
                    }}
                  >
                    <option value="NOTIFY_MANAGER">🔔 Gửi Cảnh Báo Cho Quản Lý</option>
                    <option value="BLOCK_CHECKOUT">🚫 Khóa Thanh Toán (Chặn Nợ)</option>
                    <option value="DISCOUNT">🎁 Tự Động Chiết Khấu (%)</option>
                    <option value="SUGGEST_TRANSFER">🚛 Gợi Ý Điều Chuyển Kho</option>
                  </select>
                  <input
                    type="text"
                    value={actionParam}
                    onChange={(e) => setActionParam(e.target.value)}
                    placeholder="Tham số hành động"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: 12
                    }}
                  />
                </div>
              </div>

              {feedback && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14
                }}>
                  <AlertCircle size={15} />
                  <span>{feedback.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
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
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Đang Tạo...' : '✓ Kích Hoạt Quy Tắc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
