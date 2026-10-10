import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  User, 
  Wallet, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowDownCircle, 
  ArrowUpCircle,
  PlusCircle,
  Lock,
  Printer
} from 'lucide-react';
import { api, type ShiftInfo, type ShiftSummary } from '../../services/api';
import { branchStore } from '../../services/branchContext';
import { ZReportModal } from './ZReportModal';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShift: ShiftInfo | null;
  onShiftUpdated: (shift: ShiftInfo | null) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  currentShift,
  onShiftUpdated
}) => {
  // State mở ca mới
  const [openStaffName, setOpenStaffName] = useState('Thu Ngân Chính');
  const [openInitialAmount, setOpenInitialAmount] = useState<number>(1000000);

  // Sub-tab cho ca đang mở: 'CLOSE', 'CASH_FLOW', hoặc 'CASH_DROP' (Q13)
  const [shiftTab, setShiftTab] = useState<'CLOSE' | 'CASH_FLOW' | 'CASH_DROP'>('CLOSE');

  // State rút két an toàn Cash Drop (Q13)
  const [dropAmount, setDropAmount] = useState<number>(500000);
  const [dropReceiver, setDropReceiver] = useState<string>('Kế Toán Trưởng');
  const [dropReason, setDropReason] = useState<string>('Rút bớt tiền két nộp về két sắt an toàn');
  const [isSubmittingDrop, setIsSubmittingDrop] = useState(false);

  // State chốt ca
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [actualAmount, setActualAmount] = useState<number>(0);
  const [closeNote, setCloseNote] = useState('');
  const [isZReportOpen, setIsZReportOpen] = useState(false);

  // State thu chi két tiền ngoài đơn
  const [cfType, setCfType] = useState<'IN' | 'OUT'>('IN');
  const [cfAmount, setCfAmount] = useState<number>(200000);
  const [cfCategory, setCfCategory] = useState<string>('CASH_IN');
  const [cfNote, setCfNote] = useState<string>('');
  const [isSubmittingCf, setIsSubmittingCf] = useState(false);

  // Trạng thái xử lý & lỗi
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lắng nghe phím ESC để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tải báo cáo tóm tắt khi modal mở và có ca đang chạy
  useEffect(() => {
    let isMounted = true;
    if (isOpen && currentShift) {
      const fetchSummary = async () => {
        try {
          setIsLoadingSummary(true);
          setErrorMessage(null);
          const res = await api.getShiftSummary(currentShift.id);
          if (isMounted && res.success) {
            setSummary(res.data);
            setActualAmount(Number(res.data.system_cash_amount) || 0);
          }
        } catch (err: any) {
          if (isMounted) {
            setErrorMessage(err.message || 'Không thể tải báo cáo ca trực.');
          }
        } finally {
          if (isMounted) setIsLoadingSummary(false);
        }
      };
      fetchSummary();
    }
    return () => { 
      isMounted = false; 
      if (!currentShift) setSummary(null);
    };
  }, [isOpen, currentShift]);

  if (!isOpen) return null;

  // Xử lý mở ca mới
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!openStaffName.trim()) {
      setErrorMessage('Vui lòng nhập họ tên nhân viên mở ca.');
      return;
    }
    if (openInitialAmount < 0) {
      setErrorMessage('Số tiền két ban đầu không được âm.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.openShift(openStaffName.trim(), openInitialAmount);
      if (res.success) {
        setSuccessMessage(`Đã mở ca thành công cho ${res.data.staff_name}!`);
        onShiftUpdated(res.data);
        setTimeout(() => {
          setSuccessMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Mở ca thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý chốt ca đối soát két
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (actualAmount < 0) {
      setErrorMessage('Số tiền đếm thực tế không được âm.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.closeShift(currentShift.id, actualAmount, closeNote);
      if (res.success) {
        setSuccessMessage('Chốt ca và bàn giao két tiền thành công!');
        onShiftUpdated(null);
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Chốt ca thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý nạp / chi tiền quỹ két ngoài đơn
  const handleRecordCashFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const amountNum = Number(cfAmount);
    if (!amountNum || amountNum <= 0) {
      setErrorMessage('Số tiền thu/chi phải lớn hơn 0.');
      return;
    }

    try {
      setIsSubmittingCf(true);
      const res = await api.recordCashFlow({
        shift_id: currentShift.id,
        type: cfType,
        amount: amountNum,
        category: cfCategory,
        note: cfNote.trim() || undefined
      });

      if (res.success) {
        setSuccessMessage(`Đã ghi sổ ${cfType === 'IN' ? 'Nạp tiền két' : 'Chi tiền quỹ'}: ${amountNum.toLocaleString('vi-VN')}đ`);
        setCfAmount(200000);
        setCfNote('');
        // Tải lại summary của ca để cập nhật tiền mặt hệ thống
        const sumRes = await api.getShiftSummary(currentShift.id);
        if (sumRes.success) {
          setSummary(sumRes.data);
          setActualAmount(Number(sumRes.data.system_cash_amount) || 0);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ghi nhận thu/chi quỹ thất bại.');
    } finally {
      setIsSubmittingCf(false);
    }
  };

  // Xử lý rút két an toàn Cash Drop (Q13)
  const handleCashDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropAmount || dropAmount <= 0) {
      setErrorMessage('Số tiền rút két phải lớn hơn 0');
      return;
    }
    if (!dropReceiver.trim()) {
      setErrorMessage('Vui lòng nhập tên người nhận bàn giao tiền');
      return;
    }

    try {
      setIsSubmittingDrop(true);
      setErrorMessage(null);
      const res = await api.cashDropShift({
        shift_id: currentShift?.id,
        amount: dropAmount,
        reason: dropReason,
        receiver_name: dropReceiver.trim()
      });

      setSuccessMessage(res.message || `Đã rút an toàn ${dropAmount.toLocaleString('vi-VN')}đ về két sắt tổng`);
      if (currentShift?.id) {
        const sumRes = await api.getShiftSummary(currentShift.id);
        if (sumRes.success) {
          setSummary(sumRes.data);
          setActualAmount(Number(sumRes.data.system_cash_amount) || 0);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể thực hiện rút két');
    } finally {
      setIsSubmittingDrop(false);
    }
  };

  // Tính chênh lệch tiền két
  const systemAmount = summary ? Number(summary.system_cash_amount) : 0;
  const difference = actualAmount - systemAmount;

  return (
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
      <div 
        className="glass-panel" 
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header Modal */}
        <div style={{
          padding: '18px 24px',
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
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Quản Lý Ca Thu Ngân & Két Tiền (F8)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {currentShift ? `Ca đang mở: ${currentShift.staff_name}` : 'Chi nhánh hiện chưa mở ca trực'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Thân Modal */}
        <div style={{ padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Thông báo Thành công / Thất bại */}
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

          {/* KỊCH BẢN 1: CHƯA CÓ CA MỞ -> FORM MỞ CA MỚI */}
          {!currentShift ? (
            <form onSubmit={handleOpenShift}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 20,
                fontSize: 13,
                color: '#fbbf24',
                display: 'flex',
                gap: 10,
                alignItems: 'center'
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  Bắt đầu phiên bán hàng mới. Vui lòng kiểm đếm tiền thối ban đầu trong két tiền trước khi nhận ca.
                </span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Họ tên nhân viên phụ trách ca:
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input
                    type="text"
                    value={openStaffName}
                    onChange={(e) => setOpenStaffName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: 'var(--text-main)',
                      fontSize: 14
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Tiền mặt đầu ca (Tiền thối sẵn trong két):
                </label>
                <div style={{ position: 'relative' }}>
                  <Wallet size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={openInitialAmount}
                    onChange={(e) => setOpenInitialAmount(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: 'var(--text-main)',
                      fontSize: 14,
                      fontWeight: 700
                    }}
                  />
                </div>
                {/* Các nút chọn nhanh */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {[500000, 1000000, 2000000, 3000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOpenInitialAmount(val)}
                      style={{
                        padding: '4px 10px',
                        background: openInitialAmount === val ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: openInitialAmount === val ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: openInitialAmount === val ? '#38bdf8' : 'var(--text-muted)',
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      {val.toLocaleString('vi-VN')}đ
                    </button>
                  ))}
                </div>
              </div>

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
                {isSubmitting ? 'Đang mở ca...' : 'Xác Nhận Mở Ca Bán Hàng'}
              </button>
            </form>
          ) : (
            /* KỊCH BẢN 2: ĐÃ CÓ CA ĐANG MỞ -> BÁO CÁO & CHỐT KÉT F8 */
            <div>
              {/* THANH CHUYỂN TAB CON TRONG CA ĐANG MỞ */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setShiftTab('CLOSE')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: shiftTab === 'CLOSE' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: shiftTab === 'CLOSE' ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Lock size={15} /> Đối Soát & Chốt Ca (F8)
                </button>
                <button
                  type="button"
                  onClick={() => setShiftTab('CASH_FLOW')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: shiftTab === 'CASH_FLOW' ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                    color: shiftTab === 'CASH_FLOW' ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <PlusCircle size={15} /> Thu / Chi Quỹ Két
                </button>
                <button
                  type="button"
                  onClick={() => setShiftTab('CASH_DROP')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: shiftTab === 'CASH_DROP' ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                    color: shiftTab === 'CASH_DROP' ? '#000000' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <ArrowDownCircle size={15} /> Rút Két (Cash Drop)
                </button>
              </div>

              {/* Tóm tắt ca hiện tại */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '14px 18px',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#34d399',
                      boxShadow: '0 0 8px #34d399'
                    }} />
                    <strong style={{ fontSize: 14, color: '#f8fafc' }}>{currentShift.staff_name}</strong>
                  </div>
                  <span style={{
                    fontSize: 11,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontWeight: 600
                  }}>
                    Đang mở
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Mở lúc: {new Date(currentShift.opened_at).toLocaleString('vi-VN')}
                </div>
              </div>

              {/* 4 Ô BENTO TÓM TẮT DÒNG TIỀN MẶT */}
              {isLoadingSummary ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  Đang tổng hợp dữ liệu két tiền...
                </div>
              ) : summary ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  marginBottom: 20
                }}>
                  <div style={{ background: '#090d16', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Wallet size={13} color="#38bdf8" /> Tiền đầu ca:
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                      {Number(summary.initial_amount).toLocaleString('vi-VN')}đ
                    </div>
                  </div>

                  <div style={{ background: '#090d16', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DollarSign size={13} color="#34d399" /> Doanh thu mặt:
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399' }}>
                      +{Number(summary.total_cash_sales).toLocaleString('vi-VN')}đ
                    </div>
                  </div>

                  <div style={{ background: '#090d16', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowDownCircle size={13} color="#fbbf24" /> Thu nợ mặt:
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>
                      +{Number(summary.total_debt_collected_cash).toLocaleString('vi-VN')}đ
                    </div>
                  </div>

                  <div style={{ background: '#090d16', padding: 12, borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <div style={{ fontSize: 11, color: '#38bdf8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={13} /> Két lý thuyết:
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8' }}>
                      {Number(summary.system_cash_amount).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>
              ) : null}

              {/* FORM CHỐT CA HOẶC FORM THU CHI QUỸ */}
              {shiftTab === 'CLOSE' ? (
                <form onSubmit={handleCloseShift}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Số tiền đếm thực tế trong két (VNĐ):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={actualAmount}
                      onChange={(e) => setActualAmount(Number(e.target.value))}
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

                    {/* Thanh hiển thị chênh lệch thừa/thiếu */}
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: difference === 0 
                        ? 'rgba(16, 185, 129, 0.1)' 
                        : difference > 0 
                        ? 'rgba(245, 158, 11, 0.1)' 
                        : 'rgba(244, 63, 94, 0.1)',
                      border: difference === 0 
                        ? '1px solid rgba(16, 185, 129, 0.3)' 
                        : difference > 0 
                        ? '1px solid rgba(245, 158, 11, 0.3)' 
                        : '1px solid rgba(244, 63, 94, 0.3)',
                      color: difference === 0 ? '#34d399' : difference > 0 ? '#fbbf24' : '#fb7185'
                    }}>
                      <span>Chênh lệch đối soát:</span>
                      <span>
                        {difference === 0 
                          ? 'Khớp 100% két tiền (0đ)' 
                          : difference > 0 
                          ? `Dư két: +${difference.toLocaleString('vi-VN')}đ` 
                          : `Thất thoát / Thiếu két: ${difference.toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Ghi chú bàn giao:
                    </label>
                    <textarea
                      value={closeNote}
                      onChange={(e) => setCloseNote(e.target.value)}
                      placeholder="VD: Tiền chẵn gửi két sắt, tiền lẻ 500k để lại ca sau..."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        color: 'var(--text-main)',
                        fontSize: 13,
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setIsZReportOpen(true)}
                      style={{
                        flex: 1,
                        padding: '12px 14px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        borderRadius: 8,
                        color: '#38bdf8',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                      title="Xem trước & In phiếu Z-Report chuẩn K80"
                    >
                      <Printer size={16} /> In Z-Report
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        flex: 1.4,
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: isSubmitting ? 0.7 : 1
                      }}
                    >
                      <Lock size={16} />
                      {isSubmitting ? 'Đang chốt...' : 'Chốt Ca & Bàn Giao Két'}
                    </button>
                  </div>
                </form>
              ) : shiftTab === 'CASH_FLOW' ? (
                /* FORM THU / CHI TIỀN KÉT NGOÀI ĐƠN */
                <form onSubmit={handleRecordCashFlow}>
                  <div style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 16,
                    fontSize: 13,
                    color: '#38bdf8'
                  }}>
                    Ghi nhận các khoản nạp thêm tiền lẻ hoặc chi phí phát sinh tại quầy (mua đá, bao bì, đổ xăng...) để số liệu két khớp 100%.
                  </div>

                  {/* Chọn loại Thu (IN) hoặc Chi (OUT) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <button
                      type="button"
                      onClick={() => { setCfType('IN'); setCfCategory('CASH_IN'); }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: cfType === 'IN' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                        background: cfType === 'IN' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: cfType === 'IN' ? '#34d399' : 'var(--text-muted)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <ArrowDownCircle size={16} /> Nạp Tiền Két (Thu)
                    </button>

                    <button
                      type="button"
                      onClick={() => { setCfType('OUT'); setCfCategory('EXPENSE'); }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: cfType === 'OUT' ? '2px solid #ef4444' : '1px solid var(--border-subtle)',
                        background: cfType === 'OUT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: cfType === 'OUT' ? '#f87171' : 'var(--text-muted)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <ArrowUpCircle size={16} /> Chi Tiền Quỹ (Chi)
                    </button>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Số tiền giao dịch (VNĐ) <span style={{ color: '#ef4444' }}>*</span>:
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="10000"
                      value={cfAmount}
                      onChange={(e) => setCfAmount(Number(e.target.value))}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        color: cfType === 'IN' ? '#34d399' : '#f87171',
                        fontSize: 16,
                        fontWeight: 800
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Danh mục lý do:
                    </label>
                    <select
                      value={cfCategory}
                      onChange={(e) => setCfCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        color: 'var(--text-main)',
                        fontSize: 13
                      }}
                    >
                      {cfType === 'IN' ? (
                        <>
                          <option value="CASH_IN">Nạp thêm tiền lẻ / Tiền thối bổ sung</option>
                          <option value="CAPITAL_INJECTION">Chủ cửa hàng rót vốn quầy</option>
                          <option value="OTHER_IN">Khoản thu khác</option>
                        </>
                      ) : (
                        <>
                          <option value="SUPPLIES">Mua bao bì, túi xốp, văn phòng phẩm</option>
                          <option value="ICE_WATER">Chi tiền nước đá, phụ phí quầy</option>
                          <option value="UTILITIES">Chi tiền rác, bảo vệ, điện nước</option>
                          <option value="CASH_TRANSFER">Rút tiền mặt gửi về két sắt tổng</option>
                          <option value="OTHER_EXPENSE">Khoản chi khác</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Ghi chú chi tiết:
                    </label>
                    <input
                      type="text"
                      value={cfNote}
                      onChange={(e) => setCfNote(e.target.value)}
                      placeholder="VD: Mua 5 bọc túi xốp 5kg ở tạp hóa kế bên..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        color: 'var(--text-main)',
                        fontSize: 13
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingCf}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: cfType === 'IN'
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isSubmittingCf ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    <CheckCircle2 size={18} />
                    {isSubmittingCf ? 'Đang ghi sổ...' : `Xác Nhận ${cfType === 'IN' ? 'Nạp Tiền' : 'Chi Quỹ'}`}
                  </button>
                </form>
              ) : (
                /* FORM RÚT KÉT AN TOÀN CASH DROP (Q13) */
                <form onSubmit={handleCashDrop}>
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 16,
                    fontSize: 13,
                    color: '#fbbf24'
                  }}>
                    🛡️ <strong>Rút Két An Toàn (Cash Drop):</strong> Chuyển bớt tiền mặt từ ngăn kéo thu ngân nộp về két sắt tổng của công ty để đảm bảo an toàn quầy thu ngân.
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Số tiền rút nộp về két tổng:
                    </label>
                    <div style={{ position: 'relative' }}>
                      <DollarSign size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 12 }} />
                      <input
                        type="number"
                        min="10000"
                        step="10000"
                        value={dropAmount}
                        onChange={(e) => setDropAmount(Number(e.target.value))}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 38px',
                          background: 'var(--surface-sunken)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          color: 'var(--text-main)',
                          fontSize: 16,
                          fontWeight: 700
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Người nhận tiền bàn giao (Kế toán / Quản lý ca):
                    </label>
                    <input
                      type="text"
                      value={dropReceiver}
                      onChange={(e) => setDropReceiver(e.target.value)}
                      placeholder="VD: Kế Toán Trưởng Minh Anh"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        color: 'var(--text-main)',
                        fontSize: 13
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Lý do rút két:
                    </label>
                    <input
                      type="text"
                      value={dropReason}
                      onChange={(e) => setDropReason(e.target.value)}
                      placeholder="VD: Tiền két vượt hạn mức an toàn 5.000.000đ..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        color: 'var(--text-main)',
                        fontSize: 13
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingDrop}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#000000',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isSubmittingDrop ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    <CheckCircle2 size={18} />
                    {isSubmittingDrop ? 'Đang thực hiện rút két...' : `Xác Nhận Rút ${dropAmount.toLocaleString('vi-VN')}đ Về Két Tổng`}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL BÁO CÁO KẾT CA Z-REPORT (A2) */}
      <ZReportModal
        isOpen={isZReportOpen}
        onClose={() => setIsZReportOpen(false)}
        branch={branchStore.getCurrentBranch()}
        shift={currentShift}
        summary={summary}
        actualAmount={actualAmount}
        note={closeNote}
      />
    </div>
  );
};
