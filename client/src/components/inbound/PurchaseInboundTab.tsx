import React, { useState, useEffect } from 'react';
import { 
  api, 
  type Supplier, 
  type ProductInventory, 
  type InboundItem 
} from '../../services/api';
import { branchStore } from '../../services/branchContext';
import { 
  PackagePlus, 
  Building2, 
  Receipt, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Search, 
  AlertCircle,
  FileSpreadsheet,
  Truck,
  Eye,
  X
} from 'lucide-react';
import { QuickSupplierModal } from './QuickSupplierModal';

export const PurchaseInboundTab: React.FC = () => {
  // Chế độ xem: Lập phiếu nhập mới (CREATE) hoặc Sổ phiếu & Báo cáo (HISTORY)
  const [activeSubTab, setActiveSubTab] = useState<'CREATE' | 'HISTORY'>('CREATE');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductInventory[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState<boolean>(false);
  const [inboundItems, setInboundItems] = useState<InboundItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal xem chi tiết phiếu nhập cũ
  const [inspectReceipt, setInspectReceipt] = useState<any | null>(null);

  const refreshData = async () => {
    try {
      const [supRes, prodRes, recRes] = await Promise.all([
        api.getSuppliers(),
        api.getProducts(),
        api.getInboundReceipts()
      ]);
      if (supRes.success) {
        setSuppliers(supRes.data);
        if (supRes.data.length > 0) {
          setSelectedSupplierId(prev => prev || supRes.data[0].id);
        }
      }
      if (prodRes.success) setProducts(prodRes.data);
      if (recRes.success) setReceipts(recRes.data);
    } catch (err: any) {
      console.error('Failed to load inbound data', err);
      setErrorMsg(err.message || 'Không thể tải dữ liệu nhập kho');
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const [supRes, prodRes, recRes] = await Promise.all([
          api.getSuppliers(),
          api.getProducts(),
          api.getInboundReceipts()
        ]);
        if (!isMounted) return;
        if (supRes.success) {
          setSuppliers(supRes.data);
          if (supRes.data.length > 0) {
            setSelectedSupplierId(prev => prev || supRes.data[0].id);
          }
        }
        if (prodRes.success) setProducts(prodRes.data);
        if (recRes.success) setReceipts(recRes.data);
      } catch (err: any) {
        if (isMounted) setErrorMsg(err.message || 'Không thể tải dữ liệu nhập kho');
      }
    };
    loadInitial();

    // Lắng nghe khi chuyển chi nhánh
    const unsubscribe = branchStore.subscribe(() => {
      if (isMounted) {
        refreshData();
      }
    });

    return () => { 
      isMounted = false; 
      unsubscribe();
    };
  }, []);

  const handleAddItem = (product: ProductInventory) => {
    const existing = inboundItems.find(it => it.product_id === product.id);
    if (existing) {
      setInboundItems(prev => prev.map(it => 
        it.product_id === product.id ? { ...it, quantity: it.quantity + 1 } : it
      ));
    } else {
      setInboundItems(prev => [
        ...prev,
        {
          product_id: product.id,
          uom: product.base_uom,
          conversion_rate: 1,
          quantity: 1,
          unit_price: Number(product.default_cost_price || 0)
        }
      ]);
    }
  };

  const handleUpdateItem = (productId: string, field: keyof InboundItem, value: any) => {
    setInboundItems(prev => prev.map(it => {
      if (it.product_id === productId) {
        return { ...it, [field]: value };
      }
      return it;
    }));
  };

  const handleRemoveItem = (productId: string) => {
    setInboundItems(prev => prev.filter(it => it.product_id !== productId));
  };

  const totalAmount = inboundItems.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  const debtRemaining = Math.max(0, totalAmount - paidAmount);

  const handleSubmit = async () => {
    if (inboundItems.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 sản phẩm để nhập kho');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.createPurchaseInbound({
        supplier_id: selectedSupplierId || undefined,
        items: inboundItems,
        paid_amount: paidAmount,
        payment_method: paymentMethod,
        note
      });
      if (res.success) {
        setSuccessMsg(`Đã lập thành công phiếu nhập ${res.data?.order_code}! Tồn kho đã được cộng.`);
        setInboundItems([]);
        setPaidAmount(0);
        setNote('');
        refreshData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lập phiếu nhập kho');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const currentSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const filteredReceipts = receipts.filter(r => {
    if (!historySearchTerm) return true;
    const term = historySearchTerm.toLowerCase();
    return (
      (r.order_code && r.order_code.toLowerCase().includes(term)) ||
      (r.supplier_name && r.supplier_name.toLowerCase().includes(term)) ||
      (r.note && r.note.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. THANH ĐIỀU HƯỚNG PHÂN LUỒNG TÁC VỤ (SEGMENTED SUB-TABS) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: 12,
        padding: '6px 12px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: 10
      }}>
        {/* Phím chuyển đổi Lập Phiếu vs Sổ Lịch Sử */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(15, 23, 42, 0.6)', padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setActiveSubTab('CREATE')}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: activeSubTab === 'CREATE' ? 'var(--primary)' : 'transparent',
              color: activeSubTab === 'CREATE' ? '#ffffff' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <PackagePlus size={16} />
            <span>Lập Phiếu Nhập Hàng</span>
            {inboundItems.length > 0 && (
              <span style={{ 
                background: '#ffffff', 
                color: 'var(--primary)', 
                fontSize: 11, 
                padding: '1px 6px', 
                borderRadius: 10,
                fontWeight: 800
              }}>
                {inboundItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('HISTORY')}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: activeSubTab === 'HISTORY' ? 'var(--primary)' : 'transparent',
              color: activeSubTab === 'HISTORY' ? '#ffffff' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Sổ Phiếu Nhập & Thống Kê</span>
            <span style={{ 
              background: 'rgba(255,255,255,0.1)', 
              color: '#f8fafc', 
              fontSize: 11, 
              padding: '1px 6px', 
              borderRadius: 10 
            }}>
              {receipts.length}
            </span>
          </button>
        </div>

        {/* Thông tin phụ trợ theo ngữ cảnh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {activeSubTab === 'CREATE' && (
            <button
              type="button"
              onClick={() => setIsQuickSupplierOpen(true)}
              className="btn-action"
              style={{
                fontSize: 12,
                padding: '6px 12px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Truck size={14} />
              <span>+ Thêm Nhà Cung Cấp Mới</span>
            </button>
          )}

          {activeSubTab === 'HISTORY' && (
            <div style={{ position: 'relative', width: 280, display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Tìm mã phiếu hoặc NCC..."
                value={historySearchTerm}
                onChange={e => setHistorySearchTerm(e.target.value)}
                className="search-input"
                style={{ width: '100%', height: 38, paddingLeft: 36, paddingRight: historySearchTerm ? 32 : 12, fontSize: 12, borderRadius: 8 }}
              />
              {historySearchTerm && (
                <button
                  type="button"
                  onClick={() => setHistorySearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: 8,
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
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Thông báo thao tác */}
      {successMsg && (
        <div style={{ 
          background: 'rgba(16, 185, 129, 0.15)', 
          border: '1px solid rgba(16, 185, 129, 0.4)', 
          borderRadius: 'var(--radius-md)', 
          padding: '10px 16px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#34d399' }}>
            <CheckCircle2 size={18} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="btn-action" style={{ fontSize: 11 }}>Đóng</button>
        </div>
      )}

      {errorMsg && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.15)', 
          border: '1px solid rgba(239, 68, 68, 0.4)', 
          borderRadius: 'var(--radius-md)', 
          padding: '10px 16px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f87171' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="btn-action" style={{ fontSize: 11 }}>Đóng</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. CHẾ ĐỘ 1: LẬP PHIẾU NHẬP HÀNG (FULL-HEIGHT WORKSPACE)     */}
      {/* ============================================================ */}
      {activeSubTab === 'CREATE' && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.25fr 1fr', 
          gap: 16, 
          height: 'calc(100vh - 170px)' 
        }}>
          {/* CỘT TRÁI (60%): CHỌN NCC & DANH MỤC HÀNG HÓA */}
          <div className="glass-panel" style={{ 
            padding: 16, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12,
            overflow: 'hidden' 
          }}>
            {/* Hàng chọn Nhà Cung Cấp Cao Cấp (Bố cục 2 tầng không bao giờ tràn mép) */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8,
              background: 'rgba(255,255,255,0.02)',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} color="var(--primary)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                    Nhà Cung Cấp Hàng Hóa:
                  </span>
                </div>

                {/* Huy hiệu nợ hiện tại của NCC căn phải gọn gàng */}
                {currentSupplier && (
                  <div style={{ 
                    fontSize: 12, 
                    padding: '3px 10px', 
                    borderRadius: 6, 
                    background: 'rgba(245, 158, 11, 0.12)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    color: '#fbbf24',
                    fontWeight: 600
                  }}>
                    Nợ hiện tại: <strong style={{ color: '#fef08a' }}>{Number(currentSupplier.current_debt || 0).toLocaleString('vi-VN')}đ</strong>
                  </div>
                )}
              </div>

              <select 
                value={selectedSupplierId} 
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="search-input"
                style={{ width: '100%', height: 42, padding: '0 14px', fontSize: 13 }}
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code} • {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Thanh Tìm Kiếm Chuẩn Hiện Đại (44px, bo góc 10px, có nút xóa nhanh) */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <Search 
                  size={17} 
                  color="var(--text-muted)" 
                  style={{ position: 'absolute', left: 14, pointerEvents: 'none' }} 
                />
                <input 
                  type="text"
                  placeholder="Tìm mã hoặc tên sản phẩm nhập kho..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="search-input"
                  style={{ 
                    width: '100%', 
                    height: 44, 
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
                      justifyContent: 'center',
                      padding: 4
                    }}
                    title="Xóa tìm kiếm"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="search-input"
                style={{ width: 160, height: 44, fontSize: 13, borderRadius: 10 }}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'ALL' ? 'Tất cả nhóm' : c}</option>
                ))}
              </select>
            </div>

            {/* Lưới sản phẩm rộng rãi (Cuộn dọc độc lập) */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', 
              gap: 10,
              paddingRight: 4
            }}>
              {filteredProducts.map(p => (
                <div 
                  key={p.id}
                  onClick={() => handleAddItem(p)}
                  className="bento-card"
                  style={{ 
                    padding: 12, 
                    cursor: 'pointer', 
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 90,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{p.code}</span>
                      <span style={{ 
                        fontSize: 10, 
                        padding: '1px 6px', 
                        borderRadius: 4, 
                        background: 'rgba(255,255,255,0.06)', 
                        color: 'var(--text-dim)' 
                      }}>
                        ĐVT: {p.base_uom}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: '#f8fafc', lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>
                      Vốn: {Number(p.default_cost_price || 0).toLocaleString('vi-VN')}đ
                    </span>
                    <div style={{ 
                      width: 26, 
                      height: 26, 
                      borderRadius: 6, 
                      background: 'rgba(56, 189, 248, 0.15)', 
                      color: '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Plus size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CỘT PHẢI (40%): CHI TIẾT PHIẾU NHẬP & THANH TOÁN */}
          <div className="glass-panel" style={{ 
            padding: 16, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Header phiếu nhập */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingBottom: 10,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 10
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <Receipt size={17} color="#34d399" />
                  Chi Tiết Phiếu Nhập ({inboundItems.length} mặt hàng)
                </h3>
                {inboundItems.length > 0 && (
                  <button 
                    onClick={() => setInboundItems([])}
                    className="btn-action" 
                    style={{ fontSize: 11, color: '#f87171', padding: '2px 8px' }}
                  >
                    Xóa hết
                  </button>
                )}
              </div>

              {/* Bảng kê hàng hóa nhập (Cuộn độc lập) */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
                {inboundItems.length === 0 ? (
                  <div style={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'var(--text-dim)', 
                    fontSize: 13,
                    gap: 8
                  }}>
                    <PackagePlus size={36} style={{ opacity: 0.3 }} />
                    <span>Chưa có mặt hàng nào. Nhấp sản phẩm bên trái để lập phiếu.</span>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 4px' }}>Mặt hàng</th>
                        <th style={{ padding: '6px 4px', width: 60 }}>ĐVT</th>
                        <th style={{ padding: '6px 4px', width: 65 }}>SL</th>
                        <th style={{ padding: '6px 4px', width: 95 }}>Đơn giá</th>
                        <th style={{ padding: '6px 4px', width: 95, textAlign: 'right' }}>Thành tiền</th>
                        <th style={{ padding: '6px 4px', width: 26 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inboundItems.map(it => {
                        const prod = products.find(p => p.id === it.product_id);
                        return (
                          <tr key={it.product_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '6px 4px', fontWeight: 600, color: '#f8fafc' }}>
                              {prod?.name || it.product_id}
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              <input 
                                type="text" 
                                value={it.uom}
                                onChange={e => handleUpdateItem(it.product_id, 'uom', e.target.value)}
                                className="search-input"
                                style={{ width: '100%', height: 32, padding: '0 6px', fontSize: 12, textAlign: 'center', borderRadius: 6 }}
                              />
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              <input 
                                type="number" 
                                min="1"
                                value={it.quantity}
                                onChange={e => handleUpdateItem(it.product_id, 'quantity', Math.max(1, Number(e.target.value)))}
                                className="search-input"
                                style={{ width: '100%', height: 32, padding: '0 6px', fontSize: 12, textAlign: 'center', borderRadius: 6, fontWeight: 700 }}
                              />
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              <input 
                                type="number" 
                                min="0"
                                value={it.unit_price}
                                onChange={e => handleUpdateItem(it.product_id, 'unit_price', Math.max(0, Number(e.target.value)))}
                                className="search-input"
                                style={{ width: '100%', height: 32, padding: '0 6px', fontSize: 12, textAlign: 'right', borderRadius: 6, fontWeight: 600, color: '#38bdf8' }}
                              />
                            </td>
                            <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                              {(it.quantity * it.unit_price).toLocaleString('vi-VN')}đ
                            </td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                              <button 
                                onClick={() => handleRemoveItem(it.product_id)}
                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Tóm tắt tài chính & ghi chú */}
              <div style={{ 
                background: 'rgba(255,255,255,0.03)', 
                padding: 14, 
                borderRadius: 10, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 10,
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tổng Tiền Hàng:</span>
                  <strong style={{ fontSize: 18, color: '#f8fafc', fontWeight: 800 }}>{totalAmount.toLocaleString('vi-VN')}đ</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Thanh Toán Trả Trước:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input 
                      type="number" 
                      min="0" 
                      max={totalAmount}
                      value={paidAmount}
                      onChange={e => setPaidAmount(Math.max(0, Number(e.target.value)))}
                      className="search-input"
                      style={{ width: 140, height: 36, textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#38bdf8', borderRadius: 8 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>đ</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Hình Thức Chi:</span>
                  <select 
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="search-input"
                    style={{ width: 140, height: 36, fontSize: 13, borderRadius: 8 }}
                  >
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                    <option value="CASH">Tiền mặt quỹ ca</option>
                  </select>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: 13, 
                  borderTop: '1px solid rgba(255,255,255,0.06)', 
                  paddingTop: 8 
                }}>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>Ghi Nợ Nhà Cung Cấp:</span>
                  <strong style={{ color: '#fbbf24', fontSize: 15, fontWeight: 800 }}>{debtRemaining.toLocaleString('vi-VN')}đ</strong>
                </div>

                <div>
                  <input 
                    type="text" 
                    placeholder="Ghi chú phiếu nhập (hóa đơn VAT, biển số xe giao...)" 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="search-input"
                    style={{ width: '100%', height: 36, fontSize: 12, borderRadius: 8, padding: '0 12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Nút hoàn tất nhập kho */}
              <button 
                onClick={handleSubmit}
                disabled={submitting || inboundItems.length === 0}
                className="btn-primary"
                style={{ 
                  marginTop: 10, 
                  width: '100%', 
                  padding: '11px 0', 
                  fontSize: 14, 
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: inboundItems.length === 0 ? 0.6 : 1
                }}
              >
                <PackagePlus size={16} />
                {submitting ? 'Đang lưu phiếu & cộng tồn kho...' : 'XÁC NHẬN NHẬP KHO & CỘNG TỒN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. CHẾ ĐỘ 2: SỔ PHIẾU NHẬP & BÁO CÁO THỐNG KÊ (FULL VIEW)    */}
      {/* ============================================================ */}
      {activeSubTab === 'HISTORY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 3 THẺ BENTO METRICS CARDS (CHỈ HIỂN THỊ TRONG CHẾ ĐỘ THỐNG KÊ) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 10, 
                background: 'rgba(56, 189, 248, 0.15)', 
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Receipt size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Tổng Tiền Đã Nhập Kho
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                  {receipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0).toLocaleString('vi-VN')}đ
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Tổng cộng {receipts.length} đợt nhập hàng
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 10, 
                background: 'rgba(245, 158, 11, 0.15)', 
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Nhà Cung Cấp Hợp Tác
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
                  {suppliers.length} NCC
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Nợ NCC: {suppliers.reduce((s, sup) => s + Number(sup.current_debt || 0), 0).toLocaleString('vi-VN')}đ
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 10, 
                background: 'rgba(16, 185, 129, 0.15)', 
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <PackagePlus size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Mặt Hàng Khả Dụng
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                  {products.length} Mã hàng
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Sẵn sàng nhập kho & điều chuyển
                </div>
              </div>
            </div>
          </div>

          {/* BẢNG LỊCH SỬ PHIẾU NHẬP TOÀN CHIỀU RỘNG */}
          <div className="glass-panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <FileSpreadsheet size={17} color="#38bdf8" />
                Sổ Nhật Ký Phiếu Nhập Kho (Thẻ Kho Bất Biến INV-10)
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Hiển thị {filteredReceipts.length} / {receipts.length} phiếu
              </span>
            </div>

            {filteredReceipts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 13 }}>
                Không tìm thấy phiếu nhập kho nào phù hợp.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Mã phiếu</th>
                      <th style={{ padding: '10px 12px' }}>Thời gian</th>
                      <th style={{ padding: '10px 12px' }}>Nhà cung cấp</th>
                      <th style={{ padding: '10px 12px' }}>Mặt hàng</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng tiền</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Đã thanh toán</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Nợ phát sinh</th>
                      <th style={{ padding: '10px 12px' }}>Ghi chú</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map(rec => (
                      <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary)' }}>
                          {rec.order_code}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 12 }}>
                          {new Date(rec.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f8fafc' }}>
                          {rec.supplier_name || 'Nhập lẻ'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)' }}>
                            {rec.items_count} mặt hàng
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                          {Number(rec.total_amount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#34d399' }}>
                          {Number(rec.paid_amount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: Number(rec.debt_amount) > 0 ? '#fbbf24' : 'var(--text-dim)', fontWeight: 600 }}>
                          {Number(rec.debt_amount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.note || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => setInspectReceipt(rec)}
                            className="btn-action"
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              borderRadius: 6,
                              background: 'rgba(56, 189, 248, 0.1)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Eye size={12} />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Thêm Nhanh Nhà Cung Cấp */}
      <QuickSupplierModal
        isOpen={isQuickSupplierOpen}
        onClose={() => setIsQuickSupplierOpen(false)}
        onSuccess={(newSupplier) => {
          setSuppliers(prev => [newSupplier, ...prev]);
          setSelectedSupplierId(newSupplier.id);
        }}
      />

      {/* Modal Xem Chi Tiết Phiếu Nhập */}
      {inspectReceipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: 600,
            padding: 24,
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Chi Tiết Phiếu Nhập #{inspectReceipt.order_code}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Ngày nhập: {new Date(inspectReceipt.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <button 
                onClick={() => setInspectReceipt(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              padding: 14, 
              borderRadius: 8, 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 10,
              fontSize: 13,
              marginBottom: 16
            }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Nhà cung cấp:</span>
                <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>
                  {inspectReceipt.supplier_name || 'Nhập lẻ'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Chi nhánh nhập:</span>
                <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>
                  {inspectReceipt.branch_id || 'Chi nhánh hiện tại'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Tổng tiền hàng:</span>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
                  {Number(inspectReceipt.total_amount || 0).toLocaleString('vi-VN')}đ
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Nợ phát sinh:</span>
                <div style={{ fontWeight: 700, color: Number(inspectReceipt.debt_amount) > 0 ? '#fbbf24' : '#34d399', marginTop: 2 }}>
                  {Number(inspectReceipt.debt_amount || 0).toLocaleString('vi-VN')}đ
                </div>
              </div>
            </div>

            {inspectReceipt.note && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Ghi chú: <em style={{ color: '#f8fafc' }}>{inspectReceipt.note}</em>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setInspectReceipt(null)}
                className="btn-action"
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseInboundTab;
