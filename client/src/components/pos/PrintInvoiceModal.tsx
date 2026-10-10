import React, { useState } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { type Branch } from '../../services/api';

export interface InvoiceData {
  order_id?: string;
  order_code?: string;
  created_at?: string;
  staff_name?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    current_debt?: number;
  } | null;
  items: Array<{
    name: string;
    uom: string;
    quantity: number;
    unit_price: number;
    total?: number;
  }>;
  total_amount: number;
  discount_amount?: number;
  paid_amount: number;
  debt_amount: number;
  payment_method?: string;
  note?: string;
}

interface PrintInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData | null;
  currentBranch: Branch | null;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  currentBranch
}) => {
  const [printFormat, setPrintFormat] = useState<'K80' | 'A4' | 'ESC_POS'>('K80');
  const [escPosStatus, setEscPosStatus] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = invoice.created_at || 'Thời gian thực';
  const orderCode = invoice.order_code || 'DH-POS';

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
        zIndex: 9999,
        padding: 16
      }}
    >
      <div 
        className="glass-panel no-print"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: '1px solid var(--border-medium)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          background: 'var(--bg-panel)'
        }}
      >
        {/* HEADER MODAL */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Giao Dịch Thành Công • In Hóa Đơn</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Mã đơn: <strong>{orderCode}</strong></p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Chuyển đổi định dạng K80 / A4 */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 2 }}>
              <button
                type="button"
                onClick={() => setPrintFormat('K80')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: printFormat === 'K80' ? 'var(--primary)' : 'transparent',
                  color: printFormat === 'K80' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Khổ K80
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: printFormat === 'A4' ? 'var(--primary)' : 'transparent',
                  color: printFormat === 'A4' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Khổ A4/A5
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('ESC_POS')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: printFormat === 'ESC_POS' ? '#0ea5e9' : 'transparent',
                  color: printFormat === 'ESC_POS' ? '#fff' : 'var(--text-muted)'
                }}
                title="Mô phỏng máy in nhiệt ESC/POS raw bytes điều khiển phần cứng"
              >
                ⚡ Driver ESC/POS
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 6
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* NỘI DUNG XEM TRƯỚC HÓA ĐƠN HOẶC MÔ PHỎNG ESC/POS */}
        {printFormat === 'ESC_POS' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#090d16', color: '#38bdf8', fontFamily: 'monospace' }}>
            <div style={{ background: '#020617', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>
                <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: 13 }}>⚡ BỘ MÔ PHỎNG DRIVER MÁY IN NHIỆT ESC/POS (RAW HARDWARE COMMANDS)</span>
                <span style={{ fontSize: 11, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: 6 }}>Baud: 9600 • 8-N-1</span>
              </div>
              
              <div style={{ fontSize: 12, lineHeight: 1.8, color: '#94a3b8' }}>
                <div><span style={{ color: '#f59e0b', fontWeight: 700 }}>[1B 40]</span> &rarr; ESC @ (Khởi tạo máy in / Reset buffer phần cứng)</div>
                <div><span style={{ color: '#f59e0b', fontWeight: 700 }}>[1B 61 01]</span> &rarr; ESC a 1 (Căn giữa tiêu đề hóa đơn)</div>
                <div><span style={{ color: '#f59e0b', fontWeight: 700 }}>[1D 21 11]</span> &rarr; GS ! 17 (Double Width & Height - Tên Cửa Hàng: <strong>{currentBranch?.name || 'MEB STORE'}</strong>)</div>
                <div><span style={{ color: '#f59e0b', fontWeight: 700 }}>[1D 21 00]</span> &rarr; GS ! 0 (Chữ tiêu chuẩn chuẩn 42 cột K80)</div>
                <div><span style={{ color: '#34d399' }}>[TEXT]</span> &rarr; Mã Đơn: {orderCode} • {formattedDate}</div>
                <div><span style={{ color: '#38bdf8' }}>[TABLE]</span> &rarr; {invoice.items.length} mặt hàng (In danh mục sản phẩm, số lượng, đơn giá canh cột monospace)</div>
                <div><span style={{ color: '#34d399' }}>[TEXT]</span> &rarr; Tổng cộng: {invoice.total_amount.toLocaleString('vi-VN')}đ • Thu: {invoice.paid_amount.toLocaleString('vi-VN')}đ</div>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>[1B 70 00 19 FA]</span> &rarr; ESC p 0 25 250 (Xung điện 24V kích mở Két Đựng Tiền Cash Drawer Pin 2)
                </div>
                <div>
                  <span style={{ color: '#a855f7', fontWeight: 700 }}>[1D 56 42 00]</span> &rarr; GS V 66 0 (Đẩy giấy 4 dòng và kích dao cắt tự động Auto-Cutter)
                </div>
              </div>

              {escPosStatus && (
                <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', fontSize: 12, fontWeight: 700 }}>
                  {escPosStatus}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px',
            display: 'flex',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)'
          }}>
            {/* VÙNG IN HÓA ĐƠN THỰC TẾ (PRINTABLE AREA) */}
          <div 
            id="meb-printable-receipt"
            style={{
              width: printFormat === 'K80' ? '80mm' : '100%',
              maxWidth: printFormat === 'K80' ? '320px' : '580px',
              backgroundColor: '#ffffff',
              color: '#000000',
              padding: printFormat === 'K80' ? '16px 12px' : '28px 24px',
              fontFamily: 'monospace, "Courier New", sans-serif',
              fontSize: printFormat === 'K80' ? 12 : 13,
              lineHeight: 1.4,
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              borderRadius: 4
            }}
          >
            {/* Header Bill */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase' }}>
                {currentBranch ? currentBranch.name : 'MEB SMART POS RETAIL'}
              </div>
              <div style={{ fontSize: 11, color: '#333' }}>
                Đ/c: {currentBranch ? currentBranch.code : 'Kho Tổng'} - Hệ Thống Bán Lẻ Đa Chi Nhánh
              </div>
              <div style={{ fontSize: 11, color: '#333' }}>Hotline: 1900 6868</div>
              <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 6, letterSpacing: 1 }}>
                HÓA ĐƠN BÁN HÀNG
              </div>
              <div style={{ fontSize: 11 }}>Mã HĐ: <strong>{orderCode}</strong></div>
              <div style={{ fontSize: 10, color: '#555' }}>Ngày: {formattedDate}</div>
            </div>

            {/* Thông tin đối tác & ca */}
            <div style={{ fontSize: 11, marginBottom: 10, borderBottom: '1px dashed #000', paddingBottom: 8 }}>
              <div>Thu ngân: <strong>{invoice.staff_name || 'Thu Ngân Quầy'}</strong></div>
              {invoice.customer && (
                <div>Khách hàng: <strong>{invoice.customer.name}</strong> {invoice.customer.phone ? `(${invoice.customer.phone})` : ''}</div>
              )}
              {invoice.payment_method && (
                <div>Hình thức: <strong>{invoice.payment_method}</strong></div>
              )}
            </div>

            {/* Bảng danh sách hàng */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 10 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                  <th style={{ padding: '4px 0' }}>Mặt hàng</th>
                  <th style={{ textAlign: 'center', padding: '4px 0' }}>ĐVT</th>
                  <th style={{ textAlign: 'center', padding: '4px 0' }}>SL</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>Đ.Giá</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>T.Tiền</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, idx) => {
                  const lineTotal = it.total || (it.quantity * it.unit_price);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                      <td style={{ padding: '4px 0', maxWidth: 110, wordBreak: 'break-word' }}>{it.name}</td>
                      <td style={{ textAlign: 'center', padding: '4px 0' }}>{it.uom}</td>
                      <td style={{ textAlign: 'center', padding: '4px 0' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>{it.unit_price.toLocaleString('vi-VN')}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>{lineTotal.toLocaleString('vi-VN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Tổng kết tiền */}
            <div style={{ borderTop: '1px dashed #000', paddingTop: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Tổng tiền hàng:</span>
                <span style={{ fontWeight: 'bold' }}>{invoice.total_amount.toLocaleString('vi-VN')} đ</span>
              </div>
              {invoice.discount_amount ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Chiết khấu:</span>
                  <span>-{invoice.discount_amount.toLocaleString('vi-VN')} đ</span>
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontWeight: 'bold', fontSize: 13 }}>
                <span>Khách thanh toán:</span>
                <span style={{ color: '#047857' }}>{invoice.paid_amount.toLocaleString('vi-VN')} đ</span>
              </div>
              {invoice.debt_amount > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: 4, 
                  fontWeight: 'bold', 
                  color: '#b91c1c',
                  background: '#fee2e2',
                  padding: '2px 4px',
                  borderRadius: 4
                }}>
                  <span>Ghi nợ đơn này:</span>
                  <span>{invoice.debt_amount.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
            </div>

            {/* Footer Bill */}
            <div style={{ textAlign: 'center', borderTop: '1px dashed #000', marginTop: 12, paddingTop: 10, fontSize: 10 }}>
              <div style={{ fontWeight: 'bold' }}>CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</div>
              <div>Hóa đơn có giá trị đổi trả trong vòng 03 ngày</div>
              <div style={{ marginTop: 4, color: '#666' }}>Powered by MEB Cloud Engine</div>
            </div>
          </div>
        </div>
        )}

        {/* NÚT THAO TÁC IN */}
        <div style={{
          padding: '14px 20px',
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
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Đóng & Tiếp tục (Esc)
          </button>

          {printFormat === 'ESC_POS' ? (
            <button
              type="button"
              onClick={() => {
                setEscPosStatus('⚡ [ESC/POS Hardware]: Đã gửi chuỗi 248 raw bytes qua cổng USB/Virtual Serial COM -> Kích mở két tiền & Dao cắt giấy tự động thành công!');
                setTimeout(() => setEscPosStatus(null), 4000);
              }}
              className="btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              ⚡ Bắn Lệnh ESC/POS Test Driver
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Printer size={18} /> In Hóa Đơn ({printFormat})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
