const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runStep5_1() {
  await client.connect();
  console.log('=============================================================================');
  console.log('🛡️ BƯỚC 5.1 (VI MÔ): TẠO BẢNG PHÂN QUYỀN ĐA CHI NHÁNH (USER_BRANCH_ACCESS) & RPC BẢO MẬT');
  console.log('=============================================================================\n');

  try {
    // 1. Tạo bảng user_branch_access
    console.log('1. Đang tạo bảng public.user_branch_access...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_branch_access (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
          user_id UUID NOT NULL,
          organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
          branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL,
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          is_all_branches BOOLEAN NOT NULL DEFAULT FALSE,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          CONSTRAINT chk_branch_or_all CHECK (is_all_branches = TRUE OR branch_id IS NOT NULL)
      );

      CREATE INDEX IF NOT EXISTS idx_user_branch_lookup ON public.user_branch_access(user_id, branch_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_user_all_branches ON public.user_branch_access(user_id, is_all_branches, is_active);
    `);
    console.log('   ✅ Bảng public.user_branch_access và Indexes đã sẵn sàng.');

    // 2. Tạo RPC kiểm tra quyền truy cập chi nhánh has_branch_access
    console.log('2. Đang cài đặt RPC public.has_branch_access...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.has_branch_access(
          p_user_id UUID,
          p_branch_id UUID
      )
      RETURNS BOOLEAN AS $$
      DECLARE
          v_target_org_id UUID;
          v_has_access BOOLEAN := FALSE;
      BEGIN
          -- Lấy organization_id của chi nhánh mục tiêu
          SELECT organization_id INTO v_target_org_id 
          FROM public.branches 
          WHERE id = p_branch_id;

          IF v_target_org_id IS NULL THEN
              RETURN FALSE;
          END IF;

          -- Kiểm tra xem user có quyền cụ thể tại chi nhánh đó HOẶC có quyền trên toàn bộ chi nhánh của Org
          SELECT EXISTS (
              SELECT 1 
              FROM public.user_branch_access
              WHERE user_id = p_user_id 
                AND is_active = TRUE
                AND (
                    branch_id = p_branch_id
                    OR (is_all_branches = TRUE AND organization_id = v_target_org_id)
                )
          ) INTO v_has_access;

          RETURN v_has_access;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);
    console.log('   ✅ RPC public.has_branch_access đã cài đặt thành công.');

    // 3. Khởi tạo 3 User mẫu:
    // - Alice (UUID 1): Thu ngân chỉ làm việc tại CN-Q1
    // - Bob   (UUID 2): Quản lý chỉ làm việc tại CN-Q12
    // - Boss  (UUID 3): Chủ chuỗi có quyền trên TẤT CẢ chi nhánh (is_all_branches = true)
    console.log('3. Đang khởi tạo dữ liệu phân quyền mẫu cho Alice (Q1), Bob (Q12) và Boss (Toàn quyền)...');
    const orgId = (await client.query(`SELECT id FROM public.organizations WHERE code = 'ORG-MEB-01';`)).rows[0].id;
    const q1Id = (await client.query(`SELECT id FROM public.branches WHERE code = 'CN-Q1';`)).rows[0].id;
    const q12Id = (await client.query(`SELECT id FROM public.branches WHERE code = 'CN-Q12';`)).rows[0].id;

    // Giả lập 3 UUID cố định cho User test
    const aliceId = '00000000-0000-0000-0000-000000000001';
    const bobId   = '00000000-0000-0000-0000-000000000002';
    const bossId  = '00000000-0000-0000-0000-000000000003';

    await client.query(`DELETE FROM public.user_branch_access WHERE user_id IN ($1, $2, $3)`, [aliceId, bobId, bossId]);

    // Alice -> CN-Q1 (CASHIER)
    await client.query(`
      INSERT INTO public.user_branch_access (user_id, organization_id, branch_id, role, is_primary)
      VALUES ($1, $2, $3, 'CASHIER', TRUE);
    `, [aliceId, orgId, q1Id]);

    // Bob -> CN-Q12 (STORE_MANAGER)
    await client.query(`
      INSERT INTO public.user_branch_access (user_id, organization_id, branch_id, role, is_primary)
      VALUES ($1, $2, $3, 'STORE_MANAGER', TRUE);
    `, [bobId, orgId, q12Id]);

    // Boss -> Toàn bộ chi nhánh (OWNER)
    await client.query(`
      INSERT INTO public.user_branch_access (user_id, organization_id, branch_id, role, is_all_branches, is_primary)
      VALUES ($1, $2, NULL, 'OWNER', TRUE, TRUE);
    `, [bossId, orgId]);

    console.log('   ✅ Đã phân quyền thành công.');

    // 4. Kiểm định thực tế 6 tình huống bảo mật qua RPC has_branch_access
    console.log('\n4. Đang kiểm định 6 tình huống bảo mật qua has_branch_access:');

    // Tình huống 1: Alice truy cập CN-Q1 -> PHẢI ĐƯỢC PHÉP
    const t1 = (await client.query(`SELECT public.has_branch_access($1, $2) as ok;`, [aliceId, q1Id])).rows[0].ok;
    console.log(`   • Tình huống 1: Alice truy cập CN-Q1:  ${t1 ? '✅ ĐƯỢC PHÉP' : '❌ BỊ CHẶN'} (Kỳ vọng: true)`);

    // Tình huống 2: Alice cố truy cập CN-Q12 -> BẮT BUỘC PHẢI BỊ CHẶN
    const t2 = (await client.query(`SELECT public.has_branch_access($1, $2) as ok;`, [aliceId, q12Id])).rows[0].ok;
    console.log(`   • Tình huống 2: Alice cố vào CN-Q12:   ${!t2 ? '✅ BỊ CHẶN 100%' : '❌ RÒ RỈ QUYỀN!'} (Kỳ vọng: false)`);

    // Tình huống 3: Bob truy cập CN-Q12 -> PHẢI ĐƯỢC PHÉP
    const t3 = (await client.query(`SELECT public.has_branch_access($1, $2) as ok;`, [bobId, q12Id])).rows[0].ok;
    console.log(`   • Tình huống 3: Bob truy cập CN-Q12:   ${t3 ? '✅ ĐƯỢC PHÉP' : '❌ BỊ CHẶN'} (Kỳ vọng: true)`);

    // Tình huống 4: Bob cố truy cập CN-Q1 -> BẮT BUỘC PHẢI BỊ CHẶN
    const t4 = (await client.query(`SELECT public.has_branch_access($1, $2) as ok;`, [bobId, q1Id])).rows[0].ok;
    console.log(`   • Tình huống 4: Bob cố vào CN-Q1:     ${!t4 ? '✅ BỊ CHẶN 100%' : '❌ RÒ RỈ QUYỀN!'} (Kỳ vọng: false)`);

    // Tình huống 5: Boss truy cập CN-Q1 -> PHẢI ĐƯỢC PHÉP
    const t5 = (await client.query(`SELECT public.has_branch_access($1, $2) as ok;`, [bossId, q1Id])).rows[0].ok;
    console.log(`   • Tình huống 5: Boss truy cập CN-Q1:   ${t5 ? '✅ TOÀN QUYỀN HỢP LỆ' : '❌ LỖI'} (Kỳ vọng: true)`);

    // Tình huống 6: Boss truy cập CN-Q12 -> PHẢI ĐƯỢC PHÉP
    const t6 = (await client.query(`SELECT public.has_branch_access($1, $2) as ok;`, [bossId, q12Id])).rows[0].ok;
    console.log(`   • Tình huống 6: Boss truy cập CN-Q12:  ${t6 ? '✅ TOÀN QUYỀN HỢP LỆ' : '❌ LỖI'} (Kỳ vọng: true)`);

    const allPassed = (t1 === true && t2 === false && t3 === true && t4 === false && t5 === true && t6 === true);

    if (allPassed) {
      console.log('\n=============================================================================');
      console.log('🎉 KẾT QUẢ BƯỚC 5.1: ĐẠT CHUẨN 100%! BẢO MẬT PHÂN QUYỀN CHI NHÁNH CHUẨN XÁC.');
      console.log('=============================================================================');
    } else {
      throw new Error('Kiểm định thất bại: Có tình huống bảo mật bị rò rỉ quyền truy cập!');
    }

  } catch (error) {
    console.error('❌ Lỗi tại Bước 5.1:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep5_1();
