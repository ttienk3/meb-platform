import React, { useEffect, useState, useRef } from 'react';
import { api, type ProductInventory } from '../../services/api';
import { branchStore } from '../../services/branchContext';
import { Search, Barcode, AlertCircle, RefreshCw, X, LayoutGrid, Table, AlertTriangle, Clock, Plus } from 'lucide-react';
import { PosDynamicActionsBar } from './PosDynamicActionsBar';
import { getProductImageUrl } from '../../utils/productImages';

interface ProductCatalogProps {
  onSelectProduct: (product: ProductInventory) => void;
  barcodeEnabled?: boolean;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  onSelectProduct,
  barcodeEnabled = true
}) => {
  const [products, setProducts] = useState<ProductInventory[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      return (localStorage.getItem('pos_catalog_view') as 'grid' | 'table') || 'grid';
    } catch {
      return 'grid';
    }
  });
  // Trụ cột 3: Bộ lọc nhanh sản phẩm ưu tiên FEFO / Cận hạn / Tồn lâu
  const [onlyFefoAlert, setOnlyFefoAlert] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tải danh mục sản phẩm kèm tồn kho theo chi nhánh hiện tại
  const loadProducts = async (term?: string) => {
    try {
      setLoading(true);
      const res = await api.getProducts(term);
      setProducts(res.data || []);
    } catch (err) {
      console.error('🔥 [ProductCatalog Load Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Tải sản phẩm ngay khi mount nếu đã có chi nhánh hoặc kết nối
    Promise.resolve().then(() => {
      if (isMounted) {
        loadProducts();
      }
    });

    // Lắng nghe khi chi nhánh được kích hoạt hoặc thay đổi
    const unsubscribe = branchStore.subscribe((_config, branch) => {
      if (isMounted && branch) {
        loadProducts();
      }
    });

    // Tự động focus ô tìm kiếm / barcode scanner nếu cờ tính năng bật
    if (barcodeEnabled && searchInputRef.current) {
      searchInputRef.current.focus();
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [barcodeEnabled]);

  // Xử lý tìm kiếm
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Nếu quét mã barcode hoặc bấm enter:
      const filtered = filteredProducts;
      if (filtered.length === 1) {
        onSelectProduct(filtered[0]);
        setSearchTerm('');
      } else {
        loadProducts(searchTerm);
      }
    }
  };

  // Trích xuất danh mục duy nhất để làm bộ lọc Tabs
  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // Lọc sản phẩm theo danh mục, từ khóa và tiêu chí FEFO
  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcodes && p.barcodes.some(b => 
        typeof b === 'string' 
          ? (b as string).toLowerCase().includes(searchTerm.toLowerCase())
          : (b.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) || b.uom?.toLowerCase().includes(searchTerm.toLowerCase()))
      ));
    
    // Kiểm tra cờ FEFO (hàng có lô/hạn dùng hoặc tồn lâu)
    const matchFefo = !onlyFefoAlert || 
      Boolean(p.is_aging_stock) || 
      Boolean(p.track_expiry) || 
      Boolean(p.has_expiry) || 
      Boolean(p.expiry_date) || 
      Number(p.days_in_inventory || 0) >= 60;

    return matchCat && matchSearch && matchFefo;
  });

  return (
    <div className="product-catalog-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      {/* 1. THANH TÌM KIẾM, BỘ LỌC BARCODE & TIỆN ÍCH */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Search 
            size={16} 
            color="var(--text-muted)" 
            style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} 
          />
          <input
            id="pos-search-input"
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder={barcodeEnabled ? 'Quét mã vạch [F2] (hoặc gõ tên, mã SP...)' : 'Tìm kiếm tên hoặc mã sản phẩm [F2]...'}
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            style={{
              width: '100%',
              height: 42,
              paddingLeft: 42,
              paddingRight: barcodeEnabled ? (searchTerm ? 140 : 110) : (searchTerm ? 36 : 12),
              fontSize: 14,
              borderRadius: 8
            }}
          />
          <div style={{ 
            position: 'absolute', 
            right: 8, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6 
          }}>
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); loadProducts(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4
                }}
                title="Xóa từ khóa"
              >
                <X size={16} />
              </button>
            )}
            {barcodeEnabled && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                fontSize: 12, 
                color: '#059669', 
                background: 'rgba(16, 185, 129, 0.1)', 
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '4px 10px', 
                borderRadius: 6,
                fontWeight: 600
              }}>
                <Barcode size={14} />
                <span>Máy quét</span>
              </div>
            )}
          </div>
        </div>

        {/* Nút lọc nhanh FEFO / Cảnh báo hàng tồn lâu */}
        <button
          type="button"
          onClick={() => setOnlyFefoAlert(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 14px',
            height: 42,
            borderRadius: 8,
            border: onlyFefoAlert ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
            background: onlyFefoAlert ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-subtle)',
            color: onlyFefoAlert ? '#d97706' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          title="Lọc các sản phẩm có Lô/Hạn dùng hoặc Hàng tồn kho lâu cần ưu tiên xuất FEFO"
        >
          <AlertTriangle size={15} color={onlyFefoAlert ? '#d97706' : 'var(--text-muted)'} />
          <span>FEFO</span>
        </button>

        {/* Chuyển đổi chế độ Thẻ Bán Lẻ vs Bảng Kẻ Bán Sỉ */}
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)', height: 42, alignItems: 'center', gap: 3 }}>
          <button
            type="button"
            onClick={() => { setViewMode('grid'); localStorage.setItem('pos_catalog_view', 'grid'); }}
            style={{
              background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              borderRadius: 6,
              height: 36,
              padding: '0 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: viewMode === 'grid' ? 700 : 500,
              transition: 'all 0.15s ease'
            }}
            title="Giao diện Thẻ Sản Phẩm (Bán lẻ)"
          >
            <LayoutGrid size={15} />
            <span>Thẻ</span>
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('table'); localStorage.setItem('pos_catalog_view', 'table'); }}
            style={{
              background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'table' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              borderRadius: 6,
              height: 36,
              padding: '0 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: viewMode === 'table' ? 700 : 500,
              transition: 'all 0.15s ease'
            }}
            title="Bảng Kẻ Excel Siêu Tốc (Bán buôn / Gõ phím nhanh)"
          >
            <Table size={15} />
            <span>Bảng</span>
          </button>
        </div>

        {/* TIỆN ÍCH NO-CODE DYNAMIC EXTENSIONS */}
        <PosDynamicActionsBar onRecordCreated={() => loadProducts(searchTerm)} />

        <button 
          className="btn-action" 
          onClick={() => loadProducts(searchTerm)} 
          style={{ height: 42, padding: '0 12px', borderRadius: 8 }}
          title="Tải lại danh mục & tồn kho"
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* 2. THANH CHỌN DANH MỤC HÀNG HÓA (CHUẨN YOUTUBE FILTER PILLS) */}
      {categories.length > 2 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat!)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 20,
                  border: isSelected ? '1px solid var(--text-main)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--text-main)' : 'var(--bg-subtle)',
                  color: isSelected ? 'var(--bg-card)' : 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat === 'ALL' ? 'Tất cả' : cat}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. HIỂN THỊ HÀNG HÓA: DẠNG BẢNG EXCEL SIÊU TỐC HOẶC LƯỚI THẺ BENTO */}
      {viewMode === 'table' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--table-header-bg)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 10px', width: 65, minWidth: 65, textAlign: 'center', whiteSpace: 'nowrap' }}>Ảnh</th>
                <th style={{ padding: '10px 12px', width: 110, minWidth: 110, whiteSpace: 'nowrap' }}>Mã SP</th>
                <th style={{ padding: '10px 14px', minWidth: 180 }}>Tên Sản Phẩm</th>
                <th style={{ padding: '10px 12px', width: 80, minWidth: 80, whiteSpace: 'nowrap' }}>ĐVT</th>
                <th style={{ padding: '10px 14px', width: 130, minWidth: 130, textAlign: 'right', whiteSpace: 'nowrap' }}>Tồn Khả Dụng</th>
                <th style={{ padding: '10px 14px', width: 120, minWidth: 120, textAlign: 'right', whiteSpace: 'nowrap' }}>Giá Bán</th>
                <th style={{ padding: '10px 14px', width: 110, minWidth: 110, textAlign: 'center', whiteSpace: 'nowrap' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
                    Đang tải dữ liệu hàng hóa & tồn kho chi nhánh...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
                    Không tìm thấy sản phẩm nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isOutOfStock = Number(p.available_qty || 0) <= 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectProduct(p)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      className="product-table-row"
                    >
                      <td style={{ padding: '6px 8px', width: 65, minWidth: 65, textAlign: 'center' }}>
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto'
                        }}>
                          <img 
                            src={getProductImageUrl(p.code, p.image_url, p.category, p.name)} 
                            alt={p.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}
                            loading="lazy"
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', width: 110, minWidth: 110, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {p.code}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 14 }}>{p.name}</span>
                          {(p.track_expiry || p.has_expiry || p.expiry_date) && (
                            <span style={{ 
                              fontSize: 11, 
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              background: 'rgba(245, 158, 11, 0.15)', 
                              color: '#d97706', 
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}>
                              <Clock size={11} />
                              {p.batch_number ? `Lô ${p.batch_number}` : 'Lô/HSD'}
                              {p.expiry_date && ` • ${new Date(p.expiry_date).toLocaleDateString('vi-VN')}`}
                            </span>
                          )}
                          {(p.is_aging_stock || Number(p.days_in_inventory || 0) >= 90) && (
                            <span style={{ 
                              fontSize: 11, 
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              background: 'rgba(239, 68, 68, 0.15)', 
                              color: '#ef4444', 
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontWeight: 700
                            }}>
                              ⚠️ Tồn {p.days_in_inventory || 90}d
                            </span>
                          )}
                          {p.is_combo && (
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(168, 85, 247, 0.15)', color: '#9333ea', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600 }}>
                              Combo
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', width: 80, minWidth: 80, color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {p.base_uom}
                      </td>
                      <td style={{ padding: '8px 14px', width: 130, minWidth: 130, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: isOutOfStock ? '#dc2626' : '#059669',
                          background: isOutOfStock ? '#fef2f2' : '#ecfdf5',
                          border: isOutOfStock ? '1px solid #fecaca' : '1px solid #a7f3d0',
                          padding: '3px 10px',
                          borderRadius: 6,
                          display: 'inline-block'
                        }}>
                          {Number(p.available_qty).toLocaleString('vi-VN')} {p.base_uom}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px', width: 120, minWidth: 120, textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', fontSize: 15, whiteSpace: 'nowrap' }}>
                        {Number(p.default_selling_price).toLocaleString('vi-VN')}đ
                      </td>
                      <td style={{ padding: '8px 14px', width: 110, minWidth: 110, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSelectProduct(p); }}
                          style={{
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--primary)',
                            borderRadius: 6,
                            padding: '6px 14px',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            height: 34,
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                          }}
                        >
                          <Plus size={14} /> Chọn
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', 
          gap: 12,
          alignContent: 'start',
          paddingRight: 4
        }}>
          {loading && products.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              Đang tải dữ liệu hàng hóa & tồn kho chi nhánh...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <AlertCircle size={28} style={{ margin: '0 auto 8px', color: 'var(--text-dim)' }} />
              <p>Không tìm thấy sản phẩm nào phù hợp.</p>
            </div>
          ) : (
            filteredProducts.map(p => {
              const isOutOfStock = p.available_qty <= 0;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProduct(p)}
                  className="product-card"
                  style={{
                    padding: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    opacity: isOutOfStock ? 0.65 : 1
                  }}
                >
                  <div>
                    {/* KHUNG ẢNH SẢN PHẨM CHẤT LƯỢNG CAO */}
                    <div style={{
                      width: '100%',
                      height: 130,
                      borderRadius: 8,
                      overflow: 'hidden',
                      position: 'relative',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8
                    }}>
                      <img 
                        src={getProductImageUrl(p.code, p.image_url, p.category, p.name)} 
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
                        loading="lazy"
                      />
                      {p.category && (
                        <span style={{
                          position: 'absolute',
                          top: 5,
                          left: 5,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(4px)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.25)'
                        }}>
                          {p.category}
                        </span>
                      )}
                      {p.is_combo && (
                        <span style={{
                          position: 'absolute',
                          top: 5,
                          right: 5,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'rgba(168, 85, 247, 0.9)',
                          color: '#ffffff'
                        }}>
                          Combo
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{p.code}</span>
                        {(p.track_expiry || p.has_expiry || p.expiry_date) && (
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 700, 
                            color: '#f59e0b', 
                            background: 'rgba(245, 158, 11, 0.15)', 
                            padding: '2px 5px', 
                            borderRadius: 4, 
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}>
                            <Clock size={9} />
                            {p.batch_number ? `Lô ${p.batch_number}` : 'Lô/HSD'}
                          </span>
                        )}
                        {(p.is_aging_stock || Number(p.days_in_inventory || 0) >= 90) && (
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 700, 
                            color: '#f87171', 
                            background: 'rgba(239, 68, 68, 0.15)', 
                            padding: '2px 5px', 
                            borderRadius: 4, 
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}>
                            ⚠️ Tồn lâu
                          </span>
                        )}
                      </div>
                      <span style={{ 
                        fontSize: 11, 
                        fontWeight: 600, 
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: isOutOfStock ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                        color: isOutOfStock ? '#fb7185' : '#059669'
                      }}>
                        {isOutOfStock ? 'Hết hàng' : (() => {
                          const qty = Number(p.available_qty || 0);
                          const packaging = p.barcodes?.find(b => b.rate && b.rate > 1);
                          if (packaging && packaging.rate && packaging.rate > 1) {
                            const parentCount = Math.floor(qty / packaging.rate);
                            const remainder = qty % packaging.rate;
                            if (parentCount > 0 && remainder > 0) {
                              return `Còn: ${parentCount} ${packaging.uom} ${remainder} ${p.base_uom}`;
                            } else if (parentCount > 0 && remainder === 0) {
                              return `Còn: ${parentCount} ${packaging.uom}`;
                            }
                          }
                          return `Còn: ${qty} ${p.base_uom}`;
                        })()}
                      </span>
                    </div>

                    <h4 style={{ 
                      fontSize: 14, 
                      fontWeight: 700, 
                      lineHeight: 1.35, 
                      color: 'var(--text-main)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      margin: 0
                    }}>
                      {p.name}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      ĐVT: <strong style={{ color: 'var(--text-muted)' }}>{p.base_uom}</strong>
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--accent-retail, #059669)' }}>
                      {Number(p.default_selling_price || 0).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
