import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface PosHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PosHelpModal: React.FC<PosHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'F1', label: 'Trợ giúp phím tắt', desc: 'Mở cửa sổ danh sách phím tắt quầy thu ngân' },
    { key: 'F2', label: 'Tìm kiếm & Quét Barcode', desc: 'Focus ngay vào ô tìm kiếm hàng hóa / máy quét mã vạch' },
    { key: 'F3', label: 'Thu nợ & Sổ công nợ', desc: 'Mở cửa sổ thu tiền nợ khách hàng nhanh' },
    { key: 'F4', label: 'Thêm đơn mới', desc: 'Mở thêm tab đơn hàng chờ mới tại quầy (tối đa 5 đơn)' },
    { key: 'F6', label: 'Đổi đơn chờ', desc: 'Chuyển đổi qua lại giữa các giỏ hàng đang chờ thanh toán' },
    { key: 'F8', label: 'Quản lý ca & Két tiền', desc: 'Mở ca bán hàng, kiểm đếm két tiền, giao ca F8' },
    { key: 'F9', label: 'Thanh toán đơn hàng', desc: 'Kích hoạt hoàn tất đơn hàng và in hóa đơn' },
    { key: 'F10', label: 'Đổi trả hàng (RMA)', desc: 'Mở giao diện khách trả hàng cấn trừ nợ (INV-07)' },
    { key: 'ESC', label: 'Đóng / Thoát cửa sổ', desc: 'Đóng các cửa sổ modal hoặc popup đang mở' },
  ];

  return (
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'linear-gradient(145deg, #0f172a, #1e293b)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 620,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)',
          overflow: 'hidden',
          color: '#f8fafc'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(56, 189, 248, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Keyboard size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Bảng Phím Tắt Bán Hàng POS
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                Thao tác thần tốc dành riêng cho quầy thu ngân & máy quét mã vạch
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Danh sách phím tắt */}
        <div style={{ padding: '20px 24px', maxHeight: 420, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {shortcuts.map((s) => (
              <div 
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <kbd style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#38bdf8',
                    background: '#090d16',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: 6,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    minWidth: 42,
                    textAlign: 'center'
                  }}>
                    {s.key}
                  </kbd>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#64748b'
        }}>
          <span>Mẹo: Bạn có thể nhấn <kbd style={{ padding: '2px 6px', background: '#1e293b', borderRadius: 4, color: '#cbd5e1' }}>Esc</kbd> bất kỳ lúc nào để đóng</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
