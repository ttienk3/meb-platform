import React from 'react';
import { Printer, X, ShieldCheck } from 'lucide-react';
import { type Branch, type ShiftSummary, type ShiftInfo } from '../../services/api';

interface ZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch | null;
  shift: ShiftInfo | null;
  summary: ShiftSummary | null;
  actualAmount: number;
  note?: string;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({
  isOpen,
  onClose,
  branch,
  shift,
  summary,
  actualAmount,
  note
}) => {
  const [printTimestamp] = React.useState(() => new Date());
  const formattedDateTime = React.useMemo(() => printTimestamp.toLocaleString('vi-VN'), [printTimestamp]);
  const formattedCloseTime = React.useMemo(() => printTimestamp.toLocaleTimeString('vi-VN'), [printTimestamp]);
  const formattedOpenTime = React.useMemo(() => shift ? new Date(shift.opened_at).toLocaleTimeString('vi-VN') : '', [shift]);

  const initialAmount = Number(summary?.initial_amount || 0);
  const cashSales = Number(summary?.total_cash_sales || 0);
  const debtCollected = Number(summary?.total_debt_collected_cash || 0);
  const systemTotal = Number(summary?.system_cash_amount || 0);
  const actualCounted = Number(actualAmount || 0);
  const difference = actualCounted - systemTotal;

  if (!isOpen || !shift || !summary) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16
      }}
    >
      <div 
        className="glass-panel no-print"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          background: 'var(--bg-panel)'
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Báo Cáo Kết Ca (Z-Report)
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Chi nhánh: {branch?.name || 'Chi Nhánh'} ({branch?.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* PHIẾU IN K80 Z-REPORT CHUẨN */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#070a12' }}>
          <div 
            id="z-report-printable"
            style={{
              background: '#ffffff',
              color: '#000000',
              fontFamily: "'Courier New', Courier, monospace",
              padding: '20px 16px',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              fontSize: 12,
              lineHeight: 1.4
            }}
          >
            {/* TIÊU ĐỀ DOANH NGHIỆP */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{branch?.name || 'MEB STORE'}</div>
              <div style={{ fontSize: 10, color: '#444' }}>{branch?.address || 'Hệ thống Quản Trị Đa Chi Nhánh MEB'}</div>
              <div style={{ fontSize: 10, color: '#444' }}>Hotline: {branch?.phone || '1900 xxxx'}</div>
              <div style={{ margin: '8px 0', borderBottom: '1px dashed #000' }} />
              <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 1 }}>BÁO CÁO KẾT CA (Z-REPORT)</div>
              <div style={{ fontSize: 11 }}>Mã ca: #{shift.id.slice(0, 8).toUpperCase()}</div>
              <div style={{ fontSize: 10, color: '#555' }}>
                Thời gian: {formattedDateTime}
              </div>
            </div>

            {/* THÔNG TIN CA */}
            <div style={{ marginBottom: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Thu ngân phụ trách:</span>
                <strong>{shift.staff_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Giờ mở ca:</span>
                <span>{formattedOpenTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Giờ kết ca:</span>
                <span>{formattedCloseTime}</span>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #000', margin: '8px 0' }} />

            {/* BẢNG ĐỐI SOÁT DÒNG TIỀN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>1. Tiền mặt đầu ca:</span>
                <strong>{initialAmount.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>2. Doanh thu tiền mặt (+):</span>
                <strong>+{cashSales.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>3. Thu nợ tiền mặt (+):</span>
                <strong>+{debtCollected.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div style={{ borderBottom: '1px dashed #999', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>TỔNG KÉT LÝ THUYẾT:</span>
                <span>{systemTotal.toLocaleString('vi-VN')}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 12 }}>
                <span>TIỀN ĐẾM THỰC TẾ:</span>
                <span>{actualCounted.toLocaleString('vi-VN')}đ</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 900,
                marginTop: 4,
                padding: '4px 6px',
                background: difference === 0 ? '#e6f4ea' : difference > 0 ? '#fef7e0' : '#fce8e6',
                border: '1px solid #ccc'
              }}>
                <span>CHÊNH LỆCH ĐỐI SOÁT:</span>
                <span>
                  {difference === 0 
                    ? '0đ (Khớp 100%)' 
                    : difference > 0 
                    ? `+${difference.toLocaleString('vi-VN')}đ (Dư két)` 
                    : `${difference.toLocaleString('vi-VN')}đ (Thiếu két)`}
                </span>
              </div>
            </div>

            {note && (
              <div style={{ marginTop: 10, fontSize: 10, fontStyle: 'italic', borderTop: '1px dashed #ccc', paddingTop: 6 }}>
                Ghi chú: {note}
              </div>
            )}

            {/* CHỮ KÝ */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', textAlign: 'center', fontSize: 11 }}>
              <div>
                <strong>Thu Ngân Bàn Giao</strong>
                <div style={{ height: 40 }} />
                <div>{shift.staff_name}</div>
              </div>
              <div>
                <strong>Quản Lý Chi Nhánh</strong>
                <div style={{ height: 40 }} />
                <div>(Ký và ghi rõ họ tên)</div>
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 9, color: '#777', borderTop: '1px dashed #ccc', paddingTop: 6 }}>
              MEB SaaS Multi-Branch POS • Hóa đơn Z-Report lưu trữ vĩnh viễn
            </div>
          </div>
        </div>

        {/* FOOTER NÚT BẤM */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-action"
            style={{ padding: '8px 14px', fontSize: 12 }}
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="btn-primary"
            style={{
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <Printer size={16} /> In Báo Cáo Z-Report
          </button>
        </div>
      </div>
    </div>
  );
};
