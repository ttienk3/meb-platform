/**
 * MEB PLATFORM - DYNAMIC SYSTEM & STORE SETTINGS SERVICE
 * Quản trị toàn diện: Tài khoản ngân hàng VietQR, Thông tin cửa hàng/Chủ shop,
 * Quản lý nhân viên thu ngân, Phông chữ, Cỡ chữ và Màu sắc thương hiệu.
 */

export interface StaffMember {
  id: string;
  name: string;
  role: 'CASHIER' | 'MANAGER' | 'ADMIN';
  phone?: string;
  pin?: string;
}

export interface SystemSettings {
  // 1. Tài khoản ngân hàng & VietQR
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrTemplate: 'compact2' | 'compact' | 'qr_only';

  // 2. Thông tin chủ cửa hàng & Hóa đơn in
  ownerName: string;
  storeName: string;
  hotline: string;
  address: string;
  invoiceSlogan: string;

  // 3. Nhân viên & Bảo mật quầy
  activeCashierName: string;
  managerPin: string;
  staffList: StaffMember[];

  // 4. Định dạng chữ & Giao diện (Typography & Appearance)
  fontFamily: string;
  fontSize: 'compact' | 'normal' | 'comfortable';
  primaryColor: string;
  theme: 'light' | 'dark';
}

export const VIETNAMESE_BANKS = [
  { code: 'MB', name: 'MB Bank (Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương)' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương)' },
  { code: 'ACB', name: 'ACB (Á Châu)' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)' },
  { code: 'BIDV', name: 'BIDV (Đầu Tư & Phát Triển)' },
  { code: 'ICB', name: 'VietinBank (Công Thương)' },
  { code: 'VBA', name: 'Agribank (Nông Nghiệp)' },
  { code: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
  { code: 'HDB', name: 'HDBank (Phát Triển TP.HCM)' },
  { code: 'OCB', name: 'OCB (Phương Đông)' },
  { code: 'SHB', name: 'SHB (Sài Gòn - Hà Nội)' },
  { code: 'MSB', name: 'MSB (Hàng Hải)' },
  { code: 'VIB', name: 'VIB (Quốc Tế)' },
  { code: 'CAKE', name: 'Cake by VPBank' }
];

export const FONT_OPTIONS = [
  { id: 'Inter', name: 'Inter (Hiện đại, Chuẩn quốc tế)', value: 'Inter, system-ui, -apple-system, sans-serif' },
  { id: 'Be Vietnam Pro', name: 'Be Vietnam Pro (Thuần Việt sắc nét)', value: '"Be Vietnam Pro", system-ui, sans-serif' },
  { id: 'Roboto', name: 'Roboto (Cổ điển, Rõ ràng)', value: 'Roboto, system-ui, sans-serif' },
  { id: 'Outfit', name: 'Outfit (Trẻ trung, Bo tròn nhẹ)', value: 'Outfit, system-ui, sans-serif' },
  { id: 'Monospace', name: 'Monospace (Chuẩn siêu thị POS)', value: '"JetBrains Mono", Consolas, monospace' }
];

export const COLOR_OPTIONS = [
  { id: 'blue', name: 'Xanh Biển MEB', value: '#0284c7', hover: '#0369a1' },
  { id: 'green', name: 'Xanh Lục Bảo Tài Lộc', value: '#059669', hover: '#047857' },
  { id: 'purple', name: 'Tím Hoàng Gia', value: '#7c3aed', hover: '#6d28d9' },
  { id: 'orange', name: 'Cam Năng Động', value: '#ea580c', hover: '#c2410c' },
  { id: 'red', name: 'Đỏ May Mắn', value: '#dc2626', hover: '#b91c1c' },
  { id: 'slate', name: 'Đen Xám Tối Giản', value: '#0f172a', hover: '#1e293b' }
];

const DEFAULT_SETTINGS: SystemSettings = {
  bankCode: 'MB',
  bankName: 'MB Bank (Quân Đội)',
  accountNumber: '0908123456',
  accountName: 'TRAN TIEN MEB STORE',
  qrTemplate: 'compact2',

  ownerName: 'Trần Tiến',
  storeName: 'Cửa Hàng Bách Hóa & Đồ Uống MEB',
  hotline: '0908 123 456',
  address: '123 Nguyễn Thị Minh Khai, P. Bến Nghé, Q.1, TP.HCM',
  invoiceSlogan: 'Cảm ơn Quý Khách - Hẹn Gặp Lại!',

  activeCashierName: 'Thu Ngân Q1 (Trần Tiến)',
  managerPin: '1234',
  staffList: [
    { id: 'st-1', name: 'Trần Tiến', role: 'ADMIN', phone: '0908123456', pin: '1234' },
    { id: 'st-2', name: 'Nguyễn Văn Thu Ngân', role: 'CASHIER', phone: '0912345678', pin: '0000' }
  ],

  fontFamily: 'Inter',
  fontSize: 'normal',
  primaryColor: '#0284c7',
  theme: 'light'
};

class SystemSettingsStore {
  private settings: SystemSettings;
  private listeners: Set<(settings: SystemSettings) => void> = new Set();

  constructor() {
    this.settings = this.loadFromStorage();
    if (typeof window !== 'undefined') {
      this.applyDomStyles(this.settings);
    }
  }

  private loadFromStorage(): SystemSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem('meb_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error('Lỗi đọc settings từ localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  }

  public getSettings(): SystemSettings {
    return { ...this.settings };
  }

  public saveSettings(newSettings: Partial<SystemSettings>): SystemSettings {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('meb_system_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.error('Lỗi lưu settings vào localStorage:', e);
    }

    if (typeof window !== 'undefined') {
      this.applyDomStyles(this.settings);
    }

    this.notify();
    return this.settings;
  }

  /**
   * Áp dụng trực tiếp phông chữ, cỡ chữ và màu sắc vào CSS Variables của DOM
   */
  public applyDomStyles(settings: SystemSettings) {
    if (typeof document === 'undefined') return;

    // 1. Phông chữ
    const selectedFont = FONT_OPTIONS.find(f => f.id === settings.fontFamily);
    const fontValue = selectedFont ? selectedFont.value : 'Inter, system-ui, sans-serif';
    document.documentElement.style.setProperty('--font-sans', fontValue);
    document.body.style.fontFamily = fontValue;

    // 2. Cỡ chữ gốc (Base Font Size)
    const sizeMap = {
      compact: '13px',
      normal: '14px',
      comfortable: '15.5px'
    };
    document.documentElement.style.fontSize = sizeMap[settings.fontSize] || '14px';

    // 3. Màu sắc chủ đạo (Primary Color & Hover)
    const selectedColor = COLOR_OPTIONS.find(c => c.value === settings.primaryColor) || COLOR_OPTIONS[0];
    document.documentElement.style.setProperty('--primary', selectedColor.value);
    document.documentElement.style.setProperty('--primary-hover', selectedColor.hover);
  }

  public subscribe(listener: (settings: SystemSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }
}

export const systemSettingsStore = new SystemSettingsStore();
