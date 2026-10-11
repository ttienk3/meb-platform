import { useState, useEffect, useCallback } from 'react';
import { Header, type NavTab } from './components/Header';
import { branchStore } from './services/branchContext';
import { api, type RuntimeConfig, type Branch, type ShiftInfo, type ProductInventory } from './services/api';
import { ShoppingCart, CheckCircle2 } from 'lucide-react';
import { ProductCatalog } from './components/pos/ProductCatalog';
import { CartPanel, type CartItem, type OrderDraft } from './components/pos/CartPanel';
import { ShiftModal } from './components/pos/ShiftModal';
import { CustomerDebtTab } from './components/debts/CustomerDebtTab';
import { StockTransferTab } from './components/transfers/StockTransferTab';
import { StudioTab } from './components/studio/StudioTab';
import { PurchaseInboundTab } from './components/inbound/PurchaseInboundTab';
import { ReturnModal } from './components/pos/ReturnModal';
import { StockAuditTab } from './components/audit/StockAuditTab';
import { PrintInvoiceModal, type InvoiceData } from './components/pos/PrintInvoiceModal';
import { HQDashboardTab } from './components/hq/HQDashboardTab';
import { CashbookTab } from './components/cashbook/CashbookTab';
import { PosHelpModal } from './components/pos/PosHelpModal';
import { CustomerDisplayView } from './components/pos/CustomerDisplayView';

export function App() {
  const isCustomerDisplay = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'customer-display';

  if (isCustomerDisplay) {
    return <CustomerDisplayView />;
  }

  return <MainApp />;
}

