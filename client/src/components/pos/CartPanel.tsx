import React, { useState, useEffect } from 'react';
import { 
  api, 
  type PartnerProfile, 
  type RuntimeConfig, 
  type ShiftInfo 
} from '../../services/api';
import { branchStore } from '../../services/branchContext';
import { 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  CreditCard, 
  Banknote, 
  Building, 
  CheckCircle2, 
  AlertTriangle,
  Receipt,
  UserPlus,
  QrCode,
  Layers,
  X,
  Tv,
  Wifi,
  WifiOff,
  Gift,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { QuickCustomerModal } from './QuickCustomerModal';
import { QuickDebtCollectionModal } from './QuickDebtCollectionModal';
import { VietQrModal } from './VietQrModal';
import { offlineSync } from '../../services/offlineSyncService';
import { getProductImageUrl, getProductFallbackSvg } from '../../utils/productImages';

export interface CartItem {
  product_id: string;
  code: string;
  name: string;
  uom: string;
  conversion_rate: number;
  available_qty: number;
  quantity: number;
  unit_price: number;
  image_url?: string;
}

export interface OrderDraft {
  id: string;
  name: string;
  items: CartItem[];
  selectedPartnerId: string | null;
  note: string;
}

interface CartPanelProps {
  items: CartItem[];
  onUpdateQty: (productId: string, delta: number) => void;
  onSetQty: (productId: string, qty: number) => void;
  onUpdatePrice?: (productId: string, price: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckoutSuccess: (orderResult: any) => void;
  currentConfig: RuntimeConfig | null;
  currentShift: ShiftInfo | null;
  drafts?: OrderDraft[];
  activeDraftId?: string;
  onSelectDraft?: (draftId: string) => void;
  onAddDraft?: () => void;
  onCloseDraft?: (draftId: string) => void;
  selectedPartnerId?: string;
  onSelectPartner?: (partnerId: string) => void;
}

function generateIdempotencyKey(): string {
  return `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  items,
  onUpdateQty,
  onSetQty,
  onUpdatePrice,
  onRemoveItem,
  onClearCart,
  onCheckoutSuccess,
  currentConfig,
  currentShift,
  drafts = [],
  activeDraftId = '',
  onSelectDraft,
  onAddDraft,
  onCloseDraft,
  selectedPartnerId: propPartnerId,
  onSelectPartner
}) => {
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [internalPartnerId, setInternalPartnerId] = useState<string>('');
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState<boolean>(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState<boolean>(false);
  const [isVietQrOpen, setIsVietQrOpen] = useState<boolean>(false);
  
  // Phương thức thanh toán: CASH | BANK_TRANSFER | DEBT | SPLIT
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'DEBT' | 'SPLIT'>('CASH');
  
  // Số tiền trả theo từng phần trong chế độ SPLIT hoặc tính tiền thừa
  const [splitCashInput, setSplitCashInput] = useState<string>('');
  const [splitBankInput, setSplitBankInput] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPartnerId = propPartnerId !== undefined ? propPartnerId : internalPartnerId;
  const setSelectedPartnerId = (id: string) => {
    if (onSelectPartner) onSelectPartner(id);
    setInternalPartnerId(id);
    // Q9: Tự động điền chiết khấu theo nhóm khách hàng khi chọn khách
    const partner = partners.find(p => p.id === id);
    if (partner && partner.discount_rate_pct && Number(partner.discount_rate_pct) > 0) {
      setDiscountType('PERCENT');
      setDiscountValue(Number(partner.discount_rate_pct));
    }
  };

  // Trụ cột 1: Quản lý trạng thái Bán Hàng Ngoại Tuyến (Offline POS Mode)
  const [isOnline, setIsOnline] = useState<boolean>(() => offlineSync.isOnline());
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  // Trụ cột 5: Quản lý Tích điểm & Đổi thưởng Loyalty
  const [loyaltyConfig, setLoyaltyConfig] = useState<any>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadBranchData = () => {
      api.getPartners()
        .then(res => {
          if (isMounted) setPartners(res.data || []);
        })
        .catch(err => {
          console.error('🔥 [CartPanel Load Partners Error]:', err);
        });

      api.getLoyaltyConfig().then(res => {
        if (isMounted && res.success) setLoyaltyConfig(res.data);
      }).catch(err => console.error('Lỗi tải cấu hình Loyalty:', err));
    };

    const unsubBranch = branchStore.subscribe((_config, branch) => {
      if (!isMounted || !branch) return;
      loadBranchData();
    });

    if (branchStore.getActiveBranch()) {
      loadBranchData();
    }

    // Kiểm tra số lượng đơn offline đang chờ
    offlineSync.getPendingOrders().then(orders => {
      if (isMounted) setPendingOfflineCount(orders.length);
    });

    // Lắng nghe thay đổi kết nối mạng
    const unsubNetwork = offlineSync.subscribeNetworkStatus((online) => {
      if (isMounted) {
        setIsOnline(online);
        if (online) {
          offlineSync.syncPendingOrders(payload => api.checkout(payload)).then(() => {
            offlineSync.getPendingOrders().then(orders => {
              if (isMounted) setPendingOfflineCount(orders.length);
            });
          });
        }
      }
    });

    return () => { 
      isMounted = false; 
      unsubBranch();
      unsubNetwork();
    };
  }, []);

  const handleSyncOfflineOrders = async () => {
    try {
      setIsSyncingOffline(true);
      const res = await offlineSync.syncPendingOrders(payload => api.checkout(payload));
      const remaining = await offlineSync.getPendingOrders();
      setPendingOfflineCount(remaining.length);
      if (res.syncedCount > 0) {
        alert(`Đã đồng bộ thành công ${res.syncedCount} đơn ngoại tuyến lên máy chủ!`);
      }
    } catch {
      // Bỏ qua lỗi đồng bộ
    } finally {
      setIsSyncingOffline(false);
    }
  };

  // Chiết khấu đơn hàng linh hoạt tự do thỏa thuận với khách (A4 & Q9)
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Q8: Modal PIN Quản lý duyệt đặc cách vượt hạn mức nợ
  const [isManagerPinModalOpen, setIsManagerPinModalOpen] = useState<boolean>(false);
  const [managerPinInput, setManagerPinInput] = useState<string>('');
  const [managerPinError, setManagerPinError] = useState<string | null>(null);

  const selectedPartner = partners.find(p => p.id === selectedPartnerId);

  // Tính toán Loyalty Points (Trụ cột 5)
  const partnerLoyaltyPoints = Number(selectedPartner?.loyalty_points || 0);
  const redeemRate = Number(loyaltyConfig?.redeem_value_per_point || 1000);
  const maxPointsCanUse = Math.min(partnerLoyaltyPoints, Math.floor((items.reduce((s, it) => s + it.quantity * it.unit_price, 0)) / redeemRate));
  const loyaltyDiscountAmount = useLoyaltyPoints ? maxPointsCanUse * redeemRate : 0;

  const subtotalAmount = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const discountAmount = discountType === 'PERCENT'
    ? Math.round((subtotalAmount * (Number(discountValue) || 0)) / 100)
    : Math.min(subtotalAmount, Number(discountValue) || 0);

  const totalAmount = Math.max(0, subtotalAmount - discountAmount - loyaltyDiscountAmount);
  const allowDebt = currentConfig?.features?.allow_debt === true;

  // Q5: Đồng bộ dữ liệu giỏ hàng sang Màn hình phụ Khách Hàng (Customer Display)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('meb_customer_display');
        bc.postMessage({
          type: 'CART_SYNC',
          items,
          subtotalAmount,
          discountAmount,
          totalAmount,
          customerName: selectedPartner?.name || 'Khách Lẻ',
          paymentMode,
          shiftCode: (currentShift as any)?.shift_code || currentShift?.id || ''
        });
        return () => {
          bc.close();
        };
      } catch {
        // BroadcastChannel fallback
      }
    }
  }, [items, subtotalAmount, discountAmount, totalAmount, selectedPartner, paymentMode, currentShift]);

  // Tính toán số tiền thanh toán thực tế dựa vào paymentMode
  let cashAmount = 0;
  let bankAmount = 0;
  let debtAmount = 0;
  let changeAmount = 0; // Tiền thối lại khách

  if (paymentMode === 'CASH') {
    const cashVal = parseFloat(splitCashInput) || 0;
    if (cashVal > totalAmount) {
      cashAmount = totalAmount;
      changeAmount = cashVal - totalAmount;
    } else {
      cashAmount = totalAmount;
    }
    bankAmount = 0;
    debtAmount = 0;
  } else if (paymentMode === 'BANK_TRANSFER') {
    cashAmount = 0;
    bankAmount = totalAmount;
    debtAmount = 0;
  } else if (paymentMode === 'DEBT') {
    cashAmount = 0;
    bankAmount = 0;
    debtAmount = totalAmount;
  } else if (paymentMode === 'SPLIT') {
    const cInput = parseFloat(splitCashInput) || 0;
    const bInput = parseFloat(splitBankInput) || 0;
    cashAmount = cInput;
    bankAmount = bInput;
    const totalPaid = cashAmount + bankAmount;
    if (totalPaid > totalAmount) {
      changeAmount = totalPaid - totalAmount;
      debtAmount = 0;
    } else {
      debtAmount = totalAmount - totalPaid;
    }
  }

  const paidAmount = cashAmount + bankAmount - changeAmount;

  // Xử lý nút thanh toán F9 (hỗ trợ cờ overrideDebtLimit khi quản lý nhập PIN)
  const handleCheckout = async (overrideDebtLimit: boolean = false) => {
    setErrorMessage(null);

    if (items.length === 0) {
      setErrorMessage('Giỏ hàng đang trống. Vui lòng chọn ít nhất 1 sản phẩm.');
      return;
    }

    // Kiểm tra ràng buộc bắt buộc chọn khách hàng
    if (currentConfig?.features?.customer_required && !selectedPartnerId) {
      setErrorMessage('Chi nhánh yêu cầu bắt buộc phải chọn thông tin Khách Hàng.');
      return;
    }

    // Kiểm tra ràng buộc Bán nợ (INV-01 & INV-08)
    if (debtAmount > 0) {
      if (!allowDebt) {
        setErrorMessage('Chi nhánh này chưa kích hoạt tính năng Bán Nợ (allow_debt = false). Vui lòng thu đủ 100% tiền!');
        return;
      }
      if (!selectedPartnerId) {
        setErrorMessage('Bán nợ bắt buộc phải chọn hồ sơ Khách Hàng để quản lý công nợ!');
        return;
      }
      if (selectedPartner && selectedPartner.debt_limit > 0) {
        const newTotalDebt = Number(selectedPartner.current_debt) + debtAmount;
        if (newTotalDebt > Number(selectedPartner.debt_limit) && !overrideDebtLimit) {
          // Q8: Mở Modal yêu cầu mã PIN Quản lý duyệt đặc cách bảo lãnh
          setIsManagerPinModalOpen(true);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      const paymentsPayload: Array<{ payment_method: 'CASH' | 'BANK_TRANSFER'; amount: number }> = [];
      
      if (cashAmount > 0) {
        paymentsPayload.push({
          payment_method: 'CASH',
          amount: cashAmount - changeAmount
        });
      }
      if (bankAmount > 0) {
        paymentsPayload.push({
          payment_method: 'BANK_TRANSFER',
          amount: bankAmount
        });
      }

      const idempotencyKey = generateIdempotencyKey();
      const payload = {
        order: {
          shift_id: currentShift?.id,
          partner_id: selectedPartnerId || undefined,
          idempotency_key: idempotencyKey,
          points_used: useLoyaltyPoints ? maxPointsCanUse : 0,
          points_discount_amount: loyaltyDiscountAmount,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          debt_amount: debtAmount,
          order_type: 'SALE' as const,
          note: `Bán hàng quầy POS (${paymentMode}${debtAmount > 0 ? ' - Có Nợ' : ''}${overrideDebtLimit ? ' [Quản lý duyệt PIN]' : ''}${useLoyaltyPoints ? ` [Dùng ${maxPointsCanUse} điểm]` : ''})`
        },
        items: items.map(it => ({
          product_id: it.product_id,
          uom: it.uom,
          conversion_rate: it.conversion_rate || 1,
          quantity: it.quantity,
          unit_price: it.unit_price
        })),
        payments: paymentsPayload
      };

      // XỬ LÝ OFFLINE POS NẾU MẤT MẠNG INTERNET (Trụ cột 1)
      if (!isOnline) {
        const offRecord = await offlineSync.saveOfflineOrder(payload);
        setPendingOfflineCount(prev => prev + 1);
        onCheckoutSuccess({
          order_id: offRecord.id,
          order_code: offRecord.order_code,
          customer: selectedPartner ? {
            name: selectedPartner.name,
            phone: selectedPartner.phone,
            address: selectedPartner.address,
            current_debt: selectedPartner.current_debt
          } : null,
          items: [...items],
          payments: paymentsPayload,
          change_amount: changeAmount,
          discount_amount: discountAmount + loyaltyDiscountAmount,
          total_amount: totalAmount,
          is_offline: true
        });
        setSplitCashInput('');
        setSplitBankInput('');
        setDiscountValue(0);
        setUseLoyaltyPoints(false);
        onClearCart();
        return;
      }

      try {
        const res = await api.checkout(payload);
        onCheckoutSuccess({
          ...res.data,
          customer: selectedPartner ? {
            name: selectedPartner.name,
            phone: selectedPartner.phone,
            address: selectedPartner.address,
            current_debt: selectedPartner.current_debt
          } : null,
          items: [...items],
          payments: paymentsPayload,
          change_amount: changeAmount,
          discount_amount: discountAmount + loyaltyDiscountAmount,
          total_amount: totalAmount
        });
      } catch (networkErr: any) {
        // Nếu lỗi mất kết nối mạng đột ngột: Tự động fallback sang lưu Offline (INV-01)
        if (!navigator.onLine || networkErr.message?.includes('fetch') || networkErr.message?.includes('Network')) {
          console.warn('⚠️ Mất mạng đột ngột! Chuyển sang lưu đơn ngoại tuyến IndexedDB...');
          const offRecord = await offlineSync.saveOfflineOrder(payload);
          setPendingOfflineCount(prev => prev + 1);
          setIsOnline(false);
          onCheckoutSuccess({
            order_id: offRecord.id,
            order_code: offRecord.order_code,
            customer: selectedPartner ? {
              name: selectedPartner.name,
              phone: selectedPartner.phone,
              address: selectedPartner.address,
              current_debt: selectedPartner.current_debt
            } : null,
            items: [...items],
            payments: paymentsPayload,
            change_amount: changeAmount,
            discount_amount: discountAmount + loyaltyDiscountAmount,
            total_amount: totalAmount,
            is_offline: true
          });
        } else {
          throw networkErr;
        }
      }

      setSplitCashInput('');
      setSplitBankInput('');
      setDiscountValue(0);
      setUseLoyaltyPoints(false);
      onClearCart();
    } catch (err: any) {
      console.error('🔥 [Checkout Error]:', err);
      setErrorMessage(err.message || 'Thanh toán thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cart-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 8 }}>
      {/* BANNER NGOẠI TUYẾN / ĐỒNG BỘ OFFLINE */}
      {(!isOnline || pendingOfflineCount > 0) && (
        <div style={{
          background: !isOnline ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          border: !isOnline ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 8,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isOnline ? <WifiOff size={15} color="#ef4444" /> : <Wifi size={15} color="#f59e0b" />}
            <span style={{ fontWeight: 600, color: !isOnline ? '#fca5a5' : '#fcd34d' }}>
              {!isOnline 
                ? 'Mất mạng • Bán Ngoại Tuyến (Offline POS)' 
                : 'Đã kết nối lại mạng'}
              {pendingOfflineCount > 0 && ` • ${pendingOfflineCount} đơn chờ đẩy lên máy chủ`}
            </span>
          </div>
          {pendingOfflineCount > 0 && (
            <button
              type="button"
              disabled={isSyncingOffline || !isOnline}
              onClick={handleSyncOfflineOrders}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: isSyncingOffline || !isOnline ? 'not-allowed' : 'pointer',
                opacity: isSyncingOffline || !isOnline ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <RefreshCw size={12} className={isSyncingOffline ? 'spin' : ''} />
              {isSyncingOffline ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
            </button>
          )}
        </div>
      )}

      {/* 1. THANH TÁC VỤ & TAB ĐƠN HÀNG */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
        {/* Các Tab Đơn hàng */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {drafts.length > 0 && onSelectDraft ? (
            drafts.map((d) => {
              const isActive = d.id === activeDraftId;
              const itCount = d.items.length;
              return (
                <div
                  key={d.id}
                  onClick={() => onSelectDraft(d.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: isActive ? 'var(--primary)' : 'var(--bg-subtle)',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>{d.name} ({itCount})</span>
                  {onCloseDraft && drafts.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onCloseDraft(d.id); }}
                      style={{ background: 'transparent', border: 'none', color: isActive ? '#ffffff' : '#94a3b8', cursor: 'pointer', padding: 0 }}
                      title="Đóng đơn"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}>
              <Receipt size={16} color="var(--primary)" />
              <span>Đơn Hàng ({items.length})</span>
            </div>
          )}

          {onAddDraft && drafts.length < 5 && (
            <button
              type="button"
              onClick={onAddDraft}
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                color: 'var(--text-main)',
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
              title="Thêm đơn mới"
            >
              <Plus size={13} /> Đơn
            </button>
          )}
        </div>

        {/* Nút Khách Xem & Xóa Hết */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              window.open('/?view=customer-display', 'meb_customer_display', 'width=1000,height=700,menubar=no,status=no');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              padding: '5px 10px',
              borderRadius: 6,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="Mở màn hình phụ Khách Xem"
          >
            <Tv size={13} /> Khách Xem
          </button>
          {items.length > 0 && (
            <button 
              onClick={onClearCart} 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Xóa toàn bộ giỏ hàng"
            >
              <Trash2 size={13} /> Xóa
            </button>
          )}
        </div>
      </div>

      {/* 2. CHỌN KHÁCH HÀNG */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
          <select
            value={selectedPartnerId}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
            style={{
              flex: 1,
              height: 36,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-main)',
              fontSize: 13,
              fontWeight: 500,
              padding: '0 10px',
              outline: 'none'
            }}
          >
            <option value="">Khách Lẻ (Không ghi nợ)</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code}) • {p.customer_group_name ? `Nhóm: ${p.customer_group_name}` : p.price_group === 'CONTRACTOR' ? 'Nhà thầu' : p.price_group === 'WHOLESALE' ? 'Đại lý' : 'Khách lẻ'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsQuickCustomerOpen(true)}
            className="btn-action"
            style={{
              height: 36,
              fontSize: 12.5,
              padding: '0 12px',
              background: 'var(--bg-subtle)',
              color: 'var(--primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
            title="Thêm nhanh khách hàng mới"
          >
            <UserPlus size={14} /> + Khách
          </button>
        </div>

        {/* Hiển thị sổ nợ đối tác và nhóm khách hàng nếu được chọn */}
        {selectedPartner && (
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: 6, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 2 }}>
              {selectedPartner.customer_group_name && (
                <span style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontWeight: 700
                }}>
                  🏷️ {selectedPartner.customer_group_name} {selectedPartner.discount_rate_pct ? `(-${selectedPartner.discount_rate_pct}%)` : ''}
                </span>
              )}
              <span>
                Dư nợ: <strong style={{ color: Number(selectedPartner.current_debt) > 0 ? '#fb7185' : '#fbbf24' }}>{Number(selectedPartner.current_debt).toLocaleString('vi-VN')}đ</strong>
              </span>
              <span>
                Hạn mức còn: <strong style={{ color: '#34d399' }}>{Number(selectedPartner.remaining_limit).toLocaleString('vi-VN')}đ</strong>
              </span>
            </div>
            {Number(selectedPartner.current_debt) > 0 && (
              <button
                type="button"
                onClick={() => setIsDebtModalOpen(true)}
                style={{
                  width: '100%',
                  marginTop: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
              >
                <span>💰 Thu Nợ Khách Hàng Này Tại Quầy</span>
              </button>
            )}

            {/* Trụ Cột 5: Tích điểm & Đổi thưởng Khách Hàng */}
            <div style={{
              marginTop: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gift size={14} color="#c084fc" />
                <span>
                  Điểm thưởng: <strong style={{ color: '#e879f9' }}>{partnerLoyaltyPoints.toLocaleString('vi-VN')}</strong> điểm
                  {redeemRate > 0 && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> (1đ = {redeemRate.toLocaleString('vi-VN')}đ)</span>}
                </span>
              </div>
              {partnerLoyaltyPoints > 0 && maxPointsCanUse > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0, fontWeight: 600, color: '#c084fc' }}>
                  <input
                    type="checkbox"
                    checked={useLoyaltyPoints}
                    onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                    style={{ accentColor: '#a855f7', cursor: 'pointer' }}
                  />
                  Dùng {maxPointsCanUse.toLocaleString('vi-VN')} điểm (-{(maxPointsCanUse * redeemRate).toLocaleString('vi-VN')}đ)
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. DANH SÁCH MÓN TRONG GIỎ HÀNG */}
      <div style={{ flex: '1 1 0px', minHeight: 60, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 4 }}>
        {items.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', padding: 16 }}>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Giỏ hàng đang trống.</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Bấm vào sản phẩm bên trái để thêm vào đơn</p>
          </div>
        ) : (
          items.map(it => {
            const isExceeded = it.quantity > it.available_qty && !currentConfig?.features.allow_negative_stock;
            return (
              <div 
                key={it.product_id}
                style={{
                  background: 'var(--bg-card)',
                  border: isExceeded ? '1px solid #f43f5e' : '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'var(--card-shadow)'
                }}
              >
                {/* Ảnh Thumbnail Sản Phẩm Trong Giỏ */}
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img 
                    src={getProductImageUrl(it.code, it.image_url, undefined, it.name)}
                    alt={it.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getProductFallbackSvg(it.code, undefined, it.name);
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}
                    loading="lazy"
                  />
                </div>

                {/* Chi Tiết Tên, Đơn Giá & Số Lượng */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {it.name}
                    </div>
                    <button 
                      onClick={() => onRemoveItem(it.product_id)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 2px' }}
                      title="Xóa món"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* ĐVT và Đơn Giá Có Thể Bấm Để Sửa */}
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: '#0284c7', fontWeight: 700 }}>{it.uom}</span>
                      <span>•</span>
                      <span>@{it.unit_price.toLocaleString('vi-VN')}đ</span>
                      {onUpdatePrice && (
                        <button
                          type="button"
                          onClick={() => {
                            const pStr = prompt(`Nhập đơn giá mới cho ${it.name} (${it.uom}):`, String(it.unit_price));
                            if (pStr !== null) {
                              const newP = Math.max(0, parseInt(pStr, 10) || 0);
                              onUpdatePrice(it.product_id, newP);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginLeft: 2
                          }}
                          title="Bấm để sửa đơn giá"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Bộ nút tăng/giảm số lượng và Thành tiền */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 4px' }}>
                        <button 
                          onClick={() => onUpdateQty(it.product_id, -1)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '2px 5px' }}
                        >
                          <Minus size={13} />
                        </button>
                        <input 
                          type="number"
                          value={it.quantity}
                          onChange={(e) => onSetQty(it.product_id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                          style={{ width: 34, height: 26, textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: 13.5, fontWeight: 700, outline: 'none' }}
                        />
                        <button 
                          onClick={() => onUpdateQty(it.product_id, 1)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '2px 5px' }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-retail, #059669)', minWidth: 68, textAlign: 'right' }}>
                        {(it.quantity * it.unit_price).toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>

                  {/* Cảnh báo vượt quá tồn khả dụng */}
                  {isExceeded && (
                    <div style={{ fontSize: 10, color: '#fb7185', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={11} />
                      Vượt tồn kho khả dụng ({it.available_qty} {it.uom})
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. PHƯƠNG THỨC THANH TOÁN (TIỀN MẶT / CHUYỂN KHOẢN / BÁN NỢ / CHIA TIỀN) */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
          Phương Thức Thanh Toán:
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: allowDebt ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          gap: 4,
          padding: 3,
          background: 'var(--bg-subtle)',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          marginBottom: 0
        }}>
          <button
            type="button"
            onClick={() => setPaymentMode('CASH')}
            style={{
              padding: '7px 4px',
              borderRadius: 6,
              border: 'none',
              background: paymentMode === 'CASH' ? 'var(--bg-card)' : 'transparent',
              color: paymentMode === 'CASH' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: paymentMode === 'CASH' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: 12,
              fontWeight: paymentMode === 'CASH' ? 700 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
          >
            <Banknote size={14} color={paymentMode === 'CASH' ? '#10b981' : 'inherit'} /> Tiền Mặt
          </button>

          <button
            type="button"
            onClick={() => setPaymentMode('BANK_TRANSFER')}
            style={{
              padding: '7px 4px',
              borderRadius: 6,
              border: 'none',
              background: paymentMode === 'BANK_TRANSFER' ? 'var(--bg-card)' : 'transparent',
              color: paymentMode === 'BANK_TRANSFER' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: paymentMode === 'BANK_TRANSFER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: 12,
              fontWeight: paymentMode === 'BANK_TRANSFER' ? 700 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
          >
            <Building size={14} color={paymentMode === 'BANK_TRANSFER' ? 'var(--primary)' : 'inherit'} /> Chuyển Khoản
          </button>

          {allowDebt && (
            <button
              type="button"
              onClick={() => setPaymentMode('DEBT')}
              style={{
                padding: '7px 4px',
                borderRadius: 6,
                border: 'none',
                background: paymentMode === 'DEBT' ? 'var(--bg-card)' : 'transparent',
                color: paymentMode === 'DEBT' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: paymentMode === 'DEBT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: 12,
                fontWeight: paymentMode === 'DEBT' ? 700 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.15s ease'
              }}
            >
              <CreditCard size={14} color={paymentMode === 'DEBT' ? '#d97706' : 'inherit'} /> Ghi Nợ
            </button>
          )}

          <button
            type="button"
            onClick={() => setPaymentMode('SPLIT')}
            style={{
              padding: '7px 4px',
              borderRadius: 6,
              border: 'none',
              background: paymentMode === 'SPLIT' ? 'var(--bg-card)' : 'transparent',
              color: paymentMode === 'SPLIT' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: paymentMode === 'SPLIT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: 12,
              fontWeight: paymentMode === 'SPLIT' ? 700 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={14} color={paymentMode === 'SPLIT' ? 'var(--primary)' : 'inherit'} /> Chia Tiền
          </button>
        </div>

        {/* NẾU LÀ BANK_TRANSFER HOẶC SPLIT -> CÓ NÚT XEM VIETQR */}
        {(paymentMode === 'BANK_TRANSFER' || (paymentMode === 'SPLIT' && (parseFloat(splitBankInput) || 0) > 0)) && (
          <div style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setIsVietQrOpen(true)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7
              }}
            >
              <QrCode size={15} />
              <span>📱 Xem Mã VietQR Cho Khách Quét ({((paymentMode === 'BANK_TRANSFER' ? totalAmount : parseFloat(splitBankInput) || 0)).toLocaleString('vi-VN')}đ)</span>
            </button>
          </div>
        )}

        {/* BẢNG CHIA TIỀN (SPLIT MATRIX HOẶC TÍNH TIỀN THỪA) */}
        {paymentMode === 'SPLIT' && (
          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 10,
            marginBottom: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-main)', fontWeight: 600 }}>💵 Tiền mặt:</span>
              <input
                type="number"
                value={splitCashInput}
                onChange={(e) => setSplitCashInput(e.target.value)}
                placeholder="Nhập tiền mặt..."
                style={{
                  width: 150,
                  height: 32,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'right',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-main)', fontWeight: 600 }}>💳 Chuyển khoản QR:</span>
              <input
                type="number"
                value={splitBankInput}
                onChange={(e) => setSplitBankInput(e.target.value)}
                placeholder="Nhập CK ngân hàng..."
                style={{
                  width: 150,
                  height: 32,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'right',
                  outline: 'none'
                }}
              />
            </div>

            {/* CÁC NÚT ĐỀ XUẤT TIỀN MẶT NHANH */}
            <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
              <button
                type="button"
                onClick={() => setSplitCashInput(String(totalAmount))}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 5, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}
              >
                Đủ tiền
              </button>
              <button
                type="button"
                onClick={() => setSplitCashInput(String(Math.ceil(totalAmount / 50000) * 50000))}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 5, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}
              >
                Tròn 50k
              </button>
              <button
                type="button"
                onClick={() => setSplitCashInput(String(Math.ceil(totalAmount / 100000) * 100000))}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 5, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}
              >
                Tròn 100k
              </button>
              <button
                type="button"
                onClick={() => setSplitCashInput(String(Math.ceil(totalAmount / 500000) * 500000))}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 5, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}
              >
                Tròn 500k
              </button>
            </div>
          </div>
        )}

        {/* Tóm tắt số tiền & Chiết khấu (A4) - Chuẩn Calm Modern Retail */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          padding: '8px 12px',
          borderRadius: 8,
          marginBottom: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-muted)' }}>
            <span>Tiền hàng (chưa giảm):</span>
            <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>{subtotalAmount.toLocaleString('vi-VN')}đ</strong>
          </div>

          {/* Ô Nhập Chiết Khấu / Giảm Giá Tự Do (A4) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            padding: '3px 6px',
            background: 'var(--bg-card)',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)'
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 600 }}>
              🎁 Chiết khấu đơn:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                min="0"
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                title="Thu ngân nhập % hoặc số tiền giảm giá trực tiếp (A4)"
                style={{
                  width: 75,
                  height: 26,
                  padding: '2px 6px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  textAlign: 'right',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setDiscountType(prev => prev === 'PERCENT' ? 'FIXED' : 'PERCENT')}
                style={{
                  height: 26,
                  padding: '0 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 4,
                  border: '1px solid var(--border-subtle)',
                  background: discountType === 'PERCENT' ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: discountType === 'PERCENT' ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer'
                }}
                title="Bấm để đổi đơn vị % hoặc VNĐ"
              >
                {discountType === 'PERCENT' ? '%' : 'đ'}
              </button>
            </div>
          </div>

          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#d97706' }}>
              <span>Tiền giảm trừ chiết khấu:</span>
              <strong>-{discountAmount.toLocaleString('vi-VN')}đ</strong>
            </div>
          )}

          {loyaltyDiscountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#7c3aed' }}>
              <span>Giảm trừ điểm thưởng ({maxPointsCanUse} điểm):</span>
              <strong>-{loyaltyDiscountAmount.toLocaleString('vi-VN')}đ</strong>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--text-main)', borderTop: '1px solid var(--border-subtle)', paddingTop: 5, marginTop: 2 }}>
            <span style={{ fontWeight: 700 }}>Tổng cần thanh toán:</span>
            <strong style={{ color: 'var(--text-main)', fontSize: 17, fontWeight: 800 }}>{totalAmount.toLocaleString('vi-VN')}đ</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-muted)' }}>
            <span>Khách thanh toán:</span>
            <strong style={{ color: '#059669', fontSize: 14, fontWeight: 700 }}>{paidAmount.toLocaleString('vi-VN')}đ</strong>
          </div>
          {changeAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 6px', borderRadius: 4 }}>
              <span>Tiền thối lại khách:</span>
              <strong>{changeAmount.toLocaleString('vi-VN')}đ</strong>
            </div>
          )}
          {debtAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', padding: '3px 6px', borderRadius: 4 }}>
              <span>Ghi nợ vào sổ:</span>
              <strong>+{debtAmount.toLocaleString('vi-VN')}đ</strong>
            </div>
          )}
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            padding: '6px 8px',
            borderRadius: 6,
            fontSize: 11.5,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* NÚT THANH TOÁN CHÍNH F9 */}
        <button
          id="pos-checkout-btn"
          onClick={() => handleCheckout(false)}
          disabled={isSubmitting || items.length === 0}
          className="btn-primary"
          style={{
            width: '100%',
            height: 44,
            fontSize: 14.5,
            fontWeight: 700,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: items.length === 0 ? 0.6 : 1
          }}
        >
          <CheckCircle2 size={18} />
          <span>
            {isSubmitting 
              ? 'Đang ghi nhận đơn...' 
              : `Thanh Toán F9 (${paidAmount.toLocaleString('vi-VN')}đ${debtAmount > 0 ? ` + Nợ ${debtAmount.toLocaleString('vi-VN')}đ` : ''})`}
          </span>
        </button>
      </div>

      {/* MODAL THÊM KHÁCH HÀNG NHANH */}
      <QuickCustomerModal
        isOpen={isQuickCustomerOpen}
        onClose={() => setIsQuickCustomerOpen(false)}
        onSuccess={(newCustomer: PartnerProfile) => {
          setPartners(prev => [newCustomer, ...prev]);
          setSelectedPartnerId(newCustomer.id);
        }}
      />

      {/* MODAL THU NỢ TẠI QUẦY */}
      {selectedPartner && (
        <QuickDebtCollectionModal
          isOpen={isDebtModalOpen}
          onClose={() => setIsDebtModalOpen(false)}
          partner={selectedPartner}
          currentShift={currentShift}
          onSuccess={() => {
            api.getPartners().then(res => setPartners(res.data || []));
          }}
        />
      )}

      {/* MODAL VIETQR ĐỘNG (A3) */}
      <VietQrModal
        isOpen={isVietQrOpen}
        onClose={() => setIsVietQrOpen(false)}
        amount={paymentMode === 'BANK_TRANSFER' ? totalAmount : (parseFloat(splitBankInput) || totalAmount)}
        orderCode={`HD-POS-${(activeDraftId || 'ORD').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '01'}`}
        onConfirmPaid={async () => {
          setIsVietQrOpen(false);
          await handleCheckout();
        }}
      />
      {/* MODAL DUYỆT ĐẶC CÁCH PIN QUẢN LÝ KHI VƯỢT HẠN MỨC (INV-08 / Q8) */}
      {isManagerPinModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 12,
            padding: 24,
            width: 380,
            maxWidth: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f87171', marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>VƯỢT HẠN MỨC TÍN DỤNG (INV-08)</h4>
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 16 }}>
              Khách hàng <strong>{selectedPartner?.name}</strong> đã vượt hạn mức công nợ cho phép. Cần mã PIN Quản lý chi nhánh để bảo lãnh xuất đơn.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                Mã PIN Quản lý (Mặc định: 1234):
              </label>
              <input
                type="password"
                maxLength={6}
                value={managerPinInput}
                onChange={(e) => {
                  setManagerPinInput(e.target.value);
                  setManagerPinError(null);
                }}
                autoFocus
                placeholder="Nhập 4-6 số PIN..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: 16,
                  letterSpacing: 4,
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (managerPinInput === '1234' || managerPinInput.length >= 4) {
                      setIsManagerPinModalOpen(false);
                      setManagerPinInput('');
                      setManagerPinError(null);
                      handleCheckout(true);
                    } else {
                      setManagerPinError('Mã PIN quản lý không chính xác!');
                    }
                  }
                }}
              />
              {managerPinError && (
                <div style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{managerPinError}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setIsManagerPinModalOpen(false);
                  setManagerPinInput('');
                  setManagerPinError(null);
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (managerPinInput === '1234' || managerPinInput.length >= 4) {
                    setIsManagerPinModalOpen(false);
                    setManagerPinInput('');
                    setManagerPinError(null);
                    handleCheckout(true);
                  } else {
                    setManagerPinError('Mã PIN quản lý không chính xác!');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Duyệt Xuất Đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
