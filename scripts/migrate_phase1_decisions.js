/**
 * Migration: Triển khai CSDL theo 14 Quyết Định Nghiệp Vụ Hoàn Chỉnh (Phase 1)
 * MEB SaaS Multi-Branch Platform
 */
const db = require('../server/src/db');

async function migratePhase1() {
  console.log('🚀 [Migration Phase 1]: Bắt đầu cập nhật CSDL theo 14 quyết định kiến trúc...');
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Soft Delete cho các bảng chính (Q3)
    console.log('📌 [1/8] Bổ sung cột Soft Delete (is_deleted, deleted_at)...');
    await client.query(`
      ALTER TABLE public.products 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

      ALTER TABLE public.partners 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

      ALTER TABLE public.branches 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

      ALTER TABLE public.orders 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

      CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_deleted, is_active);
      CREATE INDEX IF NOT EXISTS idx_partners_active ON public.partners(is_deleted, is_active);
    `);

    // 2. Xuất âm & Cấu hình chi nhánh (Q6, Q8)
    console.log('📌 [2/8] Bổ sung cấu hình chi nhánh (allow_negative_stock)...');
    await client.query(`
      ALTER TABLE public.branches 
        ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // 3. Quản lý Lô & HSD, Kê giá vốn thủ công (Q1, Q2)
    console.log('📌 [3/8] Bổ sung theo dõi Lô/HSD & Ghi đè giá vốn (override_cogs)...');
    await client.query(`
      ALTER TABLE public.products 
        ADD COLUMN IF NOT EXISTS track_expiry BOOLEAN NOT NULL DEFAULT FALSE;

      ALTER TABLE public.order_items 
        ADD COLUMN IF NOT EXISTS override_cogs NUMERIC DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL;

      ALTER TABLE public.inventory_logs 
        ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL;
    `);

    // 4. Nhóm khách hàng & Chiết khấu mặc định (Q9)
    console.log('📌 [4/8] Khởi tạo bảng customer_groups & liên kết partners...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.customer_groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        discount_rate_pct NUMERIC NOT NULL DEFAULT 0,
        description TEXT,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      ALTER TABLE public.partners 
        ADD COLUMN IF NOT EXISTS customer_group_id UUID REFERENCES public.customer_groups(id) ON DELETE SET NULL;

      -- Seed 3 nhóm khách hàng chuẩn
      INSERT INTO public.customer_groups (code, name, discount_rate_pct, description)
      VALUES 
        ('VIP', 'Khách Hàng Thân Thiết (VIP)', 10, 'Chiết khấu 10% tự động cho đơn mua tại quầy'),
        ('WHOLESALE', 'Khách Mua Buôn / Đại Lý', 5, 'Chiết khấu 5% cho khách hàng sỉ'),
        ('RETAIL', 'Khách Vãng Lai / Bán Lẻ', 0, 'Giá niêm yết bán lẻ tiêu chuẩn')
      ON CONFLICT (code) DO UPDATE 
        SET discount_rate_pct = EXCLUDED.discount_rate_pct,
            name = EXCLUDED.name;
    `);

    // 5. Shipper Debts bồi thường hao hụt vận chuyển (Q7)
    console.log('📌 [5/8] Khởi tạo bảng shipper_debts...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.shipper_debts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
        shipper_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
        shipper_name VARCHAR(100) NOT NULL,
        amount NUMERIC NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'DEDUCTED'
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_shipper_debts_status ON public.shipper_debts(status);
    `);

    // 6. Rút két tiền mặt an toàn giữa ca (Q13)
    console.log('📌 [6/8] Khởi tạo bảng shift_cash_drops...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.shift_cash_drops (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
        branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        reason TEXT NOT NULL,
        receiver_name VARCHAR(100) NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_shift_cash_drops_shift ON public.shift_cash_drops(shift_id);
    `);

    // 7. Sổ quỹ Đa Tài Khoản & Danh mục Chi phí vận hành OPEX (Q14)
    console.log('📌 [7/8] Khởi tạo cash_accounts, expense_categories, expense_records...');
    await client.query(`
      -- Tài khoản dòng tiền
      CREATE TABLE IF NOT EXISTS public.cash_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
        account_code VARCHAR(50) NOT NULL UNIQUE,
        account_name VARCHAR(100) NOT NULL,
        account_type VARCHAR(50) NOT NULL DEFAULT 'CASH', -- 'CASH', 'BANK_VIETQR', 'CENTRAL_SAFE'
        account_number VARCHAR(100),
        bank_name VARCHAR(100),
        current_balance NUMERIC NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      -- Danh mục chi phí vận hành
      CREATE TABLE IF NOT EXISTS public.expense_categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      -- Bản ghi chi phí vận hành
      CREATE TABLE IF NOT EXISTS public.expense_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
        account_id UUID REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
        category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
        amount NUMERIC NOT NULL,
        description TEXT NOT NULL,
        spent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        created_by VARCHAR(100) NOT NULL,
        receipt_image_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_expense_records_branch ON public.expense_records(branch_id, spent_at);

      -- Seed danh mục chi phí cơ bản
      INSERT INTO public.expense_categories (code, name, description)
      VALUES 
        ('RENT', 'Tiền Thuê Mặt Bằng / Kho Bãi', 'Chi phí thuê địa điểm hoạt động cố định'),
        ('UTILITY', 'Điện / Nước / Internet / Rác', 'Chi phí tiện ích hạ tầng hàng tháng'),
        ('SALARY', 'Lương & Phụ Cấp Nhân Viên', 'Chi phí nhân sự theo ca hoặc tháng'),
        ('SHIPPING', 'Cước Vận Chuyển / Xăng Xe', 'Chi phí điều chuyển hàng hoặc giao hàng'),
        ('MARKETING', 'Quảng Cáo & Tiếp Thị', 'Chi phí khuyến mãi, banner, tiếp khách'),
        ('OTHER', 'Chi Phí Khác', 'Các khoản chi phát sinh đột xuất')
      ON CONFLICT (code) DO NOTHING;
    `);

    // 8. Tự động khởi tạo Cash Accounts cho các chi nhánh hiện có
    console.log('📌 [8/8] Khởi tạo tài khoản tiền mặt và VietQR cho từng chi nhánh...');
    const branches = await client.query('SELECT id, code, name FROM public.branches;');
    for (const b of branches.rows) {
      // 1. Két tiền mặt
      await client.query(`
        INSERT INTO public.cash_accounts (branch_id, account_code, account_name, account_type, current_balance)
        VALUES ($1, $2, $3, 'CASH', 0)
        ON CONFLICT (account_code) DO NOTHING;
      `, [b.id, `CASH-${b.code}`, `Két Tiền Mặt (${b.name})`]);

      // 2. Tài khoản VietQR
      await client.query(`
        INSERT INTO public.cash_accounts (branch_id, account_code, account_name, account_type, account_number, bank_name, current_balance)
        VALUES ($1, $2, $3, 'BANK_VIETQR', '9999888877', 'MBBank (VietQR)', 0)
        ON CONFLICT (account_code) DO NOTHING;
      `, [b.id, `BANK-${b.code}`, `TK VietQR Ngân Hàng (${b.name})`]);
    }

    // 3. Két sắt tổng công ty
    await client.query(`
      INSERT INTO public.cash_accounts (branch_id, account_code, account_name, account_type, current_balance)
      VALUES (NULL, 'SAFE-CENTRAL', 'Két Sắt Trung Ương Trụ Sở Chính', 'CENTRAL_SAFE', 0)
      ON CONFLICT (account_code) DO NOTHING;
    `);

    await client.query('COMMIT;');
    console.log('✅ [Migration Phase 1]: Hoàn tất 100% việc cập nhật CSDL cho 14 quyết định nghiệp vụ!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ [Migration Phase 1 Error]:', err.message);
    throw err;
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) {
  migratePhase1().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migratePhase1 };
