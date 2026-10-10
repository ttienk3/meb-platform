import React, { useState, useEffect, useCallback } from 'react';
import { api, type ShiftInfo } from '../../services/api';
import { branchStore } from '../../services/branchContext';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CreditCard,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Search,
  AlertCircle,
  X,
  TrendingUp,
  Building2,
  Truck,
  PieChart,
  Receipt
} from 'lucide-react';

interface CashbookTabProps {
  currentShift: ShiftInfo | null;
  onRefreshShift?: () => void;
}

interface CashFlowItem {
  id: string;
  flow_code: string;
  branch_id: string;
  shift_id?: string;
  type: 'IN' | 'OUT';
  category: string;
  payment_method: string;
  payment_account: string;
  amount: number;
  note: string;
  created_by: string;
  created_at: string;
  partner_name?: string;
}

interface CashbookSummary {
  total_in: number;
  total_out: number;
  net_balance: number;
  cash_balance: number;
  digital_in: number;
  current_shift: any;
}

interface CashAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'CASH' | 'BANK' | 'SAFE';
  branch_id?: string;
  branch_name?: string;
  current_balance: number;
  is_active: boolean;
}

interface PnlSummary {
  revenue: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_profit: number;
  gross_margin_pct: string;
  net_margin_pct: string;
}

interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface ShipperDebt {
  id: string;
  transfer_id: string;
  transfer_code: string;
  shipper_name: string;
  shipper_phone: string;
  debt_amount: number;
  status: string;
  note: string;
  created_at: string;
}