function MainApp() {
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab') as NavTab;
      if (p) return p;
    }
    return 'pos';
  });

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentConfig, setCurrentConfig] = useState<RuntimeConfig | null>(null);
  const [currentShift, setCurrentShift] = useState<ShiftInfo | null>(null);
  
  // Quản lý đa giỏ hàng tại quầy (Multi-Tab Draft Orders)
  const [drafts, setDrafts] = useState<OrderDraft[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('meb_pos_order_drafts');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.error('Lỗi đọc draft orders:', e);
      }
    }
    return [{ id: 'order-1', name: 'Đơn 1', items: [], selectedPartnerId: null, note: '' }];
  });

  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('meb_pos_active_draft_id');
      if (savedId) return savedId;
    }
    return 'order-1';
  });

  useEffect(() => {
    try {
      localStorage.setItem('meb_pos_order_drafts', JSON.stringify(drafts));
      localStorage.setItem('meb_pos_active_draft_id', activeDraftId);
    } catch (e) {
      console.error('Lỗi lưu draft orders:', e);
    }
  }, [drafts, activeDraftId]);

  const activeDraft = drafts.find(d => d.id === activeDraftId) || drafts[0] || {
    id: 'order-1',
    name: 'Đơn 1',
    items: [],
    selectedPartnerId: null,
    note: ''
  };

  const handleSelectDraft = (draftId: string) => {
    setActiveDraftId(draftId);
  };

  const handleAddDraft = useCallback(() => {
    if (drafts.length >= 5) {
      alert('Tối đa 5 đơn chờ cùng lúc tại quầy để tránh nhầm lẫn.');
      return;
    }
    const newId = `order-${Date.now()}`;
    const newName = `Đơn ${drafts.length + 1}`;
    const newDraft: OrderDraft = {
      id: newId,
      name: newName,
      items: [],
      selectedPartnerId: null,
      note: ''
    };
    setDrafts(prev => [...prev, newDraft]);
    setActiveDraftId(newId);
  }, [drafts.length]);

  const handleCloseDraft = (draftId: string) => {
    if (drafts.length <= 1) {
      setDrafts([{ id: 'order-1', name: 'Đơn 1', items: [], selectedPartnerId: null, note: '' }]);
      setActiveDraftId('order-1');
      return;
    }
    const nextDrafts = drafts.filter(d => d.id !== draftId);
    setDrafts(nextDrafts);
    if (activeDraftId === draftId) {
      setActiveDraftId(nextDrafts[0].id);
    }
  };

  const handleUpdateActiveDraftItems = (updater: (prevItems: CartItem[]) => CartItem[]) => {
    setDrafts(prev => prev.map(d => {
      if (d.id === activeDraft.id) {
        return { ...d, items: updater(d.items) };
      }
      return d;
    }));
  };

  const handleSetPartnerIdForActiveDraft = (partnerId: string | null) => {
    setDrafts(prev => prev.map(d => {
      if (d.id === activeDraft.id) {
        return { ...d, selectedPartnerId: partnerId };
      }
      return d;
    }));
  };

  const [successOrder, setSuccessOrder] = useState<any | null>(null);
  const [printInvoiceData, setPrintInvoiceData] = useState<InvoiceData | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  useEffect(() => {
    const unsub = branchStore.subscribe((config, branch) => {
      setCurrentConfig(config);
      setCurrentBranch(branch);
      api.getCurrentShift().then(res => setCurrentShift(res.data)).catch(() => setCurrentShift(null));
    });

    branchStore.initialize().then(res => {
      if (res?.branch && res?.config) {
        setCurrentBranch(res.branch);
        setCurrentConfig(res.config);
        api.getCurrentShift().then(sRes => setCurrentShift(sRes.data)).catch(() => setCurrentShift(null));
      }
    }).catch(err => console.error('App branchStore init error:', err));

    return unsub;
  }, []);

  // Lắng nghe bộ phím tắt quầy thu ngân bán lẻ F1 - F10 & ESC toàn cục
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Mở trợ giúp phím tắt
      if (e.key === 'F1') {
        e.preventDefault();
        setIsHelpModalOpen(prev => !prev);
      }
      // F2: Focus ô tìm kiếm & quét Barcode
      else if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('pos-search-input') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
      // F3: Mở sổ công nợ khách hàng
      else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('debts');
      }
      // F4: Thêm giỏ hàng đơn mới
      else if (e.key === 'F4') {
        e.preventDefault();
        handleAddDraft();
      }
      // F6: Chuyển đổi qua lại giữa các đơn chờ
      else if (e.key === 'F6') {
        e.preventDefault();
        if (drafts.length > 1) {
          const currentIndex = drafts.findIndex(d => d.id === activeDraftId);
          const nextIndex = (currentIndex + 1) % drafts.length;
          setActiveDraftId(drafts[nextIndex].id);
        }
      }
      // F8: Quản lý ca / Chốt két tiền F8
      else if (e.key === 'F8') {
        e.preventDefault();
        setIsShiftModalOpen(prev => !prev);
      }
      // F9: Thanh toán đơn hàng
      else if (e.key === 'F9') {
        e.preventDefault();
        const checkoutBtn = document.getElementById('pos-checkout-btn') as HTMLButtonElement | null;
        if (checkoutBtn && !checkoutBtn.disabled) {
          checkoutBtn.click();
        }
      }
      // F10: Đổi trả hàng RMA
      else if (e.key === 'F10') {
        e.preventDefault();
        setIsReturnModalOpen(prev => !prev);
      }
      // Escape: Đóng modal
      else if (e.key === 'Escape') {
        setIsHelpModalOpen(false);
        setIsShiftModalOpen(false);
        setIsReturnModalOpen(false);
        setIsPrintModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drafts, activeDraftId, handleAddDraft]);

  // Thêm sản phẩm vào giỏ hàng của draft hiện tại
  const handleAddToCart = (product: ProductInventory) => {
    setSuccessOrder(null);
    handleUpdateActiveDraftItems(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          code: product.code,
          name: product.name,
          uom: product.base_uom,
          conversion_rate: 1,
          available_qty: Number(product.available_qty || 0),
          quantity: 1,
          unit_price: Number(product.default_selling_price || 0),
          image_url: product.image_url
        }
      ];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    handleUpdateActiveDraftItems(prev =>
      prev
        .map(it => it.product_id === productId ? { ...it, quantity: it.quantity + delta } : it)
        .filter(it => it.quantity > 0)
    );
  };

  const handleSetQty = (productId: string, qty: number) => {
    handleUpdateActiveDraftItems(prev =>
      prev.map(it => it.product_id === productId ? { ...it, quantity: Math.max(1, qty) } : it)
    );
  };

  const handleRemoveItem = (productId: string) => {
    handleUpdateActiveDraftItems(prev => prev.filter(it => it.product_id !== productId));
  };

  const handleUpdatePrice = (productId: string, newPrice: number) => {
    handleUpdateActiveDraftItems(prev =>
      prev.map(it => it.product_id === productId ? { ...it, unit_price: Math.max(0, newPrice) } : it)
    );
  };

  const handleClearCart = () => {
    handleUpdateActiveDraftItems(() => []);
    handleSetPartnerIdForActiveDraft(null);
  };

  const handleCheckoutSuccess = (orderResult: any) => {
    setSuccessOrder(orderResult);
    
    // Chuẩn bị dữ liệu hóa đơn để mở modal in K80
    const rawItems = orderResult?.items || activeDraft.items;
    const inv: InvoiceData = {
      order_id: orderResult?.order_id || orderResult?.id,
      order_code: orderResult?.order_code || `HD-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString(),
      staff_name: currentShift?.staff_name || 'Thu Ngân Quầy',
      customer: orderResult?.customer || null,
      items: rawItems.map((it: any) => ({
        name: it.name || it.product_name || 'Sản phẩm',
        uom: it.uom || 'Đơn vị',
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0)
      })),
      total_amount: Number(orderResult?.total_amount) || rawItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 1) * (Number(i.unit_price) || 0), 0),
      discount_amount: Number(orderResult?.discount_amount) || 0,
      paid_amount: Number(orderResult?.paid_amount) || 0,
      debt_amount: Number(orderResult?.debt_amount) || 0,
      payment_method: orderResult?.payments?.[0]?.payment_method || 'CASH'
    };
    setPrintInvoiceData(inv);
    setIsPrintModalOpen(true);

    // Xử lý đóng hoặc reset tab đơn hàng hiện tại
    if (drafts.length > 1) {
      handleCloseDraft(activeDraft.id);
    } else {
      handleClearCart();
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* 1. THANH HEADER ĐIỀU HƯỚNG & ĐỔI CHI NHÁNH */}
      <Header 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onOpenReturnModal={() => setIsReturnModalOpen(true)}
      />

      {/* 2. KHU VỰC THÂN GIAO DIỆN CHÍNH */}
      <main style={{ 
        flex: 1, 
        minHeight: 0, 
        overflow: activeTab === 'pos' ? 'hidden' : 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: activeTab === 'pos' ? '8px 12px' : '14px 20px', 
        maxWidth: 1680, 
        width: '100%', 
        margin: '0 auto', 
        boxSizing: 'border-box' 
      }}>
        {/* Banner Thông Báo Đơn Hàng Thành Công */}
        {successOrder && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 16px',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} color="#34d399" />
              <div>
                <span style={{ fontWeight: 700, color: '#34d399' }}>Thanh toán thành công! </span>
                <span style={{ color: 'var(--text-main)', fontSize: 13 }}>
                  Mã hóa đơn: <strong style={{ color: '#38bdf8' }}>{successOrder.order_code}</strong> • 
                  Tổng tiền: <strong style={{ color: '#f8fafc' }}>{Number(successOrder.total_amount).toLocaleString('vi-VN')}đ</strong>
                  {Number(successOrder.debt_amount) > 0 && ` • Ghi nợ: ${Number(successOrder.debt_amount).toLocaleString('vi-VN')}đ`}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setSuccessOrder(null)} 
              className="btn-action" 
              style={{ fontSize: 11, padding: '3px 10px' }}
            >
              Đóng
            </button>
          </div>
        )}

        {/* 3. NỘI DUNG TỪNG TAB */}
        {activeTab === 'hq' && (
          <HQDashboardTab 
            onSwitchBranchToPos={(_branchId) => {
              setActiveTab('pos');
            }}
            onOpenCreateBranchModal={() => {
              const btn = document.querySelector('header button[title*="Thêm chi nhánh"]') as HTMLButtonElement;
              if (btn) btn.click();
            }}
          />
        )}

        {activeTab === 'pos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: 14, height: '100%', minHeight: 0 }}>
            {/* Cột Trái: Danh Mục Hàng Hóa & Quét Barcode */}
            <div className="glass-panel" style={{ padding: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <ShoppingCart size={18} color="var(--primary)" />
                  Danh Mục Hàng Hóa & Tồn Kho Chi Nhánh
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Phím tắt: [F2] Tìm kiếm • [Enter] Chọn món
                </span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <ProductCatalog 
                  barcodeEnabled={currentConfig?.features.pos_barcode ?? true}
                  onSelectProduct={handleAddToCart}
                />
              </div>
            </div>

            {/* Cột Phải: Giỏ Hàng Đa Đơn Vị Tính, Sổ Nợ Khách Hàng & Nút Thanh Toán F9 */}
            <div className="glass-panel" style={{ padding: '10px 12px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <CartPanel 
                items={activeDraft.items}
                onUpdateQty={handleUpdateQty}
                onSetQty={handleSetQty}
                onUpdatePrice={handleUpdatePrice}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
                onCheckoutSuccess={handleCheckoutSuccess}
                currentConfig={currentConfig}
                currentShift={currentShift}
                drafts={drafts}
                activeDraftId={activeDraft.id}
                onSelectDraft={handleSelectDraft}
                onAddDraft={handleAddDraft}
                onCloseDraft={handleCloseDraft}
                selectedPartnerId={activeDraft.selectedPartnerId || ''}
                onSelectPartner={handleSetPartnerIdForActiveDraft}
              />
            </div>
          </div>
        )}

        {activeTab === 'inbound' && (
          <PurchaseInboundTab />
        )}

        {activeTab === 'transfers' && (
          <StockTransferTab currentBranch={currentBranch} />
        )}

        {activeTab === 'debts' && (
          <CustomerDebtTab currentShift={currentShift} />
        )}

        {activeTab === 'cashbook' && (
          <CashbookTab 
            currentShift={currentShift}
            onRefreshShift={async () => {
              try {
                const res = await api.getCurrentShift();
                setCurrentShift(res.data);
              } catch {}
            }}
          />
        )}

        {activeTab === 'audit' && (
          <StockAuditTab />
        )}

        {activeTab === 'studio' && (
          <StudioTab 
            currentBranch={currentBranch}
            onConfigUpdated={async () => {
              try {
                const cfg = await api.getRuntimeConfig();
                if (cfg.success) setCurrentConfig(cfg.data);
              } catch (e) {
                console.error('Failed to reload runtime config', e);
              }
            }}
          />
        )}
      </main>

      {/* 3. MODAL QUẢN LÝ CA BÁN HÀNG & CHỐT KÉT F8 */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        currentShift={currentShift}
        onShiftUpdated={(updatedShift) => setCurrentShift(updatedShift)}
      />

      {/* 4. MODAL ĐỔI TRẢ HÀNG & CẤN TRỪ NỢ INV-07 */}
      <ReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSuccess={(orderRes) => setSuccessOrder(orderRes)}
      />

      {/* 5. MODAL IN HÓA ĐƠN K80 / A4 CHO GIAO DỊCH */}
      <PrintInvoiceModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        invoice={printInvoiceData}
        currentBranch={currentBranch}
      />

      {/* 6. MODAL TRỢ GIÚP PHÍM TẮT QUẦY THU NGÂN F1 */}
      <PosHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* 7. THANH PHÍM TẮT TRỰC QUAN CHÂN MÀN HÌNH (POS HOTKEYS FOOTER) */}
      {/* 7. THANH PHÍM TẮT TRỰC QUAN CHÂN MÀN HÌNH (POS HOTKEYS FOOTER) */}
      {activeTab === 'pos' && (
        <footer style={{
          height: 36,
          flexShrink: 0,
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          fontSize: 12,
          color: 'var(--text-muted)',
          boxSizing: 'border-box'
        }}>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setIsHelpModalOpen(true)}>
            <kbd style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 700, fontSize: 11 }}>F1</kbd>Trợ giúp
          </span>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => document.getElementById('pos-search-input')?.focus()}>
            <kbd style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 700, fontSize: 11 }}>F2</kbd>Tìm món
          </span>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setActiveTab('debts')}>
            <kbd style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 700, fontSize: 11 }}>F3</kbd>Sổ nợ
          </span>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={handleAddDraft}>
            <kbd style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 700, fontSize: 11 }}>F4</kbd>Thêm đơn
          </span>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <kbd style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 700, fontSize: 11 }}>F6</kbd>Đổi đơn
          </span>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setIsShiftModalOpen(true)}>
            <kbd style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 700, fontSize: 11 }}>F8</kbd>Ca bán
          </span>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: '#059669', fontWeight: 700 }} onClick={() => document.getElementById('pos-checkout-btn')?.click()}>
            <kbd style={{ background: '#10b981', color: '#fff', border: 'none', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 800, fontSize: 11 }}>F9</kbd>Thanh toán
          </span>
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setIsReturnModalOpen(true)}>
            <kbd style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '2px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 700, fontSize: 11 }}>F10</kbd>Trả hàng
          </span>
        </footer>
      )}
    </div>
  );
}

export default App;
