import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  TrendingUp, 
  Wallet, 
  Package, 
  CreditCard, 
  Store, 
  Clock, 
  RefreshCw, 
  AlertTriangle, 
  Plus, 
  Search,
  ChevronRight
} from 'lucide-react';
import { 
  api, 
  type HQOverviewData, 
  type HQBranchMatrixItem, 
  type Branch 
} from '../../services/api';
import { branchStore } from '../../services/branchContext';

interface HQDashboardTabProps {
  onSwitchBranchToPos: (branchId: string) => void;
  onOpenCreateBranchModal: () => void;
}

export const HQDashboardTab: React.FC<HQDashboardTabProps> = ({
  onSwitchBranchToPos,
  onOpenCreateBranchModal
}) => {
  const [overview, setOverview] = useState<HQOverviewData | null>(null);
  const [matrix, setMatrix] = useState<HQBranchMatrixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchBranch, setSearchBranch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const loadHQData = useCallback(async () => {
    try {
      const [overviewRes, matrixRes] = await Promise.all([
        api.getHQOverview(),
        api.getHQBranchesMatrix()
      ]);
      setOverview(overviewRes.data);
      setMatrix(matrixRes.data);
    } catch (err) {
      console.error('🔥 [HQ Dashboard Load Error]:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetch = () => {
      Promise.all([
        api.getHQOverview(),
        api.getHQBranchesMatrix()
      ]).then(([overviewRes, matrixRes]) => {
        if (isMounted) {
          setOverview(overviewRes.data);
          setMatrix(matrixRes.data);
          setLoading(false);
          setRefreshing(false);
        }
      }).catch((err) => {
        console.error('🔥 [HQ Dashboard Load Error]:', err);
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    };

    fetch();
    const interval = setInterval(fetch, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHQData();
  };

  const handleToggleBranch = async (branchId: string, currentStatus: boolean, code: string) => {
    const actionText = currentStatus ? 'tạm dừng hoạt động' : 'kích hoạt lại';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} chi nhánh ${code}?`)) {
      return;
    }
    try {
      await api.toggleBranchStatus(branchId);
      await loadHQData();
    } catch (err: any) {
      alert(`Lỗi thay đổi trạng thái: ${err.message}`);
    }
  };

  const handleSelectBranchAndGoPos = async (branch: Branch) => {
    await branchStore.switchBranch(branch.id);
    onSwitchBranchToPos(branch.id);
  };

  // Lọc danh sách chi nhánh
  const filteredBranches = matrix.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(searchBranch.toLowerCase()) || 
                        b.code.toLowerCase().includes(searchBranch.toLowerCase()) ||
                        (b.address && b.address.toLowerCase().includes(searchBranch.toLowerCase()));
    const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? b.is_active : !b.is_active;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. THANH TIÊU ĐỀ HQ & CÁC NÚT ĐIỀU HÀNH CHÍNH */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Building2 size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
                HQ Executive Command Center • Trung Tâm Chỉ Huy Toàn Chuỗi
              </h1>
              <span style={{
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)'
              }}>
                REALTIME LIVE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Giám sát doanh thu tức thì, két tiền ca bán, công nợ khách hàng và vận hành độc lập từng chi nhánh.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleRefresh}
            className="btn-action"
            disabled={refreshing}
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>

          <button
            onClick={onOpenCreateBranchModal}
            className="btn-action"
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              cursor: 'pointer'
            }}
          >
            <Plus size={15} />
            <span>+ Mở Chi Nhánh Mới</span>
          </button>
        </div>
      </div>

      {/* 2. CHỈ SỐ KPI TỔNG THỂ TOÀN CHUỖI (5 THẺ BENTO) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14
      }}>
        {/* KPI 1: Chi nhánh hoạt động */}
        <div style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>MẠNG LƯỚI CHI NHÁNH</span>
            <Store size={18} color="#38bdf8" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
              {overview?.branches.active_branches || 0}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              / {overview?.branches.total_branches || 0} chi nhánh
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#34d399' }}>
            ● 100% chi nhánh đang kết nối API
          </span>
        </div>

        {/* KPI 2: Doanh thu chuỗi hôm nay */}
        <div style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>DOANH THU TOÀN CHUỖI HÔM NAY</span>
            <TrendingUp size={18} color="#34d399" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#34d399' }}>
              {Number(overview?.today_sales.total_revenue || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Từ <strong>{overview?.today_sales.orders_count || 0}</strong> đơn hàng đã thanh toán
          </span>
        </div>

        {/* KPI 3: Tiền mặt trong két ca trực */}
        <div style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>TIỀN MẶT TRONG KÉT CA TRỰC</span>
            <Wallet size={18} color="#fbbf24" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>
              {Number(overview?.live_shifts.total_cash_in_drawers || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Đang trực: <strong>{overview?.live_shifts.open_shifts_count || 0}</strong> ca bán hàng mở
          </span>
        </div>

        {/* KPI 4: Định giá tồn kho */}
        <div style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>GIÁ TRỊ TỒN KHO TOÀN CHUỖI</span>
            <Package size={18} color="#818cf8" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#818cf8' }}>
              {Number(overview?.inventory.total_inventory_valuation || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
          <span style={{ fontSize: 11, color: overview?.inventory.low_stock_alerts ? '#f87171' : '#34d399' }}>
            {overview?.inventory.low_stock_alerts ? `⚠️ ${overview.inventory.low_stock_alerts} sản phẩm sắp hết` : '✔ Mức tồn kho an toàn'}
          </span>
        </div>

        {/* KPI 5: Công nợ khách hàng */}
        <div style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>NỢ PHẢI THU KHÁCH HÀNG</span>
            <CreditCard size={18} color="#f472b6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#f472b6' }}>
              {Number(overview?.customer_debt.total_customer_debt || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Từ <strong>{overview?.customer_debt.indebted_customers_count || 0}</strong> khách có dư nợ
          </span>
        </div>
      </div>

      {/* 3. BẢNG MA TRẬN ĐIỀU HÀNH TỪNG CHI NHÁNH */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Ma Trận Vận Hành & Hiệu Suất Từng Chi Nhánh
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Theo dõi nhân viên trực ca, dòng tiền thực thu và phân quyền độc lập cho từng điểm bán.
            </p>
          </div>

          {/* Bộ lọc tìm kiếm & trạng thái */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              width: 240
            }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Tìm tên, mã, địa chỉ chi nhánh..."
                value={searchBranch}
                onChange={e => setSearchBranch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: 12,
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL" style={{ backgroundColor: '#0f172a' }}>Tất cả trạng thái</option>
              <option value="ACTIVE" style={{ backgroundColor: '#0f172a' }}>Đang hoạt động</option>
              <option value="INACTIVE" style={{ backgroundColor: '#0f172a' }}>Tạm dừng</option>
            </select>
          </div>
        </div>

        {/* Lưới các thẻ Chi Nhánh */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
            <p>Đang tải ma trận dữ liệu toàn chuỗi...</p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertTriangle size={24} color="#f59e0b" style={{ margin: '0 auto 10px auto' }} />
            <p>Không tìm thấy chi nhánh nào phù hợp với bộ lọc.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            gap: 16
          }}>
            {filteredBranches.map(branch => {
              const hasActiveShift = branch.current_shift && branch.current_shift.status === 'OPEN';
              return (
                <div
                  key={branch.id}
                  style={{
                    borderRadius: 10,
                    background: branch.is_active ? 'rgba(30, 41, 59, 0.45)' : 'rgba(30, 41, 59, 0.2)',
                    border: `1px solid ${branch.is_active ? 'rgba(255, 255, 255, 0.09)' : 'rgba(239, 68, 68, 0.2)'}`,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    transition: 'all 0.2s ease',
                    opacity: branch.is_active ? 1 : 0.7
                  }}
                >
                  {/* Header thẻ chi nhánh */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8'
                        }}>
                          {branch.code}
                        </span>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>
                          {branch.name}
                        </h3>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        📍 {branch.address || 'Chưa cập nhật địa chỉ'} • 📞 {branch.phone || 'N/A'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: branch.is_active ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: branch.is_active ? '#34d399' : '#f87171',
                        border: `1px solid ${branch.is_active ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {branch.is_active ? 'HOẠT ĐỘNG' : 'TẠM DỪNG'}
                      </span>
                    </div>
                  </div>

                  {/* Trạng thái ca bán hàng hiện tại */}
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: hasActiveShift ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${hasActiveShift ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={15} color={hasActiveShift ? '#34d399' : 'var(--text-muted)'} />
                      <div>
                        {hasActiveShift ? (
                          <>
                            <span style={{ fontWeight: 600, color: '#34d399' }}>Ca đang mở:</span>{' '}
                            <strong style={{ color: '#f8fafc' }}>{branch.current_shift?.staff_name}</strong>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Hiện chưa có ca trực bán hàng mở</span>
                        )}
                      </div>
                    </div>
                    {hasActiveShift && (
                      <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                        Két đầu ca: {Number(branch.current_shift?.initial_amount || 0).toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </div>

                  {/* Lưới mini 3 chỉ số vận hành chi nhánh */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    textAlign: 'center'
                  }}>
                    <div style={{ padding: '8px 6px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Doanh thu hôm nay</span>
                      <strong style={{ fontSize: 13, color: '#34d399' }}>
                        {Number(branch.sales_summary?.today_revenue || 0).toLocaleString('vi-VN')}đ
                      </strong>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block' }}>
                        {branch.sales_summary?.today_orders || 0} đơn
                      </span>
                    </div>

                    <div style={{ padding: '8px 6px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Vốn tồn kho</span>
                      <strong style={{ fontSize: 13, color: '#818cf8' }}>
                        {Number(branch.inventory_summary?.inventory_value || 0).toLocaleString('vi-VN')}đ
                      </strong>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block' }}>
                        {branch.inventory_summary?.total_sku || 0} mã SKU
                      </span>
                    </div>

                    <div style={{ padding: '8px 6px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Điều chuyển đến</span>
                      <strong style={{ fontSize: 13, color: branch.incoming_transfers ? '#38bdf8' : 'var(--text-dim)' }}>
                        {branch.incoming_transfers} phiếu
                      </strong>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block' }}>Đang đi đường</span>
                    </div>
                  </div>

                  {/* Nút hành động cho từng chi nhánh */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <button
                      onClick={() => handleToggleBranch(branch.id, branch.is_active, branch.code)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: branch.is_active ? '#f87171' : '#34d399',
                        cursor: 'pointer'
                      }}
                    >
                      {branch.is_active ? 'Khóa chi nhánh' : 'Kích hoạt lại'}
                    </button>

                    <button
                      onClick={() => handleSelectBranchAndGoPos(branch)}
                      className="btn-action"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <span>Vào quầy chi nhánh</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
