import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  ArrowRight, 
  Plus, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  X, 
  PackageCheck, 
  Building2
} from 'lucide-react';
import { api, type Branch, type ProductInventory } from '../../services/api';

interface StockTransferTabProps {
  currentBranch: Branch | null;
}

export const StockTransferTab: React.FC<StockTransferTabProps> = ({ currentBranch }) => {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // State Modal Tạo Phiếu
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductInventory[]>([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [transferItems, setTransferItems] = useState<Array<{ product_id: string; uom: string; send_qty: number; available_qty: number }>>([]);
  const [createNote, setCreateNote] = useState('');
  const [dispatchNow, setDispatchNow] = useState(true);

  // State Modal Nhận Hàng / Đối Soát Hao Hụt (Pha 2 - INV-06)
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [receiveItems, setReceiveItems] = useState<Array<{ product_id: string; received_quantity: number; send_qty: number; loss_reason: string }>>([]);
  const [lossResponsibility, setLossResponsibility] = useState<'SHIPPER' | 'SENDER' | 'RECEIVER'>('SHIPPER');

  // Trạng thái xử lý form & thông báo
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tải danh sách phiếu điều chuyển
  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const typeParam = filterType === 'ALL' ? undefined : filterType;
      const statusParam = filterStatus === 'ALL' ? undefined : filterStatus;
      const res = await api.getTransfers(statusParam, typeParam);
      if (res.success) {
        setTransfers(res.data || []);
      }
    } catch (err: any) {
      console.error('🔥 [Load Transfers Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    let isMounted = true;
    const fetchTransfers = async () => {
      try {
        const typeParam = filterType === 'ALL' ? undefined : filterType;
        const statusParam = filterStatus === 'ALL' ? undefined : filterStatus;
        const res = await api.getTransfers(statusParam, typeParam);
        if (isMounted && res.success) {
          setTransfers(res.data || []);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('🔥 [Load Transfers Error]:', err);
        if (isMounted) setLoading(false);
      }
    };
    fetchTransfers();
    return () => { isMounted = false; };
  }, [filterType, filterStatus]);

  // Tải danh sách chi nhánh và sản phẩm khi mở Modal Tạo Phiếu
  const handleOpenCreate = async () => {
    setIsCreateOpen(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setTransferItems([]);
    setCreateNote('');

    try {
      const [branchRes, prodRes] = await Promise.all([
        api.getBranches(),
        api.getProducts()
      ]);

      if (branchRes.success) {
        // Loại trừ chi nhánh hiện tại
        const otherBranches = branchRes.data.filter(b => b.id !== currentBranch?.id);
        setBranches(otherBranches);
        if (otherBranches.length > 0) {
          setTargetBranchId(otherBranches[0].id);
        }
      }

      if (prodRes.success) {
        const inStockProds = prodRes.data.filter(p => Number(p.available_qty) > 0);
        setAvailableProducts(inStockProds);
        if (inStockProds.length > 0) {
          setTransferItems([{
            product_id: inStockProds[0].id,
            uom: inStockProds[0].base_uom,
            send_qty: 1,
            available_qty: Number(inStockProds[0].available_qty)
          }]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi tải dữ liệu chi nhánh/sản phẩm.');
    }
  };

  // Thêm dòng sản phẩm vào phiếu tạo
  const handleAddItemRow = () => {
    if (availableProducts.length === 0) return;
    const first = availableProducts[0];
    setTransferItems(prev => [
      ...prev,
      {
        product_id: first.id,
        uom: first.base_uom,
        send_qty: 1,
        available_qty: Number(first.available_qty)
      }
    ]);
  };

  // Xóa dòng sản phẩm
  const handleRemoveItemRow = (idx: number) => {
    setTransferItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Cập nhật dòng sản phẩm
  const handleUpdateItemRow = (idx: number, field: string, val: any) => {
    setTransferItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'product_id') {
        const prod = availableProducts.find(p => p.id === val);
        return {
          ...item,
          product_id: val,
          uom: prod?.base_uom || item.uom,
          available_qty: Number(prod?.available_qty) || 0,
          send_qty: Math.min(item.send_qty, Number(prod?.available_qty) || 1)
        };
      }
      return { ...item, [field]: val };
    }));
  };

  // Gửi tạo phiếu điều chuyển
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!targetBranchId) {
      setErrorMessage('Vui lòng chọn chi nhánh đích nhận hàng.');
      return;
    }
    if (transferItems.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 mặt hàng điều chuyển.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createTransfer({
        to_branch_id: targetBranchId,
        note: createNote,
        items: transferItems.map(it => ({
          product_id: it.product_id,
          uom: it.uom,
          conversion_rate: 1,
          send_qty: it.send_qty
        }))
      });

      if (res.success) {
        const newTransferId = res.data?.id || res.data?.transfer_id;

        // Nếu người dùng chọn Xuất kho đi đường ngay (Pha 1)
        if (dispatchNow && newTransferId) {
          await api.dispatchTransfer(newTransferId);
          setSuccessMessage('Đã lập phiếu và xuất kho chuyển hàng thành công (Đang đi đường)!');
        } else {
          setSuccessMessage('Đã lập phiếu điều chuyển thành công (Trạng thái DRAFT)!');
        }

        await loadTransfers();
        setTimeout(() => {
          setIsCreateOpen(false);
          setSuccessMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lập phiếu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xuất kho đi đường cho phiếu DRAFT
  const handleDispatchDraft = async (transferId: string) => {
    try {
      setLoading(true);
      const res = await api.dispatchTransfer(transferId);
      if (res.success) {
        await loadTransfers();
      }
    } catch (err: any) {
      alert(`Lỗi xuất kho: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Hủy phiếu điều chuyển & Hoàn trả tồn kho (INV-06 SAGA Compensating Reversal)
  const handleCancelTransfer = async (transferId: string, inTransit: boolean) => {
    const confirmMsg = inTransit
      ? 'Chuyến hàng đang đi đường! Bạn có chắc chắn muốn HỦY CHUYẾN và HOÀN TRẢ toàn bộ tồn kho về Kho xuất (INV-06)?'
      : 'Bạn có chắc chắn muốn hủy phiếu chuyển nháp này?';
    if (!window.confirm(confirmMsg)) return;

    const reason = window.prompt('Nhập lý do hủy điều chuyển:', inTransit ? 'Xe hỏng / Quay đầu về kho xuất' : 'Hủy theo yêu cầu') || 'Hủy chuyến';

    try {
      setLoading(true);
      const res = await api.cancelTransfer(transferId, currentBranch?.name || 'Quản lý', reason);
      if (res.success) {
        alert(res.message || 'Hủy phiếu và hoàn trả tồn kho thành công!');
        await loadTransfers();
      } else {
        alert('Lỗi: ' + (res.message || 'Không thể hủy phiếu'));
      }
    } catch (err: any) {
      alert(`Lỗi hủy chuyến: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Mở modal nhận hàng (Pha 2 - INV-06)
  const handleOpenReceive = async (transfer: any) => {
    setSelectedTransfer(transfer);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.getTransferDetail(transfer.id);
      if (res.success) {
        setSelectedTransfer(res.data);
        const mapped = (res.data.items || []).map((it: any) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          uom: it.uom,
          send_qty: Number(it.send_qty),
          received_quantity: Number(it.send_qty), // Mặc định nhận đủ 100%
          loss_reason: ''
        }));
        setReceiveItems(mapped);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi tải chi tiết phiếu điều chuyển.');
    }
  };

  // Gửi xác nhận nhận hàng & biên bản hao hụt
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setIsSubmitting(true);
      const payloadItems = receiveItems.map(it => ({
        product_id: it.product_id,
        received_quantity: it.received_quantity,
        loss_reason: it.send_qty > it.received_quantity ? it.loss_reason || 'Hao hụt vận chuyển' : null
      }));

      const res = await api.receiveTransfer(
        selectedTransfer.id,
        payloadItems,
        lossResponsibility,
        'Thủ Kho Nhận'
      );

      if (res.success) {
        setSuccessMessage('Xác nhận nhập kho & đối soát hao hụt thành công!');
        await loadTransfers();
        setTimeout(() => {
          setSelectedTransfer(null);
          setSuccessMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Xác nhận nhập kho thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tính số liệu thống kê
  const inTransitCount = transfers.filter(t => t.status === 'DANG_DI_DUONG').length;
  const draftCount = transfers.filter(t => t.status === 'DRAFT').length;
  const completedCount = transfers.filter(t => t.status === 'HOAN_TAT' || t.status === 'COMPLETED' || t.status === 'COMPLETED_WITH_LOSS').length;
  const lossCount = transfers.filter(t => Number(t.total_loss_amount) > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. KHỐI TỔNG QUAN BENTO 4 CHỈ SỐ CẤP CAO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* Ô 1: Đang đi đường */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Truck size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Đang Đi Đường
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
              {inTransitCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>phiếu</span>
            </div>
          </div>
        </div>

        {/* Ô 2: Chờ xuất kho (DRAFT) */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Chờ Xuất Đi (DRAFT)
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
              {draftCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>phiếu</span>
            </div>
          </div>
        </div>

        {/* Ô 3: Đã hoàn tất */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Đã Nhận Đủ Kho
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
              {completedCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>phiếu</span>
            </div>
          </div>
        </div>

        {/* Ô 4: Biên bản hao hụt */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: lossCount > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: lossCount > 0 ? '#fb7185' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Biên Bản Hao Hụt
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: lossCount > 0 ? '#fb7185' : 'var(--text-muted)', marginTop: 2 }}>
              {lossCount} <span style={{ fontSize: 13, fontWeight: 500 }}>vụ đối soát</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ BỘ LỌC & NÚT TẠO PHIẾU */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Lọc Hướng Hàng (Gửi / Nhận) */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 8 }}>
            <button
              onClick={() => setFilterType('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: filterType === 'ALL' ? 'var(--primary)' : 'transparent',
                color: filterType === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Tất Cả Lộ Trình
            </button>
            <button
              onClick={() => setFilterType('OUT')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: filterType === 'OUT' ? '#f59e0b' : 'transparent',
                color: filterType === 'OUT' ? '#ffffff' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hàng Xuất Đi (OUT)
            </button>
            <button
              onClick={() => setFilterType('IN')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: filterType === 'IN' ? '#38bdf8' : 'transparent',
                color: filterType === 'IN' ? '#ffffff' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hàng Chờ Nhận (IN)
            </button>
          </div>

          {/* Lọc Trạng Thái */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              background: '#090d16',
              border: '1px solid var(--border-subtle)',
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            <option value="ALL" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Mọi trạng thái</option>
            <option value="DANG_DI_DUONG" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Đang đi đường</option>
            <option value="DRAFT" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Chờ xuất (DRAFT)</option>
            <option value="COMPLETED" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Đã hoàn tất</option>
            <option value="COMPLETED_WITH_LOSS" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Hoàn tất có hao hụt</option>
          </select>

          <button 
            onClick={loadTransfers} 
            className="btn-action" 
            title="Tải lại danh sách"
            style={{ padding: '7px 10px' }}
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Nút Tạo Phiếu Điều Chuyển Mới */}
        <button
          onClick={handleOpenCreate}
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
          }}
        >
          <Plus size={16} /> Tạo Phiếu Điều Chuyển Mới
        </button>
      </div>

      {/* 3. BẢNG DANH SÁCH PHIẾU ĐIỀU CHUYỂN */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Đang tải danh sách phiếu điều chuyển...
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Không có phiếu điều chuyển nào trong danh mục này.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600 }}>Mã Phiếu</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600 }}>Lộ Trình Điều Chuyển</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600 }}>Thời Gian</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'center' }}>Số Món</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => {
                  const isRecipient = t.to_branch_id === currentBranch?.id;
                  const isSender = t.from_branch_id === currentBranch?.id;
                  const isDraft = t.status === 'DRAFT';
                  const isInTransit = t.status === 'DANG_DI_DUONG';
                  const isCompleted = t.status === 'HOAN_TAT' || t.status === 'COMPLETED' || t.status === 'COMPLETED_WITH_LOSS';
                  const isCancelled = t.status === 'CANCELLED';
                  const hasLoss = Number(t.total_loss_amount) > 0 || t.status === 'COMPLETED_WITH_LOSS';

                  return (
                    <tr 
                      key={t.id}
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Mã Phiếu */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#38bdf8' }}>{t.transfer_code}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{t.note || 'Không có ghi chú'}</div>
                      </td>

                      {/* Lộ trình */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ 
                            fontWeight: 600, 
                            color: isSender ? '#fbbf24' : 'var(--text-main)',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '2px 8px',
                            borderRadius: 6
                          }}>
                            {t.from_branch_code}
                          </span>
                          <ArrowRight size={14} color="var(--text-dim)" />
                          <span style={{ 
                            fontWeight: 600, 
                            color: isRecipient ? '#34d399' : 'var(--text-main)',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '2px 8px',
                            borderRadius: 6
                          }}>
                            {t.to_branch_code}
                          </span>
                        </div>
                      </td>

                      {/* Thời gian */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                        <div>{new Date(t.created_at).toLocaleDateString('vi-VN')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(t.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      {/* Số món */}
                      <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 700 }}>
                        {t.total_items}
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {isDraft && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '3px 10px', borderRadius: 8 }}>
                            Chờ Xuất (DRAFT)
                          </span>
                        )}
                        {isInTransit && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Truck size={12} /> Đang Đi Đường
                          </span>
                        )}
                        {isCompleted && (
                          <div>
                            <span style={{ 
                              fontSize: 11, 
                              fontWeight: 700, 
                              color: t.status === 'COMPLETED_WITH_LOSS' || hasLoss ? '#fb7185' : '#34d399', 
                              background: t.status === 'COMPLETED_WITH_LOSS' || hasLoss ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                              padding: '3px 10px', 
                              borderRadius: 8 
                            }}>
                              {t.status === 'COMPLETED_WITH_LOSS' || hasLoss ? 'Hoàn Tất (Hao Hụt)' : 'Hoàn Tất'}
                            </span>
                            {hasLoss && Number(t.total_loss_amount) > 0 && (
                              <div style={{ fontSize: 10, color: '#fb7185', marginTop: 4, fontWeight: 600 }}>
                                Hao hụt: {Number(t.total_loss_amount).toLocaleString('vi-VN')}đ
                              </div>
                            )}
                          </div>
                        )}
                        {isCancelled && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '3px 10px', borderRadius: 8 }}>
                            Đã Hủy (Đã Hoàn Kho)
                          </span>
                        )}
                      </td>

                      {/* Nút thao tác */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {/* Nếu phiếu DRAFT và chi nhánh gửi -> Có nút Xuất kho hoặc Hủy */}
                        {isDraft && isSender && (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => handleDispatchDraft(t.id)}
                              style={{
                                padding: '5px 12px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                borderRadius: 6,
                                color: '#fbbf24',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Xuất Kho Đi (Pha 1)
                            </button>
                            <button
                              onClick={() => handleCancelTransfer(t.id, false)}
                              style={{
                                padding: '5px 8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: 6,
                                color: 'var(--text-dim)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Hủy
                            </button>
                          </div>
                        )}

                        {/* Nếu phiếu Đang đi đường và chi nhánh nhận -> Có nút Nhận Hàng (Pha 2) */}
                        {isInTransit && isRecipient && (
                          <button
                            onClick={() => handleOpenReceive(t)}
                            style={{
                              padding: '5px 12px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              borderRadius: 6,
                              color: '#34d399',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <PackageCheck size={14} /> Nhận Kho (Pha 2)
                          </button>
                        )}

                        {/* Nếu chi nhánh gửi và hàng đang đi -> Có nút Hủy Chuyến / Hoàn Kho (INV-06) */}
                        {isInTransit && isSender && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#38bdf8', fontStyle: 'italic' }}>
                              Đang vận chuyển...
                            </span>
                            <button
                              onClick={() => handleCancelTransfer(t.id, true)}
                              style={{
                                padding: '4px 10px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: 6,
                                color: '#f87171',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <RotateCcw size={12} /> Hủy Xe / Hoàn Kho
                            </button>
                          </div>
                        )}

                        {/* Đã hoàn tất */}
                        {isCompleted && (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            Đã lưu trữ
                          </span>
                        )}

                        {/* Đã hủy */}
                        {isCancelled && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            Đã bồi hoàn
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL TẠO PHIẾU ĐIỀU CHUYỂN MỚI */}
      {isCreateOpen && (
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
            maxWidth: 640,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* Header */}
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
                  <Truck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Lập Phiếu Điều Chuyển Kho 2 Pha</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Xuất từ: <strong style={{ color: '#38bdf8' }}>{currentBranch?.name}</strong> ({currentBranch?.code})
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} style={{ padding: 20, maxHeight: '80vh', overflowY: 'auto' }}>
              {errorMessage && (
                <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#fb7185', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Chi nhánh nhận */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Chi nhánh nhận hàng (Đích đến):
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <select
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      background: '#090d16',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: '#f8fafc',
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                        {b.code} • {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Danh sách mặt hàng chuyển */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Mặt hàng xuất chuyển:
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: 6,
                      color: '#38bdf8',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Plus size={12} /> Thêm món
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {transferItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#090d16', padding: 8, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      {/* Chọn SP */}
                      <select
                        value={item.product_id}
                        onChange={(e) => handleUpdateItemRow(idx, 'product_id', e.target.value)}
                        style={{ flex: 1, padding: '8px', background: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: 6, color: '#f8fafc', fontSize: 13 }}
                      >
                        {availableProducts.map(p => (
                          <option key={p.id} value={p.id} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                            {p.code} - {p.name} (Kho: {p.available_qty} {p.base_uom})
                          </option>
                        ))}
                      </select>

                      {/* Số lượng xuất */}
                      <div style={{ width: 110 }}>
                        <input
                          type="number"
                          min="1"
                          max={item.available_qty}
                          value={item.send_qty}
                          onChange={(e) => handleUpdateItemRow(idx, 'send_qty', Math.min(item.available_qty, Math.max(1, Number(e.target.value))))}
                          style={{ width: '100%', padding: '8px', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: '#38bdf8', fontSize: 13, fontWeight: 700, textAlign: 'center' }}
                        />
                      </div>

                      {/* ĐVT */}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 45, textAlign: 'center' }}>
                        {item.uom}
                      </span>

                      {/* Nút xóa */}
                      {transferItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#fb7185', cursor: 'pointer', padding: 4 }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ghi chú */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Ghi chú vận chuyển:
                </label>
                <input
                  type="text"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder="VD: Điều chuyển bù kho hàng bán chạy..."
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-main)', fontSize: 13 }}
                />
              </div>

              {/* Checkbox Xuất kho đi đường ngay */}
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="dispatchNow"
                  checked={dispatchNow}
                  onChange={(e) => setDispatchNow(e.target.checked)}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
                <label htmlFor="dispatchNow" style={{ fontSize: 13, color: 'var(--text-main)', cursor: 'pointer' }}>
                  Xuất kho đi đường ngay lập tức (Pha 1 - Đổi trạng thái sang <strong>ĐANG_DI_DUONG</strong>)
                </label>
              </div>

              {/* Nút nộp */}
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
                  gap: 8
                }}
              >
                <Truck size={18} />
                {isSubmitting ? 'Đang lập phiếu...' : 'Xác Nhận Lập Phiếu Điều Chuyển'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL NHẬN HÀNG & LẬP BIÊN BẢN HAO HỤT (PHA 2 - INV-06) */}
      {selectedTransfer && (
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
            maxWidth: 640,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* Header */}
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
                  <PackageCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nhận Kho & Đối Soát Hao Hụt (Pha 2)</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Mã phiếu: <strong style={{ color: '#38bdf8' }}>{selectedTransfer.transfer_code}</strong> • Từ: {selectedTransfer.from_branch_code}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedTransfer(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Form Nhận Hàng */}
            <form onSubmit={handleReceiveSubmit} style={{ padding: 20, maxHeight: '80vh', overflowY: 'auto' }}>
              {errorMessage && (
                <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#fb7185', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Danh sách đối soát số lượng */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Kiểm đếm thực tế từng mặt hàng:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {receiveItems.map((item, idx) => {
                    const lossQty = item.send_qty - item.received_quantity;
                    return (
                      <div key={idx} style={{ background: '#090d16', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>
                            {(item as any).product_name || `Sản phẩm #${idx + 1}`}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Xuất đi: <strong style={{ color: '#fbbf24' }}>{item.send_qty}</strong> {(item as any).uom}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'center' }}>
                          <div>
                            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                              Số lượng thực nhận:
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={item.send_qty}
                              value={item.received_quantity}
                              onChange={(e) => {
                                const val = Math.min(item.send_qty, Math.max(0, Number(e.target.value)));
                                setReceiveItems(prev => prev.map((it, i) => i === idx ? { ...it, received_quantity: val } : it));
                              }}
                              style={{ width: '100%', padding: '6px 10px', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: '#34d399', fontSize: 14, fontWeight: 800 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 11, color: lossQty > 0 ? '#fb7185' : 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                              Hao hụt / Mất mát:
                            </label>
                            <div style={{ fontSize: 14, fontWeight: 800, color: lossQty > 0 ? '#fb7185' : '#34d399', padding: '6px 0' }}>
                              {lossQty > 0 ? `-${lossQty} ${(item as any).uom} (Thiếu)` : 'Nhận đủ 100%'}
                            </div>
                          </div>
                        </div>

                        {/* Lý do hao hụt nếu phát sinh */}
                        {lossQty > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <input
                              type="text"
                              placeholder="Lý do hao hụt (VD: vỡ trong thùng, shipper làm rách...)"
                              value={item.loss_reason}
                              onChange={(e) => {
                                setReceiveItems(prev => prev.map((it, i) => i === idx ? { ...it, loss_reason: e.target.value } : it));
                              }}
                              style={{ width: '100%', padding: '6px 10px', background: 'var(--surface-sunken)', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: 6, color: '#fb7185', fontSize: 12 }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trách nhiệm hao hụt nếu có mất mát */}
              {receiveItems.some(it => it.send_qty > it.received_quantity) && (
                <div style={{ marginBottom: 20, background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: 12, borderRadius: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#fb7185', marginBottom: 6 }}>
                    Trách nhiệm đền bù hao hụt (Loss Responsibility):
                  </label>
                  <select
                    value={lossResponsibility}
                    onChange={(e: any) => setLossResponsibility(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: 6, color: '#f8fafc', fontSize: 13, fontWeight: 600 }}
                  >
                    <option value="SHIPPER" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Tài xế / Đơn vị vận chuyển (SHIPPER)</option>
                    <option value="SENDER" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Kho xuất hàng đóng gói sai (SENDER)</option>
                    <option value="RECEIVER" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Kho nhận bảo quản lỗi (RECEIVER)</option>
                  </select>
                </div>
              )}

              {/* Nút nộp */}
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
                  gap: 8
                }}
              >
                <PackageCheck size={18} />
                {isSubmitting ? 'Đang hạch toán nhập kho...' : 'Xác Nhận Nhập Kho & Chốt Biên Bản'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
