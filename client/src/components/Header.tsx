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

  // Menu Dropdown cho Kho Vận và Quản Trị
  const [isWarehouseMenuOpen, setIsWarehouseMenuOpen] = useState<boolean>(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState<boolean>(false);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-dropdown-container')) {
        setIsWarehouseMenuOpen(false);
        setIsAdminMenuOpen(false);
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
        {/* 1. THƯƠNG HIỆU, BỘ CHỌN & NÚT TẠO CHI NHÁNH MỚI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div className="meb-brand" onClick={() => onTabChange('pos')}>
            <div className="meb-logo-badge">M</div>
            <div className="meb-brand-text">
              <h1>MEB POS</h1>
            </div>
          </div>

          {/* BỘ CHỌN CHI NHÁNH */}
          <div className="branch-select-box" style={{ maxWidth: 170 }}>
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
                <option key={b.id} value={b.id} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                  {b.code} • {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* NÚT TẠO CHI NHÁNH MỚI HOÀN TOÀN */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="btn-action"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
            title="Thêm chi nhánh mới độc lập vào chuỗi"
          >
            <Plus size={13} />
            <span>Chi Nhánh</span>
          </button>
        </div>

        {/* 2. THANH ĐIỀU HƯỚNG TÁCH BIỆT BENTO TABS */}
        <nav className="nav-tabs" style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <button 
            className={`nav-tab-btn ${activeTab === 'pos' ? 'active' : ''}`}
            onClick={() => { onTabChange('pos'); setIsWarehouseMenuOpen(false); setIsAdminMenuOpen(false); }}
          >
            <ShoppingCart size={14} />
            <span>Quầy Bán Hàng</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'cashbook' ? 'active' : ''}`}
            onClick={() => { onTabChange('cashbook'); setIsWarehouseMenuOpen(false); setIsAdminMenuOpen(false); }}
          >
            <Wallet size={14} />
            <span>Sổ Quỹ</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'debts' ? 'active' : ''}`}
            onClick={() => { onTabChange('debts'); setIsWarehouseMenuOpen(false); setIsAdminMenuOpen(false); }}
          >
            <BookOpen size={14} />
            <span>Công Nợ</span>
          </button>

          {!isCashierOnly && (
            <>
              {/* MENU KHO VẬN (Nhập hàng, Điều chuyển, Kiểm kê) */}
              <div className="nav-dropdown-container" style={{ position: 'relative' }}>
                <button 
                  type="button"
                  className={`nav-tab-btn ${['inbound', 'transfers', 'audit'].includes(activeTab) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setIsWarehouseMenuOpen(prev => !prev); setIsAdminMenuOpen(false); }}
                  style={{ gap: 3 }}
                  title="Nhập hàng, điều chuyển kho & kiểm kê"
                >
                  {activeTab === 'inbound' ? <PackagePlus size={14} /> : activeTab === 'transfers' ? <Truck size={14} /> : activeTab === 'audit' ? <ClipboardCheck size={14} /> : <Truck size={14} />}
                  <span>
                    {activeTab === 'inbound' ? 'Nhập Hàng' : activeTab === 'transfers' ? 'Điều Chuyển' : activeTab === 'audit' ? 'Kiểm Kê' : 'Kho Vận'}
                  </span>
                  <ChevronDown size={11} />
                </button>

                {isWarehouseMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: 'var(--dropdown-bg, var(--bg-card))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    boxShadow: 'var(--card-shadow)',
                    padding: 4,
                    minWidth: 135,
                    zIndex: 150,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'inbound' ? 'active' : ''}`}
                      onClick={() => { onTabChange('inbound'); setIsWarehouseMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 30 }}
                    >
                      <PackagePlus size={14} />
                      <span>Nhập Hàng</span>
                    </button>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
                      onClick={() => { onTabChange('transfers'); setIsWarehouseMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 30 }}
                    >
                      <Truck size={14} />
                      <span>Điều Chuyển</span>
                    </button>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                      onClick={() => { onTabChange('audit'); setIsWarehouseMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 30 }}
                    >
                      <ClipboardCheck size={14} />
                      <span>Kiểm Kê</span>
                    </button>
                  </div>
                )}
              </div>

              {/* MENU QUẢN TRỊ (Tổng bộ HQ, No-Code Studio) */}
              <div className="nav-dropdown-container" style={{ position: 'relative' }}>
                <button 
                  type="button"
                  className={`nav-tab-btn ${['hq', 'studio'].includes(activeTab) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setIsAdminMenuOpen(prev => !prev); setIsWarehouseMenuOpen(false); }}
                  style={{ gap: 3 }}
                  title="Tổng bộ chuỗi HQ & Cấu hình No-Code"
                >
                  {activeTab === 'hq' ? <Building2 size={14} /> : activeTab === 'studio' ? <SlidersHorizontal size={14} /> : <Building2 size={14} />}
                  <span>{activeTab === 'hq' ? 'Tổng Bộ' : activeTab === 'studio' ? 'No-Code' : 'Quản Trị'}</span>
                  <ChevronDown size={11} />
                </button>

                {isAdminMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: 'var(--dropdown-bg, var(--bg-card))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    boxShadow: 'var(--card-shadow)',
                    padding: 4,
                    minWidth: 140,
                    zIndex: 150,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'hq' ? 'active' : ''}`}
                      onClick={() => { onTabChange('hq'); setIsAdminMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 30 }}
                    >
                      <Building2 size={14} />
                      <span>Tổng Bộ HQ</span>
                    </button>
                    <button
                      type="button"
                      className={`nav-tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
                      onClick={() => { onTabChange('studio'); setIsAdminMenuOpen(false); }}
                      style={{ justifyContent: 'flex-start', width: '100%', height: 30 }}
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

        {/* 3. TRẠNG THÁI CA TRỰC, SWITCH VAI TRÒ & PWA DESKTOP APP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ SÁNG / TỐI */}
          <button
            type="button"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className="btn-action"
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              height: 28
            }}
            title={`Đang dùng: ${theme === 'light' ? 'Bán Hàng Sáng (Thương mại)' : 'Ca Đêm (Tối)'}. Bấm để chuyển đổi.`}
          >
            {theme === 'light' ? <Sun size={13} color="#f59e0b" /> : <Moon size={13} color="#38bdf8" />}
            <span>{theme === 'light' ? 'Sáng' : 'Tối'}</span>
          </button>

          {/* Nút chuyển đổi vai trò: Chủ Chuỗi vs Thu Ngân Bán Hàng */}
          <button
            type="button"
            onClick={() => {
              const nextMode = !isCashierOnly;
              setIsCashierOnly(nextMode);
              if (nextMode && activeTab !== 'pos' && activeTab !== 'cashbook' && activeTab !== 'debts') {
                onTabChange('pos');
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 6,
              background: isCashierOnly ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.12)',
              border: isCashierOnly ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(2, 132, 199, 0.3)',
              color: isCashierOnly ? '#059669' : '#0284c7',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              height: 28
            }}
            title="Chuyển chế độ: Chủ Chuỗi (Đầy đủ chức năng) vs Thu Ngân (Gọn gàng)"
          >
            {isCashierOnly ? <span>🛒 Thu Ngân</span> : <span>👑 Quản Lý</span>}
          </button>

          {/* Nút Đổi Trả Hàng RMA (INV-07) */}
          {onOpenReturnModal && (
            <button
              onClick={onOpenReturnModal}
              className="btn-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#d97706',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                height: 28
              }}
              title="Khách trả lại hàng & Cấn trừ công nợ (INV-07)"
            >
              <RotateCcw size={13} />
              <span>Trả Hàng</span>
            </button>
          )}

          {currentShift ? (
            <div 
              className="shift-status-pill shift-open"
              onClick={onOpenShiftModal}
              title={`Ca bán đang mở: ${currentShift.staff_name} • Bấm để chốt ca (F8)`}
              style={{ whiteSpace: 'nowrap', cursor: 'pointer', padding: '3px 8px', fontSize: 11, height: 28, boxSizing: 'border-box' }}
            >
              <Clock size={12} />
              <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentShift.staff_name || 'Ca Mở'}
              </span>
            </div>
          ) : (
            <div 
              className="shift-status-pill shift-closed"
              onClick={onOpenShiftModal}
              title="Chi nhánh chưa mở ca. Bấm để mở ca bán hàng mới"
              style={{ whiteSpace: 'nowrap', cursor: 'pointer', padding: '3px 8px', fontSize: 11, height: 28, boxSizing: 'border-box' }}
            >
              <Clock size={12} />
              <span>Chưa Mở Ca</span>
            </div>
          )}

          {/* Nút Cài đặt Desktop PWA hoặc Huy hiệu Desktop App */}
          {!isStandalone && installPrompt && (
            <button
              onClick={handleInstallApp}
              className="btn-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                height: 28
              }}
              title="Cài đặt thành ứng dụng máy tính Desktop"
            >
              <MonitorDown size={13} />
              <span>Cài App</span>
            </button>
          )}

          {/* BADGE TÀI KHOẢN NHÂN VIÊN & PHÂN QUYỀN (A3) */}
          {currentUser ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8',
                fontSize: 11,
                fontWeight: 600,
                height: 28,
                boxSizing: 'border-box'
              }}
            >
              <User size={12} />
              <span style={{ maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.full_name}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await api.logout();
                  setCurrentUser(null);
                  setIsLoginModalOpen(true);
                }}
                title="Đăng xuất tài khoản"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '1px 3px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <LogOut size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="btn-action"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                height: 28
              }}
            >
              <Key size={12} />
              <span>Đăng Nhập</span>
            </button>
          )}
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
