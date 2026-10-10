import React, { useState, useMemo } from 'react';
import {
  X,
  Store,
  Building,
  Coffee,
  Pill,
  Shirt,
  Wrench,
  Warehouse,
  Wheat,
  Sliders,
  Package,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  Search,
  Zap,
  ShieldCheck,
  Layers,
  Sparkles,
  Database,
  Cpu,
  Check
} from 'lucide-react';
import { 
  INDUSTRY_DOMAINS, 
  BUSINESS_LOGIC_FEATURES, 
  type IndustryDomain 
} from '../../constants/industryDomains';

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    code: string;
    name: string;
    phone?: string;
    address?: string;
    industry_domain: string;
    feature_overrides: Record<string, boolean>;
    toggles: Record<string, any>;
  }) => Promise<void>;
  suggestedCode: string;
  suggestedName: string;
}

export const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  suggestedCode,
  suggestedName
}) => {
  const [code, setCode] = useState(suggestedCode);
  const [name, setName] = useState(suggestedName);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  // Lĩnh vực đang chọn
  const [selectedDomain, setSelectedDomain] = useState<IndustryDomain>(INDUSTRY_DOMAINS[0]);
  
  // Ma trận các logic nghiệp vụ (Tích chọn)
  const [featureChecks, setFeatureChecks] = useState<Record<string, boolean>>({
    ...INDUSTRY_DOMAINS[0].recommendedFeatures
  });

  // Bộ lọc tìm kiếm & nhóm ở cột phải
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<'ALL' | 'KHO' | 'BAN_HANG' | 'TAI_CHINH'>('ALL');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Khi bấm chọn lĩnh vực kinh doanh
  const handleSelectDomain = (domain: IndustryDomain) => {
    setSelectedDomain(domain);
    setFeatureChecks({ ...domain.recommendedFeatures });
  };

  // Khi bật/tắt công tắc logic cụ thể
  const handleToggleFeature = (featureKey: string) => {
    setFeatureChecks(prev => {
      const nextVal = !prev[featureKey];
      const updated = { ...prev, [featureKey]: nextVal };

      // Tự động bảo toàn ràng buộc phụ thuộc (Dependency Guard)
      if (featureKey === 'allow_debt' && nextVal === true) {
        updated.customer_required = true;
      }
      if (featureKey === 'customer_required' && nextVal === false) {
        updated.allow_debt = false;
      }

      return updated;
    });
  };

  // Thao tác nhanh
  const handleSelectAll = () => {
    const all: Record<string, boolean> = {};
    BUSINESS_LOGIC_FEATURES.forEach(f => { all[f.key] = true; });
    setFeatureChecks(all);
  };

  const handleDeselectAll = () => {
    const none: Record<string, boolean> = {};
    BUSINESS_LOGIC_FEATURES.forEach(f => { none[f.key] = false; });
    setFeatureChecks(none);
  };

  const handleResetToDomain = () => {
    setFeatureChecks({ ...selectedDomain.recommendedFeatures });
  };

  // Đếm số logic đang bật
  const activeCount = Object.values(featureChecks).filter(Boolean).length;

  // Lọc tính năng theo tìm kiếm & nhóm
  const filteredFeatures = useMemo(() => {
    return BUSINESS_LOGIC_FEATURES.filter(f => {
      const matchGroup = activeGroupFilter === 'ALL' || f.group === activeGroupFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchSearch = !query || 
        f.name.toLowerCase().includes(query) || 
        f.description.toLowerCase().includes(query) ||
        (f.standardRule && f.standardRule.toLowerCase().includes(query)) ||
        f.key.toLowerCase().includes(query);
      return matchGroup && matchSearch;
    });
  }, [searchQuery, activeGroupFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Mã và Tên chi nhánh là bắt buộc.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Đảm bảo dependency an toàn trước khi gửi
      const finalChecks = { ...featureChecks };
      if (finalChecks.allow_debt) {
        finalChecks.customer_required = true;
      }

      const toggles = {
        has_uom: Boolean(finalChecks.multi_uom),
        has_debt: Boolean(finalChecks.allow_debt),
        has_shifts: Boolean(finalChecks.require_shifts),
        has_barcode: Boolean(finalChecks.pos_barcode),
        allow_negative_stock: Boolean(finalChecks.allow_negative_stock),
        industry_domain: selectedDomain.id
      };

      await onSubmit({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        industry_domain: selectedDomain.id,
        feature_overrides: finalChecks,
        toggles
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo chi nhánh mới.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render icon lĩnh vực
  const renderDomainIcon = (iconName: string, color: string) => {
    const props = { size: 18, color };
    switch (iconName) {
      case 'Store': return <Store {...props} />;
      case 'Building': return <Building {...props} />;
      case 'Coffee': return <Coffee {...props} />;
      case 'Pill': return <Pill {...props} />;
      case 'Shirt': return <Shirt {...props} />;
      case 'Wrench': return <Wrench {...props} />;
      case 'Warehouse': return <Warehouse {...props} />;
      case 'Wheat': return <Wheat {...props} />;
      default: return <Sliders {...props} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1200, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '16px',
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(12px)'
      }}
    >
      <div 
        className="modal-content" 
        style={{ 
          width: '96%', 
          maxWidth: '1240px', 
          height: '92vh',
          maxHeight: '920px', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0,
          overflow: 'hidden',
          borderRadius: '18px',
          background: 'linear-gradient(145deg, #0b1329 0%, #070d1e 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.1)'
        }}
      >
        {/* ================================================================= */}
        {/* TOP HEADER: PHONG CÁCH NO-CODE ARCHITECT STUDIO */}
        {/* ================================================================= */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(6, 182, 212, 0.45)'
            }}>
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  MEB NO-CODE ARCHITECT STUDIO
                </h3>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  VẬN HÀNH ĐA CHI NHÁNH TỰ ĐỘNG
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
                Chọn lĩnh vực kinh doanh để nạp cấu hình tối ưu hoặc tích chọn từng logic nghiệp vụ độc lập.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Badge chỉ số công nghệ */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: 12,
              fontWeight: 700,
              color: '#34d399'
            }}>
              <Zap size={14} />
              <span>{activeCount} / 12 Logic Đang Kích Hoạt</span>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BODY: 2 CỘT SPLIT STUDIO SIÊU THOÁNG (KHÔNG BỊ CHÈN ÉP / DẸT) */}
        {/* ================================================================= */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* --------------------------------------------------------------- */}
          {/* CỘT TRÁI (400px): ĐỊNH DANH CHI NHÁNH & BỘ CHỌN 9 LĨNH VỰC */}
          {/* --------------------------------------------------------------- */}
          <div style={{
            width: '400px',
            flexShrink: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(11, 19, 41, 0.65)',
            minHeight: 0
          }}>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}>
              {/* PHẦN A: THÔNG TIN CƠ BẢN CHI NHÁNH */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#38bdf8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 12
                }}>
                  <Database size={14} />
                  <span>1. Định Danh Chi Nhánh Mới</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      Mã Chi Nhánh *
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="VD: CN-04"
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f8fafc',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      Tên Chi Nhánh *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Chi Nhánh Thủ Đức"
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f8fafc',
                        fontSize: 13,
                        fontWeight: 600,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      Số Điện Thoại
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="VD: 0908 123 456"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        fontSize: 12,
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      Địa Chỉ Hoạt Động
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="VD: 120 Võ Văn Ngân"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        fontSize: 12,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN B: BỘ CHỌN 9 LĨNH VỰC KINH DOANH */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#38bdf8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    <Layers size={14} />
                    <span>2. Lựa Chọn Lĩnh Vực (9 Mẫu)</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>Bấm để nạp nhanh</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {INDUSTRY_DOMAINS.map(domain => {
                    const isSelected = selectedDomain.id === domain.id;
                    return (
                      <div
                        key={domain.id}
                        onClick={() => handleSelectDomain(domain)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: isSelected 
                            ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%)' 
                            : 'rgba(15, 23, 42, 0.5)',
                          border: isSelected 
                            ? '1.5px solid #06b6d4' 
                            : '1px solid rgba(255, 255, 255, 0.06)',
                          boxShadow: isSelected ? '0 0 14px rgba(6, 182, 212, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: `${domain.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {renderDomainIcon(domain.iconName, domain.color)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 800 : 700,
                              color: isSelected ? '#ffffff' : '#e2e8f0',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {domain.name}
                            </span>
                            {isSelected && (
                              <span style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: '#06b6d4',
                                color: '#000000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 11,
                            color: isSelected ? '#38bdf8' : '#94a3b8',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {domain.badge} • {domain.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CARD TỰ ĐỘNG SINH DỮ LIỆU */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px dashed rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <Sparkles size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  Chi nhánh mới sẽ được cấp phát ngay kho hàng mẫu 100 sản phẩm và bảng giá quy đổi chuẩn để có thể mở bán tức thì.
                </span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* CỘT PHẢI (Flexible ~840px): MA TRẬN LOGIC NO-CODE CHUYÊN SÂU */}
          {/* --------------------------------------------------------------- */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'rgba(8, 15, 34, 0.5)'
          }}>
            {/* THANH CÔNG CỤ TÌM KIẾM, PHÂN LOẠI & THAO TÁC NHANH */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} color="#38bdf8" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                    MA TRẬN LOGIC NGHIỆP VỤ NO-CODE
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                    border: '1px solid rgba(6, 182, 212, 0.3)'
                  }}>
                    {activeCount} ĐANG BẬT
                  </span>
                </div>

                {/* 3 Nút thao tác nhanh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#e2e8f0',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Bật Tất Cả
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94a3b8',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Tắt Hết
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToDomain}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      background: 'rgba(2, 132, 199, 0.2)',
                      border: '1px solid rgba(2, 132, 199, 0.4)',
                      color: '#38bdf8',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Khôi Phục Theo {selectedDomain.shortName}
                  </button>
                </div>
              </div>

              {/* Ô TÌM KIẾM & TAB PHÂN LOẠI NHÓM */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[
                    { id: 'ALL', label: 'Tất Cả (12)' },
                    { id: 'KHO', label: 'Kho & Đa Đơn Vị (4)' },
                    { id: 'BAN_HANG', label: 'Bán Hàng & POS (5)' },
                    { id: 'TAI_CHINH', label: 'Tài Chính & Nợ (3)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveGroupFilter(tab.id as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        background: activeGroupFilter === tab.id ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                        color: activeGroupFilter === tab.id ? '#ffffff' : '#94a3b8',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm mã hoặc tên logic..."
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      borderRadius: 6,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: 11,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* DANH SÁCH TECH SWITCH CARDS (CUỘN RIÊNG BIỆT, KHÔNG CHE KHUẤT) */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minHeight: 0
            }}>
              {filteredFeatures.map(feat => {
                const isChecked = Boolean(featureChecks[feat.key]);
                const groupColor = feat.group === 'KHO' ? '#38bdf8' : feat.group === 'BAN_HANG' ? '#10b981' : '#f59e0b';
                
                return (
                  <div
                    key={feat.key}
                    onClick={() => handleToggleFeature(feat.key)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      background: isChecked ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.35)',
                      border: isChecked ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                      boxShadow: isChecked ? '0 4px 18px rgba(6, 182, 212, 0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isChecked) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isChecked) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                  >
                    {/* KHỐI TRÁI: THÔNG TIN LOGIC */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: isChecked ? `${groupColor}20` : 'rgba(255, 255, 255, 0.04)',
                        color: isChecked ? groupColor : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                        transition: 'all 0.15s ease'
                      }}>
                        {feat.group === 'KHO' ? <Package size={18} /> : feat.group === 'BAN_HANG' ? <ShoppingCart size={18} /> : <CreditCard size={18} />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: isChecked ? '#f8fafc' : '#94a3b8'
                          }}>
                            {feat.name}
                          </span>
                          
                          {feat.standardRule && (
                            <span style={{
                              fontSize: 10,
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)'
                            }}>
                              {feat.standardRule}
                            </span>
                          )}

                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: `${groupColor}15`,
                            color: groupColor,
                            fontWeight: 700
                          }}>
                            {feat.badge}
                          </span>
                        </div>

                        <p style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: isChecked ? '#cbd5e1' : '#64748b',
                          lineHeight: 1.45
                        }}>
                          {feat.description}
                        </p>
                      </div>
                    </div>

                    {/* KHỐI PHẢI: GLOWING TOGGLE SWITCH CHUẨN CÔNG NGHỆ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        color: isChecked ? '#34d399' : '#64748b'
                      }}>
                        {isChecked ? 'ĐANG BẬT' : 'TẮT'}
                      </span>

                      {/* NÚT GẠT CÔNG TẮC (iOS GLOW SWITCH) */}
                      <div 
                        style={{
                          width: 48,
                          height: 26,
                          borderRadius: 14,
                          background: isChecked ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : '#1e293b',
                          border: isChecked ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.12)',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: isChecked ? 'flex-end' : 'flex-start',
                          boxShadow: isChecked ? '0 0 12px rgba(16, 185, 129, 0.5)' : 'none',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          {isChecked && <Check size={12} color="#059669" strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BOTTOM FOOTER: HÀNH ĐỘNG DỨT ĐIỂM & BÁO LỖI */}
        {/* ================================================================= */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(11, 19, 41, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            {error ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fb7185', fontSize: 13, fontWeight: 700 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                <span>Mô hình: <strong style={{ color: '#f8fafc' }}>{selectedDomain.name}</strong></span>
                <span>•</span>
                <span>Kích hoạt: <strong style={{ color: '#38bdf8' }}>{activeCount}/12 Quy Tắc Bất Biến</strong></span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy Bỏ
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 18px rgba(6, 182, 212, 0.4)',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? (
                <span>Đang Khởi Tạo Hệ Thống...</span>
              ) : (
                <>
                  <Zap size={16} />
                  <span>🚀 Khởi Chạy Chi Nhánh ({activeCount} Logic)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
