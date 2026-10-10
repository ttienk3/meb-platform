const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runStep4_1() {
  await client.connect();
  console.log('=============================================================================');
  console.log('⚙️ BƯỚC 4.1 (VI MÔ): CÀI ĐẶT & KIỂM THỬ ĐỘNG CƠ GIẢI QUYẾT CẤU HÌNH THỪA KẾ (FALLBACK ENGINE)');
  console.log('=============================================================================\n');

  try {
    // 1. Cài đặt hàm get_effective_branch_config trên CSDL
    console.log('1. Đang cài đặt hàm public.get_effective_branch_config trên CSDL PostgreSQL...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.get_effective_branch_config(p_branch_id UUID)
      RETURNS TABLE (
          feature_key VARCHAR(50),
          group_name VARCHAR(50),
          label VARCHAR(255),
          data_type VARCHAR(20),
          effective_value JSONB,
          is_overridden BOOLEAN,
          source VARCHAR(30),
          is_locked BOOLEAN,
          options JSONB,
          dependencies JSONB
      ) AS $$
      DECLARE
          v_org_id UUID;
      BEGIN
          -- Tìm tổ chức mẹ của chi nhánh
          SELECT organization_id INTO v_org_id FROM public.branches WHERE id = p_branch_id;
          
          RETURN QUERY
          SELECT 
              fr.key AS feature_key,
              fr.group_name,
              fr.label,
              fr.data_type,
              COALESCE(bfo.value, ofd.value, fr.default_value) AS effective_value,
              (bfo.value IS NOT NULL) AS is_overridden,
              CASE 
                  WHEN bfo.value IS NOT NULL THEN 'BRANCH_OVERRIDE'::varchar(30)
                  WHEN ofd.value IS NOT NULL THEN 'ORGANIZATION_DEFAULT'::varchar(30)
                  ELSE 'SYSTEM_DEFAULT'::varchar(30)
              END AS source,
              fr.is_locked,
              fr.options,
              fr.dependencies
          FROM public.feature_registry fr
          LEFT JOIN public.organization_feature_defaults ofd 
              ON ofd.feature_key = fr.key AND ofd.organization_id = v_org_id
          LEFT JOIN public.branch_feature_overrides bfo 
              ON bfo.feature_key = fr.key AND bfo.branch_id = p_branch_id
          WHERE fr.is_active = TRUE
          ORDER BY fr.group_name, fr.key;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);
    console.log('   ✅ Đã cài đặt hàm public.get_effective_branch_config thành công.');

    // 2. Lấy ID của CN-Q1 và CN-Q12
    const q1Id = (await client.query(`SELECT id FROM public.branches WHERE code = 'CN-Q1';`)).rows[0].id;
    const q12Id = (await client.query(`SELECT id FROM public.branches WHERE code = 'CN-Q12';`)).rows[0].id;
    const orgId = (await client.query(`SELECT id FROM public.organizations WHERE code = 'ORG-MEB-01';`)).rows[0].id;

    // =========================================================================
    // TEST CA 1: CN-Q1 (Tạp hóa) KẾ THỪA 100% TỪ ORG DEFAULT
    // =========================================================================
    console.log('\n🧪 TEST CA 1: Kiểm định tính kế thừa của CN-Q1 (Không override)...');
    const q1Res = await client.query(`SELECT * FROM public.get_effective_branch_config($1);`, [q1Id]);
    const q1Debt = q1Res.rows.find(r => r.feature_key === 'allow_debt');
    const q1Print = q1Res.rows.find(r => r.feature_key === 'print_format');

    const ca1Pass = (q1Debt.effective_value === false && q1Debt.source === 'ORGANIZATION_DEFAULT' && !q1Debt.is_overridden) &&
                     (q1Print.effective_value === 'K80' && q1Print.source === 'ORGANIZATION_DEFAULT' && !q1Print.is_overridden);
    console.log(`   • allow_debt:   ${q1Debt.effective_value} (Source: ${q1Debt.source}, Overridden: ${q1Debt.is_overridden})`);
    console.log(`   • print_format: ${q1Print.effective_value} (Source: ${q1Print.source}, Overridden: ${q1Print.is_overridden})`);
    if (!ca1Pass) throw new Error('TEST CA 1 THẤT BẠI: CN-Q1 không kế thừa đúng từ Org!');
    console.log('   -> ✅ CA 1 ĐẠT CHUẨN 100%!');

    // =========================================================================
    // TEST CA 2: CN-Q12 (Vật liệu xây dựng) NHẬN GIÁ TRỊ OVERRIDE RIÊNG
    // =========================================================================
    console.log('\n🧪 TEST CA 2: Kiểm định tính ghi đè (Override) của CN-Q12...');
    const q12Res = await client.query(`SELECT * FROM public.get_effective_branch_config($1);`, [q12Id]);
    const q12Debt = q12Res.rows.find(r => r.feature_key === 'allow_debt');
    const q12Print = q12Res.rows.find(r => r.feature_key === 'print_format');

    const ca2Pass = (q12Debt.effective_value === true && q12Debt.source === 'BRANCH_OVERRIDE' && q12Debt.is_overridden) &&
                     (q12Print.effective_value === 'A4' && q12Print.source === 'BRANCH_OVERRIDE' && q12Print.is_overridden);
    console.log(`   • allow_debt:   ${q12Debt.effective_value} (Source: ${q12Debt.source}, Overridden: ${q12Debt.is_overridden})`);
    console.log(`   • print_format: ${q12Print.effective_value} (Source: ${q12Print.source}, Overridden: ${q12Print.is_overridden})`);
    if (!ca2Pass) throw new Error('TEST CA 2 THẤT BẠI: CN-Q12 không nhận giá trị Override!');
    console.log('   -> ✅ CA 2 ĐẠT CHUẨN 100%!');

    // =========================================================================
    // TEST CA 3: ĐỔI ORG DEFAULT -> TỰ ĐỘNG LAN TRUYỀN TỚI CN-Q1
    // =========================================================================
    console.log('\n🧪 TEST CA 3: Đổi Org Default của pos_barcode từ true -> false...');
    await client.query(`
      UPDATE public.organization_feature_defaults 
      SET value = 'false'::jsonb 
      WHERE organization_id = $1 AND feature_key = 'pos_barcode';
    `, [orgId]);

    const q1Updated = (await client.query(`SELECT * FROM public.get_effective_branch_config($1) WHERE feature_key = 'pos_barcode';`, [q1Id])).rows[0];
    console.log(`   • pos_barcode tại CN-Q1 sau khi đổi Org Default: ${q1Updated.effective_value} (Source: ${q1Updated.source})`);
    if (q1Updated.effective_value !== false) throw new Error('TEST CA 3 THẤT BẠI: Thay đổi Org Default không tự lan truyền tới chi nhánh!');
    console.log('   -> ✅ CA 3 ĐẠT CHUẨN 100%! Cấu hình chung lan truyền tức thì.');

    // Trả lại pos_barcode = true cho Org
    await client.query(`
      UPDATE public.organization_feature_defaults 
      SET value = 'true'::jsonb 
      WHERE organization_id = $1 AND feature_key = 'pos_barcode';
    `, [orgId]);

    // =========================================================================
    // TEST CA 4: CN-Q12 ĐÃ OVERRIDE KHÔNG BỊ ẢNH HƯỞNG BỞI ORG DEFAULT
    // =========================================================================
    console.log('\n🧪 TEST CA 4: Đổi Org Default của allow_debt từ false -> true...');
    await client.query(`
      UPDATE public.organization_feature_defaults 
      SET value = 'true'::jsonb 
      WHERE organization_id = $1 AND feature_key = 'allow_debt';
    `, [orgId]);

    const q12StillOverride = (await client.query(`SELECT * FROM public.get_effective_branch_config($1) WHERE feature_key = 'allow_debt';`, [q12Id])).rows[0];
    console.log(`   • allow_debt tại CN-Q12: ${q12StillOverride.effective_value} (Source: ${q12StillOverride.source}, Overridden: ${q12StillOverride.is_overridden})`);
    if (q12StillOverride.source !== 'BRANCH_OVERRIDE') throw new Error('TEST CA 4 THẤT BẠI: Branch Override bị ghi đè bởi Org Default!');
    console.log('   -> ✅ CA 4 ĐẠT CHUẨN 100%! Điểm khác biệt của chi nhánh được bảo vệ.');

    // Trả lại allow_debt = false cho Org
    await client.query(`
      UPDATE public.organization_feature_defaults 
      SET value = 'false'::jsonb 
      WHERE organization_id = $1 AND feature_key = 'allow_debt';
    `, [orgId]);

    // =========================================================================
    // TEST CA 5: KHÔI PHỤC MẶC ĐỊNH (RESET OVERRIDE) -> QUAY VỀ INHERITED
    // =========================================================================
    console.log('\n🧪 TEST CA 5: Xóa Override của print_format tại CN-Q12 (Khôi phục mặc định)...');
    await client.query(`
      DELETE FROM public.branch_feature_overrides 
      WHERE branch_id = $1 AND feature_key = 'print_format';
    `, [q12Id]);

    const q12Reset = (await client.query(`SELECT * FROM public.get_effective_branch_config($1) WHERE feature_key = 'print_format';`, [q12Id])).rows[0];
    console.log(`   • print_format tại CN-Q12 sau khi Reset: ${q12Reset.effective_value} (Source: ${q12Reset.source}, Overridden: ${q12Reset.is_overridden})`);
    if (q12Reset.effective_value !== 'K80' || q12Reset.source !== 'ORGANIZATION_DEFAULT' || q12Reset.is_overridden !== false) {
      throw new Error('TEST CA 5 THẤT BẠI: Reset override không quay về giá trị thừa kế!');
    }
    console.log('   -> ✅ CA 5 ĐẠT CHUẨN 100%! Khôi phục mặc định sạch sẽ, không tốn rác.');

    // Cài lại print_format = 'A4' cho CN-Q12
    await client.query(`
      INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
      VALUES ($1, 'print_format', '"A4"'::jsonb, 'Admin Q12');
    `, [q12Id]);

    console.log('\n=============================================================================');
    console.log('🎉 KẾT QUẢ BƯỚC 4.1: ĐẠT CHUẨN 100%! CẢ 5 CA KIỂM ĐỊNH KẾ THỪA THÀNH CÔNG RỰC RỠ!');
    console.log('=============================================================================');

  } catch (error) {
    console.error('❌ Lỗi tại Bước 4.1:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep4_1();
