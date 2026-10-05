import React from 'react';
import type { BranchRecord } from '../types';
import { 
  ShoppingCart, 
  PackagePlus, 
  Truck, 
  Send, 
  CreditCard, 
  ClipboardList, 
  ArrowRight,
  Building2
} from 'lucide-react';

interface BranchBentoGridProps {
  activeBranch?: BranchRecord;
  onOpenStudio: () => void;
  onOpenPos: () => void;
}

export const BranchBentoGrid: React.FC<BranchBentoGridProps> = ({
  activeBranch,
  onOpenStudio,
  onOpenPos
}) => {
  return (
    <div style={{ padding: '24px 32px' }}>
      {/* BANNER CHI NHÁNH */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(16, 185, 129, 0.12))', 
          border: '1px solid var(--color-border)', 
          borderRadius: 16, 
          padding: '20px 24px', 
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#3b82f6', color: '#fff' }}>
              CHI NHÁNH: {activeBranch?.code || 'CHƯA CHỌN'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {activeBranch?.address || 'Kho hàng trung tâm'}
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {activeBranch?.name || 'Vui lòng chọn một chi nhánh từ No-Code Studio'}
          </h1>
        </div>

        <button className="btn btn-secondary" onClick={onOpenStudio} style={{ fontSize: 13 }}>
          <Building2 size={15} /> Đổi Chi Nhánh / Quản Trị
        </button>
      </div>

      {/* TIÊU ĐỀ BENTO GRID */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          🏢 BENTO GRID: CÁC Ô CHỨC NĂNG ĐỘC LẬP
        </h2>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Thiết kế tối ưu cho máy bàn văn phòng, thao tác 1 chạm trực tiếp không qua menu rườm rà.
        </span>
      </div>

      {/* 6 Ô CHỨC NĂNG CHUẨN ĐẶC TẢ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Ô 1: BÁN HÀNG & POS */}
        <div 
          onClick={onOpenPos}
          style={{ 
            background: 'var(--color-surface)', 
            border: '2px solid rgba(59, 130, 246, 0.4)', 
            borderRadius: 16, 
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 180,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                Ô 1 • POS BÁN LẺ/SỈ
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px 0' }}>Bán Hàng & POS</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Xuất bán lẻ bì hoặc nguyên thùng. <strong>Tự động kích hoạt rã thùng (INV-04)</strong> khi hết bì lẻ.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3b82f6', fontWeight: 600, marginTop: 14 }}>
            Sẵn sàng mở POS <ArrowRight size={14} />
          </div>
        </div>

        {/* Ô 2: NHẬP HÀNG MỚI */}
        <div 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 16, 
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 180,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PackagePlus size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                Ô 2 • NHẬP KHO
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px 0' }}>Nhập Hàng Từ Nhà Cung Cấp</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Nhập hàng theo đơn vị kiện lớn (Thùng, Bao, Can). Tự động ghi vào thẻ kho bất biến (INV-10).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981', fontWeight: 600, marginTop: 14 }}>
            Mở phiếu nhập <ArrowRight size={14} />
          </div>
        </div>

        {/* Ô 3: HÀNG ĐANG VỀ CHỜ NHẬN (ĐIỀU CHUYỂN 2 PHA) */}
        <div 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 16, 
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 180,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' }}>
                Ô 3 • ĐIỀU CHUYỂN 2 PHA
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px 0' }}>Hàng Đang Về Chờ Nhận</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Hàng đang đi đường trung chuyển (INV-06). Kiểm đếm, xác nhận nhận đủ hoặc ghi nhận hao hụt.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#ea580c', fontWeight: 600, marginTop: 14 }}>
            Kiểm tra chuyến xe <ArrowRight size={14} />
          </div>
        </div>

        {/* Ô 4: CHUYỂN HÀNG ĐI */}
        <div 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 16, 
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 180,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                Ô 4 • XUẤT ĐIỀU CHUYỂN
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px 0' }}>Chuyển Hàng Đi Kho Khác</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Lập lệnh xuất kho đi chi nhánh khác. Kho xuất bị trừ ngay, hàng chuyển sang trạng thái đi đường.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a855f7', fontWeight: 600, marginTop: 14 }}>
            Lập phiếu xuất <ArrowRight size={14} />
          </div>
        </div>

        {/* Ô 5: KHÁCH HÀNG & SỔ NỢ */}
        <div 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 16, 
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 180,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                Ô 5 • SỔ NỢ & HẠN MỨC
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px 0' }}>Sổ Công Nợ 2 Chiều</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Quản lý nợ gối đầu, thu nợ, cấn trừ hàng trả lại (INV-07), <strong>khóa đơn vượt hạn mức (INV-08)</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#ef4444', fontWeight: 600, marginTop: 14 }}>
            Xem sổ nợ <ArrowRight size={14} />
          </div>
        </div>

        {/* Ô 6: THẺ KHO & KIỂM KÊ */}
        <div 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 16, 
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 180,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
                Ô 6 • AUDIT & BÁO CÁO
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px 0' }}>Thẻ Kho Bất Biến & Báo Cáo</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Nhật ký kiểm toán mọi giao dịch xuất nhập (INV-10). Cấm sửa đè số lượng tồn kho.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0ea5e9', fontWeight: 600, marginTop: 14 }}>
            Kiểm tra sổ thẻ kho <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};
