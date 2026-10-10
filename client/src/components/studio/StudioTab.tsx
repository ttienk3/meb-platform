import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  SlidersHorizontal, 
  RotateCcw, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Search, 
  History, 
  Zap, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Database,
  MousePointerClick,
  GitBranch
} from 'lucide-react';
import { api, type Branch } from '../../services/api';
import { NoCodeSchemaBuilder } from './NoCodeSchemaBuilder';
import { DynamicEntityWorkspace } from './DynamicEntityWorkspace';
import { WorkflowRulesTab } from './WorkflowRulesTab';
import { INDUSTRY_DOMAINS, type IndustryDomain } from '../../constants/industryDomains';

interface StudioTabProps {
  currentBranch: Branch | null;
  onConfigUpdated?: () => void;
}

interface FeatureRegistryItem {
  key: string;
  group_name: string;
  label: string;
  description: string;
  data_type: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON';
  default_value: any;
  is_locked: boolean;
  options?: any;
  dependencies?: string[];
}

interface EffectiveFeatureItem {
  feature_key: string;
  effective_value: any;
  source: string;
  is_overridden?: boolean;
  is_locked: boolean;
  group_name: string;
  label: string;
  description: string;
  data_type: string;
}

interface AuditLogItem {
  id: string;
  feature_key: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_value: any;
  new_value: any;
  changed_by: string;
  created_at: string;
}

