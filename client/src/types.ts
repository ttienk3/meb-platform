/**
 * MEB SAAS PLATFORM - CORE DATA TYPES
 * Đồng bộ 100% với PocketBase Core Engine Schema
 */

export interface BranchRecord {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  created?: string;
  updated?: string;
}

export interface CustomEntityRecord {
  id: string;
  code: string;
  name: string;
  category?: string;
  base_uom: string; // Đơn vị gốc: Thùng, Bao, Can, Cuộn...
  description?: string;
  barcode_base?: string; // Mã vạch nguyên thùng/bao (sỉ)
  barcode_sub?: string;  // Mã vạch đơn vị lẻ (bì/lon/kg)
  price_base?: number;   // Giá bán sỉ nguyên thùng
  price_sub?: number;    // Giá bán lẻ từng bì/lon/kg
  min_safe_stock?: number; // Ngưỡng cảnh báo an toàn
  dynamic_attributes?: Record<string, string | number | boolean>; // No-Code dynamic JSON
  created?: string;
  updated?: string;
}

export interface UomConversionRecord {
  id: string;
  entity_code: string;
  from_uom: string; // VD: Thùng
  to_uom: string;   // VD: Bì
  multiplier: number; // 1 Thùng = N Bì
  notes?: string;
  created?: string;
  updated?: string;
}

export interface InventoryLedgerRecord {
  id: string;
  branch_code: string;
  entity_code: string;
  uom: string;
  quantity: number;
  warning_threshold?: number;
  created?: string;
  updated?: string;
}

export interface BranchTransferRecord {
  id: string;
  from_branch: string;
  to_branch: string;
  entity_code: string;
  quantity: number;
  uom: string;
  status: 'CHO_XUAT' | 'DANG_DI_DUONG' | 'DA_NHAN_DU' | 'HAO_HUT_LECH';
  driver_name?: string;
  notes?: string;
  created?: string;
  updated?: string;
}

export interface CustomerDebtRecord {
  id: string;
  branch_code: string;
  customer_name: string;
  phone?: string;
  debt_balance: number;
  credit_limit: number;
  debt_status: 'AN_TOAN' | 'CANH_BAO' | 'KHOA_XUAT_DON';
  created?: string;
  updated?: string;
}

export interface StockAuditLogRecord {
  id: string;
  branch_code: string;
  entity_code: string;
  action_type: 'RA_THUNG_TU_DONG' | 'NHAP_KHO' | 'XUAT_BAN_LE' | 'XUAT_BAN_SI' | 'KIEM_KE';
  change_summary: string;
  qty_base_change?: number;
  qty_sub_change?: number;
  balance_base_after?: number;
  balance_sub_after?: number;
  order_ref?: string;
  staff_name?: string;
  created?: string;
  updated?: string;
}

export type ActiveTab = 'STUDIO' | 'BENTO_GRID' | 'POS';
