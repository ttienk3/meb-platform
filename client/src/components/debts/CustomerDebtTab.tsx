import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowDownRight, 
  User, 
  Phone, 
  Banknote, 
  Building, 
  X, 
  Receipt,
  RotateCcw,
  UserPlus,
  Building2
} from 'lucide-react';
import { api, type PartnerProfile, type ShiftInfo } from '../../services/api';
import { QuickCustomerModal } from '../pos/QuickCustomerModal';
import { SupplierDebtView } from './SupplierDebtView';

interface CustomerDebtTabProps {
  currentShift: ShiftInfo | null;
}

export const CustomerDebtTab: React.FC<CustomerDebtTabProps> = ({ currentShift }) => {
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'HAS_DEBT' | 'OVER_LIMIT'>('HAS_DEBT');
  const [debtSubTab, setDebtSubTab] = useState<'CUSTOMER_AR' | 'SUPPLIER_AP'>('CUSTOMER_AR');
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);

  // State Modal Thu Nợ F3
  const [selectedPartner, setSelectedPartner] = useState<PartnerProfile | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [collectNote, setCollectNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mở modal thu nợ cho 1 khách hàng cụ thể
  const openCollectModal = useCallback((partner: PartnerProfile) => {
    setSelectedPartner(partner);
    setCollectAmount(Number(partner.current_debt) || 0);
    setPaymentMethod('CASH');
    setCollectNote(`Thu tiền nợ gối đầu của ${partner.name}`);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  // Đóng modal thu nợ
  const closeCollectModal = useCallback(() => {
    setSelectedPartner(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  // Tải danh sách khách hàng & sổ nợ
  const loadPartners = async () => {
    try {
      setLoading(true);
      const res = await api.getPartners();
      if (res.success) {
        setPartners(res.data || []);
      }
    } catch (err: any) {
      console.error('🔥 [Load Partners Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchInitial = async () => {
      try {
        const res = await api.getPartners();
        if (isMounted && res.success) {
          setPartners(res.data || []);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('🔥 [Load Partners Error]:', err);
        if (isMounted) setLoading(false);
      }
    };
    fetchInitial();
    return () => { isMounted = false; };
  }, []);

  // Lắng nghe phím tắt F3 để mở nhanh Thu nợ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        // Tìm khách hàng đầu tiên đang có nợ để mở thu nợ
        const firstDebtPartner = partners.find(p => Number(p.current_debt) > 0);
        if (firstDebtPartner) {
          openCollectModal(firstDebtPartner);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [partners, openCollectModal]);

  // Xử lý gửi phiếu thu nợ
  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (collectAmount <= 0) {
      setErrorMessage('Số tiền thu nợ phải lớn hơn 0 đồng.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.collectDebt({
        partner_id: selectedPartner.id,
        shift_id: currentShift?.id,
        amount: collectAmount,
        payment_method: paymentMethod,
        note: collectNote
      });

      if (res.success) {
        setSuccessMessage(`Đã thu ${collectAmount.toLocaleString('vi-VN')}đ thành công! Cấn trừ trực tiếp sổ nợ.`);
        // Reload danh sách nợ mới
        await loadPartners();
        setTimeout(() => {
          closeCollectModal();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Thu nợ thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Thống kê tổng hợp số liệu
  const totalDebt = partners.reduce((sum, p) => sum + (Number(p.current_debt) || 0), 0);
  const debtPartnersCount = partners.filter(p => Number(p.current_debt) > 0).length;
  const overLimitCount = partners.filter(p => {
    const limit = Number(p.debt_limit) || 0;
    const debt = Number(p.current_debt) || 0;
    return limit > 0 && debt >= limit;
  }).length;

  // Lọc dữ liệu theo tìm kiếm & tab lọc
  const filteredPartners = partners.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(term) ||
      (p.phone && p.phone.includes(term)) ||
      (p.code && p.code.toLowerCase().includes(term));

    if (!matchSearch) return false;

    const debt = Number(p.current_debt) || 0;
    const limit = Number(p.debt_limit) || 0;

    if (filterType === 'HAS_DEBT') return debt > 0;
    if (filterType === 'OVER_LIMIT') return limit > 0 && debt >= limit;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 0. THANH ĐIỀU HƯỚNG CÔNG NỢ 2 CHIỀU (TRỤ CỘT 9: AR & AP) */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => setDebtSubTab('CUSTOMER_AR')}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: debtSubTab === 'CUSTOMER_AR' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
            background: debtSubTab === 'CUSTOMER_AR' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: debtSubTab === 'CUSTOMER_AR' ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <User size={16} /> Công Nợ Khách Hàng (Phải Thu - AR)
        </button>

        <button
          type="button"
          onClick={() => setDebtSubTab('SUPPLIER_AP')}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: debtSubTab === 'SUPPLIER_AP' ? '1px solid #f87171' : '1px solid var(--border-subtle)',
            background: debtSubTab === 'SUPPLIER_AP' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: debtSubTab === 'SUPPLIER_AP' ? '#f87171' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={16} /> Công Nợ Nhà Cung Cấp (Phải Trả - AP)
        </button>
      </div>

      {debtSubTab === 'SUPPLIER_AP' ? (
        <SupplierDebtView currentShift={currentShift} />
      ) : (
        <>
          {/* 1. KHỐI TỔNG QUAN BENTO 3 Ô THỐNG KÊ CÔNG NỢ KHÁCH HÀNG */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Ô 1: Tổng nợ toàn chi nhánh */}
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Wallet size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Tổng Nợ Đang Cho Gối Đầu
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
              {totalDebt.toLocaleString('vi-VN')} <span style={{ fontSize: 15, fontWeight: 500 }}>đ</span>
            </div>
          </div>
        </div>

        {/* Ô 2: Số khách hàng đang nợ */}
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Khách Đang Phát Sinh Nợ
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
              {debtPartnersCount} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/ {partners.length} khách</span>
            </div>
          </div>
        </div>

        {/* Ô 3: Cảnh báo vượt / chạm trần hạn mức */}
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: overLimitCount > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: overLimitCount > 0 ? '#fb7185' : '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Cảnh Báo Chạm Trần Nợ
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: overLimitCount > 0 ? '#fb7185' : '#34d399', marginTop: 2 }}>
              {overLimitCount} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>khách nguy cơ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC (CHUẨN 42PX CAO CẤP) */}
      <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 480 }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <Search 
              size={17} 
              color="var(--text-muted)" 
              style={{ position: 'absolute', left: 14, pointerEvents: 'none' }} 
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên đối tác, SĐT hoặc mã khách..."
              className="search-input"
              style={{
                width: '100%',
                height: 42,
                paddingLeft: 42,
                paddingRight: searchTerm ? 38 : 14,
                fontSize: 13,
                borderRadius: 10
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4
                }}
                title="Xóa tìm kiếm"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button 
            onClick={loadPartners} 
            className="btn-action" 
            title="Tải lại danh sách"
            style={{ height: 42, padding: '0 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}
          >
            <RotateCcw size={14} /> Làm mới
          </button>
          <button 
            onClick={() => setIsQuickCustomerOpen(true)} 
            className="btn-primary" 
            style={{ 
              height: 42,
              padding: '0 16px', 
              borderRadius: 10,
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              fontSize: 13, 
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
          >
            <UserPlus size={15} /> + Khách Mới
          </button>
        </div>

        {/* Tab Lọc */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setFilterType('HAS_DEBT')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: filterType === 'HAS_DEBT' ? 'var(--primary)' : 'transparent',
              color: filterType === 'HAS_DEBT' ? '#ffffff' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Đang Có Nợ ({debtPartnersCount})
          </button>
          <button
            onClick={() => setFilterType('OVER_LIMIT')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: filterType === 'OVER_LIMIT' ? '#f43f5e' : 'transparent',
              color: filterType === 'OVER_LIMIT' ? '#ffffff' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Vượt Hạn Mức ({overLimitCount})
          </button>
          <button
            onClick={() => setFilterType('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: filterType === 'ALL' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: filterType === 'ALL' ? '#ffffff' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Tất Cả ({partners.length})
          </button>
        </div>
      </div>

      {/* 3. BẢNG DANH SÁCH ĐỐI TÁC & CÔNG NỢ */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Đang tải dữ liệu sổ nợ khách hàng...
          </div>
        ) : filteredPartners.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Không tìm thấy đối tác nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600 }}>Mã & Tên Đối Tác</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600 }}>Số Điện Thoại</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600 }}>Nhóm Giá</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right' }}>Nợ Hiện Tại</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right' }}>Hạn Mức Nợ</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map(p => {
                  const debt = Number(p.current_debt) || 0;
                  const limit = Number(p.debt_limit) || 0;
                  const isOver = limit > 0 && debt >= limit;

                  return (
                    <tr 
                      key={p.id}
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Tên & Mã */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.code}</div>
                      </td>

                      {/* SĐT */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={13} color="var(--text-dim)" />
                          <span>{p.phone || 'Chưa có SĐT'}</span>
                        </div>
                      </td>

                      {/* Nhóm Giá */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: p.price_group === 'CONTRACTOR' 
                            ? 'rgba(245, 158, 11, 0.15)' 
                            : p.price_group === 'WHOLESALE' 
                            ? 'rgba(56, 189, 248, 0.15)' 
                            : 'rgba(255, 255, 255, 0.05)',
                          color: p.price_group === 'CONTRACTOR' 
                            ? '#fbbf24' 
                            : p.price_group === 'WHOLESALE' 
                            ? '#38bdf8' 
                            : 'var(--text-muted)'
                        }}>
                          {p.price_group === 'CONTRACTOR' ? 'Thầu Thợ' : p.price_group === 'WHOLESALE' ? 'Đại Lý' : 'Khách Lẻ'}
                        </span>
                      </td>

                      {/* Nợ hiện tại */}
                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: debt > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                        {debt > 0 ? `${debt.toLocaleString('vi-VN')}đ` : '0đ'}
                      </td>

                      {/* Hạn mức nợ */}
                      <td style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {limit > 0 ? `${limit.toLocaleString('vi-VN')}đ` : 'Không giới hạn'}
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {isOver ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fb7185', background: 'rgba(244, 63, 94, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                            Vượt Hạn Mức
                          </span>
                        ) : debt > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                            Đang Nợ
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                            Đủ Tiền
                          </span>
                        )}
                      </td>

                      {/* Nút Thu Nợ F3 */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => openCollectModal(p)}
                          disabled={debt <= 0}
                          style={{
                            padding: '6px 14px',
                            background: debt > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                            border: debt > 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                            borderRadius: 6,
                            color: debt > 0 ? '#34d399' : 'var(--text-dim)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: debt > 0 ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Receipt size={13} /> Thu Nợ (F3)
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL THU NỢ F3 NGUYÊN TỬ */}
      {selectedPartner && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* Header Modal */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ArrowDownRight size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thu Nợ Khách Hàng (F3)</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Đối tác: <strong style={{ color: '#f8fafc' }}>{selectedPartner.name}</strong> ({selectedPartner.code})
                  </p>
                </div>
              </div>
              <button onClick={closeCollectModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Form Thu Nợ */}
            <form onSubmit={handleCollectSubmit} style={{ padding: 20 }}>
              {/* Thông báo lỗi / thành công */}
              {errorMessage && (
                <div style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  color: '#fb7185',
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertTriangle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <CheckCircle2 size={16} />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Tóm tắt nợ hiện tại */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Số Nợ Hiện Tại:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>
                    {Number(selectedPartner.current_debt).toLocaleString('vi-VN')}đ
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Hạn Mức:</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {Number(selectedPartner.debt_limit) > 0 ? `${Number(selectedPartner.debt_limit).toLocaleString('vi-VN')}đ` : 'Không giới hạn'}
                  </div>
                </div>
              </div>

              {/* Ô nhập số tiền thu */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Số tiền thu (VNĐ):
                </label>
                <input
                  type="number"
                  min="1000"
                  max={Number(selectedPartner.current_debt)}
                  step="1000"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    color: 'var(--text-main)',
                    fontSize: 16,
                    fontWeight: 800
                  }}
                />

                {/* Các nút chọn nhanh */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(Number(selectedPartner.current_debt))}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 6,
                      color: '#34d399',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Thu hết 100% ({Number(selectedPartner.current_debt).toLocaleString('vi-VN')}đ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(Math.round(Number(selectedPartner.current_debt) / 2))}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: 'var(--text-muted)',
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    Thu 50%
                  </button>
                </div>
              </div>

              {/* Phương thức thanh toán */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Phương thức thanh toán:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: paymentMethod === 'CASH' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      background: paymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: paymentMethod === 'CASH' ? '#34d399' : 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Banknote size={15} /> Tiền Mặt (Vào Két)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: paymentMethod === 'BANK_TRANSFER' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                      background: paymentMethod === 'BANK_TRANSFER' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: paymentMethod === 'BANK_TRANSFER' ? '#38bdf8' : 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Building size={15} /> Chuyển Khoản NH
                  </button>
                </div>

                {paymentMethod === 'CASH' && currentShift && (
                  <div style={{ fontSize: 11, color: '#34d399', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> Số tiền thu sẽ được tự động cộng vào ca trực của <strong>{currentShift.staff_name}</strong>.
                  </div>
                )}
              </div>

              {/* Ghi chú */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Ghi chú phiếu thu:
                </label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  placeholder="VD: Khách chuyển khoản VCB, trả bớt đợt 1..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    color: 'var(--text-main)',
                    fontSize: 13
                  }}
                />
              </div>

              {/* Nút gửi */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? 'Đang hạch toán...' : 'Xác Nhận Thu Nợ & In Phiếu Thu (F3)'}
              </button>
            </form>
          </div>
        </div>
      )}

        {/* Modal Thêm Nhanh Khách Hàng */}
        <QuickCustomerModal
          isOpen={isQuickCustomerOpen}
          onClose={() => setIsQuickCustomerOpen(false)}
          onSuccess={(newCustomer) => {
            setPartners(prev => [newCustomer, ...prev]);
          }}
        />
      </>
      )}
    </div>
  );
};
