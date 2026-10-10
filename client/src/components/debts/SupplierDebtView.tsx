import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Wallet, 
  Search, 
  Banknote, 
  Building, 
  CheckCircle2, 
  AlertCircle, 
  X,
  History,
  Phone
} from 'lucide-react';
import { api, type ShiftInfo } from '../../services/api';

interface SupplierItem {
  id: string;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  tax_code?: string;
  current_debt: number;
  debt_limit: number;
  payment_term_days: number;
}

interface SupplierDebtViewProps {
  currentShift: ShiftInfo | null;
}

export const SupplierDebtView: React.FC<SupplierDebtViewProps> = ({ currentShift: _currentShift }) => {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // State Modal Trả Nợ NCC
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [payNote, setPayNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadSupplierDebts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getSupplierDebts();
      if (res.success) {
        setSuppliers(res.suppliers || []);
        setRecentTransactions(res.recent_transactions || []);
      }
    } catch (err) {
      console.error('🔥 [Supplier Debts Load Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.getSupplierDebts().then(res => {
      if (isMounted && res.success) {
        setSuppliers(res.suppliers || []);
        setRecentTransactions(res.recent_transactions || []);
        setLoading(false);
      }
    }).catch(err => {
      console.error('🔥 [Supplier Debts Load Error]:', err);
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  const openPayModal = (supplier: SupplierItem) => {
    setSelectedSupplier(supplier);
    setPayAmount(Number(supplier.current_debt) || 0);
    setPaymentMethod('BANK_TRANSFER');
    setPayNote(`Thanh toán tiền hàng cho ${supplier.name}`);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const closePayModal = () => {
    setSelectedSupplier(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handlePaySubmit = async () => {
    if (!selectedSupplier) return;
    if (payAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền thanh toán lớn hơn 0');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await api.paySupplierDebt({
        supplier_id: selectedSupplier.id,
        amount: payAmount,
        payment_method: paymentMethod,
        note: payNote
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Thanh toán nợ nhà cung cấp thành công!');
        await loadSupplierDebts();
        setTimeout(() => {
          closePayModal();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi thanh toán nợ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + Number(s.current_debt || 0), 0);
  const debtSuppliersCount = suppliers.filter(s => Number(s.current_debt || 0) > 0).length;

  const filteredSuppliers = suppliers.filter(s => {
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) ||
           s.code.toLowerCase().includes(term) ||
           (s.phone && s.phone.includes(term));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. KHỐI TỔNG QUAN BENTO 3 Ô THỐNG KÊ CÔNG NỢ NCC */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Ô 1: Tổng nợ phải trả NCC */}
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Wallet size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Tổng Nợ Phải Trả Nhà Cung Cấp
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f87171', marginTop: 2 }}>
              {totalSupplierDebt.toLocaleString('vi-VN')} <span style={{ fontSize: 15, fontWeight: 500 }}>đ</span>
            </div>
          </div>
        </div>

        {/* Ô 2: Số nhà cung cấp đang có nợ */}
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
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Nhà Cung Cấp Đang Có Dư Nợ
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
              {debtSuppliersCount} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/ {suppliers.length} đối tác</span>
            </div>
          </div>
        </div>

        {/* Ô 3: Lịch sử giao dịch AP */}
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <History size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Phiếu Thanh Toán Gần Đây
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
              {recentTransactions.length} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>giao dịch</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ TÌM KIẾM */}
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
              placeholder="Tìm theo tên nhà cung cấp, SĐT hoặc mã NCC..."
              className="search-input"
              style={{ width: '100%', height: 42, paddingLeft: 42, paddingRight: 14, fontSize: 13, borderRadius: 10 }}
            />
          </div>
        </div>
      </div>

      {/* 3. BẢNG DANH SÁCH NHÀ CUNG CẤP & CÔNG NỢ */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '14px 18px' }}>Mã & Tên Nhà Cung Cấp</th>
              <th style={{ padding: '14px 18px' }}>Liên Hệ / SĐT</th>
              <th style={{ padding: '14px 18px', textAlign: 'center' }}>Hạn Công Nợ</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Dư Nợ Hiện Tại (AP)</th>
              <th style={{ padding: '14px 18px', textAlign: 'center' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Đang tải dữ liệu công nợ nhà cung cấp...
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Không tìm thấy nhà cung cấp nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredSuppliers.map(s => {
                const hasDebt = Number(s.current_debt || 0) > 0;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{s.code}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                        <Phone size={13} />
                        <span>{s.phone || 'Chưa cập nhật'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                        {s.payment_term_days || 30} ngày
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: 14, 
                        fontWeight: 700, 
                        color: hasDebt ? '#f87171' : '#34d399' 
                      }}>
                        {Number(s.current_debt || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      {hasDebt ? (
                        <button
                          type="button"
                          onClick={() => openPayModal(s)}
                          style={{
                            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: 6,
                            padding: '6px 14px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          💸 Trả Nợ NCC
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Hết nợ</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. MODAL THANH TOÁN NỢ NHÀ CUNG CẤP */}
      {selectedSupplier && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: 520,
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Thanh Toán Nợ Nhà Cung Cấp</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {selectedSupplier.name} ({selectedSupplier.code})
                  </p>
                </div>
              </div>
              <button onClick={closePayModal} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <CheckCircle2 size={16} />
                {successMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dư nợ hiện tại cần trả:</span>
              <strong style={{ fontSize: 16, color: '#f87171' }}>{Number(selectedSupplier.current_debt || 0).toLocaleString('vi-VN')}đ</strong>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Số Tiền Thanh Toán (VNĐ):
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={payAmount || ''}
                onChange={e => setPayAmount(Math.max(0, Number(e.target.value)))}
                className="search-input"
                style={{ width: '100%', height: 42, fontSize: 16, fontWeight: 700, color: '#38bdf8', padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Phương Thức Chi Tiền:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  style={{
                    padding: '10px',
                    borderRadius: 8,
                    border: paymentMethod === 'BANK_TRANSFER' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                    background: paymentMethod === 'BANK_TRANSFER' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: paymentMethod === 'BANK_TRANSFER' ? '#38bdf8' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Building size={16} /> Chuyển Khoản
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  style={{
                    padding: '10px',
                    borderRadius: 8,
                    border: paymentMethod === 'CASH' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                    background: paymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: paymentMethod === 'CASH' ? '#34d399' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Banknote size={16} /> Tiền Mặt
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Ghi Chú Phiếu Chi:
              </label>
              <input
                type="text"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder="Nội dung thanh toán nợ NCC..."
                className="search-input"
                style={{ width: '100%', height: 38, fontSize: 13, padding: '0 12px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button onClick={closePayModal} className="btn-action" style={{ padding: '8px 16px', fontSize: 13 }}>
                Hủy Bỏ
              </button>
              <button 
                onClick={handlePaySubmit}
                disabled={isSubmitting || payAmount <= 0}
                className="btn-primary"
                style={{ padding: '8px 20px', fontWeight: 700, fontSize: 13 }}
              >
                {isSubmitting ? 'Đang ghi nhận...' : 'XÁC NHẬN CHI TIỀN TRẢ NỢ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SupplierDebtView;
