import React, { useEffect, useState, useRef } from 'react';
import { api, type ProductInventory } from '../../services/api';
import { branchStore } from '../../services/branchContext';
import { Search, Barcode, AlertCircle, RefreshCw, X, LayoutGrid, Table, AlertTriangle, Clock } from 'lucide-react';
import { PosDynamicActionsBar } from './PosDynamicActionsBar';

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
    <div className="product-catalog-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* 0. THANH TIỆN ÍCH NO-CODE DYNAMIC EXTENSIONS */}
      <PosDynamicActionsBar onRecordCreated={() => loadProducts(searchTerm)} />

      {/* 1. THANH TÌM KIẾM & BỘ LỌC BARCODE (CHUẨN HIỆN ĐẠI 44PX) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Search 
            size={18} 
            color="var(--text-muted)" 
            style={{ position: 'absolute', left: 14, pointerEvents: 'none' }} 
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
              height: 44,
              paddingLeft: 44,
              paddingRight: barcodeEnabled ? (searchTerm ? 140 : 110) : (searchTerm ? 38 : 14),
              fontSize: 14,
              borderRadius: 10
            }}
          />
          <div style={{ 
            position: 'absolute', 
            right: 12, 
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
                <X size={15} />
              </button>
            )}
            {barcodeEnabled && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                fontSize: 11, 
                color: '#38bdf8', 
                background: 'rgba(56, 189, 248, 0.12)', 
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '3px 8px', 
                borderRadius: 6,
                fontWeight: 600
              }}>
                <Barcode size={13} />
                <span>Máy quét ON</span>
              </div>
            )}
          </div>
        </div>

        {/* Nút lọc nhanh FEFO / Cảnh báo hàng tồn lâu (Trụ cột 3) */}
        <button
          type="button"
          onClick={() => setOnlyFefoAlert(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px',
            height: 44,
            borderRadius: 10,
            border: onlyFefoAlert ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
            background: onlyFefoAlert ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
            color: onlyFefoAlert ? '#fbbf24' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          title="Lọc các sản phẩm có Lô/Hạn dùng hoặc Hàng tồn kho lâu cần ưu tiên xuất FEFO"
        >
          <AlertTriangle size={15} color={onlyFefoAlert ? '#fbbf24' : 'var(--text-dim)'} />
          <span>Ưu tiên FEFO</span>
        </button>

        {/* Chuyển đổi chế độ Thẻ Bán Lẻ vs Bảng Kẻ Bán Sỉ (Q4) */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 10, padding: 3, border: '1px solid var(--border-subtle)', height: 44, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { setViewMode('grid'); localStorage.setItem('pos_catalog_view', 'grid'); }}
            style={{
              background: viewMode === 'grid' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'grid' ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 7,
              height: 36,
              padding: '0 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
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
              background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'table' ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 7,
              height: 36,
              padding: '0 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            title="Bảng Kẻ Excel Siêu Tốc (Bán buôn / Gõ phím nhanh)"
          >
            <Table size={15} />
            <span>Bảng</span>
          </button>
        </div>

        <button 
          className="btn-action" 
          onClick={() => loadProducts(searchTerm)} 
          style={{ height: 44, padding: '0 14px', borderRadius: 10 }}
          title="Tải lại danh mục & tồn kho"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* 2. THANH CHỌN DANH MỤC HÀNG HÓA */}
      {categories.length > 2 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat!)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                background: selectedCategory === cat ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: selectedCategory === cat ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {cat === 'ALL' ? 'Tất cả' : cat}
            </button>
          ))}
        </div>
      )}

      {/* 3. HIỂN THỊ HÀNG HÓA: DẠNG BẢNG EXCEL SIÊU TỐC HOẶC LƯỚI THẺ BENTO */}
      {viewMode === 'table' ? (
        <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#0f172a' }}>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 14px' }}>Mã SP</th>
                <th style={{ padding: '10px 14px' }}>Tên Sản Phẩm</th>
                <th style={{ padding: '10px 14px' }}>ĐVT</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tồn Khả Dụng</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Giá Bán</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    Đang tải dữ liệu hàng hóa & tồn kho chi nhánh...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
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
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>
                        {p.code}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</span>
                          {(p.track_expiry || p.has_expiry || p.expiry_date) && (
                            <span style={{ 
                              fontSize: 10, 
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              background: 'rgba(245, 158, 11, 0.15)', 
                              color: '#f59e0b', 
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}>
                              <Clock size={10} />
                              {p.batch_number ? `Lô ${p.batch_number}` : 'Lô/HSD'}
                              {p.expiry_date && ` • ${new Date(p.expiry_date).toLocaleDateString('vi-VN')}`}
                            </span>
                          )}
                          {(p.is_aging_stock || Number(p.days_in_inventory || 0) >= 90) && (
                            <span style={{ 
                              fontSize: 10, 
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              background: 'rgba(239, 68, 68, 0.15)', 
                              color: '#f87171', 
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontWeight: 700
                            }}>
                              ⚠️ Tồn {p.days_in_inventory || 90}d
                            </span>
                          )}
                          {p.is_combo && (
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                              Combo
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {p.base_uom}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 700,
                          color: isOutOfStock ? '#ef4444' : '#10b981',
                          background: isOutOfStock ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          padding: '2px 8px',
                          borderRadius: 6
                        }}>
                          {Number(p.available_qty).toLocaleString('vi-VN')} {p.base_uom}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                        {Number(p.default_selling_price).toLocaleString('vi-VN')}đ
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSelectProduct(p); }}
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: 'var(--primary)',
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          + Chọn
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: 14,
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
                    background: 'rgba(18, 24, 38, 0.75)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    transition: 'all 0.18s ease',
                    opacity: isOutOfStock ? 0.65 : 1
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{p.code}</span>
                        {(p.track_expiry || p.has_expiry || p.expiry_date) && (
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 700, 
                            color: '#f59e0b', 
                            background: 'rgba(245, 158, 11, 0.15)', 
                            padding: '1px 5px', 
                            borderRadius: 4, 
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2
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
                            padding: '1px 5px', 
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
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: isOutOfStock ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                        color: isOutOfStock ? '#fb7185' : '#34d399'
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
                      fontWeight: 600, 
                      lineHeight: 1.35, 
                      color: 'var(--text-main)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {p.name}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      ĐVT: <strong style={{ color: 'var(--text-muted)' }}>{p.base_uom}</strong>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
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
