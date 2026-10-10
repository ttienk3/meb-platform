/**
 * ============================================================================
 * MEB MASTER BLUEPRINT PHASE 1 MIGRATION: 20 TRỤ CỘT NGHIỆP VỤ & 10 INVARIANTS
 * ============================================================================
 * Thực thi migration mở rộng CSDL PostgreSQL chuẩn hóa:
 * 1. Multi-Tenant White-Label (organizations bổ sung logo_url, custom bill header/footer)
 * 2. Loyalty Engine (loyalty_configs, loyalty_ledger, partners.loyalty_points)
 * 3. RMA Đổi Trả Hàng INV-07 (rma_records, rma_items)
 * 4. Kiểm Kê Kho 2 Bước INV-03/05 (stocktake_audits mở rộng status, loss_allocation)
 * 5. Công Nợ Nhà Cung Cấp AP (supplier_debts, partners.payment_term_days)
 * 6. Hàng Combo & Phiếu Đóng Gói BOM (product_combos, assembly_orders, assembly_items)
 * 7. Trung Tâm Cảnh Báo Bất Thường (anomaly_alerts)
 * 8. Khóa Idempotency Key Chống Bấm Trùng (orders.idempotency_key)
 */

const db = require('../server/src/db');

async function runMasterPhase1Migration() {
  console.log('🚀 [MIGRATION MASTER PHASE 1]: Bắt đầu cập nhật CSDL 20 Trụ Cột Nghiệp Vụ...');
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. MULTI-TENANT & WHITE-LABEL (organizations)
    console.log('  👉 [1/8] Mở rộng bảng organizations cho White-label...');
    await client.query(`
      ALTER TABLE public.organizations
      ADD COLUMN IF NOT EXISTS logo_url text,
      ADD COLUMN IF NOT EXISTS custom_bill_header text,
      ADD COLUMN IF NOT EXISTS custom_bill_footer text,
      ADD COLUMN IF NOT EXISTS domain_name character varying(255);
    `);

    // 2. LOYALTY ENGINE (TÍCH ĐIỂM & ĐỔI THƯỞNG)
    console.log('  👉 [2/8] Tạo cấu trúc Loyalty Points & Ledger...');
    await client.query(`
      ALTER TABLE public.partners
      ADD COLUMN IF NOT EXISTS loyalty_points numeric NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS public.loyalty_configs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
        earn_rate_pct numeric NOT NULL DEFAULT 1.0, -- Tiêu 100k tích 1%
        redeem_value_per_point numeric NOT NULL DEFAULT 1000, -- 1 điểm = 1.000đ
        min_points_to_redeem integer NOT NULL DEFAULT 10,
        expiry_months integer NOT NULL DEFAULT 12,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
      );

      CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
        order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
        points_change numeric NOT NULL, -- Dương là tích, âm là tiêu
        balance_after numeric NOT NULL,
        reason character varying(255) NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_partner ON public.loyalty_ledger(partner_id);
    `);

    // 3. RMA ĐỔI TRẢ HÀNG CẤN TRỪ NỢ (INV-07)
    console.log('  👉 [3/8] Tạo bảng RMA Đổi Trả Hàng (rma_records, rma_items)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.rma_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rma_code character varying(64) NOT NULL UNIQUE,
        original_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
        partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
        branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
        return_type character varying(32) NOT NULL DEFAULT 'REFUND', -- 'REFUND' | 'EXCHANGE'
        refund_amount numeric NOT NULL DEFAULT 0,
        debt_deduction_amount numeric NOT NULL DEFAULT 0,
        cash_refund_amount numeric NOT NULL DEFAULT 0,
        status character varying(32) NOT NULL DEFAULT 'COMPLETED', -- 'DRAFT' | 'APPROVED' | 'COMPLETED'
        note text,
        created_by character varying(128),
        created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
      );

      CREATE TABLE IF NOT EXISTS public.rma_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rma_id uuid NOT NULL REFERENCES public.rma_records(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        uom character varying(32) NOT NULL,
        quantity numeric NOT NULL,
        return_price numeric NOT NULL,
        condition character varying(32) NOT NULL DEFAULT 'GOOD', -- 'GOOD' (nhập lại kho) | 'DAMAGED' (hủy/thanh lý)
        note text
      );

      CREATE INDEX IF NOT EXISTS idx_rma_branch ON public.rma_records(branch_id);
      CREATE INDEX IF NOT EXISTS idx_rma_partner ON public.rma_records(partner_id);
    `);

    // 4. KIỂM KÊ KHO 2 BƯỚC (INV-03 / INV-05)
    console.log('  👉 [4/8] Cập nhật bảng Kiểm Kê Kho stocktake_audits...');
    await client.query(`
      ALTER TABLE public.stocktake_audits
      ADD COLUMN IF NOT EXISTS status character varying(32) NOT NULL DEFAULT 'APPROVED',
      ADD COLUMN IF NOT EXISTS loss_allocation character varying(32) NOT NULL DEFAULT 'STORE_EXPENSE',
      ADD COLUMN IF NOT EXISTS penalized_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_by character varying(128),
      ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
    `);

    // 5. CÔNG NỢ NHÀ CUNG CẤP AP (ACCOUNTS PAYABLE)
    console.log('  👉 [5/8] Tạo bảng Công Nợ Nhà Cung Cấp (supplier_debts)...');
    await client.query(`
      ALTER TABLE public.partners
      ADD COLUMN IF NOT EXISTS payment_term_days integer NOT NULL DEFAULT 30;

      CREATE TABLE IF NOT EXISTS public.supplier_debts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
        reference_code character varying(64) NOT NULL,
        transaction_type character varying(32) NOT NULL, -- 'INBOUND_DEBT' | 'DEBT_PAYMENT' | 'RETURN_DEDUCTION'
        amount numeric NOT NULL,
        balance_after numeric NOT NULL,
        due_date timestamp with time zone,
        status character varying(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'OVERDUE' | 'PAID'
        note text,
        created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_supplier_debts_supplier ON public.supplier_debts(supplier_id);
    `);

    // 6. HÀNG COMBO & ĐÓNG GÓI BOM (BILL OF MATERIALS)
    console.log('  👉 [6/8] Tạo bảng Combo & Phiếu Đóng Gói (product_combos, assembly_orders)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.product_combos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        combo_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        quantity numeric NOT NULL,
        uom character varying(32) NOT NULL,
        CONSTRAINT uq_product_combo_item UNIQUE (combo_product_id, component_product_id)
      );

      CREATE TABLE IF NOT EXISTS public.assembly_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_code character varying(64) NOT NULL UNIQUE,
        branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
        assembly_type character varying(32) NOT NULL DEFAULT 'ASSEMBLY', -- 'ASSEMBLY' (đóng gói) | 'DISASSEMBLY' (rã gói)
        target_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        target_quantity numeric NOT NULL,
        status character varying(32) NOT NULL DEFAULT 'COMPLETED',
        note text,
        created_by character varying(128),
        created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
      );

      CREATE TABLE IF NOT EXISTS public.assembly_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        assembly_order_id uuid NOT NULL REFERENCES public.assembly_orders(id) ON DELETE CASCADE,
        component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        consumed_quantity numeric NOT NULL,
        uom character varying(32) NOT NULL
      );
    `);

    // 7. TRUNG TÂM CẢNH BÁO BẤT THƯỜNG (ANOMALY & FRAUD DETECTION)
    console.log('  👉 [7/8] Tạo bảng Cảnh Báo Bất Thường anomaly_alerts...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.anomaly_alerts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
        alert_type character varying(64) NOT NULL, -- 'PRICE_OVERRIDE' | 'POST_PRINT_CANCEL' | 'CASH_DISCREPANCY' | 'OVERDUE_DEBT' | 'LOW_STOCK' | 'NEAR_EXPIRY'
        severity character varying(16) NOT NULL DEFAULT 'MEDIUM', -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
        title character varying(255) NOT NULL,
        description text NOT NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        is_resolved boolean NOT NULL DEFAULT false,
        resolved_by character varying(128),
        created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_branch ON public.anomaly_alerts(branch_id);
      CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_severity ON public.anomaly_alerts(severity);
    `);

    // 8. IDEMPOTENCY KEY TRÁNH BẤM ĐÚP TẠO ĐƠN TRÙNG (INV-10)
    console.log('  👉 [8/8] Bổ sung Idempotency Key vào bảng orders...');
    await client.query(`
      ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS idempotency_key character varying(128);

      CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_idempotency_key 
      ON public.orders(idempotency_key) 
      WHERE idempotency_key IS NOT NULL;
    `);

    await client.query('COMMIT;');
    console.log('🎉 [MIGRATION MASTER PHASE 1 THÀNH CÔNG]: Toàn bộ 8 khối cấu trúc dữ liệu đã được triển khai vào PostgreSQL 100%!');
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('🔥 [MIGRATION MASTER PHASE 1 THẤT BẠI]:', error);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

runMasterPhase1Migration();
