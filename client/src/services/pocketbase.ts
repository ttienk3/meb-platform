/**
 * POCKETBASE CORE ENGINE CLIENT SERVICE (Native Fetch Wrapper)
 * Siêu nhẹ, zero-dependency, tối ưu 100% cho máy văn phòng Intel i3 / RAM 8GB.
 * Kết nối trực tiếp tới Core Engine tại http://127.0.0.1:8090
 */

import type {
  BranchRecord,
  CustomEntityRecord,
  UomConversionRecord,
  InventoryLedgerRecord,
  BranchTransferRecord,
  CustomerDebtRecord,
  StockAuditLogRecord,
} from '../types';

const PB_BASE_URL = typeof window !== 'undefined' && window.location.hostname 
  ? `http://${window.location.hostname}:8090`
  : 'http://127.0.0.1:8090';

interface PocketBaseListResponse<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${PB_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || JSON.stringify(errJson.data) || errorDetail;
    } catch {
      // response is not json
    }
    throw new Error(`[PocketBase ${response.status}] ${errorDetail}`);
  }

  // PocketBase DELETE returns 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const pbApi = {
  // =========================================================================
  // 1. CHI NHÁNH (BRANCHES)
  // =========================================================================
  async getBranches(): Promise<BranchRecord[]> {
    const res = await request<PocketBaseListResponse<BranchRecord>>(
      '/api/collections/branches/records?perPage=100&sort=-created'
    );
    return res.items;
  },

  async createBranch(data: Omit<BranchRecord, 'id' | 'created' | 'updated'>): Promise<BranchRecord> {
    return request<BranchRecord>('/api/collections/branches/records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBranch(id: string, data: Partial<BranchRecord>): Promise<BranchRecord> {
    return request<BranchRecord>(`/api/collections/branches/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteBranch(id: string): Promise<boolean> {
    await request<void>(`/api/collections/branches/records/${id}`, {
      method: 'DELETE',
    });
    return true;
  },

  // =========================================================================
  // 2. VẬT THỂ ĐỘNG NO-CODE (CUSTOM ENTITIES)
  // =========================================================================
  async getCustomEntities(): Promise<CustomEntityRecord[]> {
    const res = await request<PocketBaseListResponse<CustomEntityRecord>>(
      '/api/collections/custom_entities/records?perPage=100&sort=-created'
    );
    return res.items;
  },

  async createCustomEntity(
    data: Omit<CustomEntityRecord, 'id' | 'created' | 'updated'>
  ): Promise<CustomEntityRecord> {
    return request<CustomEntityRecord>('/api/collections/custom_entities/records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCustomEntity(id: string, data: Partial<CustomEntityRecord>): Promise<CustomEntityRecord> {
    return request<CustomEntityRecord>(`/api/collections/custom_entities/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteCustomEntity(id: string): Promise<boolean> {
    await request<void>(`/api/collections/custom_entities/records/${id}`, {
      method: 'DELETE',
    });
    return true;
  },

  // =========================================================================
  // 3. QUY ĐỔI ĐA ĐƠN VỊ (UOM CONVERSIONS)
  // =========================================================================
  async getUomConversions(entityCode?: string): Promise<UomConversionRecord[]> {
    const filter = entityCode ? `&filter=(entity_code='${entityCode}')` : '';
    const res = await request<PocketBaseListResponse<UomConversionRecord>>(
      `/api/collections/uom_conversions/records?perPage=100${filter}`
    );
    return res.items;
  },

  async createUomConversion(
    data: Omit<UomConversionRecord, 'id' | 'created' | 'updated'>
  ): Promise<UomConversionRecord> {
    return request<UomConversionRecord>('/api/collections/uom_conversions/records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteUomConversion(id: string): Promise<boolean> {
    await request<void>(`/api/collections/uom_conversions/records/${id}`, {
      method: 'DELETE',
    });
    return true;
  },

  // =========================================================================
  // 4. SỔ KHO & TỒN THỰC TẾ (INVENTORY LEDGER)
  // =========================================================================
  async getInventory(branchCode?: string): Promise<InventoryLedgerRecord[]> {
    const filter = branchCode ? `&filter=(branch_code='${branchCode}')` : '';
    const res = await request<PocketBaseListResponse<InventoryLedgerRecord>>(
      `/api/collections/inventory_ledger/records?perPage=200${filter}`
    );
    return res.items;
  },

  async updateInventoryItem(id: string, quantity: number): Promise<InventoryLedgerRecord> {
    return request<InventoryLedgerRecord>(`/api/collections/inventory_ledger/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  },

  async createInventoryItem(
    data: Omit<InventoryLedgerRecord, 'id' | 'created' | 'updated'>
  ): Promise<InventoryLedgerRecord> {
    return request<InventoryLedgerRecord>('/api/collections/inventory_ledger/records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // =========================================================================
  // 5. ĐIỀU CHUYỂN KHO (BRANCH TRANSFERS)
  // =========================================================================
  async getTransfers(branchCode?: string): Promise<BranchTransferRecord[]> {
    const filter = branchCode
      ? `&filter=(from_branch='${branchCode}' || to_branch='${branchCode}')`
      : '';
    const res = await request<PocketBaseListResponse<BranchTransferRecord>>(
      `/api/collections/branch_transfers/records?perPage=100&sort=-created${filter}`
    );
    return res.items;
  },

  // =========================================================================
  // 6. SỔ NỢ KHÁCH HÀNG (CUSTOMER DEBTS)
  // =========================================================================
  async getDebts(branchCode?: string): Promise<CustomerDebtRecord[]> {
    const filter = branchCode ? `&filter=(branch_code='${branchCode}')` : '';
    const res = await request<PocketBaseListResponse<CustomerDebtRecord>>(
      `/api/collections/customer_debts/records?perPage=100${filter}`
    );
    return res.items;
  },

  // =========================================================================
  // 7. SỔ NHẬT KÝ KIỂM TOÁN TỒN KHO & RÃ THÙNG (STOCK AUDIT LOGS - INV-10)
  // =========================================================================
  async getAuditLogs(branchCode?: string, entityCode?: string): Promise<StockAuditLogRecord[]> {
    const filters: string[] = [];
    if (branchCode) filters.push(`branch_code='${branchCode}'`);
    if (entityCode) filters.push(`entity_code='${entityCode}'`);
    const filterStr = filters.length > 0 ? `&filter=(${filters.join(' && ')})` : '';

    const res = await request<PocketBaseListResponse<StockAuditLogRecord>>(
      `/api/collections/stock_audit_logs/records?perPage=100&sort=-id${filterStr}`
    );
    return res.items;
  },

  async createAuditLog(
    data: Omit<StockAuditLogRecord, 'id' | 'created' | 'updated'>
  ): Promise<StockAuditLogRecord> {
    return request<StockAuditLogRecord>('/api/collections/stock_audit_logs/records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