export const CashbookTab: React.FC<CashbookTabProps> = ({ currentShift, onRefreshShift }) => {
  const [subTab, setSubTab] = useState<'FLOWS' | 'ACCOUNTS' | 'PNL'>('FLOWS');

  // Dữ liệu dòng tiền
  const [summary, setSummary] = useState<CashbookSummary>({
    total_in: 0,
    total_out: 0,
    net_balance: 0,
    cash_balance: 0,
    digital_in: 0,
    current_shift: null
  });
  const [flows, setFlows] = useState<CashFlowItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Dữ liệu tài khoản & OPEX
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [pnlData, setPnlData] = useState<PnlSummary | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [shipperDebts, setShipperDebts] = useState<ShipperDebt[]>([]);

  // Modal tạo phiếu thu/chi ca
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'IN' | 'OUT'>('IN');
  const [modalAmount, setModalAmount] = useState<string>('');
  const [modalCategory, setModalCategory] = useState<string>('EXPENSE');
  const [modalNote, setModalNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal tạo phiếu chi OPEX (Mặt bằng, điện nước, lương...)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [expenseAccountId, setExpenseAccountId] = useState<string>('');
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseDesc, setExpenseDesc] = useState<string>('');

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [cbRes, accRes, pnlRes, catRes, shipRes] = await Promise.allSettled([
        api.getCashbook(),
        api.getCashbookAccounts(),
        api.getCashbookPnl(),
        api.getExpenseCategories(),
        api.getShipperDebts()
      ]);

      if (cbRes.status === 'fulfilled' && cbRes.value.success && cbRes.value.data) {
        setSummary(cbRes.value.data.summary);
        setFlows(cbRes.value.data.flows || []);
      }
      if (accRes.status === 'fulfilled' && accRes.value.success) {
        setAccounts(accRes.value.data || []);
      }
      if (pnlRes.status === 'fulfilled' && pnlRes.value.success) {
        setPnlData(pnlRes.value.data);
      }
      if (catRes.status === 'fulfilled' && catRes.value.success) {
        setCategories(catRes.value.data || []);
      }
      if (shipRes.status === 'fulfilled' && shipRes.value.success) {
        setShipperDebts(shipRes.value.data || []);
      }
    } catch (err) {
      console.error('Lỗi tải sổ quỹ:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Tải dữ liệu ban đầu
    api.getCashbook()
      .then(cbRes => {
        if (isMounted && cbRes.success && cbRes.data) {
          setSummary(cbRes.data.summary);
          setFlows(cbRes.data.flows || []);
        }
      })
      .catch(err => console.error('Lỗi getCashbook:', err));

    api.getCashbookAccounts()
      .then(accRes => {
        if (isMounted && accRes.success) {
          setAccounts(accRes.data || []);
          if (accRes.data?.length > 0 && !expenseAccountId) {
            setExpenseAccountId(accRes.data[0].id);
          }
        }
      })
      .catch(err => console.error('Lỗi getCashbookAccounts:', err));

    api.getCashbookPnl()
      .then(pnlRes => {
        if (isMounted && pnlRes.success) setPnlData(pnlRes.data);
      })
      .catch(err => console.error('Lỗi getCashbookPnl:', err));

    api.getExpenseCategories()
      .then(catRes => {
        if (isMounted && catRes.success) {
          setCategories(catRes.data || []);
          if (catRes.data?.length > 0 && !expenseCategoryId) {
            setExpenseCategoryId(catRes.data[0].id);
          }
        }
      })
      .catch(err => console.error('Lỗi getExpenseCategories:', err));

    api.getShipperDebts()
      .then(shipRes => {
        if (isMounted && shipRes.success) setShipperDebts(shipRes.data || []);
      })
      .catch(err => console.error('Lỗi getShipperDebts:', err));

    const unsubscribe = branchStore.subscribe(() => {
      if (isMounted) refreshData();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [expenseAccountId, expenseCategoryId, refreshData]);

  const handleOpenModal = (type: 'IN' | 'OUT') => {
    setModalType(type);
    setModalAmount('');
    setModalCategory(type === 'IN' ? 'TOPUP' : 'EXPENSE');
    setModalNote('');
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSaveFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(modalAmount);
    if (!numAmount || numAmount <= 0) {
      setFeedback({ type: 'error', message: 'Số tiền phải lớn hơn 0' });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.recordCashFlow({
        shift_id: currentShift?.id,
        type: modalType,
        amount: numAmount,
        category: modalCategory,
        note: modalNote.trim() || (modalType === 'IN' ? 'Nạp tiền quỹ' : 'Chi quỹ vận hành')
      });

      if (res.success) {
        setIsModalOpen(false);
        refreshData();
        if (onRefreshShift) onRefreshShift();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Không thể ghi nhận giao dịch' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi kết nối' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lưu phiếu chi OPEX theo danh mục
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(expenseAmount);
    if (!numAmount || numAmount <= 0) {
      setFeedback({ type: 'error', message: 'Số tiền chi OPEX phải lớn hơn 0' });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createExpense({
        account_id: expenseAccountId || undefined,
        category_id: expenseCategoryId || undefined,
        amount: numAmount,
        description: expenseDesc.trim() || 'Chi phí vận hành OPEX'
      });

      if (res.success) {
        setIsExpenseModalOpen(false);
        setExpenseAmount('');
        setExpenseDesc('');
        refreshData();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Lỗi tạo phiếu chi' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi kết nối' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFlows = flows.filter(f => {
    const matchType = typeFilter === 'ALL' || f.type === typeFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchSearch = !query || 
      f.flow_code.toLowerCase().includes(query) ||
      (f.note && f.note.toLowerCase().includes(query)) ||
      (f.partner_name && f.partner_name.toLowerCase().includes(query)) ||
      f.category.toLowerCase().includes(query);
    return matchType && matchSearch;
  });

  const getCategoryLabel = (cat: string, type: string) => {
    switch (cat) {
      case 'SALE': return 'Thu Bán Hàng POS';
      case 'DEBT_COLLECT': return 'Thu Khách Trả Nợ';
      case 'PURCHASE': return 'Chi Nhập Hàng NCC';
      case 'TOPUP': return 'Nạp Bổ Sung Két';
      case 'WITHDRAW': return 'Rút Tiền Nộp Về Chủ';
      case 'EXPENSE': return 'Chi Phí Vận Hành';
      default: return type === 'IN' ? 'Thu Khác' : 'Chi Khác';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* THANH CHUYỂN ĐỔI SUB-TAB CAO CẤP */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.7)',
        padding: '6px 12px',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setSubTab('FLOWS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: subTab === 'FLOWS' ? '#0284c7' : 'transparent',
              color: subTab === 'FLOWS' ? '#ffffff' : '#94a3b8',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Wallet size={15} /> Dòng Tiền & Thu Chi
          </button>
          <button
            type="button"
            onClick={() => setSubTab('ACCOUNTS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: subTab === 'ACCOUNTS' ? '#0284c7' : 'transparent',
              color: subTab === 'ACCOUNTS' ? '#ffffff' : '#94a3b8',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Building2 size={15} /> Két & Tài Khoản ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('PNL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: subTab === 'PNL' ? '#0284c7' : 'transparent',
              color: subTab === 'PNL' ? '#ffffff' : '#94a3b8',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <PieChart size={15} /> Lãi/Lỗ P&L & Bồi Thường
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {subTab === 'ACCOUNTS' && (
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setIsExpenseModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Receipt size={14} /> + Chi Phí OPEX
            </button>
          )}
          <button
            type="button"
            onClick={refreshData}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#94a3b8',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Đồng Bộ
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 1: DÒNG TIỀN & THU CHI CHI TIẾT */}
      {/* ------------------------------------------------------------- */}
      {subTab === 'FLOWS' && (
        <>
          {/* BENTO 4 CHỈ SỐ SỔ QUỸ CHI NHÁNH */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {/* TỔNG TIỀN VÀO */}
            <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ArrowDownLeft size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>TỔNG THU VÀO</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                  {summary.total_in.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Bán hàng + Thu nợ khách
                </div>
              </div>
            </div>

            {/* TỔNG TIỀN RA */}
            <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ArrowUpRight size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>TỔNG CHI RA</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f87171', marginTop: 2 }}>
                  {summary.total_out.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Tiền hàng + Chi phí ca
                </div>
              </div>
            </div>

            {/* SỐ DƯ QUỸ TIỀN MẶT */}
            <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Wallet size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>TỒN QUỸ TIỀN MẶT</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                  {summary.cash_balance.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Tiền mặt trong két quầy
                </div>
              </div>
            </div>

            {/* DOANH THU CHUYỂN KHOẢN */}
            <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CreditCard size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>TIỀN CHUYỂN KHOẢN</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#c084fc', marginTop: 2 }}>
                  {summary.digital_in.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  VietQR + Thẻ ngân hàng
                </div>
              </div>
            </div>
          </div>

          {/* THANH ĐIỀU KHIỂN & BỘ LỌC */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, maxWidth: 500 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '0 10px',
                flex: 1
              }}>
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  placeholder="Tìm mã phiếu, lý do, khách hàng..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    padding: '8px 10px',
                    fontSize: 12,
                    outline: 'none',
                    width: '100%'
                  }}
                />
              </div>

              <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8, padding: 3, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: typeFilter === 'ALL' ? '#334155' : 'transparent',
                    color: typeFilter === 'ALL' ? '#ffffff' : '#94a3b8',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('IN')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: typeFilter === 'IN' ? '#059669' : 'transparent',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Thu (+)
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('OUT')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: typeFilter === 'OUT' ? '#dc2626' : 'transparent',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Chi (-)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleOpenModal('IN')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <PlusCircle size={14} /> + Phiếu Thu Tiền
              </button>
              <button
                type="button"
                onClick={() => handleOpenModal('OUT')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <MinusCircle size={14} /> - Phiếu Chi Tiền
              </button>
            </div>
          </div>

          {/* BẢNG LỊCH SỬ THU CHI */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Mã Giao Dịch</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Thời Gian</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Phân Loại</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Phương Thức</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Đối Tác / Lý Do</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Số Tiền</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                      Chưa có giao dịch thu chi nào phù hợp với bộ lọc
                    </td>
                  </tr>
                ) : (
                  filteredFlows.map(f => {
                    const isIncome = f.type === 'IN';
                    return (
                      <tr key={f.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                          {f.flow_code}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                          {new Date(f.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isIncome ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isIncome ? '#34d399' : '#f87171'
                          }}>
                            {getCategoryLabel(f.category, f.type)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                          {f.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                          {f.partner_name && <strong style={{ color: '#38bdf8', marginRight: 6 }}>{f.partner_name} •</strong>}
                          {f.note}
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: 13,
                          color: isIncome ? '#34d399' : '#f87171'
                        }}>
                          {isIncome ? '+' : '-'}{f.amount.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 2: KÉT TIỀN & CÁC TÀI KHOẢN THANH TOÁN (Q14) */}
      {/* ------------------------------------------------------------- */}
      {subTab === 'ACCOUNTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {accounts.map(acc => {
              const isSafe = acc.account_type === 'SAFE';
              const isBank = acc.account_type === 'BANK';
              return (
                <div key={acc.id} className="glass-panel" style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  border: isSafe ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isSafe ? <Building2 size={18} color="#fbbf24" /> : isBank ? <CreditCard size={18} color="#c084fc" /> : <Wallet size={18} color="#38bdf8" />}
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#f8fafc' }}>{acc.account_name}</span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isSafe ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                      color: isSafe ? '#fbbf24' : '#38bdf8'
                    }}>
                      {acc.account_code}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Số Dư Hiện Tại:</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: acc.current_balance >= 0 ? '#34d399' : '#f87171', marginTop: 2 }}>
                      {Number(acc.current_balance || 0).toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
                    <span>Chi nhánh: {acc.branch_name || 'Toàn hệ thống'}</span>
                    <span style={{ color: acc.is_active ? '#34d399' : '#94a3b8' }}>● Đang hoạt động</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DANH MỤC CHI PHÍ VẬN HÀNH (OPEX) */}
          <div className="glass-panel" style={{ padding: 18 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
              Danh Mục Phân Bổ Chi Phí Vận Hành (OPEX)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {categories.map(cat => (
                <div key={cat.id} style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 13, color: '#cbd5e1' }}>{cat.name}</span>
                  <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{cat.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 3: BÁO CÁO LÃI/LỖ P&L & BỒI THƯỜNG TÀI XẾ (Q7 & Q14) */}
      {/* ------------------------------------------------------------- */}
      {subTab === 'PNL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* BENTO BÁO CÁO LỢI NHUẬN RÒNG REAL-TIME */}
          {pnlData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              <div className="glass-panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>DOANH THU</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
                  {pnlData.revenue.toLocaleString('vi-VN')} đ
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>GIÁ VỐN (COGS)</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fb923c', marginTop: 4 }}>
                  {pnlData.cogs.toLocaleString('vi-VN')} đ
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>LỢI NHUẬN GỘP ({pnlData.gross_margin_pct})</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399', marginTop: 4 }}>
                  {pnlData.gross_profit.toLocaleString('vi-VN')} đ
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>CHI PHÍ OPEX</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f87171', marginTop: 4 }}>
                  {pnlData.opex.toLocaleString('vi-VN')} đ
                </div>
              </div>
              <div className="glass-panel" style={{
                padding: '14px 16px',
                background: pnlData.net_profit >= 0 ? 'rgba(5, 150, 105, 0.2)' : 'rgba(225, 29, 72, 0.2)',
                border: pnlData.net_profit >= 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)'
              }}>
                <div style={{ fontSize: 11, color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={13} /> LỢI NHUẬN RÒNG ({pnlData.net_margin_pct})
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: pnlData.net_profit >= 0 ? '#34d399' : '#f87171', marginTop: 4 }}>
                  {pnlData.net_profit.toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>
          )}

          {/* DANH SÁCH BỒI THƯỜNG HAO HỤT TÀI XẾ (SHIPPER DEBTS - Q7) */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={17} color="#fbbf24" />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                Công Nợ Bồi Thường Hao Hụt Vận Chuyển Của Tài Xế (INV-06 / Q7)
              </h4>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Phiếu Điều Chuyển</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Tài Xế / Shipper</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Số Điện Thoại</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Lý Do Hao Hụt</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Trạng Thái</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Tiền Bồi Thường</th>
                </tr>
              </thead>
              <tbody>
                {shipperDebts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                      Không có ghi nhận nợ bồi thường hao hụt tài xế nào trong hệ thống
                    </td>
                  </tr>
                ) : (
                  shipperDebts.map(sd => (
                    <tr key={sd.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                        {sd.transfer_code}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f8fafc' }}>
                        {sd.shipper_name}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                        {sd.shipper_phone || '---'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                        {sd.note}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: sd.status === 'PAID' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: sd.status === 'PAID' ? '#34d399' : '#f87171'
                        }}>
                          {sd.status === 'PAID' ? 'Đã Trừ Lương' : 'Chưa Thu Hồi'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#f87171' }}>
                        {Number(sd.debt_amount || 0).toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL TẠO PHIẾU THU / CHI TIỀN CA BÁN */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
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
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 420,
            padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                {modalType === 'IN' ? <PlusCircle size={18} color="#34d399" /> : <MinusCircle size={18} color="#f87171" />}
                {modalType === 'IN' ? 'Tạo Phiếu Thu Tiền' : 'Tạo Phiếu Chi Tiền'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFlow}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Số Tiền (VNĐ)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  autoFocus
                  required
                  placeholder="Nhập số tiền..."
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: modalType === 'IN' ? '#34d399' : '#f87171',
                    fontSize: 18,
                    fontWeight: 900,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Danh Mục Phân Loại
                </label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {modalType === 'IN' ? (
                    <>
                      <option value="TOPUP">Nạp Bổ Sung Vốn / Tiền Lẻ Két</option>
                      <option value="SALE_OTHER">Thu Bán Phế Liệu / Khác</option>
                      <option value="OTHER">Khoản Thu Khác</option>
                    </>
                  ) : (
                    <>
                      <option value="EXPENSE">Chi Phí Vận Hành (Điện, Nước, Bao Bì)</option>
                      <option value="WITHDRAW">Rút Tiền Nộp Về Két Sắt / Chủ Chuỗi</option>
                      <option value="MEAL">Chi Tiền Ăn Ca / Tiếp Khách</option>
                      <option value="OTHER">Khoản Chi Khác</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Ghi Chú / Lý Do Chi Tiết
                </label>
                <input
                  type="text"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="VD: Mua thêm túi ni lông và cuộn giấy in bill..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 12,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {feedback && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14
                }}>
                  <AlertCircle size={15} />
                  <span>{feedback.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    background: modalType === 'IN' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Đang Lưu...' : '✓ Xác Nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL TẠO PHIẾU CHI PHÍ VẬN HÀNH OPEX (Q14) */}
      {/* ------------------------------------------------------------- */}
      {isExpenseModalOpen && (
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
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 440,
            padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={18} color="#f43f5e" />
                Ghi Nhận Chi Phí Vận Hành (OPEX)
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Trừ Tiền Từ Tài Khoản / Két
                </label>
                <select
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({Number(acc.current_balance).toLocaleString('vi-VN')}đ)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Danh Mục Chi Phí
                </label>
                <select
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Số Tiền Chi (VNĐ)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  placeholder="Nhập số tiền chi..."
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f43f5e',
                    fontSize: 18,
                    fontWeight: 900,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  Mô Tả & Hóa Đơn Chứng Từ
                </label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="VD: Tiền thuê mặt bằng tháng này / Hóa đơn điện..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 12,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {feedback && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14
                }}>
                  <AlertCircle size={15} />
                  <span>{feedback.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Đang Lưu...' : '✓ Xác Nhận Chi Tiêu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
