import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { 
  BranchRecord, 
  CustomEntityRecord, 
  UomConversionRecord, 
  InventoryLedgerRecord 
} from '../types';
import { uomEngine } from '../services/uomEngine';
import { 
  Barcode, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Printer, 
  PauseCircle, 
  PlayCircle, 
  ArrowLeft, 
  Sparkles,
  AlertTriangle,
  X,
  PackageCheck
} from 'lucide-react';

interface PosCartItem {
  id: string; // unique item line id
  entityCode: string;
  name: string;
  unitType: 'BASE' | 'SUB';
  unitName: string;
  price: number;
  quantity: number;
  baseUom: string;
  subUom: string;
  multiplier: number;
}

interface ParkedBill {
  id: string;
  code: string; // VD: Đơn treo #1
  createdAt: string;
  items: PosCartItem[];
  customerNote?: string;
  total: number;
}

interface ToastMessage {
  id: string;
  type: 'SUCCESS' | 'UNPACK' | 'ERROR' | 'INFO';
  title: string;
  description: string;
}

interface PosScreenProps {
  activeBranch: BranchRecord;
  entities: CustomEntityRecord[];
  conversions: UomConversionRecord[];
  inventory: InventoryLedgerRecord[];
  onBackToBento: () => void;
  onRefreshData: () => Promise<void>;
}

