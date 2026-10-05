import React, { useState } from 'react';
import type { 
  BranchRecord, 
  CustomEntityRecord, 
  UomConversionRecord, 
  StockAuditLogRecord 
} from '../types';
import { 
  Building2, 
  Boxes, 
  ArrowRightLeft, 
  Plus, 
  Trash2, 
  Tag, 
  MapPin, 
  Phone, 
  Settings2,
  Barcode,
  DollarSign,
  ClipboardList,
  AlertCircle
} from 'lucide-react';

interface OwnerNoCodeStudioProps {
  branches: BranchRecord[];
  entities: CustomEntityRecord[];
  conversions: UomConversionRecord[];
  auditLogs: StockAuditLogRecord[];
  activeBranchCode: string;
  onSelectActiveBranch: (code: string) => void;
  onCreateBranch: (data: Omit<BranchRecord, 'id' | 'created' | 'updated'>) => Promise<void>;
  onDeleteBranch: (id: string) => Promise<void>;
  onCreateEntity: (data: Omit<CustomEntityRecord, 'id' | 'created' | 'updated'>) => Promise<void>;
  onDeleteEntity: (id: string) => Promise<void>;
  onCreateConversion: (data: Omit<UomConversionRecord, 'id' | 'created' | 'updated'>) => Promise<void>;
  onDeleteConversion: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const OwnerNoCodeStudio: React.FC<OwnerNoCodeStudioProps> = ({
  branches,
  entities,
  conversions,
  auditLogs,
  activeBranchCode,
  onSelectActiveBranch,
  onCreateBranch,
  onDeleteBranch,
  onCreateEntity,
  onDeleteEntity,
  onCreateConversion,
  onDeleteConversion,
  isLoading
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ENTITIES' | 'BRANCHES' | 'CONVERSIONS' | 'AUDIT_LOGS'>('ENTITIES');

  // FORM TẠO CHI NHÁNH
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');

  // FORM TẠO VẬT THỂ ĐỘNG (NO-CODE BUILDER)
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [newEntityCode, setNewEntityCode] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityCategory, setNewEntityCategory] = useState('VLXD & Bán Lẻ');
  const [newEntityBaseUom, setNewEntityBaseUom] = useState('Thùng');
  const [newEntityDesc, setNewEntityDesc] = useState('');
  const [newBarcodeBase, setNewBarcodeBase] = useState('');
  const [newBarcodeSub, setNewBarcodeSub] = useState('');
  const [newPriceBase, setNewPriceBase] = useState<number>(0);
  const [newPriceSub, setNewPriceSub] = useState<number>(0);
  const [newMinSafeStock, setNewMinSafeStock] = useState<number>(5);

  const [dynamicAttrs, setDynamicAttrs] = useState<Array<{ key: string; value: string }>>([
    { key: 'màu_sắc', value: 'Xám tiêu chuẩn' },
    { key: 'trọng_lượng_kg', value: '20' }
  ]);

  // FORM TẠO QUY ĐỔI ĐƠN VỊ
  const [showConvModal, setShowConvModal] = useState(false);
  const [convEntityCode, setConvEntityCode] = useState('');
  const [convFromUom, setConvFromUom] = useState('Thùng');
  const [convToUom, setConvToUom] = useState('Bì');
  const [convMultiplier, setConvMultiplier] = useState(24);
  const [convNotes, setConvNotes] = useState('');

  // Xử lý tạo chi nhánh
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchCode.trim() || !newBranchName.trim()) return;
    await onCreateBranch({
      code: newBranchCode.trim().toUpperCase(),
      name: newBranchName.trim(),
      address: newBranchAddress.trim(),
      phone: newBranchPhone.trim(),
      is_active: true
    });
    setNewBranchCode('');
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setShowBranchModal(false);
  };

  // Xử lý tạo vật thể động
  const handleSaveEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityCode.trim() || !newEntityName.trim() || !newEntityBaseUom.trim()) return;

    // Chuyển array thuộc tính động thành JSON object
    const attrsObject: Record<string, string | number> = {};
    dynamicAttrs.forEach(attr => {
      if (attr.key.trim()) {
        const numVal = Number(attr.value);
        attrsObject[attr.key.trim()] = !isNaN(numVal) && attr.value.trim() !== '' ? numVal : attr.value;
      }
    });

    await onCreateEntity({
      code: newEntityCode.trim().toUpperCase(),
      name: newEntityName.trim(),
      category: newEntityCategory.trim(),
      base_uom: newEntityBaseUom.trim(),
      description: newEntityDesc.trim(),
      barcode_base: newBarcodeBase.trim(),
      barcode_sub: newBarcodeSub.trim(),
      price_base: Number(newPriceBase) || 0,
      price_sub: Number(newPriceSub) || 0,
      min_safe_stock: Number(newMinSafeStock) || 5,
      dynamic_attributes: attrsObject
    });

    setNewEntityCode('');
    setNewEntityName('');
    setNewEntityDesc('');
    setNewBarcodeBase('');
    setNewBarcodeSub('');
    setNewPriceBase(0);
    setNewPriceSub(0);
    setNewMinSafeStock(5);
    setDynamicAttrs([]);
    setShowEntityModal(false);
  };

  const addDynamicAttrField = () => {
    setDynamicAttrs([...dynamicAttrs, { key: '', value: '' }]);
  };

  const removeDynamicAttrField = (idx: number) => {
    setDynamicAttrs(dynamicAttrs.filter((_, i) => i !== idx));
  };

  const updateDynamicAttrField = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...dynamicAttrs];
    updated[idx][field] = val;
    setDynamicAttrs(updated);
  };

  const handleSaveConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convEntityCode || !convFromUom || !convToUom || convMultiplier <= 0) return;

    await onCreateConversion({
      entity_code: convEntityCode,
      from_uom: convFromUom.trim(),
      to_uom: convToUom.trim(),
      multiplier: Number(convMultiplier),
      notes: convNotes.trim()
    });

    setConvNotes('');
    setShowConvModal(false);
  };

  return (
    <div className="studio-container" style={{ padding: '24px 32px' }}>
      {/* HEADER NO-CODE STUDIO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings2 size={26} color="var(--color-primary)" />
            MEB No-Code Studio (Trung Tâm Quản Trị Hệ Thống)
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: '6px 0 0 0', fontSize: 14 }}>
            Tự định nghĩa Vật thể động, Mã vạch Barcode, Bảng giá đa tầng & Giám sát Audit Log rã thùng (INV-04 / INV-10)
          </p>
        </div>

        {/* CỤM NÚT SUB-TAB */}
        <div style={{ display: 'flex', gap: 8, background: 'var(--color-surface)', padding: 6, borderRadius: 10, border: '1px solid var(--color-border)' }}>
          <button
            className={`btn ${activeSubTab === 'ENTITIES' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('ENTITIES')}
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            <Boxes size={16} /> 1. Vật Thể & Giá ({entities.length})
          </button>
          <button
            className={`btn ${activeSubTab === 'CONVERSIONS' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('CONVERSIONS')}
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            <ArrowRightLeft size={16} /> 2. Quy Đổi Thùng-Bì ({conversions.length})
          </button>
          <button
            className={`btn ${activeSubTab === 'BRANCHES' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('BRANCHES')}
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            <Building2 size={16} /> 3. Chi Nhánh ({branches.length})
          </button>
          <button
            className={`btn ${activeSubTab === 'AUDIT_LOGS' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('AUDIT_LOGS')}
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            <ClipboardList size={16} /> 4. Sổ Kiểm Toán ({auditLogs.length})
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: 16, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="dot-pulse" style={{ background: '#3b82f6' }}></div>
          Đang đồng bộ dữ liệu thời gian thực với PocketBase Core Engine...
        </div>
      )}

      {/* =====================================================================
          TAB 1: VẬT THỂ & GIÁ ĐA TẦNG (DYNAMIC ENTITIES & PRICING)
          ===================================================================== */}
      {activeSubTab === 'ENTITIES' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Danh Sách Vật Thể, Barcode & Bảng Giá Đa Tầng</h2>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Tự động phân biệt Barcode Thùng (áp giá sỉ) vs Barcode Bì lẻ (áp giá lẻ) cho máy quét POS siêu tốc.
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowEntityModal(true)}>
              <Plus size={16} /> + Tạo Vật Thể Mới (No-Code)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
            {entities.map(ent => (
              <div 
                key={ent.id} 
                style={{ 
                  background: 'var(--color-surface)', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: 14, 
                  padding: 20,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                      MÃ: {ent.code}
                    </span>
                    <h3 style={{ fontSize: 17, fontWeight: 600, margin: '8px 0 4px 0' }}>{ent.name}</h3>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag size={13} /> {ent.category || 'Mặc định'} • Đơn vị gốc: <strong style={{ color: 'var(--color-primary)' }}>{ent.base_uom}</strong>
                    </div>
                  </div>
                  <button 
                    className="icon-btn" 
                    title="Xóa vật thể"
                    onClick={() => onDeleteEntity(ent.id)}
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* KHU VỰC BẢNG GIÁ & BARCODE 2 ĐƠN VỊ */}
                <div style={{ background: 'var(--color-background)', borderRadius: 10, padding: 12, marginBottom: 12, border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {/* Đơn vị gốc (Thùng) */}
                    <div style={{ borderRight: '1px solid var(--color-border)', paddingRight: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>
                        📦 Đơn vị gốc ({ent.base_uom})
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, margin: '4px 0', color: 'var(--color-text-primary)' }}>
                        {ent.price_base ? ent.price_base.toLocaleString('vi-VN') + ' đ' : 'Chưa đặt giá'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Barcode size={13} /> {ent.barcode_base || 'Chưa có mã'}
                      </div>
                    </div>

                    {/* Đơn vị lẻ */}
                    <div style={{ paddingLeft: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                        🏷️ Đơn vị lẻ (Bì/Lon/Kg)
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, margin: '4px 0', color: 'var(--color-text-primary)' }}>
                        {ent.price_sub ? ent.price_sub.toLocaleString('vi-VN') + ' đ' : 'Chưa đặt giá'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Barcode size={13} /> {ent.barcode_sub || 'Chưa có mã'}
                      </div>
                    </div>
                  </div>

                  {ent.min_safe_stock && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--color-border)', fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} /> Ngưỡng cảnh báo an toàn: <strong>{ent.min_safe_stock} {ent.base_uom}</strong>
                    </div>
                  )}
                </div>

                {ent.description && (
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                    {ent.description}
                  </p>
                )}

                {/* THUỘC TÍNH JSON TỰ ĐỊNH NGHĨA */}
                <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                    ✨ THUỘC TÍNH JSON TỰ TẠO:
                  </div>
                  {ent.dynamic_attributes && Object.keys(ent.dynamic_attributes).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(ent.dynamic_attributes).map(([k, v]) => (
                        <span 
                          key={k} 
                          style={{ 
                            fontSize: 11, 
                            padding: '3px 8px', 
                            borderRadius: 6, 
                            background: 'var(--color-background)', 
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-primary)'
                          }}
                        >
                          <strong>{k}</strong>: {String(v)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      (Chưa có thuộc tính mở rộng)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: QUY ĐỔI ĐA ĐƠN VỊ (UOM CONVERSIONS)
          ===================================================================== */}
      {activeSubTab === 'CONVERSIONS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Cấu Hình Quy Đổi Đa Đơn Vị (Multi-UoM)</h2>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Thiết lập tỷ lệ rã Thùng sang Bì lẻ phục vụ cơ chế tự động rã kho (INV-04) khi bán hàng.
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowConvModal(true)}>
              <Plus size={16} /> + Thêm Quy Tắc Quy Đổi
            </button>
          </div>

          <div style={{ background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Mã Vật Thể</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Đơn Vị Cha (Nhập)</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Công Thức Quy Đổi</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Đơn Vị Con (Bán Lẻ)</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Ghi Chú</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map(conv => (
                  <tr key={conv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#3b82f6' }}>
                      {conv.entity_code}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', fontWeight: 600 }}>
                        1 {conv.from_uom}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <strong style={{ fontSize: 16, color: 'var(--color-primary)' }}>= {conv.multiplier}</strong>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                        {conv.to_uom}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                      {conv.notes || '---'}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button 
                        className="icon-btn" 
                        title="Xóa quy tắc quy đổi"
                        onClick={() => onDeleteConversion(conv.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: DANH MỤC CHI NHÁNH (BRANCHES)
          ===================================================================== */}
      {activeSubTab === 'BRANCHES' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Danh Sách Chi Nhánh Hệ Thống</h2>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Dữ liệu được cô lập logic theo từng chi nhánh theo đúng quy định INV-01.
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowBranchModal(true)}>
              <Plus size={16} /> + Mở Chi Nhánh Mới
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {branches.map(br => (
              <div 
                key={br.id}
                style={{ 
                  background: 'var(--color-surface)', 
                  border: `2px solid ${activeBranchCode === br.code ? 'var(--color-primary)' : 'var(--color-border)'}`, 
                  borderRadius: 12, 
                  padding: 20,
                  position: 'relative'
                }}
              >
                {activeBranchCode === br.code && (
                  <div style={{ position: 'absolute', top: -10, right: 16, background: 'var(--color-primary)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                    ĐANG CHỌN THAO TÁC
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      MÃ: {br.code}
                    </span>
                    <h3 style={{ fontSize: 17, fontWeight: 600, margin: '8px 0 4px 0' }}>{br.name}</h3>
                  </div>
                  <button 
                    className="icon-btn" 
                    title="Xóa chi nhánh"
                    onClick={() => onDeleteBranch(br.id)}
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} /> {br.address || 'Chưa cập nhật địa chỉ'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={14} /> {br.phone || 'Chưa cập nhật số điện thoại'}
                  </div>
                </div>

                <button 
                  className={`btn ${activeBranchCode === br.code ? 'btn-secondary' : 'btn-primary'}`} 
                  style={{ width: '100%', fontSize: 13 }}
                  onClick={() => onSelectActiveBranch(br.code)}
                >
                  {activeBranchCode === br.code ? '✓ Chi Nhánh Đang Chọn' : 'Chọn Chi Nhánh Này'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: SỔ NHẬT KÝ KIỂM TOÁN TỒN KHO & RÃ THÙNG (AUDIT LOGS - INV-10)
          ===================================================================== */}
      {activeSubTab === 'AUDIT_LOGS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={20} color="var(--color-primary)" />
                Sổ Nhật Ký Kiểm Toán Tồn Kho & Rã Thùng Tự Động (INV-10)
              </h2>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Tất cả các thao tác rã thùng ngầm, xuất nhập bán lẻ/sỉ đều được lưu vết vĩnh viễn không thể sửa đè.
              </span>
            </div>
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
              Audit Ledger: Bất Biến 100%
            </span>
          </div>

          <div style={{ background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Thời Gian</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Chi Nhánh</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Loại Thao Tác</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mã Vật Thể</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nội Dung Chi Tiết</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Đơn Hàng</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Người Thực Hiện</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      Chưa có nhật ký phát sinh nào. Khi bạn quét bán lẻ kích hoạt rã thùng trong POS, nhật ký sẽ tự động xuất hiện ở đây.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                        {log.created ? new Date(log.created).toLocaleString('vi-VN') : 'Vừa xong'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {log.branch_code}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: 4, 
                          fontSize: 11, 
                          fontWeight: 700,
                          background: log.action_type === 'RA_THUNG_TU_DONG' ? 'rgba(234, 88, 12, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: log.action_type === 'RA_THUNG_TU_DONG' ? '#ea580c' : '#3b82f6'
                        }}>
                          {log.action_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                        {log.entity_code}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)' }}>
                        {log.change_summary}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                        {log.order_ref || '---'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                        {log.staff_name || 'Hệ thống tự động'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TẠO VẬT THỂ ĐỘNG (DYNAMIC ENTITY BUILDER MODAL)
          ===================================================================== */}
      {showEntityModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--color-surface)', width: '100%', maxWidth: 640, borderRadius: 16, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Boxes size={22} color="var(--color-primary)" /> Tạo Vật Thể Hàng Hóa Mới (No-Code Studio)
            </h2>

            <form onSubmit={handleSaveEntity}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mã Định Danh (Code) *</label>
                  <input 
                    type="text" 
                    placeholder="VD: SON_CT_01, XM_HT_50" 
                    value={newEntityCode} 
                    onChange={e => setNewEntityCode(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tên Vật Thể Hàng Hóa *</label>
                  <input 
                    type="text" 
                    placeholder="VD: Sơn Chống Thấm Cao Cấp" 
                    value={newEntityName} 
                    onChange={e => setNewEntityName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Ngành Hàng</label>
                  <input 
                    type="text" 
                    placeholder="VD: Sơn, VLXD" 
                    value={newEntityCategory} 
                    onChange={e => setNewEntityCategory(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Đơn Vị Gốc (Base UoM) *</label>
                  <select 
                    value={newEntityBaseUom} 
                    onChange={e => setNewEntityBaseUom(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                  >
                    <option value="Thùng">Thùng (Carton)</option>
                    <option value="Bao">Bao (Bao 50kg)</option>
                    <option value="Can">Can (Can 20L)</option>
                    <option value="Cuộn">Cuộn</option>
                    <option value="Tấn">Tấn</option>
                    <option value="Chiếc">Chiếc</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Ngưỡng Tồn Cảnh Báo</label>
                  <input 
                    type="number" 
                    min={1} 
                    value={newMinSafeStock} 
                    onChange={e => setNewMinSafeStock(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                  />
                </div>
              </div>

              {/* BẢNG GIÁ & BARCODE 2 ĐƠN VỊ TÍNH */}
              <div style={{ background: 'var(--color-background)', padding: 14, borderRadius: 10, marginBottom: 14, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={16} /> Cấu Hình Barcode & Giá Bán Cho Máy Quét POS
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mã Vạch Nguyên Thùng (Barcode Base)</label>
                    <input 
                      type="text" 
                      placeholder="VD: 893500100010" 
                      value={newBarcodeBase} 
                      onChange={e => setNewBarcodeBase(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Giá Bán Sỉ Nguyên Thùng (VNĐ)</label>
                    <input 
                      type="number" 
                      placeholder="VD: 1200000" 
                      value={newPriceBase || ''} 
                      onChange={e => setNewPriceBase(Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mã Vạch Đơn Vị Lẻ (Barcode Sub - Bì/Lon)</label>
                    <input 
                      type="text" 
                      placeholder="VD: 893500100011" 
                      value={newBarcodeSub} 
                      onChange={e => setNewBarcodeSub(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Giá Bán Lẻ Đơn Vị (VNĐ)</label>
                    <input 
                      type="number" 
                      placeholder="VD: 65000" 
                      value={newPriceSub || ''} 
                      onChange={e => setNewPriceSub(Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mô Tả Quy Cách</label>
                <textarea 
                  rows={2} 
                  placeholder="Ghi chú quy cách đóng gói..."
                  value={newEntityDesc} 
                  onChange={e => setNewEntityDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              {/* THUỘC TÍNH DYNAMIC JSON */}
              <div style={{ background: 'var(--color-background)', padding: 14, borderRadius: 10, marginBottom: 18, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                    ✨ Thêm Thuộc Tính Tùy Biến (Dynamic Attributes - Không Cần Code)
                  </label>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    onClick={addDynamicAttrField}
                    style={{ fontSize: 12, padding: '4px 10px', height: 'auto' }}
                  >
                    <Plus size={14} /> Thêm Trường Mới
                  </button>
                </div>

                {dynamicAttrs.map((attr, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input 
                      type="text" 
                      placeholder="Tên trường (VD: màu_sắc, trọng_lượng)"
                      value={attr.key}
                      onChange={e => updateDynamicAttrField(idx, 'key', e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }}
                    />
                    <input 
                      type="text" 
                      placeholder="Giá trị (VD: Xám, 20)"
                      value={attr.value}
                      onChange={e => updateDynamicAttrField(idx, 'value', e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }}
                    />
                    <button 
                      type="button" 
                      className="icon-btn" 
                      onClick={() => removeDynamicAttrField(idx)}
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEntityModal(false)}>
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu Vào PocketBase Engine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TẠO QUY TẮC QUY ĐỔI (UOM CONVERSION MODAL)
          ===================================================================== */}
      {showConvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--color-surface)', width: '100%', maxWidth: 500, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowRightLeft size={22} color="var(--color-primary)" /> Cấu Hình Tỷ Lệ Rã Thùng - Bì
            </h2>

            <form onSubmit={handleSaveConversion}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Chọn Vật Thể Hàng Hóa *</label>
                <select 
                  value={convEntityCode} 
                  onChange={e => {
                    setConvEntityCode(e.target.value);
                    const selected = entities.find(ent => ent.code === e.target.value);
                    if (selected) setConvFromUom(selected.base_uom);
                  }}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                >
                  <option value="">-- Chọn vật thể --</option>
                  {entities.map(ent => (
                    <option key={ent.id} value={ent.code}>
                      {ent.name} ({ent.code}) - Đơn vị gốc: {ent.base_uom}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>1 Đơn vị cha</label>
                  <input 
                    type="text" 
                    value={convFromUom}
                    onChange={e => setConvFromUom(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                  />
                </div>
                <div style={{ textAlign: 'center', paddingTop: 20, fontWeight: 700, fontSize: 18, color: 'var(--color-primary)' }}>
                  =
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Số lượng đơn vị con</label>
                  <input 
                    type="number" 
                    min={1} 
                    value={convMultiplier}
                    onChange={e => setConvMultiplier(Number(e.target.value))}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tên Đơn Vị Con (Bán Lẻ) *</label>
                <input 
                  type="text" 
                  placeholder="VD: Bì, Lon, Gói, Kg, Viên"
                  value={convToUom}
                  onChange={e => setConvToUom(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Ghi Chú Quy Cách</label>
                <input 
                  type="text" 
                  placeholder="VD: 1 Thùng rã được đúng 24 Bì nhỏ"
                  value={convNotes}
                  onChange={e => setConvNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowConvModal(false)}>
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu Quy Tắc Quy Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TẠO CHI NHÁNH MỚI (CREATE BRANCH MODAL)
          ===================================================================== */}
      {showBranchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--color-surface)', width: '100%', maxWidth: 480, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={22} color="var(--color-primary)" /> Mở Thêm Chi Nhánh Mới
            </h2>

            <form onSubmit={handleSaveBranch}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mã Chi Nhánh (Code) *</label>
                <input 
                  type="text" 
                  placeholder="VD: KHO_TONG, CN_Q1, CN_THU_DUC" 
                  value={newBranchCode} 
                  onChange={e => setNewBranchCode(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tên Chi Nhánh *</label>
                <input 
                  type="text" 
                  placeholder="VD: Chi Nhánh Thủ Đức (VLXD)" 
                  value={newBranchName} 
                  onChange={e => setNewBranchName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Địa Chỉ Kho / Cửa Hàng</label>
                <input 
                  type="text" 
                  placeholder="VD: 456 Xa Lộ Hà Nội, TP. Thủ Đức" 
                  value={newBranchAddress} 
                  onChange={e => setNewBranchAddress(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Số Điện Thoại Liên Hệ</label>
                <input 
                  type="text" 
                  placeholder="VD: 0988776655" 
                  value={newBranchPhone} 
                  onChange={e => setNewBranchPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBranchModal(false)}>
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu Vào PocketBase Engine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
