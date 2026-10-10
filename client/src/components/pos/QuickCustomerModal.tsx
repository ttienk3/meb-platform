import React, { useState } from 'react';
import { X, UserPlus, AlertTriangle } from 'lucide-react';
import { api, type PartnerProfile } from '../../services/api';

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCustomer: PartnerProfile) => void;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [debtLimit, setDebtLimit] = useState<number>(5000000);
  const [priceGroup, setPriceGroup] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên khách hàng.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createPartner({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        debt_limit: Number(debtLimit) || 0,
        price_group: priceGroup
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        setName('');
        setPhone('');
        setAddress('');
        setDebtLimit(5000000);
        onClose();
      }
    } catch (err: any) {
      console.error('🔥 [QuickCustomerModal Error]:', err);
      setErrorMessage(err.message || 'Không thể tạo mới khách hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 16,
          border: '1px solid var(--border-medium)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          background: 'var(--bg-panel)'
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserPlus size={20} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thêm Nhanh Khách Hàng</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {errorMessage && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              color: '#f87171',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Họ và Tên Khách Hàng <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: Nguyễn Văn An, Chị Hoa Tạp Hóa..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Số Điện Thoại
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="VD: 0988123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Nhóm Giá Áp Dụng
                </label>
                <select
                  className="input-field"
                  value={priceGroup}
                  onChange={(e) => setPriceGroup(e.target.value as any)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="RETAIL">Giá Bán Lẻ</option>
                  <option value="WHOLESALE">Giá Bán Buôn / Đại Lý</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Địa Chỉ Nhận Hàng
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: 123 Hai Bà Trưng, P. Bến Nghé, Q1"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Hạn Mức Tín Dụng Bán Nợ (VNĐ)
              </label>
              <input
                type="number"
                step="500000"
                min="0"
                className="input-field"
                value={debtLimit}
                onChange={(e) => setDebtLimit(Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Hạn mức tối đa khách được phép nợ trước khi hệ thống khóa xuất đơn (INV-08).
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-action"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700 }}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu & Chọn Khách'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