export const StudioTab: React.FC<StudioTabProps> = ({ currentBranch, onConfigUpdated }) => {
  const [registry, setRegistry] = useState<FeatureRegistryItem[]>([]);
  const [effectiveFeatures, setEffectiveFeatures] = useState<EffectiveFeatureItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [subTab, setSubTabState] = useState<'features' | 'schema' | 'entities' | 'workflows'>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('subTab') as any;
      if (s && ['features', 'schema', 'entities', 'workflows'].includes(s)) return s;
    }
    return 'features';
  });

  const setSubTab = (tab: 'features' | 'schema' | 'entities' | 'workflows') => {
    setSubTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('subTab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Bộ lọc
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Thông báo phản hồi
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Tải dữ liệu từ backend
  const loadData = useCallback(async () => {
    if (!currentBranch) return;
    try {
      setLoading(true);
      const [regRes, effRes, auditRes] = await Promise.all([
        api.getFeatureRegistry(),
        api.getBranchFeatures(currentBranch.id),
        api.getAuditLogs(currentBranch.id)
      ]);

      if (regRes.success) setRegistry(regRes.data || []);
      if (effRes.success) setEffectiveFeatures(effRes.data || []);
      if (auditRes.success) setAuditLogs(auditRes.data || []);
    } catch (err: any) {
      console.error('🔥 [Studio Load Data Error]:', err);
      setFeedback({ type: 'error', message: err.message || 'Không thể tải cấu hình No-Code Studio.' });
    } finally {
      setLoading(false);
    }
  }, [currentBranch]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!currentBranch) return;
      try {
        setLoading(true);
        const [regRes, effRes, auditRes] = await Promise.all([
          api.getFeatureRegistry(),
          api.getBranchFeatures(currentBranch.id),
          api.getAuditLogs(currentBranch.id)
        ]);
        if (!isMounted) return;
        if (regRes.success) setRegistry(regRes.data || []);
        if (effRes.success) setEffectiveFeatures(effRes.data || []);
        if (auditRes.success) setAuditLogs(auditRes.data || []);
      } catch (err: any) {
        if (!isMounted) return;
        setFeedback({ type: 'error', message: err.message || 'Không thể tải cấu hình No-Code Studio.' });
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => { isMounted = false; };
  }, [currentBranch]);

  // Nhóm các tính năng duy nhất
  const groups = useMemo(() => {
    const set = new Set<string>();
    registry.forEach(r => {
      if (r.group_name) set.add(r.group_name);
    });
    return Array.from(set);
  }, [registry]);

  // Kết hợp thông tin registry và giá trị hiệu lực của chi nhánh
  const combinedFeatures = useMemo(() => {
    const effMap = new Map<string, EffectiveFeatureItem>();
    effectiveFeatures.forEach(ef => effMap.set(ef.feature_key, ef));

    return registry.map(reg => {
      const eff = effMap.get(reg.key);
      const effectiveValue = eff ? eff.effective_value : reg.default_value;
      const isOverridden = eff ? (Boolean(eff.is_overridden) || eff.source === 'BRANCH_OVERRIDE' || eff.source === 'BRANCH') : false;
      const source = eff ? eff.source : 'ORGANIZATION_DEFAULT';
      const isLocked = reg.is_locked || (eff ? eff.is_locked : false);

      return {
        ...reg,
        effective_value: effectiveValue,
        is_overridden: isOverridden,
        source,
        is_locked: isLocked
      };
    });
  }, [registry, effectiveFeatures]);

  // Lọc theo từ khóa tìm kiếm và nhóm
  const filteredFeatures = useMemo(() => {
    return combinedFeatures.filter(f => {
      const matchGroup = selectedGroup === 'ALL' || f.group_name === selectedGroup;
      const query = searchQuery.toLowerCase().trim();
      const matchSearch = !query || 
        f.key.toLowerCase().includes(query) || 
        f.label.toLowerCase().includes(query) || 
        (f.description && f.description.toLowerCase().includes(query));
      return matchGroup && matchSearch;
    });
  }, [combinedFeatures, selectedGroup, searchQuery]);

  // Thống kê Bento
  const metrics = useMemo(() => {
    const total = registry.length;
    const enabled = combinedFeatures.filter(f => Boolean(f.effective_value)).length;
    const overridden = combinedFeatures.filter(f => f.is_overridden).length;
    const inherited = Math.max(0, total - overridden);
    return { total, enabled, overridden, inherited };
  }, [registry, combinedFeatures]);

  // Xử lý bật/tắt (Toggle) tính năng
  const handleToggle = async (feature: any) => {
    if (!currentBranch || feature.is_locked || mutatingKey) return;

    const newValue = !feature.effective_value;
    setMutatingKey(feature.key);
    setFeedback(null);

    try {
      const res = await api.overrideFeature({
        branch_id: currentBranch.id,
        feature_key: feature.key,
        value: newValue,
        updated_by: 'Chủ Hệ Thống (Studio)'
      });

      if (res.success) {
        await api.invalidateCache();
        setFeedback({ 
          type: 'success', 
          message: `Đã ${newValue ? 'BẬT' : 'TẮT'} tính năng [${feature.label}] cho chi nhánh ${currentBranch.code}!` 
        });
        await loadData();
        if (onConfigUpdated) onConfigUpdated();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi ghi đè tính năng.' });
    } finally {
      setMutatingKey(null);
    }
  };

  // Xử lý khôi phục thừa kế mặc định (Reset Override)
  const handleResetOverride = async (featureKey: string, label: string) => {
    if (!currentBranch || mutatingKey) return;

    setMutatingKey(featureKey);
    setFeedback(null);

    try {
      const res = await api.resetFeatureOverride(currentBranch.id, featureKey);
      if (res.success) {
        await api.invalidateCache();
        setFeedback({ 
          type: 'success', 
          message: `Đã khôi phục kế thừa mặc định cho tính năng [${label}]!` 
        });
        await loadData();
        if (onConfigUpdated) onConfigUpdated();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi khôi phục tính năng.' });
    } finally {
      setMutatingKey(null);
    }
  };

  // Áp dụng nhanh toàn bộ gói logic theo lĩnh vực kinh doanh
  const handleApplyDomainPreset = async (domain: IndustryDomain) => {
    if (!currentBranch || mutatingKey) return;
    if (!confirm(`Bạn có chắc muốn áp dụng toàn bộ gói logic nghiệp vụ [${domain.name}] cho chi nhánh ${currentBranch.name || currentBranch.code}? Các cờ tính năng sẽ được thiết lập tự động.`)) {
      return;
    }

    setMutatingKey('BATCH_APPLY');
    setFeedback(null);
    try {
      const res = await api.batchOverrideFeatures(
        currentBranch.id,
        domain.recommendedFeatures,
        `Áp dụng gói lĩnh vực: ${domain.name}`
      );
      if (res.success) {
        await api.invalidateCache();
        setFeedback({
          type: 'success',
          message: `🎉 Đã áp dụng thành công gói logic [${domain.name}] (${domain.badge}) cho chi nhánh ${currentBranch.code}!`
        });
        await loadData();
        if (onConfigUpdated) onConfigUpdated();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Không thể áp dụng gói logic.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi áp dụng gói logic lĩnh vực.' });
    } finally {
      setMutatingKey(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* THANH ĐIỀU HƯỚNG 3 PHÂN HỆ NO-CODE STUDIO */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 6,
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 10,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setSubTab('features')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: subTab === 'features' ? '#0284c7' : 'transparent',
            color: subTab === 'features' ? '#ffffff' : 'var(--text-muted)'
          }}
        >
          <SlidersHorizontal size={15} />
          <span>🎛️ Cờ Tính Năng Nghiệp Vụ</span>
        </button>

        <button
          onClick={() => setSubTab('schema')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: subTab === 'schema' ? '#0284c7' : 'transparent',
            color: subTab === 'schema' ? '#ffffff' : 'var(--text-muted)'
          }}
        >
          <Database size={15} />
          <span>🏗️ Trình Tạo CSDL & Bảng Động</span>
        </button>

        <button
          onClick={() => setSubTab('entities')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: subTab === 'entities' ? '#0284c7' : 'transparent',
            color: subTab === 'entities' ? '#ffffff' : 'var(--text-muted)'
          }}
        >
          <MousePointerClick size={15} />
          <span>⚡ Dữ Liệu & Nút Hành Động</span>
        </button>

        <button
          onClick={() => setSubTab('workflows')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: subTab === 'workflows' ? '#0284c7' : 'transparent',
            color: subTab === 'workflows' ? '#ffffff' : 'var(--text-muted)'
          }}
        >
          <GitBranch size={15} />
          <span>🔄 Tự Động Hóa & Workflow (If-Then)</span>
        </button>
      </div>

      {subTab === 'schema' ? (
        <NoCodeSchemaBuilder />
      ) : subTab === 'entities' ? (
        <DynamicEntityWorkspace />
      ) : subTab === 'workflows' ? (
        <WorkflowRulesTab />
      ) : (
        <>
          {/* 1. KHỐI THỐNG KÊ BENTO 4 CHỈ SỐ MA TRẬN NO-CODE */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* Ô 1: Tổng số cờ tính năng */}
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
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG CỜ TÍNH NĂNG</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.total}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Từ điển Registry hệ thống</div>
          </div>
        </div>

        {/* Ô 2: Đang kích hoạt */}
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
            <Zap size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>ĐANG KÍCH HOẠT</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399', marginTop: 2 }}>{metrics.enabled}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Đang chạy tại {currentBranch?.code}</div>
          </div>
        </div>

        {/* Ô 3: Tùy biến chi nhánh (Branch Override) */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(168, 85, 247, 0.15)',
            color: '#c084fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>CẤU HÌNH ĐẶC THÙ</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#c084fc', marginTop: 2 }}>{metrics.overridden}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Ghi đè riêng cho chi nhánh</div>
          </div>
        </div>

        {/* Ô 4: Kế thừa tổ chức (Inherited) */}
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
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>KẾ THỪA MẶC ĐỊNH</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{metrics.inherited}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Đồng bộ từ Doanh nghiệp</div>
          </div>
        </div>
      </div>

      {/* 1.5 THANH ÁP DỤNG NHANH GÓI LOGIC THEO LĨNH VỰC (1-CLICK DOMAIN PRESETS) */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
              Áp Dụng Nhanh Gói Nghiệp Vụ Theo Lĩnh Vực (1-Click Preset)
            </span>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'rgba(2, 132, 199, 0.2)',
              color: '#38bdf8',
              fontWeight: 600
            }}>
              9 Mô Hình Có Sẵn
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Nhấp vào bất kỳ lĩnh vực nào để áp dụng tự động toàn bộ logic cờ tương ứng
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10
        }}>
          {INDUSTRY_DOMAINS.map(domain => {
            const isApplying = mutatingKey === 'BATCH_APPLY';
            const getEmoji = (iconName: string) => {
              switch (iconName) {
                case 'Store': return '🏬';
                case 'Building': return '🧱';
                case 'Coffee': return '☕';
                case 'Pill': return '💊';
                case 'Shirt': return '👕';
                case 'Wrench': return '🔧';
                case 'Warehouse': return '🚛';
                case 'Wheat': return '🌾';
                default: return '🎛️';
              }
            };
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => handleApplyDomainPreset(domain)}
                  disabled={isApplying}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${domain.color}40`,
                    background: 'rgba(15, 23, 42, 0.5)',
                    cursor: isApplying ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    opacity: isApplying ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${domain.color}15`;
                    e.currentTarget.style.borderColor = domain.color;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)';
                    e.currentTarget.style.borderColor = `${domain.color}40`;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{getEmoji(domain.iconName)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#f8fafc',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {domain.shortName || domain.name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: domain.color,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {domain.badge}
                    </div>
                  </div>
                </button>
              );
          })}
        </div>
      </div>

      {/* Thông báo Feedback */}
      {feedback && (
        <div style={{
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: feedback.type === 'success' ? '#34d399' : '#fb7185'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span style={{ fontSize: 13, fontWeight: 600 }}>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="btn-action" 
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            Đóng
          </button>
        </div>
      )}

      {/* 2. THANH CÔNG CỤ TÌM KIẾM, BỘ LỌC NHÓM & NHẬT KÝ KIỂM TOÁN */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        {/* Tìm kiếm & Filter Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ position: 'relative', minWidth: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input 
              type="text"
              placeholder="Tìm theo mã cờ hoặc tên tính năng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 8,
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: 13
              }}
            />
          </div>

          {/* Tab nhóm */}
          <div style={{ display: 'flex', background: 'var(--surface-sunken)', padding: 3, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setSelectedGroup('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: selectedGroup === 'ALL' ? 'var(--primary)' : 'transparent',
                color: selectedGroup === 'ALL' ? '#fff' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Tất cả
            </button>
            {groups.map(grp => (
              <button
                key={grp}
                onClick={() => setSelectedGroup(grp)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: selectedGroup === grp ? 'var(--primary)' : 'transparent',
                  color: selectedGroup === grp ? '#fff' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        {/* Nút Xem Nhật Ký Kiểm Toán (Audit Logs) & Tải lại */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowAuditModal(!showAuditModal)}
            className="btn-action"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '8px 14px',
              background: showAuditModal ? 'rgba(56, 189, 248, 0.2)' : undefined,
              borderColor: showAuditModal ? 'rgba(56, 189, 248, 0.4)' : undefined,
              color: showAuditModal ? '#38bdf8' : undefined
            }}
          >
            <History size={15} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {showAuditModal ? 'Ẩn Nhật Ký' : `Nhật Ký Kiểm Toán (${auditLogs.length})`}
            </span>
          </button>

          <button 
            onClick={loadData} 
            className="btn-action" 
            title="Làm mới ma trận cấu hình"
            style={{ padding: '8px 10px' }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* 3. KHAY NHẬT KÝ KIỂM TOÁN (AUDIT LOGS TRAY) KHI ĐƯỢC MỞ */}
      {showAuditModal && (
        <div className="glass-panel" style={{ padding: 20, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
              <ShieldCheck size={18} />
              Nhật Ký Thay Đổi Cấu Hình Chi Nhánh {currentBranch?.code} (Ghi Nhận Bởi Trigger Bất Biến)
            </h4>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tự động lưu trữ bất biến (INV-10)</span>
          </div>

          {auditLogs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              Chưa có bản ghi thay đổi cấu hình nào cho chi nhánh này.
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Thời gian</th>
                    <th style={{ padding: '8px 12px' }}>Cờ Tính Năng</th>
                    <th style={{ padding: '8px 12px' }}>Hành động</th>
                    <th style={{ padding: '8px 12px' }}>Biến động</th>
                    <th style={{ padding: '8px 12px' }}>Người sửa</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#38bdf8' }}>
                        <code>{log.feature_key}</code>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: log.action === 'INSERT' ? 'rgba(16, 185, 129, 0.15)' : (log.action === 'DELETE' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                          color: log.action === 'INSERT' ? '#34d399' : (log.action === 'DELETE' ? '#fb7185' : '#fbbf24')
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: 'var(--text-dim)' }}>{JSON.stringify(log.old_value)}</span>
                        <ArrowRight size={11} style={{ margin: '0 6px', display: 'inline' }} />
                        <span style={{ color: '#f8fafc', fontWeight: 600 }}>{JSON.stringify(log.new_value)}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                        {log.changed_by || 'Hệ Thống'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. MA TRẬN BENTO CARDS CÁC CỜ TÍNH NĂNG NO-CODE */}
      {loading ? (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang nạp ma trận cấu hình No-Code từ Database...
        </div>
      ) : filteredFeatures.length === 0 ? (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Không tìm thấy cờ tính năng nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filteredFeatures.map(feat => {
            const isOverridden = feat.is_overridden;
            const isEnabled = Boolean(feat.effective_value);
            const isMutating = mutatingKey === feat.key;

            return (
              <div 
                key={feat.key} 
                className="glass-panel"
                style={{
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isOverridden ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid var(--border-subtle)',
                  background: isOverridden ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)' : undefined,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Header Thẻ: Nhóm, Tên cờ & Huy hiệu Nguồn */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-dim)',
                        letterSpacing: '0.05em'
                      }}>
                        {feat.group_name}
                      </span>

                      {feat.is_locked ? (
                        <span 
                          title="Tính năng bị Khóa bởi Doanh nghiệp: Chi nhánh không được tự ý ghi đè"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            background: 'rgba(244, 63, 94, 0.15)',
                            color: '#fb7185'
                          }}
                        >
                          <Lock size={10} /> ĐÃ KHÓA
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          background: 'rgba(52, 211, 153, 0.1)',
                          color: '#34d399'
                        }}>
                          <Unlock size={10} /> MỞ
                        </span>
                      )}
                    </div>

                    {/* Huy hiệu Nguồn */}
                    {isOverridden ? (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: '#c084fc',
                        border: '1px solid rgba(168, 85, 247, 0.4)'
                      }}>
                        TÙY BIẾN CHI NHÁNH
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--text-dim)'
                      }}>
                        KẾ THỪA MẶC ĐỊNH
                      </span>
                    )}
                  </div>

                  {/* Tên nhãn và Key */}
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                    {feat.label}
                  </h4>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', marginBottom: 10 }}>
                    <code>{feat.key}</code>
                  </div>

                  {/* Mô tả nghiệp vụ */}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, minHeight: 36 }}>
                    {feat.description || 'Không có mô tả chi tiết.'}
                  </p>
                </div>

                {/* Footer Thẻ: Công tắc Toggle & Nút Reset Override */}
                <div style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  {/* Nút Khôi phục mặc định nếu đang ghi đè */}
                  {isOverridden ? (
                    <button
                      onClick={() => handleResetOverride(feat.key, feat.label)}
                      disabled={isMutating}
                      className="btn-action"
                      style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        color: '#c084fc',
                        borderColor: 'rgba(168, 85, 247, 0.3)'
                      }}
                      title="Hủy bỏ ghi đè, quay lại giá trị mặc định của tổ chức"
                    >
                      <RotateCcw size={11} /> Khôi phục mặc định
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      Mặc định: <strong>{String(feat.default_value)}</strong>
                    </span>
                  )}

                  {/* Nút Toggle Trực quan */}
                  <button
                    onClick={() => handleToggle(feat)}
                    disabled={feat.is_locked || isMutating}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: feat.is_locked || isMutating ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      opacity: feat.is_locked ? 0.5 : 1,
                      padding: '4px 8px',
                      borderRadius: 8
                    }}
                    title={feat.is_locked ? 'Tính năng bị khóa bởi Doanh nghiệp' : 'Bấm để Bật/Tắt tính năng'}
                  >
                    <span style={{ 
                      fontSize: 12, 
                      fontWeight: 700, 
                      color: isEnabled ? '#34d399' : 'var(--text-dim)' 
                    }}>
                      {isEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                    </span>
                    {isEnabled ? (
                      <ToggleRight size={32} color="#34d399" />
                    ) : (
                      <ToggleLeft size={32} color="var(--text-dim)" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
};
