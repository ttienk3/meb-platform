import React from 'react';
import { QrCode, X, CheckCircle2, Copy, Check, Settings } from 'lucide-react';
import { storeSettings } from '../../services/storeSettingsService';

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
  onOpenSettings?: () => void;
}

export const VietQrModal: React.FC<VietQrModalProps> = ({
  isOpen,
  onClose,
  amount,
  orderCode = 'HD-BAN-LE',
  bankCode,
  bankName,
  accountNumber,
  accountName,
  onConfirmPaid,
  onOpenSettings
}) => {
  const [copied, setCopied] = React.useState<string | null>(null);
  const currentSettings = storeSettings.getSettings();

  const finalBankCode = bankCode || currentSettings.bankCode || 'MB';
  const finalBankName = bankName || currentSettings.bankName || 'MB Bank (Quân Đội)';
  const finalAccountNumber = accountNumber || currentSettings.bankAccountNumber || '0908123456';
  const finalAccountName = accountName || currentSettings.bankAccountName || 'TRAN TIEN';

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const qrUrl = `https://img.vietqr.io/image/${finalBankCode}-${finalAccountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(finalAccountName)}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        color: 'var(--text-main, #0f172a)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 440,
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-subtle, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--primary-subtle, #e0f2fe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary, #0284c7)'
            }}>
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Quét Mã VietQR Chuyển Khoản
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Mã QR động chuẩn Napas 247
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
            <X size={20} />
          </button>
        </div>

        {/* NỘI DUNG QR & CHI TIẾT */}
        <div style={{ padding: 20, textAlign: 'center' }}>
          {/* SỐ TIỀN CẦN THANH TOÁN */}
          <div style={{
            background: 'var(--primary-subtle, #f0f9ff)',
            border: '1px solid rgba(2, 132, 199, 0.2)',
            borderRadius: 12,
            padding: '10px 16px',
            marginBottom: 14
          }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 2 }}>Số tiền cần thanh toán:</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary, #0284c7)' }}>
              {amount.toLocaleString('vi-VN')} đ
            </div>
          </div>

          {/* HÌNH ẢNH MÃ QR */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 10,
            display: 'inline-block',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            marginBottom: 14
          }}>
            <img 
              src={qrUrl} 
              alt="VietQR Code" 
              style={{ width: 210, height: 210, objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* THÔNG TIN CHUYỂN KHOẢN KÈM NÚT COPY */}
          <div style={{
            background: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: 10,
            padding: 12,
            textAlign: 'left',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ngân hàng:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{finalBankName}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Số tài khoản:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 13 }}>{finalAccountNumber}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(finalAccountNumber, 'acc')}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10.5
                  }}
                >
                  {copied === 'acc' ? <Check size={11} color="#059669" /> : <Copy size={11} />}
                  <span>{copied === 'acc' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Chủ tài khoản:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{finalAccountName}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nội dung CK:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{orderCode}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(orderCode, 'code')}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10.5
                  }}
                >
                  {copied === 'code' ? <Check size={11} color="#059669" /> : <Copy size={11} />}
                  <span>{copied === 'code' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* NÚT THAY ĐỔI CÀI ĐẶT NGÂN HÀNG & NÚT XÁC NHẬN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Đóng lại
              </button>
              {onConfirmPaid && (
                <button
                  type="button"
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

            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '4px 8px'
                }}
              >
                <Settings size={13} />
                <span>Đổi thông tin ngân hàng / Tên chủ tài khoản</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
