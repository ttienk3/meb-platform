/**
 * MEB PLATFORM - STORE & SYSTEM SETTINGS SERVICE
 * Quản lý cấu hình toàn diện: Tài khoản ngân hàng VietQR, Tên cửa hàng,
 * Tài khoản nhân viên thu ngân, Font chữ và Định dạng giao diện.
 */

export interface StaffAccount {
  id: string;
  name: string;
  role: 'MANAGER' | 'CASHIER';
  phone: string;
  pinCode?: string;
  active: boolean;
}

export interface BankConfig {
  code: string;       // Mã VietQR: 'MB', 'VCB', 'TCB', 'ACB', 'VPB', 'TPB', 'CTG', 'BIDV', 'VBA'
  name: string;       // Tên đầy đủ
  accountNumber: string;
  accountName: string;
}

export interface StoreSettings {
  // 1. Cửa hàng & Chủ sở hữu
  storeName: string;
  ownerName: string;
  hotline: string;
  address: string;
  receiptFooter: string;

  // 2. Tài khoản Ngân Hàng & VietQR
  bankCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;

  // 3. Danh sách Nhân viên
  staffList: StaffAccount[];
  currentStaffId: string;

  // 4. Định dạng chữ & Giao diện
  fontFamily: string;
  fontSize: 'compact' | 'standard' | 'large' | 'huge';
  printFormat: 'K80' | 'A4';
  theme: 'light' | 'dark';
}

export const POPULAR_BANKS = [
  { code: 'MB', name: 'MB Bank (Ngân Hàng Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương)' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương)' },
  { code: 'ACB', name: 'ACB (Á Châu)' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)' },
  { code: 'CTG', name: 'VietinBank (Công Thương)' },
  { code: 'BIDV', name: 'BIDV (Đầu Tư & Phát Triển)' },
  { code: 'VBA', name: 'Agribank (Nông Nghiệp)' },
  { code: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
  { code: 'HDB', name: 'HDBank (Phát Triển TP.HCM)' },
  { code: 'OCB', name: 'OCB (Phương Đông)' }
];

export const FONT_OPTIONS = [
  { key: 'Be Vietnam Pro', label: 'Be Vietnam Pro (Chuẩn Tiếng Việt, Thanh Lịch)', fontVal: "'Be Vietnam Pro', sans-serif" },
  { key: 'Inter', label: 'Inter (Hiện Đại, Siêu Nét Kiểu Apple/FB)', fontVal: "'Inter', sans-serif" },
  { key: 'Roboto', label: 'Roboto (Chuẩn Google, Rõ Ràng)', fontVal: "'Roboto', sans-serif" },
  { key: 'Nunito', label: 'Nunito (Bo Tròn Thân Thiện, Dịu Mắt)', fontVal: "'Nunito', sans-serif" },
  { key: 'Outfit', label: 'Outfit (Sang Trọng, Cao Cấp)', fontVal: "'Outfit', sans-serif" },
  { key: 'System', label: 'Hệ Thống Mặc Định (System Native)', fontVal: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
];

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'MEB POS - Bách Hóa & Bán Lẻ',
  ownerName: 'Trần Tiến',
  hotline: '0908 123 456',
  address: '123 Nguyễn Thị Minh Khai, P. Bến Nghé, Q.1, TP.HCM',
  receiptFooter: 'Cảm ơn Quý Khách - Hẹn Gặp Lại!',
  
  bankCode: 'MB',
  bankName: 'MB Bank (Ngân Hàng Quân Đội)',
  bankAccountNumber: '0908123456',
  bankAccountName: 'TRAN TIEN',

  staffList: [
    { id: 'staff-1', name: 'Trần Tiến (Chủ Cửa Hàng)', role: 'MANAGER', phone: '0908 123 456', pinCode: '1234', active: true },
    { id: 'staff-2', name: 'Nguyễn Văn Thu Ngân 01', role: 'CASHIER', phone: '0912 345 678', pinCode: '0000', active: true },
    { id: 'staff-3', name: 'Lê Thị Thu Ngân 02', role: 'CASHIER', phone: '0933 678 910', pinCode: '0000', active: true }
  ],
  currentStaffId: 'staff-1',

  fontFamily: 'Be Vietnam Pro',
  fontSize: 'standard',
  printFormat: 'K80',
  theme: 'light'
};

const SETTINGS_KEY = 'meb_store_settings';
type SettingsListener = (settings: StoreSettings) => void;

class StoreSettingsService {
  private settings: StoreSettings;
  private listeners: Set<SettingsListener> = new Set();

  constructor() {
    this.settings = this.loadFromStorage();
    if (typeof window !== 'undefined') {
      this.applyToDOM(this.settings);
    }
  }

  private loadFromStorage(): StoreSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          staffList: Array.isArray(parsed.staffList) && parsed.staffList.length > 0 
            ? parsed.staffList 
            : DEFAULT_SETTINGS.staffList
        };
      }
    } catch (e) {
      console.warn('Lỗi đọc settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public getSettings(): StoreSettings {
    return { ...this.settings };
  }

  public getCurrentStaff(): StaffAccount | null {
    const list = this.settings.staffList || [];
    return list.find(s => s.id === this.settings.currentStaffId) || list[0] || null;
  }

  public getActiveStaff(): StaffAccount | null {
    return this.getCurrentStaff();
  }

  public setActiveStaff(staffId: string): void {
    this.saveSettings({ currentStaffId: staffId });
  }

  public saveSettings(patch: Partial<StoreSettings>): StoreSettings {
    this.settings = {
      ...this.settings,
      ...patch
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      } catch (e) {
        console.error('Lỗi lưu settings:', e);
      }
      this.applyToDOM(this.settings);
    }

    this.notify();
    return { ...this.settings };
  }

  public applyToDOM(settings: StoreSettings) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // 1. Áp dụng Font chữ
    const selectedFont = FONT_OPTIONS.find(f => f.key === settings.fontFamily) || FONT_OPTIONS[0];
    root.style.setProperty('--font-family', selectedFont.fontVal);

    // 2. Áp dụng Cỡ chữ (Scale)
    const fontSizeMap = {
      compact: '13px',
      standard: '14px',
      large: '15.5px',
      huge: '17px'
    };
    root.style.fontSize = fontSizeMap[settings.fontSize] || '14px';

    // 3. Áp dụng Theme
    root.setAttribute('data-theme', settings.theme || 'light');
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getSettings());
      } catch (e) {
        console.error('Lỗi listener settings:', e);
      }
    }
  }
}

export const storeSettings = new StoreSettingsService();
