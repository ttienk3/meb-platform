import React, { useState } from 'react';
import { api, type PartnerProfile, type ShiftInfo } from '../../services/api';
import { X, DollarSign, CreditCard, Banknote, CheckCircle2, AlertCircle } from 'lucide-react';

interface QuickDebtCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: PartnerProfile;
  currentShift: ShiftInfo | null;
  onSuccess: () => void;
}

export const QuickDebtCollectionModal: React.FC<QuickDebtCollectionModalProps> = ({
  isOpen,
  onClose,
  partner,
  currentShift,
  onSuccess
}) => {
  const currentDebt = Math.max(0, Number(partner.current_debt || 0));
  const [amount, setAmount] = useState<string>(currentDebt > 0 ? currentDebt.toString() : '');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [note, setNote] = useState<string>('Khách thanh toán nợ cũ tại quầy POS');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickPreset = (fraction: number) => {
    const val = Math.round(currentDebt * fraction);
    setAmount(val.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Số tiền thu phải lớn hơn 0');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await api.collectDebt({
        partner_id: partner.id,
        shift_id: currentShift?.id,
        amount: numAmount,
        payment_method: paymentMethod,
        payment_account: paymentMethod === 'CASH' ? 'KET_TIEN' : 'NGAN_HANG',
        note: note.trim() || 'Thu nợ tại quầy POS',
        created_by: currentShift?.staff_name || 'Thu Ngân'
      });

      if (res.success) {
        setSuccessMsg(`Đã thu ${numAmount.toLocaleString('vi-VN')} đ thành công! Số nợ còn lại: ${Math.max(0, currentDebt - numAmount).toLocaleString('vi-VN')} đ`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(res.message || 'Không thể ghi nhận thu nợ.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối khi thu nợ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="modal-overlay"
      style={{
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                Thu Nợ Khách Hàng Tại Quầy
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                Tự động cấn trừ sổ nợ & cộng tiền vào két bán hàng
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {/* Thông tin khách hàng & Dư nợ */}
          <div style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>{partner.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{partner.phone || 'Không có SĐT'} • {partner.code}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dư nợ hiện tại</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#e11d48' }}>
                  {currentDebt.toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>
          </div>

          {/* Nhập số tiền thu */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              Số Tiền Thu Thực Tế (VNĐ) *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              min={1}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: '#059669',
                fontSize: 18,
                fontWeight: 900,
                outline: 'none',
                fontFamily: 'monospace'
              }}
            />

            {/* Phím tắt chọn nhanh tỷ lệ nợ */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => handleQuickPreset(1)}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: 6,
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#059669',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Trả Hết 100%
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(0.5)}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Trả 50%
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(0.3)}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Trả 30%
              </button>
            </div>
          </div>

          {/* Phương thức thanh toán */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              Hình Thức Thanh Toán
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: paymentMethod === 'CASH' ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
                  background: paymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-subtle)',
                  color: paymentMethod === 'CASH' ? '#059669' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                <Banknote size={16} />
                <span>Tiền Mặt (Vào Két)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: paymentMethod === 'BANK_TRANSFER' ? '1.5px solid #0284c7' : '1px solid var(--border-subtle)',
                  background: paymentMethod === 'BANK_TRANSFER' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-subtle)',
                  color: paymentMethod === 'BANK_TRANSFER' ? '#0284c7' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                <CreditCard size={16} />
                <span>Chuyển Khoản QR</span>
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
              Ghi Chú Thu Nợ
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Khách trả tiền đợt 1..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: 12,
                outline: 'none'
              }}
            />
          </div>

          {/* Thông báo lỗi / thành công */}
          {error && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14
            }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#059669',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14
            }}>
              <CheckCircle2 size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ACTIONS */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
              }}
            >
              {isSubmitting ? 'Đang Thu Nợ...' : '✓ Xác Nhận Thu Nợ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