export const PosScreen: React.FC<PosScreenProps> = ({
  activeBranch,
  entities,
  conversions,
  inventory,
  onBackToBento,
  onRefreshData
}) => {
  // GIỎ HÀNG HIỆN TẠI
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedCartIdx, setSelectedCartIdx] = useState<number>(0);

  // ĐƠN TREO (PARK BILLS) LƯU CỤC BỘ TRONG LOCAL STORAGE
  const [parkedBills, setParkedBills] = useState<ParkedBill[]>(() => {
    try {
      const saved = localStorage.getItem(`meb_parked_${activeBranch.code}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // TÌM KIẾM & MÃ VẠCH
  const [searchQuery, setSearchQuery] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // THANH TOÁN
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QR' | 'DEBT'>('CASH');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // MODAL IN HÓA ĐƠN
  const [completedOrder, setCompletedOrder] = useState<{
    orderRef: string;
    items: PosCartItem[];
    total: number;
    cashGiven: number;
    change: number;
    paymentMethod: string;
    unpackedDetails: string[];
    timestamp: string;
  } | null>(null);

  // THÔNG BÁO KHÔNG CHẠM (NON-BLOCKING TOASTS)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'SUCCESS' | 'UNPACK' | 'ERROR' | 'INFO', title: string, description: string) => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 5);
    setToasts(prev => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // LƯU ĐƠN TREO VÀO LOCAL STORAGE MỖI KHI CẬP NHẬT
  useEffect(() => {
    try {
      localStorage.setItem(`meb_parked_${activeBranch.code}`, JSON.stringify(parkedBills));
    } catch (e) {
      console.error('Không thể lưu đơn treo:', e);
    }
  }, [parkedBills, activeBranch.code]);

  // LUÔN TỰ ĐỘNG KHÓA CON TRỎ (AUTO-FOCUS) VÀO Ô MÃ VẠCH
  const refocusBarcodeInput = useCallback(() => {
    setTimeout(() => {
      if (barcodeInputRef.current && document.activeElement !== barcodeInputRef.current) {
        // Chỉ focus nếu người dùng không đang nhập tiền khách đưa
        const isTypingMoney = document.activeElement?.getAttribute('id') === 'cash-given-input';
        if (!isTypingMoney) {
          barcodeInputRef.current.focus();
        }
      }
    }, 50);
  }, []);

  useEffect(() => {
    refocusBarcodeInput();
  }, [cart, refocusBarcodeInput]);

  // TÍNH TOÁN TỔNG TIỀN
  const orderTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const changeDue = Math.max(0, (cashGiven || 0) - orderTotal);

  // TÌM TỒN KHO THỰC TẾ THEO MÃ SẢN PHẨM & ĐƠN VỊ TÍNH
  const getStock = useCallback((entityCode: string, uom: string) => {
    const inv = inventory.find(i => i.branch_code === activeBranch.code && i.entity_code === entityCode && i.uom === uom);
    return inv ? inv.quantity : 0;
  }, [inventory, activeBranch.code]);

  // THÊM SẢN PHẨM VÀO GIỎ HÀNG
  const addItemToCart = useCallback((entity: CustomEntityRecord, unitType: 'BASE' | 'SUB') => {
    const conv = conversions.find(c => c.entity_code === entity.code);
    const multiplier = conv ? conv.multiplier : 1;
    const baseUom = entity.base_uom;
    const subUom = conv ? conv.to_uom : 'Bì';

    const unitName = unitType === 'BASE' ? baseUom : subUom;
    const price = unitType === 'BASE' ? (entity.price_base || 0) : (entity.price_sub || 0);

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.entityCode === entity.code && item.unitType === unitType);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          id: `${entity.code}-${unitType}-${Date.now()}`,
          entityCode: entity.code,
          name: entity.name,
          unitType,
          unitName,
          price,
          quantity: 1,
          baseUom,
          subUom,
          multiplier
        }
      ];
    });

    refocusBarcodeInput();
  }, [conversions, refocusBarcodeInput]);

  // XỬ LÝ QUÉT MÃ VẠCH SIÊU TỐC
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // 1. Kiểm tra nếu khớp Barcode Base (Nguyên thùng)
    const baseMatch = entities.find(ent => ent.barcode_base && ent.barcode_base.trim() === query);
    if (baseMatch) {
      addItemToCart(baseMatch, 'BASE');
      addToast('SUCCESS', 'Quét Mã Thùng Thành Công', `Đã thêm 1 ${baseMatch.base_uom} [${baseMatch.name}] (Giá sỉ)`);
      setSearchQuery('');
      return;
    }

    // 2. Kiểm tra nếu khớp Barcode Sub (Đơn vị lẻ)
    const subMatch = entities.find(ent => ent.barcode_sub && ent.barcode_sub.trim() === query);
    if (subMatch) {
      addItemToCart(subMatch, 'SUB');
      addToast('SUCCESS', 'Quét Mã Lẻ Thành Công', `Đã thêm 1 đơn vị lẻ [${subMatch.name}] (Giá lẻ)`);
      setSearchQuery('');
      return;
    }

    // 3. Nếu không phải barcode chính xác, thử tìm theo mã Code hoặc Tên viết tắt
    const textMatch = entities.find(ent => 
      ent.code.toLowerCase() === query.toLowerCase() || 
      ent.name.toLowerCase().includes(query.toLowerCase())
    );

    if (textMatch) {
      // Mặc định thêm đơn vị lẻ nếu quét/tìm kiếm thường
      addItemToCart(textMatch, 'SUB');
      addToast('INFO', 'Đã Thêm Sản Phẩm', `Đã thêm 1 ${textMatch.name}`);
      setSearchQuery('');
    } else {
      addToast('ERROR', 'Không Tìm Thấy Hàng', `Không tìm thấy sản phẩm nào khớp với mã [${query}]`);
      setSearchQuery('');
    }
  };

  // CẬP NHẬT SỐ LƯỢNG MÓN
  const updateQuantity = (idx: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      updated[idx].quantity = newQty;
      return updated;
    });
    refocusBarcodeInput();
  };

  // CHUYỂN ĐỔI ĐƠN VỊ THÙNG <-> BÌ (F3)
  const toggleUnitType = useCallback((idx: number) => {
    setCart(prev => {
      if (!prev[idx]) return prev;
      const updated = [...prev];
      const item = updated[idx];
      const entity = entities.find(e => e.code === item.entityCode);
      if (!entity) return prev;

      const newType = item.unitType === 'BASE' ? 'SUB' : 'BASE';
      const newUnitName = newType === 'BASE' ? item.baseUom : item.subUom;
      const newPrice = newType === 'BASE' ? (entity.price_base || 0) : (entity.price_sub || 0);

      updated[idx] = {
        ...item,
        unitType: newType,
        unitName: newUnitName,
        price: newPrice
      };
      return updated;
    });
    refocusBarcodeInput();
  }, [entities, refocusBarcodeInput]);

  // TREO HÓA ĐƠN (PARK BILL - F4)
  const handleParkBill = useCallback(() => {
    if (cart.length === 0) {
      addToast('INFO', 'Giỏ Hàng Đang Trống', 'Không có sản phẩm nào để treo hóa đơn.');
      return;
    }

    const newParked: ParkedBill = {
      id: Date.now().toString(),
      code: `Đơn Treo #${parkedBills.length + 1} (${orderTotal.toLocaleString('vi-VN')} đ)`,
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      items: cart,
      total: orderTotal
    };

    setParkedBills(prev => [newParked, ...prev]);
    setCart([]);
    setCashGiven(0);
    addToast('INFO', 'Đã Treo Hóa Đơn (F4)', `Đã lưu tạm đơn ${newParked.code}. Sẵn sàng thanh toán khách tiếp theo.`);
    refocusBarcodeInput();
  }, [cart, orderTotal, parkedBills.length, addToast, refocusBarcodeInput]);

  // MỞ LẠI HÓA ĐƠN TREO (RESUME BILL)
  const handleResumeBill = useCallback((bill: ParkedBill) => {
    if (cart.length > 0) {
      handleParkBill();
    }
    setCart(bill.items);
    setParkedBills(prev => prev.filter(b => b.id !== bill.id));
    addToast('SUCCESS', 'Khôi Phục Đơn Treo', `Đã mở lại giỏ hàng của ${bill.code}`);
    refocusBarcodeInput();
  }, [cart.length, handleParkBill, addToast, refocusBarcodeInput]);

  // HOÀN TẤT THANH TOÁN (F9 / SPACE) KÍCH HOẠT ENGINE RÃ THÙNG INV-04
  const handleCompleteCheckout = useCallback(async () => {
    if (cart.length === 0) {
      addToast('ERROR', 'Giỏ Hàng Rỗng', 'Vui lòng quét ít nhất một mặt hàng trước khi thanh toán.');
      return;
    }

    setIsProcessing(true);
    const orderRef = `HD-${Date.now().toString().slice(-6)}`;
    const unpackedNotes: string[] = [];

    try {
      // GỌI ENGINE INV-04 XỬ LÝ TUẦN TỰ CHO TỪNG DÒNG MÓN HÀNG
      for (const item of cart) {
        const result = await uomEngine.executeSaleDeduction(
          activeBranch.code,
          item.entityCode,
          item.unitType,
          item.quantity,
          'Thu Ngân POS',
          orderRef
        );

        if (result.unpackedBoxes > 0) {
          unpackedNotes.push(`Tự động rã ${result.unpackedBoxes} ${item.baseUom} -> ${result.unpackedBoxes * item.multiplier} ${item.subUom} [${item.name}]`);
          addToast(
            'UNPACK',
            '⚡ [INV-04] TỰ ĐỘNG RÃ THÙNG',
            `Đã rã ${result.unpackedBoxes} ${item.baseUom} thành công để xuất đủ ${item.quantity} ${item.unitName}!`
          );
        }
      }

      // ĐỒNG BỘ LẠI TỒN KHO TỪ POCKETBASE
      await onRefreshData();

      // MỞ MODAL HÓA ĐƠN HOÀN TẤT
      setCompletedOrder({
        orderRef,
        items: [...cart],
        total: orderTotal,
        cashGiven: cashGiven || orderTotal,
        change: changeDue,
        paymentMethod: paymentMethod === 'CASH' ? 'Tiền Mặt' : paymentMethod === 'QR' ? 'Chuyển Khoản QR' : 'Ghi Nợ',
        unpackedDetails: unpackedNotes,
        timestamp: new Date().toLocaleString('vi-VN')
      });

      addToast('SUCCESS', 'Thanh Toán Thành Công', `Đơn hàng #${orderRef} đã hoàn tất và trừ tồn kho chuẩn xác!`);
      setCart([]);
      setCashGiven(0);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addToast('ERROR', 'CHẶN ĐƠN HÀNG THẤT BẠI', errorMessage);
    } finally {
      setIsProcessing(false);
      refocusBarcodeInput();
    }
  }, [cart, activeBranch.code, orderTotal, cashGiven, changeDue, paymentMethod, onRefreshData, addToast, refocusBarcodeInput]);

  // REFS ĐỂ GẮN VÀO KEYBOARD LISTENER KHÔNG BỊ PHỤ THUỘC RERENDER
  const actionsRef = useRef({
    toggleUnitType,
    handleParkBill,
    handleCompleteCheckout,
    setPaymentMethod,
    setCompletedOrder,
    refocusBarcodeInput,
    cart,
    selectedCartIdx,
    isProcessing,
    completedOrder
  });

  useEffect(() => {
    actionsRef.current = {
      toggleUnitType,
      handleParkBill,
      handleCompleteCheckout,
      setPaymentMethod,
      setCompletedOrder,
      refocusBarcodeInput,
      cart,
      selectedCartIdx,
      isProcessing,
      completedOrder
    };
  }, [toggleUnitType, handleParkBill, handleCompleteCheckout, cart, selectedCartIdx, isProcessing, completedOrder, refocusBarcodeInput]);

  // HỆ THỐNG PHÍM TẮT TOÀN DIỆN (HOTKEY-DRIVEN)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { 
        toggleUnitType: toggleUnit, 
        handleParkBill: parkBill, 
        handleCompleteCheckout: checkout, 
        setPaymentMethod: setPayMethod,
        setCompletedOrder: setOrder,
        refocusBarcodeInput: refocus,
        cart: currentCart, 
        selectedCartIdx: currentIdx, 
        isProcessing: processing, 
        completedOrder: currentOrder 
      } = actionsRef.current;

      // F1: Khóa con trỏ vào ô tìm kiếm
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }
      // F3: Chuyển đổi Thùng <-> Bì cho món đang chọn
      else if (e.key === 'F3') {
        e.preventDefault();
        if (currentCart.length > 0) {
          toggleUnit(currentIdx);
        }
      }
      // F4: Treo hóa đơn hiện tại
      else if (e.key === 'F4') {
        e.preventDefault();
        parkBill();
      }
      // F8: Đổi phương thức thanh toán
      else if (e.key === 'F8') {
        e.preventDefault();
        setPayMethod(prev => (prev === 'CASH' ? 'QR' : prev === 'QR' ? 'DEBT' : 'CASH'));
      }
      // F9: Thanh toán nhanh
      else if (e.key === 'F9') {
        e.preventDefault();
        if (!processing && currentCart.length > 0) {
          checkout();
        }
      }
      // Phím Space (nếu không đang gõ text): Thanh toán nhanh
      else if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!processing && currentCart.length > 0) {
          checkout();
        }
      }
      // Esc: Hủy modal hóa đơn nếu đang mở
      else if (e.key === 'Escape') {
        if (currentOrder) {
          setOrder(null);
          refocus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // LỌC SẢN PHẨM TRÊN MÀN HÌNH
  const filteredEntities = entities.filter(ent => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return ent.name.toLowerCase().includes(q) || 
           ent.code.toLowerCase().includes(q) ||
           (ent.barcode_base && ent.barcode_base.includes(q)) ||
           (ent.barcode_sub && ent.barcode_sub.includes(q));
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 65px)', background: 'var(--color-background)', overflow: 'hidden' }}>
      
      {/* =====================================================================
          TOAST NOTIFICATIONS (THÔNG BÁO KHÔNG CHẠM - NON-BLOCKING)
          ===================================================================== */}
      <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380 }}>
        {toasts.map(toast => (
          <div 
            key={toast.id}
            style={{ 
              background: toast.type === 'UNPACK' ? '#ea580c' : toast.type === 'ERROR' ? '#ef4444' : toast.type === 'SUCCESS' ? '#10b981' : '#3b82f6',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              animation: 'slideIn 0.25s ease-out'
            }}
          >
            {toast.type === 'UNPACK' ? <Sparkles size={20} /> : toast.type === 'ERROR' ? <AlertTriangle size={20} /> : <PackageCheck size={20} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{toast.title}</div>
              <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.3 }}>{toast.description}</div>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* =====================================================================
          CỘT TRÁI: TÌM KIẾM, MÃ VẠCH & DANH MỤC SẢN PHẨM (62% WIDTH)
          ===================================================================== */}
      <div style={{ flex: 62, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', overflow: 'hidden' }}>
        
        {/* HEADER QUẦY THU NGÂN & THANH TÌM KIẾM MÃ VẠCH */}
        <div style={{ padding: '16px 20px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-secondary" onClick={onBackToBento} style={{ padding: '6px 12px', fontSize: 13 }}>
                <ArrowLeft size={16} /> Về Bento Grid
              </button>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🛒 POS BÁN HÀNG SIÊU TỐC - {activeBranch.name}
                </h1>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Hỗ trợ quét Barcode liên tục • Tự động rã thùng ngầm (INV-04)
                </span>
              </div>
            </div>

            {/* DANH SÁCH ĐƠN TREO (PARK BILL TABS) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <PauseCircle size={15} color="#ea580c" /> Đơn Treo:
              </span>
              {parkedBills.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Không có</span>
              ) : (
                parkedBills.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleResumeBill(b)}
                    style={{ 
                      padding: '4px 10px', 
                      borderRadius: 6, 
                      fontSize: 11, 
                      fontWeight: 700,
                      background: 'rgba(234, 88, 12, 0.15)', 
                      color: '#ea580c', 
                      border: '1px solid rgba(234, 88, 12, 0.3)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title={`Bấm để mở lại: ${b.code}`}
                  >
                    <PlayCircle size={12} /> {b.code}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Ô INPUT MÃ VẠCH AUTO-FOCUS (KHÓA MỤC TIÊU) */}
          <form onSubmit={handleBarcodeSubmit} style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 14, top: 12, color: 'var(--color-primary)' }}>
              <Barcode size={20} />
            </div>
            <input 
              ref={barcodeInputRef}
              type="text" 
              placeholder="[F1] Bấm phím hoặc dùng súng quét mã vạch (Tự động nhận diện Thùng vs Bì lẻ)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '12px 16px 12px 46px', 
                borderRadius: 10, 
                border: '2px solid var(--color-primary)', 
                background: 'var(--color-background)', 
                color: 'inherit',
                fontSize: 15,
                fontWeight: 600,
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)'
              }}
            />
            <div style={{ position: 'absolute', right: 12, top: 11, fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, background: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
              ENTER ĐỂ THÊM
            </div>
          </form>
        </div>

        {/* LƯỚI THẺ SẢN PHẨM & CẢNH BÁO TỒN KHO THỜI GIAN THỰC */}
        <div style={{ flex: 1, padding: 18, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filteredEntities.map(ent => {
              const conv = conversions.find(c => c.entity_code === ent.code);
              const multiplier = conv ? conv.multiplier : 1;
              const subUom = conv ? conv.to_uom : 'Bì';

              const baseStock = getStock(ent.code, ent.base_uom);
              const subStock = getStock(ent.code, subUom);
              const minSafe = ent.min_safe_stock || 5;

              // Xác định trạng thái cảnh báo màu sắc
              const isBaseLow = baseStock <= minSafe && baseStock > 0;
              const isBaseOut = baseStock === 0;

              return (
                <div 
                  key={ent.id}
                  style={{ 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: 12, 
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                        {ent.code}
                      </span>
                      {conv && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          1 {ent.base_uom} = {multiplier} {subUom}
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 10px 0', lineHeight: 1.3 }}>
                      {ent.name}
                    </h3>

                    {/* KHU VỰC HIỂN THỊ TỒN KHO 2 ĐƠN VỊ CÓ MÀU CẢNH BÁO */}
                    <div style={{ background: 'var(--color-background)', borderRadius: 8, padding: '8px 10px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Tồn {ent.base_uom}: </span>
                        <strong style={{ 
                          color: isBaseOut ? '#ef4444' : isBaseLow ? '#f59e0b' : '#10b981',
                          fontWeight: 700 
                        }}>
                          {baseStock} {isBaseOut ? '(Hết Thùng)' : isBaseLow ? '(Sắp Hết)' : ''}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Tồn {subUom}: </span>
                        <strong style={{ color: subStock === 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          {subStock}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 2 NÚT THAO TÁC: BÁN THÙNG (SỈ) & BÁN BÌ (LẺ) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button 
                      onClick={() => addItemToCart(ent, 'BASE')}
                      style={{ 
                        padding: '8px 6px', 
                        borderRadius: 8, 
                        border: '1px solid rgba(234, 88, 12, 0.3)', 
                        background: 'rgba(234, 88, 12, 0.08)',
                        color: '#ea580c',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700 }}>📦 1 {ent.base_uom} (Sỉ)</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {ent.price_base ? (ent.price_base / 1000).toLocaleString('vi-VN') + 'k' : '---'}
                      </div>
                    </button>

                    <button 
                      onClick={() => addItemToCart(ent, 'SUB')}
                      style={{ 
                        padding: '8px 6px', 
                        borderRadius: 8, 
                        border: '1px solid rgba(16, 185, 129, 0.3)', 
                        background: 'rgba(16, 185, 129, 0.08)',
                        color: '#10b981',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700 }}>🏷️ 1 {subUom} (Lẻ)</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {ent.price_sub ? (ent.price_sub / 1000).toLocaleString('vi-VN') + 'k' : '---'}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER THANH PHÍM TẮT TIÊU CHUẨN (HOTKEY BAR) */}
        <div style={{ padding: '10px 18px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)', overflowX: 'auto' }}>
          <span><kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-border)', fontWeight: 700 }}>F1</kbd> Tìm/Barcode</span>
          <span><kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-border)', fontWeight: 700 }}>F3</kbd> Đổi Thùng/Bì</span>
          <span><kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-border)', fontWeight: 700 }}>F4</kbd> Treo Đơn</span>
          <span><kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-border)', fontWeight: 700 }}>F8</kbd> Đổi PT Thanh Toán</span>
          <span><kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-border)', fontWeight: 700 }}>F9 / Space</kbd> Thanh Toán</span>
          <span><kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-border)', fontWeight: 700 }}>Esc</kbd> Đóng Hóa Đơn</span>
        </div>
      </div>

      {/* =====================================================================
          CỘT PHẢI: GIỎ HÀNG, SỐ TIỀN CHỮ LỚN & PHÍM THANH TOÁN (38% WIDTH)
          ===================================================================== */}
      <div style={{ flex: 38, display: 'flex', flexDirection: 'column', background: 'var(--color-surface)' }}>
        
        {/* TIÊU ĐỀ GIỎ HÀNG */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} color="var(--color-primary)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>HÓA ĐƠN BÁN HÀNG</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              {cart.length} món
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button 
              className="btn btn-ghost" 
              onClick={handleParkBill} 
              title="Treo đơn hiện tại (F4)"
              style={{ fontSize: 12, padding: '6px 10px', height: 'auto', color: '#ea580c' }}
            >
              <PauseCircle size={15} /> Treo Đơn (F4)
            </button>
            <button 
              className="icon-btn" 
              onClick={() => setCart([])} 
              title="Xóa toàn bộ giỏ hàng"
              style={{ color: '#ef4444' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* BẢNG CHI TIẾT CÁC MÓN TRONG GIỎ HÀNG */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              <ShoppingCart size={48} style={{ opacity: 0.25, marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>Giỏ hàng đang trống</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Dùng súng quét barcode hoặc bấm chọn sản phẩm bên trái</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cart.map((item, idx) => {
                const isSelected = selectedCartIdx === idx;
                const isBase = item.unitType === 'BASE';

                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedCartIdx(idx)}
                    style={{ 
                      padding: 12, 
                      borderRadius: 10, 
                      border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`, 
                      background: isSelected ? 'rgba(37, 99, 235, 0.04)' : 'var(--color-background)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                        
                        {/* BADGE PHÂN BIỆT RÀNH MẠCH ĐƠN VỊ THÙNG VS BÌ */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ 
                            fontSize: 11, 
                            fontWeight: 700, 
                            padding: '2px 8px', 
                            borderRadius: 4, 
                            background: isBase ? 'rgba(234, 88, 12, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isBase ? '#ea580c' : '#10b981'
                          }}>
                            {isBase ? `📦 THÙNG SỈ (${item.unitName})` : `🏷️ BÌ LẺ (${item.unitName})`}
                          </span>

                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleUnitType(idx); }}
                            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            title="Bấm hoặc gõ F3 để đổi đơn vị"
                          >
                            Đổi sang {isBase ? item.subUom : item.baseUom} (F3)
                          </button>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          {(item.price * item.quantity).toLocaleString('vi-VN')} đ
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {item.price.toLocaleString('vi-VN')} đ / {item.unitName}
                        </div>
                      </div>
                    </div>

                    {/* BỘ CHỌN SỐ LƯỢNG MÓN */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTop: '1px dashed var(--color-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQuantity(idx, -1); }}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQuantity(idx, 1); }}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); updateQuantity(idx, -item.quantity); }}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                      >
                        Xóa dòng
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* =====================================================================
            BẢNG TÍNH TIỀN CHỮ LỚN & PHÍM THANH TOÁN (LARGE DIGITS SUMMARY)
            ===================================================================== */}
        <div style={{ padding: '16px 20px', background: 'var(--color-background)', borderTop: '2px solid var(--color-border)' }}>
          
          {/* TỔNG CỘNG CHỮ LỚN TƯƠNG PHẢN CAO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-secondary)' }}>TỔNG CỘNG TIỀN:</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: -0.5 }}>
              {orderTotal.toLocaleString('vi-VN')} <span style={{ fontSize: 18 }}>đ</span>
            </span>
          </div>

          {/* CHỌN PHƯƠNG THỨC THANH TOÁN (F8) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <button 
              onClick={() => setPaymentMethod('CASH')}
              style={{ 
                padding: '8px 4px', 
                borderRadius: 8, 
                border: `2px solid ${paymentMethod === 'CASH' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: paymentMethod === 'CASH' ? 'rgba(37, 99, 235, 0.12)' : 'var(--color-surface)',
                color: paymentMethod === 'CASH' ? 'var(--color-primary)' : 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <Banknote size={15} /> Tiền Mặt (F8)
            </button>

            <button 
              onClick={() => setPaymentMethod('QR')}
              style={{ 
                padding: '8px 4px', 
                borderRadius: 8, 
                border: `2px solid ${paymentMethod === 'QR' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: paymentMethod === 'QR' ? 'rgba(37, 99, 235, 0.12)' : 'var(--color-surface)',
                color: paymentMethod === 'QR' ? 'var(--color-primary)' : 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <QrCode size={15} /> Chuyển Khoản
            </button>

            <button 
              onClick={() => setPaymentMethod('DEBT')}
              style={{ 
                padding: '8px 4px', 
                borderRadius: 8, 
                border: `2px solid ${paymentMethod === 'DEBT' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: paymentMethod === 'DEBT' ? 'rgba(37, 99, 235, 0.12)' : 'var(--color-surface)',
                color: paymentMethod === 'DEBT' ? 'var(--color-primary)' : 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <CreditCard size={15} /> Ghi Nợ
            </button>
          </div>

          {/* NHẬP TIỀN KHÁCH ĐƯA (CHỈ KHI TIỀN MẶT) */}
          {paymentMethod === 'CASH' && (
            <div style={{ marginBottom: 12, background: 'var(--color-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Tiền khách đưa:</span>
                <input 
                  id="cash-given-input"
                  type="number"
                  placeholder={orderTotal.toString()}
                  value={cashGiven || ''}
                  onChange={e => setCashGiven(Number(e.target.value))}
                  style={{ width: 140, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontWeight: 700, fontSize: 14, textAlign: 'right', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              {/* NÚT CHỌN NHANH TIỀN MẶT */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
                <button 
                  onClick={() => setCashGiven(orderTotal)} 
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-background)', cursor: 'pointer' }}
                >
                  Đủ tiền
                </button>
                <button 
                  onClick={() => setCashGiven(200000)} 
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-background)', cursor: 'pointer' }}
                >
                  200k
                </button>
                <button 
                  onClick={() => setCashGiven(500000)} 
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-background)', cursor: 'pointer' }}
                >
                  500k
                </button>
                <button 
                  onClick={() => setCashGiven(1000000)} 
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-background)', cursor: 'pointer' }}
                >
                  1.000k
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--color-border)', paddingTop: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Tiền thừa thối lại:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                  {changeDue.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          )}

          {/* NÚT HOÀN TẤT THANH TOÁN (F9 / SPACE) */}
          <button 
            disabled={cart.length === 0 || isProcessing}
            onClick={handleCompleteCheckout}
            style={{ 
              width: '100%', 
              padding: '16px', 
              borderRadius: 12, 
              background: cart.length === 0 ? 'var(--color-border)' : 'linear-gradient(135deg, #2563eb, #10b981)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: 18,
              cursor: cart.length === 0 || isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: cart.length > 0 ? '0 4px 16px rgba(37, 99, 235, 0.35)' : 'none'
            }}
          >
            {isProcessing ? (
              <>Đang kích hoạt Engine INV-04...</>
            ) : (
              <>
                <Printer size={22} />
                <span>THANH TOÁN & IN PHIẾU (F9 / SPACE)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =====================================================================
          MODAL: IN HÓA ĐƠN HOÀN TẤT (K80 RECEIPT MODAL)
          ===================================================================== */}
      {completedOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}>
          <div style={{ background: '#fff', color: '#111', width: '100%', maxWidth: 420, borderRadius: 12, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
            
            {/* TIÊU ĐỀ PHIẾU K80 */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #666', paddingBottom: 12, marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>MEB SAAS PLATFORM</h2>
              <div style={{ fontSize: 13, fontWeight: 700, margin: '4px 0' }}>{activeBranch.name}</div>
              <div style={{ fontSize: 11, color: '#555' }}>Đ/C: {activeBranch.address || 'Kho hàng trung tâm'}</div>
              <div style={{ fontSize: 11, color: '#555' }}>SĐT: {activeBranch.phone || '0901234567'}</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>HÓA ĐƠN BÁN HÀNG #{completedOrder.orderRef}</div>
              <div style={{ fontSize: 11, color: '#666' }}>{completedOrder.timestamp}</div>
            </div>

            {/* DANH SÁCH MÓN */}
            <div style={{ borderBottom: '1px dashed #666', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                <span>MẶT HÀNG</span>
                <span style={{ textAlign: 'center' }}>SL</span>
                <span style={{ textAlign: 'right' }}>THÀNH TIỀN</span>
              </div>
              {completedOrder.items.map(it => (
                <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: 12, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>({it.unitName})</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>{it.quantity}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700 }}>
                    {(it.price * it.quantity).toLocaleString('vi-VN')}
                  </div>
                </div>
              ))}
            </div>

            {/* BẢNG TỔNG TIỀN */}
            <div style={{ borderBottom: '1px dashed #666', paddingBottom: 10, marginBottom: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                <span>TỔNG TIỀN:</span>
                <span>{completedOrder.total.toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                <span>Phương thức:</span>
                <span>{completedOrder.paymentMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                <span>Tiền khách đưa:</span>
                <span>{completedOrder.cashGiven.toLocaleString('vi-VN')} đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Tiền thừa thối:</span>
                <span>{completedOrder.change.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            {/* THÔNG BÁO RÃ THÙNG INV-04 */}
            {completedOrder.unpackedDetails.length > 0 && (
              <div style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 10, color: '#ea580c' }}>
                <strong>⚡ THAO TÁC RÃ THÙNG TỰ ĐỘNG (INV-04):</strong>
                {completedOrder.unpackedDetails.map((d, i) => (
                  <div key={i}>• {d}</div>
                ))}
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 14 }}>
              Cảm ơn quý khách và hẹn gặp lại!
            </div>

            {/* NÚT THAO TÁC IN */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={() => window.print()}
                style={{ flex: 1, padding: 10, borderRadius: 6, background: '#111', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Printer size={16} /> In Ra Máy In K80
              </button>
              <button 
                onClick={() => setCompletedOrder(null)}
                style={{ padding: '10px 16px', borderRadius: 6, background: '#e5e7eb', color: '#111', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
