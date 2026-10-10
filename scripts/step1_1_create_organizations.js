const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runStep1_1() {
  await client.connect();
  console.log('=============================================================================');
  console.log('🏛️ BƯỚC 1.1 (VI MÔ): TẠO THỰC THỂ GỐC BẢNG ORGANIZATIONS & KHỞI TẠO TỔ CHỨC MẸ');
  console.log('=============================================================================\n');

  try {
    // 1. Tạo bảng organizations
    console.log('1. Đang tạo bảng public.organizations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.organizations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
          code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          tax_code VARCHAR(50),
          phone VARCHAR(50),
          address TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_organizations_code ON public.organizations(code);
      CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(is_active);
    `);
    console.log('   ✅ Bảng public.organizations và Indexes đã tạo thành công.');

    // 2. Chèn Doanh nghiệp mẹ mặc định
    console.log('2. Đang khởi tạo Tổ chức mẹ mặc định: ORG-MEB-01...');
    const insertRes = await client.query(`
      INSERT INTO public.organizations (code, name, tax_code, phone, address)
      VALUES (
        'ORG-MEB-01',
        'Tổng Công Ty Thương Mại & Phân Phối MEB',
        '0312345678',
        '1900-8888',
        'Tòa nhà MEB Tower, Quận 1, TP. Hồ Chí Minh'
      )
      ON CONFLICT (code) DO UPDATE 
      SET name = EXCLUDED.name,
          updated_at = clock_timestamp()
      RETURNING *;
    `);

    const org = insertRes.rows[0];
    console.log('   ✅ Đã khởi tạo / xác nhận Doanh nghiệp mẹ:');
    console.log(`      - ID:       ${org.id}`);
    console.log(`      - Mã:       ${org.code}`);
    console.log(`      - Tên:      ${org.name}`);
    console.log(`      - MST:      ${org.tax_code}`);
    console.log(`      - Ngày tạo: ${org.created_at}\n`);

    // 3. Kiểm định truy vấn độc lập
    console.log('3. Đang kiểm định truy vấn độc lập...');
    const verifyRes = await client.query(`SELECT count(*) as total FROM public.organizations WHERE code = 'ORG-MEB-01' AND is_active = TRUE;`);
    const count = parseInt(verifyRes.rows[0].total, 10);

    if (count === 1) {
      console.log('=============================================================================');
      console.log('🎉 KẾT QUẢ BƯỚC 1.1: ĐẠT CHUẨN 100%! BẢNG ORGANIZATIONS HOẠT ĐỘNG HOÀN HẢO.');
      console.log('=============================================================================');
    } else {
      throw new Error(`Kiểm định thất bại: Số lượng tổ chức tìm thấy là ${count} (Kỳ vọng: 1)`);
    }

  } catch (error) {
    console.error('❌ Lỗi tại Bước 1.1:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep1_1();
