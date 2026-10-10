import React, { useState, useEffect } from 'react';
import { 
  api, 
  type PartnerProfile, 
  type ProductInventory 
} from '../../services/api';
import { 
  RotateCcw, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Trash2,
  FileText
} from 'lucide-react';

interface ReturnItemExtended {
  product_id: string;
  uom: string;
  conversion_rate: number;
  quantity: number;
  unit_price: number;
  condition: 'GOOD' | 'DAMAGED';
  reason?: string;
}

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [products, setProducts] = useState<ProductInventory[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [originalOrderId, setOriginalOrderId] = useState<string>('');
  const [items, setItems] = useState<ReturnItemExtended[]>([]);
  const [refundMode, setRefundMode] = useState<'DEBT_OFFSET' | 'CASH_REFUND'>('DEBT_OFFSET');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    api.getPartners().then(res => {
      if (res.success) {
        setPartners(res.data);
        if (res.data.length > 0) {
          setSelectedPartnerId(prev => prev || res.data[0].id);
        }
      }
    }).catch(console.error);

    api.getProducts().then(res => {
      if (res.success) setProducts(res.data);
    }).catch(console.error);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddItem = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const existing = items.find(it => it.product_id === productId);
    if (existing) {
      setItems(prev => prev.map(it => 
        it.product_id === productId ? { ...it, quantity: it.quantity + 1 } : it
      ));
    } else {
      setItems(prev => [
        ...prev,
        {
          product_id: prod.id,
          uom: prod.base_uom,
          conversion_rate: 1,
          quantity: 1,
          unit_price: Number(prod.default_selling_price || 0),
          condition: 'GOOD',
          reason: 'Khách đổi trả / thừa hàng'
        }
      ]);
    }
  };

  const handleUpdateItem = (productId: string, field: keyof ReturnItemExtended, value: any) => {
    setItems(prev => prev.map(it => {
      if (it.product_id === productId) {
        return { ...it, [field]: value };
      }
      return it;
    }));
  };

  const handleRemoveItem = (productId: string) => {
    setItems(prev => prev.filter(it => it.product_id !== productId));
  };

  const totalReturnAmount = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  const selectedPartner = partners.find(p => p.id === selectedPartnerId);

  // Tính toán giả lập cấn trừ nợ vs tiền mặt trả lại
  const partnerCurrentDebt = Number(selectedPartner?.current_debt || 0);
  const estimatedDebtDeduction = refundMode === 'DEBT_OFFSET' 
    ? Math.min(totalReturnAmount, partnerCurrentDebt)
    : 0;
  const estimatedCashRefund = totalReturnAmount - estimatedDebtDeduction;

  const handleSubmit = async () => {
    if (items.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất 1 mặt hàng khách trả');
      return;
    }
    if (refundMode === 'DEBT_OFFSET' && !selectedPartnerId) {
      setErrorMsg('Cấn trừ nợ (INV-07) bắt buộc phải chọn khách hàng');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      
      const payload = {
        original_order_id: originalOrderId.trim() || undefined,
        partner_id: selectedPartnerId || undefined,
        items: items.map(it => ({
          product_id: it.product_id,
          uom: it.uom,
          quantity: it.quantity,
          return_price: it.unit_price,
          condition: it.condition,
          note: it.reason || ''
        })),
        note: note || `Đổi trả hàng quầy POS (${refundMode === 'DEBT_OFFSET' ? 'Cấn trừ nợ' : 'Hoàn tiền mặt'})`
      };

      const res = await api.createRma(payload);

      if (res.success) {
        const msg = res.data?.debt_deduction_amount > 0 
          ? `Lập phiếu RMA thành công! Đã cấn trừ nợ ${Number(res.data.debt_deduction_amount).toLocaleString('vi-VN')}đ, hoàn tiền mặt ${Number(res.data.cash_refund_amount).toLocaleString('vi-VN')}đ.`
          : `Lập phiếu RMA thành công! Tổng tiền hoàn: ${Number(res.data?.refund_amount || totalReturnAmount).toLocaleString('vi-VN')}đ.`;
        setSuccessMsg(msg);
        if (onSuccess) onSuccess(res.data);
        setTimeout(() => {
          onClose();
          setSuccessMsg(null);
          setItems([]);
          setOriginalOrderId('');
          setNote('');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi xử lý đổi trả hàng RMA');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: 780,
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Lập Phiếu Đổi Trả Hàng (RMA Return - INV-07)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Hàng nguyên vẹn tự động nhập kho • Hàng hỏng cách ly • Giá trị hoàn tự động cấn trừ nợ
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Thông báo */}
        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {/* Thông tin đối soát: Khách hàng & Mã đơn gốc */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
          {/* Chọn Khách Hàng */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Khách Hàng Trả Hàng:
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={selectedPartnerId}
                onChange={e => setSelectedPartnerId(e.target.value)}
                className="search-input"
                style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              >
                <option value="">Khách Vãng Lai (Không nợ)</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name} (Nợ: {Number(p.current_debt || 0).toLocaleString('vi-VN')}đ)
                  </option>
                ))}
              </select>
            </div>
            {selectedPartner && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                Dư nợ hiện tại: <strong>{Number(selectedPartner.current_debt || 0).toLocaleString('vi-VN')}đ</strong>
              </div>
            )}
          </div>

          {/* Nhập mã đơn gốc */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Mã Đơn Bán Gốc (Nếu có đối soát):
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <FileText size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 10 }} />
              <input
                type="text"
                placeholder="VD: ORD-102938"
                value={originalOrderId}
                onChange={e => setOriginalOrderId(e.target.value)}
                className="search-input"
                style={{ width: '100%', paddingLeft: 32, paddingRight: 8, height: 36, fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        {/* Thêm Sản Phẩm Trả */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Chọn Sản Phẩm Khách Trả Lại:
          </label>
          <select
            id="return-product-select"
            className="search-input"
            style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}
            defaultValue=""
            onChange={e => {
              if (e.target.value) {
                handleAddItem(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="" disabled>-- Bấm để chọn sản phẩm trả về --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name} ({Number(p.default_selling_price || 0).toLocaleString('vi-VN')}đ/{p.base_uom})
              </option>
            ))}
          </select>
        </div>

        {/* Bảng Mặt Hàng Trả */}
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 13 }}>
              Chưa có mặt hàng nào. Chọn từ ô phía trên để thêm vào phiếu trả.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', textAlign: 'left', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '8px 8px' }}>Sản phẩm</th>
                  <th style={{ padding: '8px 4px', width: 65 }}>SL</th>
                  <th style={{ padding: '8px 4px', width: 95 }}>Đơn giá</th>
                  <th style={{ padding: '8px 4px', width: 140 }}>Tình trạng hàng</th>
                  <th style={{ padding: '8px 4px', width: 100, textAlign: 'right' }}>Thành tiền</th>
                  <th style={{ padding: '8px 4px', width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const p = products.find(prod => prod.id === it.product_id);
                  return (
                    <tr key={it.product_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 600, color: '#f8fafc' }}>
                        {p?.name || it.product_id} ({it.uom})
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={e => handleUpdateItem(it.product_id, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="search-input"
                          style={{ width: '100%', padding: '2px 4px', fontSize: 12, textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input
                          type="number"
                          min="0"
                          value={it.unit_price}
                          onChange={e => handleUpdateItem(it.product_id, 'unit_price', Math.max(0, Number(e.target.value)))}
                          className="search-input"
                          style={{ width: '100%', padding: '2px 4px', fontSize: 12, textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <select
                          value={it.condition}
                          onChange={e => handleUpdateItem(it.product_id, 'condition', e.target.value as any)}
                          style={{
                            width: '100%',
                            padding: '3px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: it.condition === 'GOOD' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: it.condition === 'GOOD' ? '#34d399' : '#f87171',
                            border: it.condition === 'GOOD' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          <option value="GOOD">✅ Nguyên vẹn (Nhập kho)</option>
                          <option value="DAMAGED">⚠️ Hỏng vỡ (Loại thải)</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                        {(it.quantity * it.unit_price).toLocaleString('vi-VN')}đ
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleRemoveItem(it.product_id)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Tóm tắt hoàn tiền & Phương Thức Cấn Trừ */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tổng Giá Trị Hàng Trả:</span>
            <strong style={{ fontSize: 17, color: '#38bdf8' }}>{totalReturnAmount.toLocaleString('vi-VN')}đ</strong>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
              <input 
                type="radio" 
                name="refundMode"
                value="DEBT_OFFSET"
                checked={refundMode === 'DEBT_OFFSET'}
                onChange={() => setRefundMode('DEBT_OFFSET')}
              />
              <span style={{ fontWeight: 600, color: '#34d399' }}>
                Cấn trừ trực tiếp vào sổ nợ (INV-07)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
              <input 
                type="radio" 
                name="refundMode"
                value="CASH_REFUND"
                checked={refundMode === 'CASH_REFUND'}
                onChange={() => setRefundMode('CASH_REFUND')}
              />
              <span style={{ color: 'var(--text-main)' }}>
                Hoàn tiền mặt từ quỹ két ca
              </span>
            </label>
          </div>

          {/* Chi tiết phân bổ hoàn tiền */}
          {refundMode === 'DEBT_OFFSET' && partnerCurrentDebt > 0 && totalReturnAmount > 0 && (
            <div style={{ 
              padding: '6px 10px', 
              borderRadius: 6, 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: 12
            }}>
              <span>Giảm nợ: <strong style={{ color: '#34d399' }}>-{estimatedDebtDeduction.toLocaleString('vi-VN')}đ</strong></span>
              <span>Tiền thối lại khách: <strong style={{ color: '#38bdf8' }}>{estimatedCashRefund.toLocaleString('vi-VN')}đ</strong></span>
            </div>
          )}

          <input 
            type="text"
            placeholder="Ghi chú lý do trả hàng (VD: hàng thừa công trình, giao nhầm mã...)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="search-input"
            style={{ width: '100%', fontSize: 12, marginTop: 2, boxSizing: 'border-box' }}
          />
        </div>

        {/* Nút hành động */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} className="btn-action" style={{ padding: '8px 16px', fontSize: 13 }}>
            Hủy Bỏ
          </button>
          <button 
            onClick={handleSubmit}
            disabled={submitting || items.length === 0}
            className="btn-primary"
            style={{ padding: '8px 20px', fontWeight: 700, fontSize: 13 }}
          >
            {submitting ? 'Đang hoàn kho & cấn trừ...' : 'XÁC NHẬN TRẢ HÀNG & CẤN TRỪ NỢ'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ReturnModal;
