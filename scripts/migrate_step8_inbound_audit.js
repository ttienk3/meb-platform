const { query } = require('../server/src/db');

async function migrate() {
  console.log('📦 Bắt đầu migrate bảng stocktake_audits & stocktake_audit_items...');
  
  await query(`
    CREATE TABLE IF NOT EXISTS public.stocktake_audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_code VARCHAR(50) NOT NULL UNIQUE,
      branch_id UUID NOT NULL REFERENCES public.branches(id),
      matched_items_count INT NOT NULL DEFAULT 0,
      over_items_count INT NOT NULL DEFAULT 0,
      short_items_count INT NOT NULL DEFAULT 0,
      total_variance_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
      note TEXT,
      created_by VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );

    CREATE TABLE IF NOT EXISTS public.stocktake_audit_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_id UUID NOT NULL REFERENCES public.stocktake_audits(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES public.products(id),
      system_qty NUMERIC(15,3) NOT NULL,
      actual_qty NUMERIC(15,3) NOT NULL,
      variance_qty NUMERIC(15,3) NOT NULL,
      unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
      variance_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_stocktake_audits_branch ON public.stocktake_audits(branch_id);
    CREATE INDEX IF NOT EXISTS idx_stocktake_audit_items_audit ON public.stocktake_audit_items(audit_id);
  `);

  console.log('✅ Hoàn tất migrate bảng Kiểm kê kho.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('🔥 Lỗi migrate:', err);
  process.exit(1);
});
