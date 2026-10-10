import React, { useState, useEffect } from 'react';
import { ShoppingBag, QrCode, Store, Sparkles } from 'lucide-react';

interface DisplayCartItem {
  product_id: string;
  code: string;
  name: string;
  uom: string;
  quantity: number;
  unit_price: number;
}

interface CartSyncData {
  type: string;
  items: DisplayCartItem[];
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  customerName: string;
  paymentMode: string;
  shiftCode: string;
}

export const CustomerDisplayView: React.FC = () => {
  const [data, setData] = useState<CartSyncData>({
    type: 'CART_SYNC',
    items: [],
    subtotalAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    customerName: 'Khách Lẻ',
    paymentMode: 'CASH',
    shiftCode: ''
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('meb_customer_display');
    bc.onmessage = (event) => {
      if (event.data && event.data.type === 'CART_SYNC') {
        setData(event.data);
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  const hasItems = data.items.length > 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top left, #0f172a 0%, #020617 100%)',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 32px',
      boxSizing: 'border-box'
    }}>
      {/* HEADER MÀN HÌNH KHÁCH */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 20,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            padding: 10,
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
          }}>
            <Store size={26} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
              MEB MULTI-BRANCH POS
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
              Màn hình thông tin dành cho Quý Khách Hàng
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '8px 16px',
          borderRadius: 24,
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Sparkles size={16} color="#38bdf8" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
            Khách hàng: <strong style={{ color: '#38bdf8' }}>{data.customerName}</strong>
          </span>
        </div>
      </header>

      {/* BODY CHÍNH: 2 CỘT (DANH SÁCH MÓN & THANH TOÁN) */}
      <div style={{ display: 'flex', flex: 1, gap: 28 }}>
        {/* CỘT TRÁI: DANH SÁCH MÓN ĐÃ QUÉT */}
        <div style={{
          flex: 7,
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 16,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShoppingBag size={20} color="#38bdf8" />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Giỏ Hàng Mua Sắm</h2>
            </div>
            <span style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700
            }}>
              {data.items.length} mặt hàng
            </span>
          </div>

          {!hasItems ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              gap: 12
            }}>
              <ShoppingBag size={48} strokeWidth={1.5} />
              <p style={{ fontSize: 16, margin: 0 }}>Quầy thu ngân đang chuẩn bị đơn hàng cho Quý Khách...</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: 13 }}>
                    <th style={{ padding: '10px 8px', fontWeight: 600 }}>Tên Sản Phẩm</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center' }}>ĐVT</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center' }}>SL</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Đơn Giá</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Thành Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it, idx) => {
                    const lineTotal = it.quantity * it.unit_price;
                    return (
                      <tr key={idx} style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        fontSize: 15
                      }}>
                        <td style={{ padding: '14px 8px', fontWeight: 600, color: '#f8fafc' }}>
                          <div>{it.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{it.code}</div>
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'center', color: '#94a3b8' }}>
                          {it.uom}
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                          {it.quantity}
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'right', color: '#cbd5e1' }}>
                          {it.unit_price.toLocaleString('vi-VN')}đ
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                          {lineTotal.toLocaleString('vi-VN')}đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: TỔNG KẾT THANH TOÁN & VIETQR */}
        <div style={{
          flex: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: 24,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Thanh Toán
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: '#94a3b8' }}>Tiền hàng tạm tính:</span>
              <span style={{ fontWeight: 600 }}>{data.subtotalAmount.toLocaleString('vi-VN')}đ</span>
            </div>

            {data.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#fb7185' }}>
                <span>Chiết khấu ưu đãi:</span>
                <span style={{ fontWeight: 700 }}>-{data.discountAmount.toLocaleString('vi-VN')}đ</span>
              </div>
            )}

            <div style={{
              borderTop: '2px dashed rgba(255, 255, 255, 0.15)',
              paddingTop: 16,
              marginTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline'
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>TỔNG CỘNG:</span>
              <span style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#38bdf8',
                letterSpacing: -1
              }}>
                {data.totalAmount.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* BANNER THANH TOÁN VIETQR */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.5)',
            borderRadius: 16,
            border: '1px solid rgba(56, 189, 248, 0.2)',
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.15)',
              padding: 12,
              borderRadius: 12,
              color: '#38bdf8'
            }}>
              <QrCode size={32} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#f8fafc' }}>
                Hỗ trợ Chuyển khoản VietQR 24/7
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Quét mã tức thì • Miễn phí giao dịch • Tự động khớp lệnh
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 'auto',
            textAlign: 'center',
            padding: 12,
            color: '#64748b',
            fontSize: 12
          }}>
            Cảm ơn Quý Khách đã tin tưởng mua sắm cùng MEB Platform!
          </div>
        </div>
      </div>
    </div>
  );
};
