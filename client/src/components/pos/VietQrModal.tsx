import React from 'react';
import { QrCode, X, CheckCircle2, Copy, Check } from 'lucide-react';

interface VietQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  orderCode?: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  onConfirmPaid?: () => void;
}

export const VietQrModal: React.FC<VietQrModalProps> = ({
  isOpen,
  onClose,
  amount,
  orderCode = 'HD-BAN-LE',
  bankCode = 'MB',
  bankName = 'MB Bank (Quân Đội)',
  accountNumber = '0908123456',
  accountName = 'MEB PLATFORM STORE',
  onConfirmPaid
}) => {
  const [copied, setCopied] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(accountName)}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 440,
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Quét Mã VietQR Chuyển Khoản
              </h3>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                Mã QR động chuẩn Napas 247
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
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* NỘI DUNG QR & CHI TIẾT */}
        <div style={{ padding: 20, textAlign: 'center' }}>
          {/* SỐ TIỀN CẦN THANH TOÁN */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>Số tiền cần thanh toán:</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>
              {amount.toLocaleString('vi-VN')} đ
            </div>
          </div>

          {/* HÌNH ẢNH MÃ QR */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 12,
            display: 'inline-block',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            marginBottom: 16
          }}>
            <img 
              src={qrUrl} 
              alt="VietQR Code" 
              style={{ width: 220, height: 220, objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* THÔNG TIN CHUYỂN KHOẢN KÈM NÚT COPY */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            padding: 12,
            textAlign: 'left',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8' }}>Ngân hàng:</span>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>{bankName}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8' }}>Số tài khoản:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{accountNumber}</span>
                <button
                  onClick={() => handleCopy(accountNumber, 'acc')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 6px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10
                  }}
                >
                  {copied === 'acc' ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                  <span>{copied === 'acc' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8' }}>Chủ tài khoản:</span>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>{accountName}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8' }}>Nội dung CK:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{orderCode}</span>
                <button
                  onClick={() => handleCopy(orderCode, 'code')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 6px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10
                  }}
                >
                  {copied === 'code' ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                  <span>{copied === 'code' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* NÚT XÁC NHẬN */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Đóng lại
            </button>
            {onConfirmPaid && (
              <button
                onClick={() => {
                  onConfirmPaid();
                  onClose();
                }}
                style={{
                  flex: 2,
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                <CheckCircle2 size={16} />
                <span>Khách Đã Chuyển Khoản Xong</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
