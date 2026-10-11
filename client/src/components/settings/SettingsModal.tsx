import React, { useState } from 'react';
import { 
  X, 
  Store, 
  CreditCard, 
  Users, 
  Type, 
  Save, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { 
  storeSettings, 
  type StoreSettings, 
  POPULAR_BANKS, 
  FONT_OPTIONS,
  type StaffAccount 
} from '../../services/storeSettingsService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'STORE' | 'BANK' | 'STAFF' | 'TYPOGRAPHY';
  defaultTab?: 'STORE' | 'BANK' | 'STAFF' | 'TYPOGRAPHY';
}

const SettingsModalDialog: React.FC<SettingsModalProps> = ({
  onClose,
  initialTab,
  defaultTab
}) => {
  const startTab = initialTab || defaultTab || 'STORE';
  const [activeTab, setActiveTab] = useState<'STORE' | 'BANK' | 'STAFF' | 'TYPOGRAPHY'>(startTab);
  const [formData, setFormData] = useState<StoreSettings>(() => storeSettings.getSettings());
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Form nhân viên mới
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'CASHIER' | 'MANAGER'>('CASHIER');

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    storeSettings.saveSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleAddStaff = () => {
    if (!newStaffName.trim()) {
      alert('Vui lòng nhập họ tên nhân viên.');
      return;
    }
    const newStaff: StaffAccount = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      phone: newStaffPhone.trim() || '0900000000',
      role: newStaffRole,
      pinCode: '0000',
      active: true
    };
    const updatedList = [...formData.staffList, newStaff];
    setFormData(prev => ({ ...prev, staffList: updatedList }));
    storeSettings.saveSettings({ staffList: updatedList });
    setNewStaffName('');
    setNewStaffPhone('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleDeleteStaff = (staffId: string) => {
    if (formData.staffList.length <= 1) {
      alert('Hệ thống phải có ít nhất 1 tài khoản nhân viên / chủ cửa hàng.');
      return;
    }
    const updatedList = formData.staffList.filter(s => s.id !== staffId);
    let nextCurrent = formData.currentStaffId;
    if (nextCurrent === staffId) {
      nextCurrent = updatedList[0].id;
    }
    setFormData(prev => ({ ...prev, staffList: updatedList, currentStaffId: nextCurrent }));
    storeSettings.saveSettings({ staffList: updatedList, currentStaffId: nextCurrent });
  };

  // Preview QR code
  const previewQrUrl = `https://img.vietqr.io/image/${formData.bankCode}-${formData.bankAccountNumber}-compact2.png?amount=100000&addInfo=HD-MAU&accountName=${encodeURIComponent(formData.bankAccountName || 'CHU TAI KHOAN')}`;

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
        borderRadius: 16,
        width: '100%',
        maxWidth: 780,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        overflow: 'hidden'
      }}>
        {/* HEADER MODAL */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-subtle, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--primary, #0284c7)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Trung Tâm Cài Đặt & Tùy Biến Hệ Thống
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Thay đổi tài khoản VietQR, nhân viên, tên thương hiệu và kiểu chữ tự do theo ý bạn
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
              borderRadius: 8
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* TAB NAVIGATION */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          background: 'var(--bg-card)',
          padding: '0 16px',
          overflowX: 'auto',
          gap: 6
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('STORE')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'STORE' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'STORE' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'STORE' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Store size={16} /> 🏪 Cửa Hàng & Chủ Sở Hữu
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BANK')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'BANK' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'BANK' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'BANK' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <CreditCard size={16} /> 💳 Ngân Hàng & VietQR
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STAFF')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'STAFF' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'STAFF' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'STAFF' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Users size={16} /> 👥 Tài Khoản Nhân Viên
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TYPOGRAPHY')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'TYPOGRAPHY' ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'TYPOGRAPHY' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'TYPOGRAPHY' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Type size={16} /> 🎨 Chữ & Định Dạng Giao Diện
          </button>
        </div>

        {/* NỘI DUNG TỪNG TAB */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {isSaved && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10b981',
              color: '#059669',
              padding: '10px 16px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <CheckCircle2 size={18} />
              <span>Đã lưu cài đặt và áp dụng toàn hệ thống thành công!</span>
            </div>
          )}

          {/* TAB 1: CỬA HÀNG & CHỦ SỞ HỮU */}
          {activeTab === 'STORE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Tên Cửa Hàng / Thương Hiệu:
                  </label>
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    placeholder="VD: Bách Hóa Tiêu Dùng Tuấn Tiến"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Hiển thị trên đầu Header và dòng đầu tiên của hóa đơn in
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Tên Chủ Cửa Hàng (Tên của bạn):
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="VD: Trần Tiến"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Đại diện pháp lý / Quản trị viên cao nhất
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Hotline / Số Điện Thoại Bán Hàng:
                  </label>
                  <input
                    type="text"
                    value={formData.hotline}
                    onChange={(e) => setFormData({ ...formData, hotline: e.target.value })}
                    placeholder="VD: 0908 123 456"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Địa Chỉ Cửa Hàng:
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="VD: 123 Nguyễn Thị Minh Khai, Q.1, TP.HCM"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  Lời Chúc / Chân Trang Hóa Đơn:
                </label>
                <input
                  type="text"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  placeholder="VD: Cảm ơn Quý Khách - Hẹn Gặp Lại!"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: NGÂN HÀNG & VIETQR */}
          {activeTab === 'BANK' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Chọn Ngân Hàng Thụ Hưởng:
                  </label>
                  <select
                    value={formData.bankCode}
                    onChange={(e) => {
                      const bank = POPULAR_BANKS.find(b => b.code === e.target.value);
                      setFormData({
                        ...formData,
                        bankCode: e.target.value,
                        bankName: bank?.name || e.target.value
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  >
                    {POPULAR_BANKS.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Số Tài Khoản Ngân Hàng:
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value.replace(/\s+/g, '') })}
                    placeholder="VD: 0908123456"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 700, borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Tên Chủ Tài Khoản (In hoa không dấu):
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountName}
                    onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value.toUpperCase() })}
                    placeholder="VD: TRAN TIEN"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, fontWeight: 700, borderRadius: 8 }}
                  />
                </div>

                <div style={{
                  background: 'var(--bg-subtle)',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  💡 <strong>Tự Động Tạo VietQR:</strong> Khách mua hàng chỉ cần mở app ngân hàng quét mã QR, hệ thống tự động điền đúng Số Tiền và Mã Hóa Đơn, không sợ chuyển nhầm tiền!
                </div>
              </div>

              {/* LIVE PREVIEW VIETQR */}
              <div style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
                  Mã VietQR Thực Tế Cho Khách
                </span>
                <div style={{
                  background: '#ffffff',
                  padding: 8,
                  borderRadius: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                  <img
                    src={previewQrUrl}
                    alt="VietQR Preview"
                    style={{ width: 170, height: 170, display: 'block' }}
                  />
                </div>
                <div style={{ marginTop: 10, fontSize: 12 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{formData.bankAccountName || 'TRAN TIEN'}</div>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>STK: {formData.bankAccountNumber}</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 11 }}>{formData.bankName}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TÀI KHOẢN & NHÂN VIÊN */}
          {activeTab === 'STAFF' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Form Thêm Nhân Viên */}
              <div style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: 14
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} color="var(--primary)" /> Thêm Tài Khoản Nhân Viên / Thu Ngân Mới
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="Họ tên nhân viên..."
                    style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6 }}
                  />
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="Số điện thoại..."
                    style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6 }}
                  />
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as any)}
                    style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6 }}
                  >
                    <option value="CASHIER">🛒 Thu Ngân Quầy</option>
                    <option value="MANAGER">👑 Quản Trị Viên / Chủ</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddStaff}
                    style={{
                      background: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Bảng Danh Sách Nhân Viên */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Danh Sách Nhân Viên Hệ Thống:
                </label>
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <tr>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nhân Viên</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Số Điện Thoại</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Vai Trò</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Đang Trực Ca</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.staffList.map((s) => {
                        const isCurrent = formData.currentStaffId === s.id;
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.name}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{s.phone}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background: s.role === 'MANAGER' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                color: s.role === 'MANAGER' ? 'var(--primary)' : '#059669'
                              }}>
                                {s.role === 'MANAGER' ? '👑 Quản Trị' : '🛒 Thu Ngân'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <input
                                type="radio"
                                name="currentStaffRadio"
                                checked={isCurrent}
                                onChange={() => {
                                  setFormData(prev => ({ ...prev, currentStaffId: s.id }));
                                  storeSettings.saveSettings({ currentStaffId: s.id });
                                }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(s.id)}
                                title="Xóa nhân viên"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: 4
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHỮ & ĐỊNH DẠNG GIAO DIỆN */}
          {activeTab === 'TYPOGRAPHY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Kiểu Font Chữ Toàn Hệ Thống:
                  </label>
                  <select
                    value={formData.fontFamily}
                    onChange={(e) => {
                      const next = { ...formData, fontFamily: e.target.value };
                      setFormData(next);
                      storeSettings.applyToDOM(next);
                    }}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  >
                    {FONT_OPTIONS.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Cỡ Chữ Giao Diện (Font Size Scale):
                  </label>
                  <select
                    value={formData.fontSize}
                    onChange={(e) => {
                      const next = { ...formData, fontSize: e.target.value as any };
                      setFormData(next);
                      storeSettings.applyToDOM(next);
                    }}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  >
                    <option value="compact">Nhỏ Gọn (13px - Hiển thị nhiều dữ liệu)</option>
                    <option value="standard">Tiêu Chuẩn (14px - Chuẩn màn hình quầy)</option>
                    <option value="large">Lớn / Dễ Đọc (15.5px - Dành cho quầy máy tính bảng)</option>
                    <option value="huge">Cực Lớn (17px - Dễ nhìn cho người lớn tuổi)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Khổ In Hóa Đơn Mặc Định:
                  </label>
                  <select
                    value={formData.printFormat}
                    onChange={(e) => setFormData({ ...formData, printFormat: e.target.value as any })}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
                  >
                    <option value="K80">Khổ Giấy Nhiệt K80 (80mm - Máy in quầy POS)</option>
                    <option value="A4">Khổ Giấy A4 / A5 (In văn bản / Xuất buôn)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Màu Sắc Giao Diện:
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...formData, theme: 'light' as const };
                        setFormData(next);
                        storeSettings.applyToDOM(next);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 8,
                        border: formData.theme === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      <Sun size={16} color="#d97706" /> Chế Độ Sáng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...formData, theme: 'dark' as const };
                        setFormData(next);
                        storeSettings.applyToDOM(next);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 8,
                        border: formData.theme === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      <Moon size={16} color="#38bdf8" /> Chế Độ Tối
                    </button>
                  </div>
                </div>
              </div>

              {/* KHUNG XEM TRƯỚC TYPOGRAPHY TRỰC TIẾP */}
              <div style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: 16
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                  👁️ Xem Trước Kiểu Chữ Thời Gian Thực (Live Preview):
                </span>
                <div style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  marginBottom: 6
                }}>
                  {formData.storeName || 'MEB POS - Bán Hàng Siêu Tốc'}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Hệ thống quản trị bán hàng đa chi nhánh, quét mã vạch 0.01 giây, tự động rã thùng sang bì, thanh toán VietQR và đối soát sổ nợ thông minh.
                </div>
                <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: '#059669' }}>
                  Tổng thanh toán: 1.250.000đ • Đã thanh toán: 1.250.000đ
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-subtle, #f8fafc)'
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            💡 Cài đặt được lưu tự động và có hiệu lực ngay lập tức.
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-main)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--primary, #0284c7)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)'
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

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <SettingsModalDialog {...props} />;
};
