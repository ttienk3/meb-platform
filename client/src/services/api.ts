/**
 * MEB PLATFORM - CLIENT API ADAPTER (BƯỚC 7.1.1)
 * Bộ điều phối API Client & Đóng gói Ngữ cảnh Chi nhánh (Context-Aware API Client)
 * Đảm bảo liên kết chặt chẽ giữa Giao diện người dùng và Backend Express Engine
 */

export interface Branch {
  id: string;
  code: string;
  name: string;
  organization_id: string;
  organization_name?: string;
  phone?: string;
  address?: string;
  toggles?: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
}

export interface FeatureMeta {
  source: 'BRANCH_OVERRIDE' | 'ORG_DEFAULT' | 'SYSTEM_DEFAULT';
  is_locked: boolean;
  data_type: string;
  group_name: string;
  label: string;
}

export interface RuntimeConfig {
  userId: string;
  branch: {
    id: string;
    code: string;
    name: string;
    organization_id: string;
  };
  features: {
    pos_barcode: boolean;
    allow_debt: boolean;
    customer_required: boolean;
    allow_negative_stock: boolean;
    require_shifts: boolean;
    print_format: 'K80_MINIMAL' | 'A4_FULL';
    track_serial: boolean;
    multi_uom: boolean;
    [key: string]: any;
  };
  featureMeta: Record<string, FeatureMeta>;
}

export interface ProductBarcodeItem {
  uom: string;
  rate: number;
  barcode: string;
  price_retail?: number;
  price_wholesale?: number;
  price_contractor?: number;
}

export interface ProductInventory {
  id: string;
  code: string;
  name: string;
  category?: string;
  base_uom: string;
  default_cost_price: number;
  default_selling_price: number;
  barcodes?: ProductBarcodeItem[];
  is_combo?: boolean;
  combo_items?: any[];
  on_hand: number;
  reserved: number;
  available_qty: number;
  cost_price: number;
  has_expiry?: boolean;
  track_expiry?: boolean;
  image_url?: string;
  batch_number?: string;
  expiry_date?: string;
  is_aging_stock?: boolean;
  days_in_inventory?: number;
}

export interface PartnerProfile {
  id: string;
  code: string;
  name: string;
  phone: string;
  address?: string;
  type: string;
  price_group: 'RETAIL' | 'CONTRACTOR' | 'WHOLESALE';
  debt_limit: number;
  current_debt: number;
  remaining_limit: number;
  customer_group_id?: string;
  customer_group_name?: string;
  discount_rate_pct?: number;
  loyalty_points?: number;
}

export interface ShiftInfo {
  id: string;
  branch_id: string;
  staff_name: string;
  initial_amount: number;
  opened_at: string;
  status: 'OPEN' | 'CLOSED';
}

export interface ShiftSummary {
  shift_id: string;
  staff_name: string;
  initial_amount: number;
  total_cash_sales: number;
  total_debt_collected_cash: number;
  system_cash_amount: number;
}

export interface CheckoutPayload {
  order: {
    shift_id?: string;
    partner_id?: string;
    order_code?: string;
    idempotency_key?: string;
    points_used?: number;
    points_discount_amount?: number;
    total_amount: number;
    paid_amount: number;
    debt_amount?: number;
    order_type?: 'SALE' | 'PREORDER' | 'RETURN';
    note?: string;
  };
  items: Array<{
    product_id: string;
    uom: string;
    conversion_rate?: number;
    quantity: number;
    unit_price: number;
  }>;
  payments?: Array<{
    payment_method: 'CASH' | 'BANK_TRANSFER';
    amount: number;
  }>;
}

export interface DebtCollectionPayload {
  partner_id: string;
  shift_id?: string;
  amount: number;
  payment_method?: 'CASH' | 'BANK_TRANSFER';
  payment_account?: string;
  note?: string;
  created_by?: string;
}

