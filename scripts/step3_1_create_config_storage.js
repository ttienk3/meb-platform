const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runStep3_1() {
  await client.connect();
  console.log('=============================================================================');
  console.log('📦 BƯỚC 3.1 (VI MÔ): TẠO BỘ ĐÔI BẢNG CẤU HÌNH THỪA KẾ (ORG DEFAULTS & SPARSE OVERRIDES)');
  console.log('=============================================================================\n');

  try {
    // 1. Tạo bảng organization_feature_defaults
    console.log('1. Đang tạo bảng public.organization_feature_defaults...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.organization_feature_defaults (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
          organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
          feature_key VARCHAR(50) NOT NULL REFERENCES public.feature_registry(key) ON DELETE CASCADE,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          CONSTRAINT uq_org_feature UNIQUE (organization_id, feature_key)
      );

      CREATE INDEX IF NOT EXISTS idx_org_defaults_lookup ON public.organization_feature_defaults(organization_id, feature_key);
    `);
    console.log('   ✅ Bảng public.organization_feature_defaults đã tạo thành công.');

    // 2. Tạo bảng branch_feature_overrides (Sparse storage - chỉ lưu delta)
    console.log('2. Đang tạo bảng public.branch_feature_overrides (Sparse Delta Storage)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.branch_feature_overrides (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
          branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
          feature_key VARCHAR(50) NOT NULL REFERENCES public.feature_registry(key) ON DELETE CASCADE,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          updated_by VARCHAR(100),
          CONSTRAINT uq_branch_feature UNIQUE (branch_id, feature_key)
      );

      CREATE INDEX IF NOT EXISTS idx_branch_overrides_lookup ON public.branch_feature_overrides(branch_id, feature_key);
    `);
    console.log('   ✅ Bảng public.branch_feature_overrides đã tạo thành công.');

    // 3. Nạp Org Defaults cho Doanh nghiệp mẹ ORG-MEB-01 từ feature_registry
    console.log('3. Đang khởi tạo bộ cấu hình mặc định (Organization Defaults) cho ORG-MEB-01...');
    const orgId = (await client.query(`SELECT id FROM public.organizations WHERE code = 'ORG-MEB-01';`)).rows[0].id;

    await client.query(`
      INSERT INTO public.organization_feature_defaults (organization_id, feature_key, value)
      SELECT $1, key, default_value
      FROM public.feature_registry
      ON CONFLICT (organization_id, feature_key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = clock_timestamp();
    `, [orgId]);

    const orgDefaultsCount = (await client.query(`SELECT count(*) as total FROM public.organization_feature_defaults WHERE organization_id = $1`, [orgId])).rows[0].total;
    console.log(`   ✅ Đã nạp ${orgDefaultsCount} cấu hình mặc định cho Tổ chức mẹ.`);

    // 4. Thiết lập Sparse Override cho Chi nhánh 2 (CN-Q12 - Vật Liệu Xây Dựng)
    // CN-Q12 cần: Bán nợ = true, Khổ in = 'A4'.
    // CN-Q1 (Tạp hóa): 0 bản ghi override (hoàn toàn kế thừa).
    console.log('4. Đang thiết lập Sparse Override có chọn lọc cho CN-Q12 (Vật Liệu Xây Dựng)...');
    const q12Id = (await client.query(`SELECT id FROM public.branches WHERE code = 'CN-Q12';`)).rows[0].id;
    const q1Id = (await client.query(`SELECT id FROM public.branches WHERE code = 'CN-Q1';`)).rows[0].id;

    // Xóa override cũ nếu có để đảm bảo test sạch
    await client.query(`DELETE FROM public.branch_feature_overrides WHERE branch_id IN ($1, $2)`, [q1Id, q12Id]);

    // Chèn đúng 2 override cho CN-Q12
    await client.query(`
      INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
      VALUES 
      ($1, 'allow_debt', 'true'::jsonb, 'Admin Q12'),
      ($1, 'customer_required', 'true'::jsonb, 'Admin Q12'),
      ($1, 'print_format', '"A4"'::jsonb, 'Admin Q12');
    `, [q12Id]);
    console.log('   ✅ Đã ghi nhận 3 override riêng biệt cho CN-Q12 (allow_debt=true, customer_required=true, print_format="A4").');

    // 5. Kiểm định tính thưa thớt (Sparse Verification)
    console.log('\n5. Đang kiểm định tính chất thưa thớt (Sparse Storage Verification)...');
    const q1Overrides = (await client.query(`SELECT count(*) as total FROM public.branch_feature_overrides WHERE branch_id = $1`, [q1Id])).rows[0].total;
    const q12Overrides = (await client.query(`SELECT count(*) as total FROM public.branch_feature_overrides WHERE branch_id = $1`, [q12Id])).rows[0].total;

    console.log(`   • Số bản ghi override của CN-Q1 (Tạp hóa): ${q1Overrides} dòng (Kỳ vọng: 0 dòng - Hoàn toàn thừa kế)`);
    console.log(`   • Số bản ghi override của CN-Q12 (VLXD):   ${q12Overrides} dòng (Kỳ vọng: 3 dòng - Điểm khác biệt thực sự)`);

    if (parseInt(q1Overrides, 10) === 0 && parseInt(q12Overrides, 10) === 3) {
      console.log('\n=============================================================================');
      console.log('🎉 KẾT QUẢ BƯỚC 3.1: ĐẠT CHUẨN 100%! SPARSE STORAGE ĐÃ BẢO VỆ CSDL KHÔNG BỊ RÁC.');
      console.log('=============================================================================');
    } else {
      throw new Error('Kiểm định thất bại: CSDL bị sai lệch số lượng bản ghi sparse!');
    }

  } catch (error) {
    console.error('❌ Lỗi tại Bước 3.1:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep3_1();
