import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  QrCode, 
  Building2, 
  Users, 
  Palette, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  KeyRound
} from 'lucide-react';
import { 
  systemSettingsStore, 
  type SystemSettings, 
  VIETNAMESE_BANKS, 
  FONT_OPTIONS, 
  COLOR_OPTIONS,
  type StaffMember
} from '../../services/systemSettings';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'BANK_QR' | 'STORE_INFO' | 'STAFF' | 'APPEARANCE';

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return <SystemSettingsModalContent onClose={onClose} />;
};

const SystemSettingsModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('stab') as SettingsTab;
      if (p && ['BANK_QR', 'STORE_INFO', 'STAFF', 'APPEARANCE'].includes(p)) return p;
    }
    return 'BANK_QR';
  });
  const [formData, setFormData] = useState<SystemSettings>(() => systemSettingsStore.getSettings());
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<'CASHIER' | 'MANAGER'>('CASHIER');
  const [newStaffPhone, setNewStaffPhone] = useState<string>('');
  const [newStaffPin, setNewStaffPin] = useState<string>('0000');

  const handleChange = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setFormData(prev => {
      const updated = { ...prev, [key]: value };
      // Áp dụng trực tiếp vào DOM xem trước thời gian thực
      if (['fontFamily', 'fontSize', 'primaryColor'].includes(key as string)) {
        systemSettingsStore.applyDomStyles(updated);
      }
      return updated;
    });
  };

  const handleBankSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value;
    const bank = VIETNAMESE_BANKS.find(b => b.code === selectedCode);
    if (bank) {
      handleChange('bankCode', bank.code);
      handleChange('bankName', bank.name);
    }
  };

  const handleAddStaff = () => {
    if (!newStaffName.trim()) return;
    const newStaff: StaffMember = {
      id: `st-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      phone: newStaffPhone.trim() || undefined,
      pin: newStaffPin.trim() || '0000'
    };
    const updatedList = [...formData.staffList, newStaff];
    handleChange('staffList', updatedList);
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffPin('0000');
  };

  const handleRemoveStaff = (staffId: string) => {
    if (formData.staffList.length <= 1) {
      alert('Phải giữ lại ít nhất 1 tài khoản nhân viên quản trị.');
      return;
    }
    const updatedList = formData.staffList.filter(s => s.id !== staffId);
    handleChange('staffList', updatedList);
  };

  const handleSave = () => {
    systemSettingsStore.saveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 900);
  };

  // URL xem trước QR động của VietQR
  const previewQrUrl = `https://img.vietqr.io/image/${formData.bankCode}-${formData.accountNumber}-${formData.qrTemplate || 'compact2'}.png?amount=50000&addInfo=TEST%20MEB%20POS&accountName=${encodeURIComponent(formData.accountName)}`;

  return (
    <div 
      className="modal-overlay" 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 840,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          background: 'var(--bg-card)'
        }}
      >
        {/* HEADER MODAL */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(2, 132, 199, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
                Trung Tâm Cài Đặt & Tùy Biến Toàn Diện
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Tài khoản ngân hàng VietQR, Tên của bạn, Nhân viên và Phông chữ / Màu sắc giao diện
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* TABS THANH ĐIỀU HƯỚNG */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle)',
          padding: '0 16px',
          gap: 6
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('BANK_QR')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'BANK_QR' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              background: 'transparent',
              color: activeTab === 'BANK_QR' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'BANK_QR' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <QrCode size={16} /> Tài Khoản Ngân Hàng (VietQR)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STORE_INFO')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'STORE_INFO' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              background: 'transparent',
              color: activeTab === 'STORE_INFO' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'STORE_INFO' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Building2 size={16} /> Tên Của Tôi & Cửa Hàng
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STAFF')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'STAFF' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              background: 'transparent',
              color: activeTab === 'STAFF' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'STAFF' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Users size={16} /> Nhân Viên & Bảo Mật
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPEARANCE')}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'APPEARANCE' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              background: 'transparent',
              color: activeTab === 'APPEARANCE' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'APPEARANCE' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Palette size={16} /> Định Dạng Chữ & Giao Diện
          </button>
        </div>

        {/* NỘI DUNG TỪNG TAB */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* TAB 1: TÀI KHOẢN NGÂN HÀNG & VIETQR */}
          {activeTab === 'BANK_QR' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
              <div>
                <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                  Thiết Lập Tài Khoản Nhận Tiền Chuyển Khoản
                </h4>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Ngân hàng thụ hưởng:
                  </label>
                  <select
                    value={formData.bankCode}
                    onChange={handleBankSelect}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      outline: 'none'
                    }}
                  >
                    {VIETNAMESE_BANKS.map(b => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Số tài khoản ngân hàng:
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => handleChange('accountNumber', e.target.value.replace(/\s+/g, ''))}
                    placeholder="VD: 0908123456"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 15,
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Tên chủ tài khoản (In hoa không dấu):
                  </label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => handleChange('accountName', e.target.value.toUpperCase())}
                    placeholder="VD: TRAN TIEN"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      fontWeight: 700,
                      outline: 'none',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Mẫu hiển thị VietQR:
                  </label>
                  <select
                    value={formData.qrTemplate}
                    onChange={(e) => handleChange('qrTemplate', e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14
                    }}
                  >
                    <option value="compact2">Chuẩn VietQR Đầy Đủ (Kèm Logo Ngân Hàng & Napas247)</option>
                    <option value="compact">Gọn nhẹ (Compact)</option>
                    <option value="qr_only">Chỉ hiển thị mã QR (QR Only)</option>
                  </select>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'rgba(2, 132, 199, 0.08)',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  fontSize: 12.5,
                  color: 'var(--primary)',
                  lineHeight: 1.5
                }}>
                  💡 <strong>Tự động hóa:</strong> Khi khách chọn phương thức thanh toán <strong>Chuyển Khoản</strong> tại quầy POS, hệ thống sẽ tự sinh mã QR gắn đúng số tài khoản và ngân hàng này để khách quét thanh toán tức thì!
                </div>
              </div>

              {/* KHUNG XEM TRƯỚC VIETQR LIVE */}
              <div style={{
                background: 'var(--bg-subtle)',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <QrCode size={16} color="var(--primary)" /> XEM TRƯỚC MÃ VIETQR THỰC TẾ
                </div>

                <div style={{
                  background: '#ffffff',
                  padding: 10,
                  borderRadius: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  marginBottom: 12
                }}>
                  <img
                    src={previewQrUrl}
                    alt="VietQR Preview"
                    style={{ width: 200, height: 260, objectFit: 'contain', display: 'block' }}
                  />
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                  {formData.bankName}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', letterSpacing: 0.5 }}>
                  STK: {formData.accountNumber || 'Chưa nhập'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {formData.accountName || 'CHƯA NHẬP TÊN'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TÊN CỦA TÔI & CỬA HÀNG */}
          {activeTab === 'STORE_INFO' && (
            <div style={{ maxWidth: 640 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                Thông Tin Thương Hiệu & Tiêu Đề Hóa Đơn In
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Tên của tôi (Chủ cửa hàng):
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => handleChange('ownerName', e.target.value)}
                    placeholder="VD: Trần Tiến"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Tên Cửa Hàng / Doanh Nghiệp:
                  </label>
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => handleChange('storeName', e.target.value)}
                    placeholder="VD: Cửa Hàng Bách Hóa MEB"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      fontWeight: 700
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Hotline / Điện thoại liên hệ:
                  </label>
                  <input
                    type="text"
                    value={formData.hotline}
                    onChange={(e) => handleChange('hotline', e.target.value)}
                    placeholder="VD: 0908 123 456"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Địa chỉ cửa hàng:
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="VD: 123 Nguyễn Thị Minh Khai, Q.1"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Slogan / Lời cảm ơn in chân hóa đơn (Bill K80 / A4):
                </label>
                <input
                  type="text"
                  value={formData.invoiceSlogan}
                  onChange={(e) => handleChange('invoiceSlogan', e.target.value)}
                  placeholder="VD: Cảm ơn Quý Khách - Hẹn Gặp Lại!"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: 14
                  }}
                />
              </div>

              {/* Khung mô phỏng Header Bill in ấn */}
              <div style={{
                background: '#ffffff',
                color: '#000000',
                border: '1px dashed #cbd5e1',
                borderRadius: 8,
                padding: 16,
                textAlign: 'center',
                fontFamily: 'monospace'
              }}>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{formData.storeName || 'TÊN CỬA HÀNG CỦA BẠN'}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Đ/c: {formData.address || 'Địa chỉ quầy'}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Hotline: {formData.hotline || '0908 123 456'}</div>
                <div style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
                <div style={{ fontSize: 11, fontStyle: 'italic' }}>*** {formData.invoiceSlogan} ***</div>
              </div>
            </div>
          )}

          {/* TAB 3: NHÂN VIÊN & BẢO MẬT */}
          {activeTab === 'STAFF' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={{
                  padding: 16,
                  borderRadius: 10,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                    Thu ngân phụ trách ca hiện tại:
                  </label>
                  <input
                    type="text"
                    value={formData.activeCashierName}
                    onChange={(e) => handleChange('activeCashierName', e.target.value)}
                    placeholder="VD: Thu Ngân Q1"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Tên này sẽ hiển thị trên Header và dòng "Thu ngân" trên hóa đơn bán lẻ.
                  </div>
                </div>

                <div style={{
                  padding: 16,
                  borderRadius: 10,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                    Mã PIN quản lý phê duyệt đặc cách:
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                    <input
                      type="password"
                      maxLength={6}
                      value={formData.managerPin}
                      onChange={(e) => handleChange('managerPin', e.target.value)}
                      placeholder="Mã PIN 4-6 số"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: 15,
                        fontWeight: 800,
                        letterSpacing: 3
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Mã này dùng để mở két hoặc duyệt xuất đơn nợ khi khách vượt hạn mức tín dụng.
                  </div>
                </div>
              </div>

              {/* DANH SÁCH NHÂN VIÊN */}
              <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                Danh Sách Nhân Viên & Phân Quyền ({formData.staffList.length})
              </h4>

              <div style={{
                borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                marginBottom: 20
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Họ và Tên</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Vai Trò</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Số Điện Thoại</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Mã PIN</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', width: 60 }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.staffList.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {s.name}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: s.role === 'ADMIN' ? 'rgba(239, 68, 68, 0.12)' : s.role === 'MANAGER' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: s.role === 'ADMIN' ? '#ef4444' : s.role === 'MANAGER' ? 'var(--primary)' : '#059669'
                          }}>
                            {s.role === 'ADMIN' ? 'Chủ Chuỗi' : s.role === 'MANAGER' ? 'Quản Lý' : 'Thu Ngân'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {s.phone || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          ••••
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveStaff(s.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-dim)',
                              cursor: 'pointer',
                              padding: 4
                            }}
                            title="Xóa nhân viên"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* THÊM NHÂN VIÊN MỚI */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto',
                gap: 10,
                alignItems: 'end',
                padding: 14,
                borderRadius: 10,
                background: 'var(--bg-subtle)',
                border: '1px dashed var(--border-subtle)'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Họ tên nhân viên mới:
                  </label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="VD: Lê Thị B"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 13
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Vai trò:
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 13
                    }}
                  >
                    <option value="CASHIER">Thu Ngân</option>
                    <option value="MANAGER">Quản Lý</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Số điện thoại:
                  </label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="VD: 0912..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 13
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Mã PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    placeholder="4 số"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 13
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddStaff}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 35
                  }}
                >
                  <Plus size={15} /> Thêm
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ĐỊNH DẠNG CHỮ & GIAO DIỆN (TYPOGRAPHY & APPEARANCE) */}
          {activeTab === 'APPEARANCE' && (
            <div style={{ maxWidth: 680 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                Tùy Biến Phông Chữ, Cỡ Chữ & Màu Sắc Toàn Hệ Thống
              </h4>

              {/* CHỌN PHÔNG CHỮ */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                  1. Phông chữ hiển thị (Typography):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {FONT_OPTIONS.map(f => {
                    const isSelected = formData.fontFamily === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleChange('fontFamily', f.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-subtle)',
                          fontFamily: f.value,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-main)', marginBottom: 4 }}>
                          {f.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Bánh kẹo, 140 Hộp, 50.000đ
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CHỌN CỠ CHỮ GIAO DIỆN */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                  2. Cỡ chữ toàn trang (Scale Text Size):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { id: 'compact', title: 'Nhỏ gọn (13px)', desc: 'Hiển thị tối đa sản phẩm, hợp máy tính bảng' },
                    { id: 'normal', title: 'Tiêu chuẩn (14px)', desc: 'Cân bằng, đọc thoải mái mắt' },
                    { id: 'comfortable', title: 'Lớn & Dễ nhìn (15.5px)', desc: 'Chữ to rõ nét, thao tác nhanh tại quầy' }
                  ].map(sz => {
                    const isSelected = formData.fontSize === sz.id;
                    return (
                      <div
                        key={sz.id}
                        onClick={() => handleChange('fontSize', sz.id as any)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-subtle)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-main)', marginBottom: 4 }}>
                          {sz.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {sz.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CHỌN MÀU SẮC CHỦ ĐẠO */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                  3. Màu sắc thương hiệu chủ đạo (Accent Color):
                </label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {COLOR_OPTIONS.map(c => {
                    const isSelected = formData.primaryColor === c.value;
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleChange('primaryColor', c.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 14px',
                          borderRadius: 20,
                          cursor: 'pointer',
                          border: isSelected ? `2px solid ${c.value}` : '1px solid var(--border-subtle)',
                          background: isSelected ? 'var(--bg-subtle)' : 'transparent'
                        }}
                      >
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: c.value }} />
                        <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: 'var(--text-main)' }}>
                          {c.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER NÚT BẤM */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-subtle)'
        }}>
          <button
            type="button"
            onClick={() => {
              if (confirm('Khôi phục toàn bộ cài đặt về mặc định của hệ thống?')) {
                localStorage.removeItem('meb_system_settings');
                window.location.reload();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 13,
              cursor: 'pointer',
              padding: '6px 10px'
            }}
          >
            <RotateCcw size={14} /> Khôi phục mặc định
          </button>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saveSuccess && (
              <span style={{ color: '#059669', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> Đã áp dụng thành công!
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <Save size={16} /> Lưu Cài Đặt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