export interface TransferPayload {
  to_branch_id: string;
  shipper_id?: string;
  transfer_code?: string;
  note?: string;
  created_by?: string;
  items: Array<{
    product_id: string;
    uom: string;
    conversion_rate?: number;
    send_qty: number;
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE' | 'ACCOUNTANT' | string;
  organization_id?: string;
}

export class MebApiClient {
  private baseUrl: string;
  private currentBranchId: string | null = typeof window !== 'undefined' 
    ? (localStorage.getItem('meb_active_branch_id') || '01a10c53-0367-7d6e-9a77-48fa6504cc23') 
    : '01a10c53-0367-7d6e-9a77-48fa6504cc23';
  private currentUserId: string = '00000000-0000-0000-0000-000000000003'; // Mặc định Super Admin
  private authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('meb_auth_token') : null;
  private currentUser: UserProfile | null = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('meb_auth_user') || 'null') : null;

  constructor(baseUrl: string = import.meta.env.VITE_API_URL || '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    if (this.currentUser?.id) {
      this.currentUserId = this.currentUser.id;
    }
  }

  public setBranchId(branchId: string) {
    this.currentBranchId = branchId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('meb_active_branch_id', branchId);
    }
  }

  public getBranchId(): string | null {
    return this.currentBranchId;
  }

  public setUserId(userId: string) {
    this.currentUserId = userId;
  }

  public getUserId(): string {
    return this.currentUserId;
  }

  public setToken(token: string | null) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('meb_auth_token', token);
      else localStorage.removeItem('meb_auth_token');
    }
  }

  public getToken(): string | null {
    return this.authToken;
  }

  public setCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('meb_auth_user', JSON.stringify(user));
        this.setUserId(user.id);
      } else {
        localStorage.removeItem('meb_auth_user');
      }
    }
  }

  public getUserProfile(): UserProfile | null {
    return this.currentUser;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.currentUserId
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    if (this.currentBranchId) {
      headers['x-branch-id'] = this.currentBranchId;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      ...this.getHeaders(),
      ...(options.headers as Record<string, string> || {})
    };

    const res = await fetch(url, { ...options, headers });
    const data = await res.json();

    if (!res.ok || data.success === false) {
      const errorMsg = data.error?.message || data.message || `Lỗi HTTP ${res.status}`;
      const err = new Error(errorMsg);
      (err as any).status = res.status;
      (err as any).code = data.error?.code || 'API_ERROR';
      throw err;
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // 0. XÁC THỰC TÀI KHOẢN & PHÂN QUYỀN CHI NHÁNH (A3)
  // ---------------------------------------------------------------------------

  public async login(payload: { emailOrPhone: string; password: string }): Promise<{ success: boolean; token: string; user: UserProfile; branches: Branch[] }> {
    const res = await this.request<{ success: boolean; token: string; user: UserProfile; branches: Branch[] }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success && res.token) {
      this.setToken(res.token);
      this.setCurrentUser(res.user);
    }
    return res;
  }

  public async getProfile(): Promise<{ success: boolean; user: UserProfile; branches: Branch[] }> {
    return this.request<{ success: boolean; user: UserProfile; branches: Branch[] }>('/api/auth/me');
  }

  public async logout(): Promise<void> {
    this.setToken(null);
    this.setCurrentUser(null);
  }

  // ---------------------------------------------------------------------------
  // 1. QUẢN LÝ HỆ THỐNG & CHI NHÁNH (ADMIN & CONTEXT)
  // ---------------------------------------------------------------------------

  public async getBranches(): Promise<{ success: boolean; count: number; data: Branch[] }> {
    return this.request<{ success: boolean; count: number; data: Branch[] }>('/api/admin/branches');
  }

  public async createBranch(payload: {
    code: string;
    name: string;
    phone?: string;
    address?: string;
    persona_type?: string;
    industry_domain?: string;
    feature_overrides?: Record<string, any>;
    toggles?: Record<string, any>;
  }): Promise<{ success: boolean; message: string; data: Branch }> {
    return this.request<{ success: boolean; message: string; data: Branch }>('/api/admin/branches', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getRuntimeConfig(): Promise<{ success: boolean; data: RuntimeConfig }> {
    if (!this.currentBranchId) {
      throw new Error('Chưa thiết lập branchId cho Client. Vui lòng setBranchId() trước khi gọi getRuntimeConfig()');
    }
    return this.request<{ success: boolean; data: RuntimeConfig }>('/api/context/runtime');
  }

  public async invalidateCache(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/context/invalidate', {
      method: 'POST'
    });
  }

  public async getFeatureRegistry(): Promise<{ success: boolean; count: number; data: any[] }> {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/admin/features/registry');
  }

  public async getBranchFeatures(branchId: string): Promise<{ success: boolean; branch: any; count: number; data: any[] }> {
    return this.request<{ success: boolean; branch: any; count: number; data: any[] }>(`/api/admin/features/branch/${branchId}`);
  }

  public async overrideFeature(payload: { branch_id: string; feature_key: string; value: any; updated_by?: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/admin/features/override', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async batchOverrideFeatures(branch_id: string, overrides: Record<string, any>, updated_by?: string) {
    return this.request<{ success: boolean; message: string; error?: string }>('/api/admin/features/batch-override', {
      method: 'POST',
      body: JSON.stringify({ branch_id, overrides, updated_by })
    });
  }

  public async resetFeatureOverride(branch_id: string, feature_key: string) {
    return this.request<{ success: boolean; message: string }>('/api/admin/features/override', {
      method: 'DELETE',
      body: JSON.stringify({ branch_id, feature_key })
    });
  }

  public async getAuditLogs(branchId?: string) {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return this.request<{ success: boolean; count: number; data: any[] }>(`/api/admin/audit-logs${query}`);
  }

  // ---------------------------------------------------------------------------
  // 2. NGHIỆP VỤ BÁN HÀNG POS (CATALOG & PARTNERS)
  // ---------------------------------------------------------------------------

  public async getProducts(search?: string): Promise<{ success: boolean; count: number; data: ProductInventory[] }> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<{ success: boolean; count: number; data: ProductInventory[] }>(`/api/pos/products${query}`);
  }

  public async getPartners(search?: string, group?: string): Promise<{ success: boolean; count: number; data: PartnerProfile[] }> {
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (group) params.append('group', group);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ success: boolean; count: number; data: PartnerProfile[] }>(`/api/pos/partners${queryString}`);
  }

  public async createPartner(payload: { name: string; phone?: string; address?: string; debt_limit?: number; price_group?: string; code?: string }) {
    return this.request<{ success: boolean; message: string; data: PartnerProfile }>('/api/pos/partners', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async recordCashFlow(payload: { shift_id?: string; type: 'IN' | 'OUT'; amount: number; category?: string; note?: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/pos/shifts/cash-flow', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getCashbook() {
    return this.request<{
      success: boolean;
      data: {
        summary: {
          total_in: number;
          total_out: number;
          net_balance: number;
          cash_balance: number;
          digital_in: number;
          current_shift: any;
        };
        flows: any[];
      };
    }>('/api/pos/cashbook');
  }

  // ---------------------------------------------------------------------------
  // 3. QUẢN LÝ CA BÁN HÀNG & KÉT TIỀN (SHIFTS & RECONCILIATION)
  // ---------------------------------------------------------------------------

  public async getCurrentShift(): Promise<{ success: boolean; data: ShiftInfo | null }> {
    return this.request<{ success: boolean; data: ShiftInfo | null }>('/api/pos/shifts/current');
  }

  public async openShift(staff_name: string, initial_amount: number): Promise<{ success: boolean; data: ShiftInfo }> {
    return this.request<{ success: boolean; data: ShiftInfo }>('/api/pos/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ staff_name, initial_amount })
    });
  }

  public async getShiftSummary(shiftId: string): Promise<{ success: boolean; data: ShiftSummary }> {
    return this.request<{ success: boolean; data: ShiftSummary }>(`/api/pos/shifts/${shiftId}/summary`);
  }

  public async closeShift(shiftId: string, actual_amount: number, note?: string) {
    return this.request<{ success: boolean; message: string; data: any }>(`/api/pos/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify({ actual_amount, note })
    });
  }

  // ---------------------------------------------------------------------------
  // 4. THANH TOÁN ĐƠN HÀNG & THU NỢ (CHECKOUT & DEBT)
  // ---------------------------------------------------------------------------

  public async checkout(payload: CheckoutPayload) {
    return this.request<{ success: boolean; data: any }>('/api/pos/checkout', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async collectDebt(payload: DebtCollectionPayload) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/pos/debt-collection', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getRecentOrders(limit: number = 20, shift_id?: string) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (shift_id) params.append('shift_id', shift_id);
    return this.request<{ success: boolean; count: number; data: any[] }>(`/api/pos/orders/recent?${params.toString()}`);
  }

  // ---------------------------------------------------------------------------
  // 5. ĐIỀU CHUYỂN KHO LIÊN CHI NHÁNH (STOCK TRANSFERS)
  // ---------------------------------------------------------------------------

  public async getTransfers(status?: string, type?: 'IN' | 'OUT') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (type) params.append('type', type);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ success: boolean; count: number; data: any[] }>(`/api/transfers${queryString}`);
  }

  public async createTransfer(payload: TransferPayload) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/transfers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async dispatchTransfer(transferId: string, dispatched_by?: string) {
    return this.request<{ success: boolean; message: string; data: any }>(`/api/transfers/${transferId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ dispatched_by })
    });
  }

  public async receiveTransfer(transferId: string, received_items: any[], loss_responsibility?: string, received_by?: string) {
    return this.request<{ success: boolean; message: string; data: any }>(`/api/transfers/${transferId}/receive`, {
      method: 'POST',
      body: JSON.stringify({ received_items, loss_responsibility, received_by })
    });
  }

  public async getTransferDetail(transferId: string) {
    return this.request<{ success: boolean; data: any }>(`/api/transfers/${transferId}`);
  }

  public async cancelTransfer(transferId: string, cancelled_by?: string, reason?: string) {
    return this.request<{ success: boolean; message: string; data: any }>(`/api/transfers/${transferId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled_by, reason })
    });
  }

  // ---------------------------------------------------------------------------
  // 6. NHẬP HÀNG TỪ NHÀ CUNG CẤP (PURCHASE INBOUND)
  // ---------------------------------------------------------------------------

  public async getSuppliers() {
    return this.request<{ success: boolean; count: number; data: Supplier[] }>('/api/inbound/suppliers');
  }

  public async createSupplier(payload: { name: string; phone?: string; address?: string; tax_code?: string; code?: string }) {
    return this.request<{ success: boolean; message: string; data: Supplier }>('/api/inbound/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getInboundReceipts() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/inbound/receipts');
  }

  public async createPurchaseInbound(payload: PurchaseInboundPayload) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/inbound/purchase', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ---------------------------------------------------------------------------
  // 7. ĐỔI TRẢ HÀNG & CẤN TRỪ NỢ (RMA RETURNS - INV-07)
  // ---------------------------------------------------------------------------

  public async createReturnOrder(payload: ReturnPayload) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/pos/returns', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getRecentReturns() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/pos/returns/recent');
  }

  // ---------------------------------------------------------------------------
  // 8. KIỂM KÊ KHO ĐỊNH KỲ (STOCKTAKE AUDIT - INV-10)
  // ---------------------------------------------------------------------------

  public async getAuditProducts(category?: string, search?: string) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ success: boolean; branchId: string; count: number; data: any[] }>(`/api/inventory/audit-products${queryString}`);
  }

  public async createStockAudit(payload: StockAuditPayload) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/inventory/audit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getAuditHistory() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/inventory/audit-history');
  }

  // ---------------------------------------------------------------------------
  // 9. HQ MULTI-BRANCH COMMAND CENTER (ĐIỀU HÀNH TỔNG BỘ CHUỖI REALTIME)
  // ---------------------------------------------------------------------------

  public async getHQOverview() {
    return this.request<{ success: boolean; data: HQOverviewData }>('/api/hq/overview');
  }

  public async getHQBranchesMatrix() {
    return this.request<{ success: boolean; count: number; data: HQBranchMatrixItem[] }>('/api/hq/branches-matrix');
  }

  public async toggleBranchStatus(branchId: string) {
    return this.request<{ success: boolean; message: string; data: { id: string; is_active: boolean } }>(`/api/hq/branches/${branchId}/toggle-status`, {
      method: 'POST'
    });
  }

  // ---------------------------------------------------------------------------
  // 10. NO-CODE DYNAMIC SCHEMA BUILDER (TỰ TẠO BẢNG, TRƯỜNG & NÚT HÀNH ĐỘNG)
  // ---------------------------------------------------------------------------

  public async getSchemaTables() {
    return this.request<{ success: boolean; count: number; data: CustomSchemaTable[] }>('/api/schema/tables');
  }

  public async createSchemaTable(payload: { code: string; name: string; description?: string; icon?: string; category?: string }) {
    return this.request<{ success: boolean; message: string; data: CustomSchemaTable }>('/api/schema/tables', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async deleteSchemaTable(tableId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/schema/tables/${tableId}`, {
      method: 'DELETE'
    });
  }

  public async getSchemaFields(tableCode: string) {
    return this.request<{ success: boolean; table: any; count: number; data: CustomSchemaField[] }>(`/api/schema/tables/${tableCode}/fields`);
  }

  public async createSchemaField(tableCode: string, payload: Partial<CustomSchemaField>) {
    return this.request<{ success: boolean; message: string; data: CustomSchemaField }>(`/api/schema/tables/${tableCode}/fields`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async deleteSchemaField(tableCode: string, fieldId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/schema/tables/${tableCode}/fields/${fieldId}`, {
      method: 'DELETE'
    });
  }

  public async getSchemaActions(tableCode: string) {
    return this.request<{ success: boolean; count: number; data: CustomSchemaAction[] }>(`/api/schema/tables/${tableCode}/actions`);
  }

  public async createSchemaAction(tableCode: string, payload: Partial<CustomSchemaAction>) {
    return this.request<{ success: boolean; message: string; data: CustomSchemaAction }>(`/api/schema/tables/${tableCode}/actions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async deleteSchemaAction(tableCode: string, actionId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/schema/tables/${tableCode}/actions/${actionId}`, {
      method: 'DELETE'
    });
  }

  // ---------------------------------------------------------------------------
  // 11. NO-CODE DYNAMIC DATA & CUSTOM ACTION RUNTIME ENGINE
  // ---------------------------------------------------------------------------

  public async getDynamicRecords(tableCode: string, params?: { branch_id?: string; q?: string; status?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.branch_id) qs.append('branch_id', params.branch_id);
    if (params?.q) qs.append('q', params.q);
    if (params?.status) qs.append('status', params.status);
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.offset) qs.append('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ 
      success: boolean; 
      meta: { table: CustomSchemaTable; fields: CustomSchemaField[]; actions: CustomSchemaAction[]; total: number; count: number };
      data: DynamicRecord[] 
    }>(`/api/dynamic/${tableCode}${query}`);
  }

  public async createDynamicRecord(tableCode: string, payload: { record_data: Record<string, any>; branch_id?: string; status?: string }) {
    return this.request<{ success: boolean; message: string; data: DynamicRecord }>(`/api/dynamic/${tableCode}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateDynamicRecord(tableCode: string, id: string, payload: { record_data?: Record<string, any>; status?: string; branch_id?: string }) {
    return this.request<{ success: boolean; message: string; data: DynamicRecord }>(`/api/dynamic/${tableCode}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  public async deleteDynamicRecord(tableCode: string, id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/dynamic/${tableCode}/${id}`, {
      method: 'DELETE'
    });
  }

  public async triggerDynamicAction(tableCode: string, id: string, actionKey: string, payload?: { note?: string; payload?: any }) {
    return this.request<{ success: boolean; message: string; action: any; data: DynamicRecord }>(`/api/dynamic/${tableCode}/${id}/action/${actionKey}`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  }

  // ---------------------------------------------------------------------------
  // 12. QUY TẮC TỰ ĐỘNG HÓA & WORKFLOW ENGINE (RULE ENGINE)
  // ---------------------------------------------------------------------------
  public async getWorkflows() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/workflows');
  }

  public async createWorkflow(payload: { name: string; trigger_event: string; condition_config?: any; action_config?: any }) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async toggleWorkflow(id: string) {
    return this.request<{ success: boolean; message: string; data: any }>(`/api/workflows/${id}/toggle`, {
      method: 'PUT'
    });
  }

  public async deleteWorkflow(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/workflows/${id}`, {
      method: 'DELETE'
    });
  }

  // ---------------------------------------------------------------------------
  // 13. SỔ QUỸ, NHÓM KHÁCH HÀNG, CASH DROP & CHI PHÍ VẬN HÀNH (PHASE 1 DECISIONS)
  // ---------------------------------------------------------------------------
  public async getCustomerGroups() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/pos/customer-groups');
  }

  public async createCustomerGroup(payload: { code: string; name: string; discount_rate_pct?: number; description?: string }) {
    return this.request<{ success: boolean; data: any }>('/api/pos/customer-groups', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async cashDropShift(payload: { shift_id?: string; amount: number; reason: string; receiver_name: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/pos/shifts/cash-drop', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getExpenseCategories() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/pos/expense-categories');
  }

  public async createExpense(payload: { account_id?: string; category_id?: string; amount: number; description: string; receipt_image_url?: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/pos/expenses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getCashbookAccounts() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/pos/cashbook/accounts');
  }

  public async getCashbookPnl() {
    return this.request<{ success: boolean; data: { revenue: number; cogs: number; gross_profit: number; opex: number; net_profit: number; gross_margin_pct: string; net_margin_pct: string } }>('/api/pos/cashbook/pnl');
  }

  public async getShipperDebts() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/transfers/shipper-debts');
  }

  // ---------------------------------------------------------------------------
  // 12. LOYALTY & REWARD POINTS ENGINE (TRỤ CỘT 5)
  // ---------------------------------------------------------------------------
  public async getLoyaltyConfig() {
    return this.request<{ success: boolean; data: any }>('/api/loyalty/config');
  }

  public async saveLoyaltyConfig(payload: any) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/loyalty/config', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getLoyaltyBalance(partnerId: string) {
    return this.request<{ success: boolean; data: { partner: any; points: number; history: any[] } }>(`/api/loyalty/balance/${partnerId}`);
  }

  public async adjustLoyaltyPoints(payload: { partnerId: string; pointsChange: number; reason: string }) {
    return this.request<{ success: boolean; message: string; data: { newBalance: number } }>('/api/loyalty/adjust', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ---------------------------------------------------------------------------
  // 13. RMA RETURN MERCHANDISE AUTHORIZATION (INV-07 / TRỤ CỘT 6)
  // ---------------------------------------------------------------------------
  public async createRma(payload: { original_order_id?: string; partner_id?: string; items: any[]; note?: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/rma/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getRmaList() {
    return this.request<{ success: boolean; count: number; data: any[] }>('/api/rma/list');
  }

  // ---------------------------------------------------------------------------
  // 14. SUPPLIER DEBTS & ACCOUNTS PAYABLE (TRỤ CỘT 9)
  // ---------------------------------------------------------------------------
  public async getSupplierDebts() {
    return this.request<{ success: boolean; suppliers: any[]; recent_transactions: any[] }>('/api/suppliers/debts');
  }

  public async paySupplierDebt(payload: { supplier_id: string; amount: number; payment_account_id?: string; payment_method?: string; note?: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/api/suppliers/debts/pay', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ---------------------------------------------------------------------------
  // 15. COMBO & ASSEMBLY BOM ENGINE (TRỤ CỘT 14)
  // ---------------------------------------------------------------------------
  public async getComboDetails(productId: string) {
    return this.request<{ success: boolean; count: number; components: any[] }>(`/api/combos/${productId}`);
  }

  public async saveCombo(payload: { combo_product_id: string; components: any[] }) {
    return this.request<{ success: boolean; message: string }>('/api/combos', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async assembleCombo(payload: { target_product_id: string; target_quantity: number; note?: string }) {
    return this.request<{ success: boolean; message: string; order_code: string }>('/api/combos/assemble', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ---------------------------------------------------------------------------
  // 16. ANOMALY & FRAUD DETECTION ALERTS (TRỤ CỘT 15)
  // ---------------------------------------------------------------------------
  public async getAnomalyAlerts(isResolved?: boolean) {
    const q = isResolved !== undefined ? `?is_resolved=${isResolved}` : '';
    return this.request<{ success: boolean; count: number; data: any[] }>(`/api/anomalies${q}`);
  }

  public async resolveAnomalyAlert(id: string) {
    return this.request<{ success: boolean; message: string; data: any }>(`/api/anomalies/${id}/resolve`, {
      method: 'POST'
    });
  }
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  tax_code?: string;
  current_debt: number;
}

export interface InboundItem {
  product_id: string;
  uom: string;
  conversion_rate: number;
  quantity: number;
  unit_price: number;
  note?: string;
}

export interface PurchaseInboundPayload {
  supplier_id?: string;
  items: InboundItem[];
  paid_amount?: number;
  payment_method?: 'CASH' | 'BANK_TRANSFER';
  note?: string;
}

export interface ReturnItem {
  product_id: string;
  uom: string;
  conversion_rate?: number;
  quantity: number;
  unit_price: number;
  reason?: string;
}

export interface ReturnPayload {
  partner_id?: string;
  items: ReturnItem[];
  refund_mode: 'DEBT_OFFSET' | 'CASH_REFUND';
  parent_order_id?: string;
  note?: string;
}

export interface StockAuditItem {
  product_id: string;
  actual_qty: number;
  reason?: string;
}

export interface StockAuditPayload {
  items: StockAuditItem[];
  note?: string;
}

export interface HQOverviewData {
  timestamp: string;
  branches: { total_branches: number; active_branches: number };
  today_sales: { orders_count: number; total_revenue: number; total_debt_created: number };
  live_shifts: { open_shifts_count: number; total_cash_in_drawers: number };
  customer_debt: { total_customer_debt: number; indebted_customers_count: number };
  inventory: { total_inventory_valuation: number; low_stock_alerts: number };
}

export interface HQBranchMatrixItem extends Branch {
  current_shift?: {
    id: string;
    staff_name: string;
    status: string;
    opened_at: string;
    initial_amount: number;
    system_amount: number;
  } | null;
  sales_summary: {
    today_orders: number;
    today_revenue: number;
    today_collected: number;
    today_debt: number;
  };
  inventory_summary: {
    total_sku: number;
    total_qty: number;
    inventory_value: number;
    low_stock_count: number;
  };
  incoming_transfers: number;
}

export interface CustomSchemaTable {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  is_active: boolean;
  fields_count?: number;
  actions_count?: number;
  records_count?: number;
  created_at: string;
}

export interface CustomSchemaField {
  id: string;
  table_id: string;
  field_key: string;
  field_label: string;
  data_type: 'TEXT' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'RELATION';
  options?: any;
  relation_table?: string;
  is_required: boolean;
  default_value?: any;
  sort_order: number;
}

export interface CustomSchemaAction {
  id: string;
  table_id: string;
  action_key: string;
  label: string;
  color?: string;
  icon?: string;
  action_type: 'UPDATE_STATUS' | 'NOTIFICATION' | 'WEBHOOK' | 'PRINT';
  config?: any;
  sort_order: number;
}

export interface DynamicRecord {
  id: string;
  table_id: string;
  table_code: string;
  branch_id?: string;
  branch_name?: string;
  branch_code?: string;
  record_data: Record<string, any>;
  status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Khởi tạo một singleton client mặc định cho ứng dụng
export const api = new MebApiClient();
