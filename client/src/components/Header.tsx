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
  Monitor,
  Plus,
  PackagePlus,
  ClipboardCheck,
  RotateCcw,
  Wallet,
  User,
  Key,
  LogOut
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div className="meb-brand" onClick={() => onTabChange('pos')}>
            <div className="meb-logo-badge">M</div>
            <div className="meb-brand-text">
              <h1>MEB PLATFORM</h1>
              <p>Smart Multi-Branch POS</p>
            </div>
          </div>

          {/* BỘ CHỌN CHI NHÁNH */}
          <div className="branch-select-box" style={{ maxWidth: 240 }}>
            <Building2 size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
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
                fontSize: 13,
                fontWeight: 600,
                maxWidth: 200,
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
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
            title="Thêm chi nhánh mới độc lập vào chuỗi"
          >
            <Plus size={14} />
            <span>+ Chi Nhánh</span>
          </button>
        </div>

        {/* 2. THANH ĐIỀU HƯỚNG TÁCH BIỆT BENTO TABS */}
        <nav className="nav-tabs" style={{ flexShrink: 0, display: 'flex', gap: 4, overflowX: 'auto' }}>
          {!isCashierOnly && (
            <button 
              className={`nav-tab-btn ${activeTab === 'hq' ? 'active' : ''}`}
              onClick={() => onTabChange('hq')}
              style={{
                background: activeTab === 'hq' ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(29, 78, 216, 0.3) 100%)' : undefined,
                borderColor: activeTab === 'hq' ? 'rgba(59, 130, 246, 0.5)' : undefined,
                color: activeTab === 'hq' ? '#38bdf8' : undefined
              }}
            >
              <Building2 size={15} />
              <span>🏢 Tổng Bộ Chuỗi</span>
            </button>
          )}

          <button 
            className={`nav-tab-btn ${activeTab === 'pos' ? 'active' : ''}`}
            onClick={() => onTabChange('pos')}
          >
            <ShoppingCart size={15} />
            <span>Quầy Bán Hàng</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'cashbook' ? 'active' : ''}`}
            onClick={() => onTabChange('cashbook')}
          >
            <Wallet size={15} />
            <span>Sổ Quỹ Tiền Mặt</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'debts' ? 'active' : ''}`}
            onClick={() => onTabChange('debts')}
          >
            <BookOpen size={15} />
            <span>Sổ Nợ Khách Hàng</span>
          </button>

          {!isCashierOnly && (
            <>
              <button 
                className={`nav-tab-btn ${activeTab === 'inbound' ? 'active' : ''}`}
                onClick={() => onTabChange('inbound')}
              >
                <PackagePlus size={15} />
                <span>Nhập Hàng NCC</span>
              </button>

              <button 
                className={`nav-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
                onClick={() => onTabChange('transfers')}
              >
                <Truck size={15} />
                <span>Điều Chuyển Kho</span>
              </button>

              <button 
                className={`nav-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => onTabChange('audit')}
              >
                <ClipboardCheck size={15} />
                <span>Kiểm Kê Kho</span>
              </button>

              <button 
                className={`nav-tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
                onClick={() => onTabChange('studio')}
              >
                <SlidersHorizontal size={15} />
                <span>No-Code Studio</span>
              </button>
            </>
          )}
        </nav>

        {/* 3. TRẠNG THÁI CA TRỰC, SWITCH VAI TRÒ & PWA DESKTOP APP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: isCashierOnly ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.12)',
              border: isCashierOnly ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(56, 189, 248, 0.3)',
              color: isCashierOnly ? '#34d399' : '#38bdf8',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Bấm để chuyển nhanh giữa Chế độ Chủ Chuỗi (Tất cả tab) và Chế độ Thu Ngân Bán Hàng"
          >
            {isCashierOnly ? (
              <>
                <span>🛒 Chế Độ Thu Ngân</span>
                <span style={{ fontSize: 9, background: '#059669', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>
                  FOCUS
                </span>
              </>
            ) : (
              <>
                <span>👑 Chế Độ Chủ Chuỗi</span>
                <span style={{ fontSize: 9, background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>
                  HQ
                </span>
              </>
            )}
          </button>
          {/* Nút Cài đặt Desktop PWA hoặc Huy hiệu Desktop App */}
          {isStandalone ? (
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 8,
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                color: '#34d399',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
              title="Đang chạy ở chế độ Desktop App độc lập"
            >
              <Monitor size={14} />
              <span>Desktop App</span>
            </div>
          ) : installPrompt ? (
            <button
              onClick={handleInstallApp}
              className="btn-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(134, 59, 255, 0.2) 100%)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Cài đặt thành ứng dụng máy tính Desktop độc lập"
            >
              <MonitorDown size={14} />
              <span>Cài App</span>
            </button>
          ) : null}

          {/* Nút Đổi Trả Hàng RMA (INV-07) */}
          {onOpenReturnModal && (
            <button
              onClick={onOpenReturnModal}
              className="btn-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 8,
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fbbf24',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Khách trả lại hàng & Cấn trừ công nợ (INV-07)"
            >
              <RotateCcw size={14} />
              <span>Trả Hàng (RMA)</span>
            </button>
          )}

          {currentShift ? (
            <div 
              className="shift-status-pill shift-open"
              onClick={onOpenShiftModal}
              title="Bấm để xem tóm tắt hoặc Chốt ca (F8)"
              style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              <Clock size={14} />
              <span>
                {currentShift.staff_name} • {Number(currentShift.initial_amount).toLocaleString('vi-VN')}đ
              </span>
            </div>
          ) : (
            <div 
              className="shift-status-pill shift-closed"
              onClick={onOpenShiftModal}
              title="Chi nhánh chưa mở ca. Bấm để mở ca bán hàng mới"
              style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              <Clock size={14} />
              <span>Chưa Mở Ca</span>
            </div>
          )}

          {/* BADGE TÀI KHOẢN NHÂN VIÊN & PHÂN QUYỀN (A3) */}
          {currentUser ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <User size={13} />
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  padding: '2px 4px',
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
                gap: 5,
                padding: '5px 10px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Key size={13} />
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
