import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  ClipboardCheck, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Boxes, 
  Check, 
  XCircle, 
  History,
  FileCheck2,
  RefreshCw,
  FileSpreadsheet,
  X
} from 'lucide-react';

interface AuditProductItem {
  id: string;
  code: string;
  name: string;
  category?: string;
  base_uom: string;
  system_qty: number;
  actual_qty: number;
  cost_price: number;
  reason?: string;
}

export const StockAuditTab: React.FC = () => {
  // Phân luồng: Kiểm đếm thực tế (AUDIT) hoặc Lịch sử & Báo cáo (HISTORY)
  const [activeSubTab, setActiveSubTab] = useState<'AUDIT' | 'HISTORY'>('AUDIT');

  const [items, setItems] = useState<AuditProductItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshData = async () => {
    try {
      const [prodRes, histRes] = await Promise.all([
        api.getAuditProducts(),
        api.getAuditHistory()
      ]);

      if (prodRes.success) {
        setItems(prodRes.data.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          base_uom: p.base_uom,
          system_qty: Number(p.system_qty || 0),
          actual_qty: Number(p.system_qty || 0), // Mặc định bằng tồn sổ sách
          cost_price: Number(p.cost_price || 0),
          reason: ''
        })));
      }

      if (histRes.success) {
        setHistory(histRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load stock audit data', err);
      setErrorMsg(err.message || 'Lỗi khi tải dữ liệu kiểm kê kho');
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getAuditProducts(),
      api.getAuditHistory()
    ]).then(([prodRes, histRes]) => {
      if (!isMounted) return;
      if (prodRes.success) {
        setItems(prodRes.data.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          base_uom: p.base_uom,
          system_qty: Number(p.system_qty || 0),
          actual_qty: Number(p.system_qty || 0),
          cost_price: Number(p.cost_price || 0),
          reason: ''
        })));
      }
      if (histRes.success) {
        setHistory(histRes.data);
      }
    }).catch(err => {
      if (isMounted) setErrorMsg(err.message || 'Lỗi khi tải dữ liệu kiểm kê kho');
    });
    return () => { isMounted = false; };
  }, []);

  const handleUpdateActual = (id: string, qty: number) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, actual_qty: Math.max(0, qty) } : it));
  };

  const handleUpdateReason = (id: string, reason: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, reason } : it));
  };

  // Tính toán số liệu thống kê
  const matchedCount = items.filter(it => it.actual_qty === it.system_qty).length;
  const overCount = items.filter(it => it.actual_qty > it.system_qty).length;
  const shortCount = items.filter(it => it.actual_qty < it.system_qty).length;
  const totalVarianceQty = items.reduce((sum, it) => sum + (it.actual_qty - it.system_qty), 0);

  const handleSubmitAudit = async () => {
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const auditPayload = {
        items: items.map(it => ({
          product_id: it.id,
          actual_qty: it.actual_qty,
          reason: it.reason || undefined
        })),
        note: note || 'Biên bản kiểm kê kho định kỳ'
      };

      const res = await api.createStockAudit(auditPayload);
      if (res.success) {
        setSuccessMsg(`Đã chốt thành công đợt kiểm kê ${res.data?.audit_code}! Thẻ kho đã được cân bằng.`);
        setNote('');
        refreshData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu biên bản kiểm kê');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(it => {
    const matchSearch = it.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        it.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'ALL' || it.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const categories = ['ALL', ...Array.from(new Set(items.map(p => p.category).filter(Boolean)))];

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
        {/* Phím chuyển đổi Phiếu Kiểm Đếm vs Sổ Lịch Sử */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(15, 23, 42, 0.6)', padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setActiveSubTab('AUDIT')}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: activeSubTab === 'AUDIT' ? 'var(--primary)' : 'transparent',
              color: activeSubTab === 'AUDIT' ? '#ffffff' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <ClipboardCheck size={16} />
            <span>Phiếu Kiểm Đếm Thực Tế</span>
            <span style={{ 
              background: 'rgba(255,255,255,0.1)', 
              color: '#f8fafc', 
              fontSize: 11, 
              padding: '1px 6px', 
              borderRadius: 10 
            }}>
              {items.length} mã
            </span>
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
            <History size={16} />
            <span>Nhật Ký Các Đợt Kiểm Kê</span>
            <span style={{ 
              background: 'rgba(255,255,255,0.1)', 
              color: '#f8fafc', 
              fontSize: 11, 
              padding: '1px 6px', 
              borderRadius: 10 
            }}>
              {history.length}
            </span>
          </button>
        </div>

        {/* Thanh Mini Metrics Chips tóm tắt nhanh khi đang kiểm đếm */}
        {activeSubTab === 'AUDIT' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ 
              padding: '3px 8px', 
              borderRadius: 6, 
              background: 'rgba(16, 185, 129, 0.12)', 
              color: '#34d399', 
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              <Check size={13} /> Khớp: <strong>{matchedCount}</strong>
            </span>

            {overCount > 0 && (
              <span style={{ 
                padding: '3px 8px', 
                borderRadius: 6, 
                background: 'rgba(56, 189, 248, 0.12)', 
                color: '#38bdf8', 
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <CheckCircle2 size={13} /> Dư thừa: <strong>+{overCount}</strong>
              </span>
            )}

            {shortCount > 0 && (
              <span style={{ 
                padding: '3px 8px', 
                borderRadius: 6, 
                background: 'rgba(239, 68, 68, 0.12)', 
                color: '#f87171', 
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <XCircle size={13} /> Thất thoát: <strong>{shortCount}</strong>
              </span>
            )}

            <button 
              onClick={refreshData} 
              className="btn-action" 
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px' }}
              title="Tải lại tồn kho sổ sách mới nhất"
            >
              <RefreshCw size={12} />
              Tải lại sổ
            </button>
          </div>
        )}
      </div>

      {/* Thông báo */}
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
      {/* 2. CHẾ ĐỘ 1: PHIẾU KIỂM ĐẾM THỰC TẾ (FULL WORKSPACE)         */}
      {/* ============================================================ */}
      {activeSubTab === 'AUDIT' && (
        <div className="glass-panel" style={{ 
          padding: 16, 
          display: 'flex', 
          flexDirection: 'column', 
          height: 'calc(100vh - 170px)',
          overflow: 'hidden'
        }}>
          {/* Thanh Tìm Kiếm & Lọc Danh Mục (Chuẩn 44px hiện đại) */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <Search 
                size={17} 
                color="var(--text-muted)" 
                style={{ position: 'absolute', left: 14, pointerEvents: 'none' }} 
              />
              <input 
                type="text"
                placeholder="Tìm mã hoặc tên sản phẩm để kiểm đếm..."
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
                <option key={c} value={c}>{c === 'ALL' ? 'Tất cả phân loại' : c}</option>
              ))}
            </select>
          </div>

          {/* Bảng Kiểm Đếm Rộng Rãi (Cuộn dọc) */}
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.08)', 
                  color: 'var(--text-dim)', 
                  textAlign: 'left', 
                  position: 'sticky', 
                  top: 0, 
                  background: 'rgba(15,23,42,0.98)', 
                  zIndex: 2 
                }}>
                  <th style={{ padding: '10px 12px' }}>Mã & Tên Sản Phẩm</th>
                  <th style={{ padding: '10px 12px', width: 70 }}>ĐVT</th>
                  <th style={{ padding: '10px 12px', width: 110, textAlign: 'right' }}>Tồn Sổ Sách</th>
                  <th style={{ padding: '10px 12px', width: 130, textAlign: 'center' }}>Thực Đếm</th>
                  <th style={{ padding: '10px 12px', width: 110, textAlign: 'right' }}>Chênh Lệch</th>
                  <th style={{ padding: '10px 12px', minWidth: 220 }}>Lý Do Điều Chỉnh (Nếu Lệch)</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(it => {
                  const variance = it.actual_qty - it.system_qty;
                  const isMatch = variance === 0;
                  const isOver = variance > 0;

                  return (
                    <tr key={it.id} style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: !isMatch ? (isOver ? 'rgba(56, 189, 248, 0.03)' : 'rgba(239, 68, 68, 0.03)') : 'transparent'
                    }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{it.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{it.code}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {it.base_uom}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>
                        {it.system_qty}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <input 
                          type="number"
                          min="0"
                          value={it.actual_qty}
                          onChange={e => handleUpdateActual(it.id, Number(e.target.value))}
                          className="search-input"
                          style={{ 
                            width: 80, 
                            textAlign: 'center', 
                            fontWeight: 700,
                            padding: '6px 8px',
                            borderColor: isMatch ? 'rgba(255,255,255,0.1)' : (isOver ? '#38bdf8' : '#f87171')
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                        {isMatch ? (
                          <span style={{ color: '#34d399', fontSize: 12 }}>0 (Khớp)</span>
                        ) : isOver ? (
                          <span style={{ color: '#38bdf8' }}>+{variance}</span>
                        ) : (
                          <span style={{ color: '#f87171' }}>{variance}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input 
                          type="text"
                          placeholder={isMatch ? 'Không có chênh lệch' : 'VD: Rách vỡ, hao hụt, kiểm đếm lại...'}
                          value={it.reason || ''}
                          disabled={isMatch}
                          onChange={e => handleUpdateReason(it.id, e.target.value)}
                          className="search-input"
                          style={{ 
                            width: '100%', 
                            fontSize: 12, 
                            padding: '6px 10px',
                            opacity: isMatch ? 0.4 : 1,
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Chốt Kiểm Kê & Ghi Thẻ Kho */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 12, 
            paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexWrap: 'wrap', 
            gap: 12 
          }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <input 
                type="text"
                placeholder="Ghi chú đợt kiểm kê (VD: Kiểm kê cuối tháng, thủ kho A đếm...)"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="search-input"
                style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Tổng Lệch Toàn Kho:</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: totalVarianceQty === 0 ? '#34d399' : (totalVarianceQty > 0 ? '#38bdf8' : '#f87171') }}>
                  {totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty} đơn vị
                </div>
              </div>

              <button
                onClick={handleSubmitAudit}
                disabled={submitting || items.length === 0}
                className="btn-primary"
                style={{ padding: '10px 22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
              >
                <FileCheck2 size={16} />
                {submitting ? 'Đang cân bằng kho...' : 'CHỐT CÂN BẰNG KHO & GHI THẺ KHO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. CHẾ ĐỘ 2: NHẬT KÝ KIỂM KÊ & BÁO CÁO (HISTORY VIEW)       */}
      {/* ============================================================ */}
      {activeSubTab === 'HISTORY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 4 Thẻ Bento KPI Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Boxes size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Tổng Mặt Hàng Đếm
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                  {items.length} Mã hàng
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Toàn bộ tồn kho chi nhánh</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <Check size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Mã Khớp 100%
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                  {matchedCount} Mã
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Không có sai lệch số lượng</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Lệch Thừa (Dư Hàng)
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                  {overCount} Mã
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Thực tế nhiều hơn sổ sách</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                <XCircle size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Lệch Thiếu (Thất Thoát)
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f87171', marginTop: 2 }}>
                  {shortCount} Mã
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cần lập biên bản hao hụt</div>
              </div>
            </div>
          </div>

          {/* Bảng Nhật Ký Kiểm Kê Toàn Chiều Rộng */}
          <div className="glass-panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <FileSpreadsheet size={17} color="#fbbf24" />
                Sổ Nhật Ký Các Đợt Kiểm Kê (Lưu Trữ Bất Biến INV-10)
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{history.length} đợt đã ghi nhận</span>
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 13 }}>
                Chưa có đợt kiểm kê nào được lưu trữ.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Mã đợt</th>
                      <th style={{ padding: '10px 12px' }}>Thời gian chốt</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Khớp</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Thừa</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Thiếu</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng lệch</th>
                      <th style={{ padding: '10px 12px' }}>Ghi chú</th>
                      <th style={{ padding: '10px 12px' }}>Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary)' }}>
                          {h.audit_code}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 12 }}>
                          {new Date(h.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#34d399', fontWeight: 600 }}>
                          {h.matched_items_count}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#38bdf8', fontWeight: 600 }}>
                          {h.over_items_count}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#f87171', fontWeight: 600 }}>
                          {h.short_items_count}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: Number(h.total_variance_qty) === 0 ? '#34d399' : (Number(h.total_variance_qty) > 0 ? '#38bdf8' : '#f87171') }}>
                          {Number(h.total_variance_qty) > 0 ? `+${h.total_variance_qty}` : h.total_variance_qty}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 12 }}>
                          {h.note || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-main)', fontSize: 12 }}>
                          {h.created_by || 'THU_KHO'}
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
    </div>
  );
};

export default StockAuditTab;
