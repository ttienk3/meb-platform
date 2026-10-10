import React, { useState } from 'react';
import { X, Truck, AlertTriangle } from 'lucide-react';
import { api, type Supplier } from '../../services/api';

interface QuickSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSupplier: Supplier) => void;
}

export const QuickSupplierModal: React.FC<QuickSupplierModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Vui lòng nhập tên nhà cung cấp hoặc công ty.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createSupplier({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        tax_code: taxCode.trim() || undefined
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        setName('');
        setPhone('');
        setAddress('');
        setTaxCode('');
        onClose();
      }
    } catch (err: any) {
      console.error('🔥 [QuickSupplierModal Error]:', err);
      setErrorMessage(err.message || 'Không thể tạo mới nhà cung cấp.');
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
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Truck size={20} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thêm Mới Nhà Cung Cấp</h3>
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
                Tên Nhà Cung Cấp / Công Ty <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: Cty TNHH Nước Giải Khát Tân Hiệp, Kho Cung Ứng..."
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
                  Số Điện Thoại Liên Hệ
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="VD: 02838123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Mã Số Thuế (Nếu có)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="VD: 0315897645"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Địa Chỉ Kho / Trụ Sở
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: Lô A2, KCN Tân Bình, Tây Thạnh, Tân Phú"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
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
              style={{ 
                padding: '8px 20px', 
                fontSize: 13, 
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              }}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu & Chọn NCC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
