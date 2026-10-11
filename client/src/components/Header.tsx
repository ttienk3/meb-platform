import React, { useEffect, useState } from 'react';
import { 
  api, 
  type Branch, 
  type RuntimeConfig, 
  type ShiftInfo,
  type UserProfile
} from '../services/api';
import { branchStore } from '../services/branchContext';
import { 
  Building2, 
  ShoppingCart, 
  Truck, 
  BookOpen, 
  SlidersHorizontal, 
  Clock, 
  MonitorDown,
  Plus,
  PackagePlus,
  ClipboardCheck,
  RotateCcw,
  Wallet,
  User,
  Key,
  LogOut,
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react';
import { CreateBranchModal } from './branch/CreateBranchModal';
import { LoginModal } from './auth/LoginModal';

export type NavTab = 'hq' | 'pos' | 'inbound' | 'transfers' | 'debts' | 'cashbook' | 'audit' | 'studio';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenShiftModal?: () => void;
  onOpenReturnModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenShiftModal,
  onOpenReturnModal
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [, setCurrentConfig] = useState<RuntimeConfig | null>(null);
  const [currentShift, setCurrentShift] = useState<ShiftInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  // State Modal Tạo Chi Nhánh Mới (Hỗ trợ URL query param ?openCreateBranch=1)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(() => {
    return typeof window !== 'undefined' && window.location.search.includes('openCreateBranch');
  });

  // Chế độ Vai Trò: Chủ Chuỗi (HQ) vs Thu Ngân Bán Hàng (Cashier Focus)
  const [isCashierOnly, setIsCashierOnly] = useState<boolean>(false);

  // Xác thực người dùng cá nhân & Phân quyền (A3)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => api.getUserProfile());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Chế độ Giao diện Bán Hàng: Light (Thương mại / Siêu thị) vs Dark (Ca đêm / Bar)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meb_pos_theme') as 'light' | 'dark';
      if (saved) return saved;
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meb_pos_theme', theme);
  }, [theme]);

  // Menu Dropdown cho Kho Vận, Quản Trị và User Profile
  const [isWarehouseMenuOpen, setIsWarehouseMenuOpen] = useState<boolean>(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState<boolean>(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-dropdown-container')) {
        setIsWarehouseMenuOpen(false);
        setIsAdminMenuOpen(false);
      }
      if (!target.closest('.profile-menu-container')) {
        setIsProfileMenuOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Đồng bộ ca bán hàng hiện tại của chi nhánh
  const syncShift = async () => {
    try {
      const res = await api.getCurrentShift();
      setCurrentShift(res.data);
    } catch {
      setCurrentShift(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Đăng ký nhận sự kiện khi chi nhánh hoặc cấu hình thay đổi
    const unsubscribe = branchStore.subscribe((config, branch) => {
      if (!isMounted) return;
      setCurrentConfig(config);
      setCurrentBranch(branch);
      setBranches(branchStore.getBranchesList());
      syncShift();
    });

    // Khởi tạo store nếu chưa có dữ liệu
    const init = async () => {
      try {
        setLoading(true);
        const res = await branchStore.initialize();
        if (isMounted && res?.branch) {
          setCurrentConfig(res.config);
          setCurrentBranch(res.branch);
          setBranches(branchStore.getBranchesList());
          syncShift();
        }
      } catch (err) {
        console.error('🔥 [Header Init Error]:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    // Kiểm tra chế độ PWA Desktop Standalone
    const checkStandalone = () => {
      const isStand = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (isMounted) setIsStandalone(Boolean(isStand));
    };
    checkStandalone();

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (isMounted) setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleBranchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = e.target.value;
    if (!newBranchId || newBranchId === currentBranch?.id) return;

    try {
      setLoading(true);
      await branchStore.switchBranch(newBranchId);
    } catch (err: any) {
      alert(`Không thể chuyển chi nhánh: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  return (
    <>
      <header className="meb-header">
        {/* 1. THƯƠNG HIỆU & BỘ CHỌN CHI NHÁNH */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div className="meb-brand" onClick={() => onTabChange('pos')}>
            <div className="meb-logo-badge">M</div>
            <div className="meb-brand-text">
              <h1>MEB POS</h1>
            </div>
          </div>

          {/* BỘ CHỌN CHI NHÁNH */}
          <div className="branch-select-box" style={{ maxWidth: 175 }}>
            <Building2 size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
            <select 
              value={currentBranch?.id || ''} 
              onChange={handleBranchChange}
              disabled={loading}
              aria-label="Chọn chi nhánh hoạt động"
              style={{
                background: 'transparent',
                color: 'var(--text-main)',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                fontWeight: 600,
                maxWidth: 135,
                cursor: 'pointer'
              }}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.code} • {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. THANH ĐIỀU HƯỚNG TÁCH BIỆT BENTO TABS */}
        <nav className="nav-tabs">
          <button 
            type="button"
            className={`nav-tab-btn ${activeTab === 'pos' ? 'active' : ''}`}
            onClick={() => { onTabChange('pos'); setIsWarehouseMenuOpen(false); setIsAdminMenuOpen(false); }}
          >
            <ShoppingCart size={14} />
            <span>Bán Hàng</span>
          </button>

          <button 
            type="button"
            className={`nav-tab-btn ${activeTab === 'cashbook' ? 'active' : ''}`}
            onClick={() => { onTabChange('cashbook'); setIsWarehouseMenuOpen(false); setIsAdminMenuOpen(false); }}
          >
            <Wallet size={14} />
            <span>Sổ Quỹ</span>
          </button>

          <button 
            type="button"
            className={`nav-tab-btn ${activeTab === 'debts' ? 'active' : ''}`}
            onClick={() => { onTabChange('debts'); setIsWarehouseMenuOpen(false); setIsAdminMenuOpen(false); }}
          >
            <BookOpen size={14} />
            <span>Công Nợ</span>
          </button>

          {!isCashierOnly && (
            <>
              {/* MENU KHO VẬN */}
              <div className="nav-dropdown-container" style={{ position: 'relative' }}>
                <button 
                  type="button"
                  className={`nav-tab-btn ${['inbound', 'transfers', 'audit'].includes(activeTab) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setIsWarehouseMenuOpen(prev => !prev); setIsAdminMenuOpen(false); }}
                  title="Nhập hàng, điều chuyển kho & kiểm kê"
                >
                  <Truck size={14} />
                  <span>Kho Vận</span>
                  <ChevronDown size={12} />
                </button>

                {isWarehouseMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 6,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    padding: 4,
                    minWidth: 150,
                    zIndex: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'inbound' ? 'active' : ''}`}
                      onClick={() => { onTabChange('inbound'); setIsWarehouseMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 32 }}
                    >
                      <PackagePlus size={14} />
                      <span>Nhập Hàng</span>
                    </button>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
                      onClick={() => { onTabChange('transfers'); setIsWarehouseMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 32 }}
                    >
                      <Truck size={14} />
                      <span>Điều Chuyển</span>
                    </button>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                      onClick={() => { onTabChange('audit'); setIsWarehouseMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 32 }}
                    >
                      <ClipboardCheck size={14} />
                      <span>Kiểm Kê</span>
                    </button>
                  </div>
                )}
              </div>

              {/* MENU QUẢN TRỊ */}
              <div className="nav-dropdown-container" style={{ position: 'relative' }}>
                <button 
                  type="button"
                  className={`nav-tab-btn ${['hq', 'studio'].includes(activeTab) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setIsAdminMenuOpen(prev => !prev); setIsWarehouseMenuOpen(false); }}
                  title="Tổng bộ chuỗi HQ & Cấu hình No-Code"
                >
                  <Building2 size={14} />
                  <span>Quản Trị</span>
                  <ChevronDown size={12} />
                </button>

                {isAdminMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 6,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    padding: 4,
                    minWidth: 160,
                    zIndex: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'hq' ? 'active' : ''}`}
                      onClick={() => { onTabChange('hq'); setIsAdminMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 32 }}
                    >
                      <Building2 size={14} />
                      <span>Tổng Bộ HQ</span>
                    </button>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
                      onClick={() => { onTabChange('studio'); setIsAdminMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 32 }}
                    >
                      <SlidersHorizontal size={14} />
                      <span>No-Code Studio</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* 3. TRẠNG THÁI CA TRỰC, TRẢ HÀNG, THEME & USER MENU */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Nút Đổi Trả Hàng RMA (INV-07) */}
          {onOpenReturnModal && (
            <button
              onClick={onOpenReturnModal}
              className="btn-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                height: 32
              }}
              title="Khách trả lại hàng & Cấn trừ công nợ (INV-07)"
            >
              <RotateCcw size={13} color="var(--text-muted)" />
              <span>Trả Hàng</span>
            </button>
          )}

          {/* CA BÁN HÀNG */}
          {currentShift ? (
            <div 
              className="shift-status-pill"
              onClick={onOpenShiftModal}
              title={`Ca bán đang mở: ${currentShift.staff_name} • Bấm để chốt ca (F8)`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#059669',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                height: 30,
                boxSizing: 'border-box'
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentShift.staff_name || 'Ca Mở'}
              </span>
            </div>
          ) : (
            <div 
              className="shift-status-pill"
              onClick={onOpenShiftModal}
              title="Chi nhánh chưa mở ca. Bấm để mở ca bán hàng mới"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                height: 30,
                boxSizing: 'border-box'
              }}
            >
              <Clock size={12} />
              <span>Chưa Mở Ca</span>
            </div>
          )}

          {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ SÁNG / TỐI (ICON ONLY) */}
          <button
            type="button"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className="btn-action"
            style={{
              width: 32,
              height: 32,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
            title={theme === 'light' ? 'Chuyển sang chế độ Tối' : 'Chuyển sang chế độ Sáng'}
          >
            {theme === 'light' ? <Sun size={15} color="#d97706" /> : <Moon size={15} color="#38bdf8" />}
          </button>

          {/* USER PROFILE DROPDOWN (CHUẨN FB / SHOPEE / YOUTUBE) */}
          <div className="profile-menu-container" style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px 3px 4px',
                borderRadius: 20,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                height: 32
              }}
              title="Tài khoản & Thiết lập"
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700
              }}>
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : <User size={13} />}
              </div>
              <ChevronDown size={12} color="var(--text-muted)" />
            </button>

            {isProfileMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                width: 220,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                padding: '8px 6px',
                zIndex: 250,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                {/* Thông tin người dùng */}
                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                    {currentUser ? currentUser.full_name : 'Khách vãng lai'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {currentUser?.role || (isCashierOnly ? 'Vai trò: Thu Ngân' : 'Vai trò: Quản Trị Chuỗi')}
                  </div>
                </div>

                {/* Chuyển đổi vai trò */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isCashierOnly;
                    setIsCashierOnly(nextMode);
                    setIsProfileMenuOpen(false);
                    if (nextMode && activeTab !== 'pos' && activeTab !== 'cashbook' && activeTab !== 'debts') {
                      onTabChange('pos');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>Chế độ:</span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    background: isCashierOnly ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.12)',
                    color: isCashierOnly ? '#059669' : 'var(--primary)',
                    fontWeight: 700
                  }}>
                    {isCashierOnly ? '🛒 Thu Ngân' : '👑 Quản Lý'}
                  </span>
                </button>

                {/* Thêm Chi Nhánh Mới */}
                <button
                  type="button"
                  onClick={() => {
                    handleOpenCreateModal();
                    setIsProfileMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Plus size={14} color="var(--primary)" />
                  <span>+ Thêm Chi Nhánh Mới</span>
                </button>

                {/* Cài đặt App Desktop PWA nếu khả dụng */}
                {!isStandalone && installPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      handleInstallApp();
                      setIsProfileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <MonitorDown size={14} color="var(--primary)" />
                    <span>Cài đặt Desktop App</span>
                  </button>
                )}

                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

                {/* Đăng nhập / Đăng xuất */}
                {currentUser ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.logout();
                      setCurrentUser(null);
                      setIsProfileMenuOpen(false);
                      setIsLoginModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={14} />
                    <span>Đăng Xuất</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsLoginModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Key size={14} />
                    <span>Đăng Nhập</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MODAL ĐĂNG NHẬP HỆ THỐNG & PHÂN QUYỀN (A3) */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* MODAL TẠO CHI NHÁNH MỚI HOÀN TOÀN: CHỌN LĨNH VỰC & MA TRẬN LOGIC NO-CODE */}
      <CreateBranchModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        suggestedCode={`CN-${branches.length + 1 > 9 ? branches.length + 1 : '0' + (branches.length + 1)}`}
        suggestedName={`Chi Nhánh ${branches.length + 1}`}
        onSubmit={async (payload) => {
          const res = await api.createBranch(payload);
          if (!res.success) {
            throw new Error(res.message || 'Không thể tạo chi nhánh mới');
          }
          await branchStore.addBranchAndSwitch(res.data.id);
        }}
      />
    </>
  );
};
