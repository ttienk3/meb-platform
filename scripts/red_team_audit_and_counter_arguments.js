const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runRedTeamAudit() {
  await client.connect();
  console.log('=============================================================================');
  console.log('🔥 RED TEAM AUDIT: PHẢN BIỆN, SOi LỖ HỔNG & TÌM ĐIỂM CHẾT CỦA HỆ THỐNG');
  console.log('   Mục tiêu: Đập vỡ các giả định màu hồng, phơi bày các góc khuất kiến trúc');
  console.log('=============================================================================\n');

  const findings = [];
  const q12 = (await client.query("SELECT id, organization_id FROM public.branches WHERE code = 'CN-Q12'")).rows[0];

  // -------------------------------------------------------------------------
  // 1. PHẢN BIỆN 1: BẪY VƯỢT QUYỀN KHÓA CỦA ADMIN (ADMIN LOCK BYPASS)
  // -------------------------------------------------------------------------
  console.log('🚨 PHẢN BIỆN 1: Chi nhánh có thể lách luật override tính năng bị khóa (is_locked = true)?');
  console.log('   Kịch bản: Admin đã khóa "require_shifts = true" (bắt buộc giao ca). Chi nhánh cố tình chèn "require_shifts = false"...');
  
  // Dọn dẹp override require_shifts nếu có
  await client.query("DELETE FROM public.branch_feature_overrides WHERE branch_id = $1 AND feature_key = 'require_shifts'", [q12.id]);
  
  try {
    await client.query(`
      INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
      VALUES ($1, 'require_shifts', 'false'::jsonb, 'Hacker');
    `, [q12.id]);

    // Kiểm tra hàm get_effective_branch_config
    const effective = (await client.query("SELECT * FROM public.get_effective_branch_config($1) WHERE feature_key = 'require_shifts'", [q12.id])).rows[0];
    
    if (effective.effective_value === false) {
      findings.push({
        id: 'SEC-01',
        title: 'Chi nhánh có thể vô hiệu hóa tính năng bị Admin khóa cứng (is_locked bypass)',
        severity: 'CRITICAL',
        description: 'CSDL cho phép chèn override cho tính năng có is_locked = true, và hàm get_effective_branch_config ưu tiên bfo.value, làm sập ý chí của Admin!'
      });
      console.log('   ❌ PHÁT HIỆN LỖ HỔNG SEC-01: Chi nhánh đã override thành công require_shifts = false! is_locked bị vô hiệu hóa hoàn toàn!');
    } else {
      console.log('   ✅ Tốt: Hàm get_effective_branch_config đã bỏ qua override vì tính năng bị khóa.');
    }
  } catch (err) {
    console.log('   ✅ CSDL đã chặn ngay từ lệnh INSERT:', err.message);
  } finally {
    // Dọn dẹp
    await client.query("DELETE FROM public.branch_feature_overrides WHERE branch_id = $1 AND feature_key = 'require_shifts'", [q12.id]);
  }

  // -------------------------------------------------------------------------
  // 2. PHẢN BIỆN 2: BẪY VI PHẠM RÀNG BUỘC PHỤ THUỘC (DEPENDENCY VIOLATION)
  // -------------------------------------------------------------------------
  console.log('\n🚨 PHẢN BIỆN 2: Chi nhánh có thể tạo trạng thái phi logic (Vi phạm Dependencies)?');
  console.log('   Kịch bản: Cho phép "allow_debt = true" (Bán nợ) nhưng "customer_required = false" (Không cần chọn khách)...');

  try {
    await client.query(`
      INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
      VALUES ($1, 'customer_required', 'false'::jsonb, 'Hacker')
      ON CONFLICT (branch_id, feature_key) DO UPDATE SET value = 'false'::jsonb;
    `, [q12.id]);

    const debtCfg = (await client.query("SELECT * FROM public.get_effective_branch_config($1) WHERE feature_key = 'allow_debt'", [q12.id])).rows[0];
    const custCfg = (await client.query("SELECT * FROM public.get_effective_branch_config($1) WHERE feature_key = 'customer_required'", [q12.id])).rows[0];

    if (debtCfg.effective_value === true && custCfg.effective_value === false) {
      findings.push({
        id: 'LOGIC-01',
        title: 'Vi phạm ràng buộc phụ thuộc tính năng (Feature Dependency Invariant)',
        severity: 'HIGH',
        description: 'allow_debt = true nhưng customer_required = false. CSDL không có trigger chặn, dẫn tới bẫy bán nợ cho khách ẩn danh!'
      });
      console.log('   ❌ PHÁT HIỆN LỖ HỔNG LOGIC-01: allow_debt = true NHƯNG customer_required = false! Bẫy bán nợ ẩn danh được kích hoạt!');
    }
  } catch (err) {
    console.log('   ✅ Đã chặn được:', err.message);
  } finally {
    // Trả lại customer_required = true cho Q12
    await client.query("UPDATE public.branch_feature_overrides SET value = 'true'::jsonb WHERE branch_id = $1 AND feature_key = 'customer_required'", [q12.id]);
  }

  // -------------------------------------------------------------------------
  // 3. PHẢN BIỆN 3: BẪY RÒ RỈ CHÉO TỔ CHỨC (CROSS-TENANT INJECTION)
  // -------------------------------------------------------------------------
  console.log('\n🚨 PHẢN BIỆN 3: Có thể gán nhân viên của Doanh nghiệp A vào Chi nhánh của Doanh nghiệp B?');
  
  // Tạo giả định Doanh nghiệp B
  await client.query(`
    INSERT INTO public.organizations (code, name) 
    VALUES ('ORG-TEST-B', 'Doanh Nghiệp Đối Thủ B') 
    ON CONFLICT (code) DO NOTHING;
  `);
  const orgB = (await client.query("SELECT id FROM public.organizations WHERE code = 'ORG-TEST-B'")).rows[0];

  const fakeUserId = '99999999-9999-9999-9999-999999999999';
  try {
    // Cố tình chèn: user thuộc Org B nhưng gán branch_id của Q12 (thuộc Org A)
    await client.query(`
      INSERT INTO public.user_branch_access (user_id, organization_id, branch_id, role)
      VALUES ($1, $2, $3, 'CASHIER');
    `, [fakeUserId, orgB.id, q12.id]);

    findings.push({
      id: 'SEC-02',
      title: 'Thiếu ràng buộc tính nhất quán Tenant giữa User và Branch (Cross-Tenant Mismatch)',
      severity: 'HIGH',
      description: 'user_branch_access cho phép lưu organization_id của Org B nhưng branch_id lại thuộc Org A. Dễ gây rò rỉ dữ liệu khi truy vấn!'
    });
    console.log('   ❌ PHÁT HIỆN LỖ HỔNG SEC-02: Cho phép lưu organization_id lệch với organization_id của chi nhánh!');
  } catch (err) {
    console.log('   ✅ CSDL đã chặn gán chéo Tenant:', err.message);
  } finally {
    await client.query("DELETE FROM public.user_branch_access WHERE user_id = $1", [fakeUserId]);
    await client.query("DELETE FROM public.organizations WHERE id = $1", [orgB.id]);
  }

  // -------------------------------------------------------------------------
  // 4. PHẢN BIỆN 4: SỰ ĐỨT GÃY VỚI LÕI BÁN HÀNG (SALES ENGINE DISCONNECTION)
  // -------------------------------------------------------------------------
  console.log('\n🚨 PHẢN BIỆN 4: Lõi bán hàng checkout_order có đang dùng động cơ thừa kế mới hay vẫn đọc cờ cũ?');
  const funcDef = (await client.query(`
    SELECT pg_get_functiondef(oid) as def 
    FROM pg_proc 
    WHERE proname = 'checkout_order' 
    LIMIT 1;
  `)).rows[0].def;

  if (!funcDef.includes('get_effective_branch_config')) {
    findings.push({
      id: 'INTEG-01',
      title: 'Đứt gãy liên kết nghiệp vụ (Sales Engine Disconnection)',
      severity: 'CRITICAL',
      description: 'Hàm checkout_order vẫn đang kiểm tra allow_negative_stock và toggles từ bảng branches cũ. Cấu hình kế thừa mới chưa có tác dụng thực tế trong lúc thanh toán!'
    });
    console.log('   ❌ PHÁT HIỆN ĐIỂM CHẾT INTEG-01: checkout_order chưa kết nối với get_effective_branch_config! Toàn bộ cơ chế thừa kế mới chưa bảo vệ được quầy thu ngân!');
  } else {
    console.log('   ✅ checkout_order đã liên kết chặt chẽ với động cơ thừa kế mới.');
  }

  // -------------------------------------------------------------------------
  // 5. PHẢN BIỆN 5: THIẾU NHẬT KÝ KIỂM TOÁN TỰ ĐỘNG (AUDIT LOG AUTOMATION)
  // -------------------------------------------------------------------------
  console.log('\n🚨 PHẢN BIỆN 5: Bảng config_audit_logs có tự động ghi vết khi có thay đổi không?');
  const auditTableExists = (await client.query(`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_audit_logs') as ok;
  `)).rows[0].ok;

  if (!auditTableExists) {
    findings.push({
      id: 'AUDIT-01',
      title: 'Chưa triển khai bảng và Trigger kiểm toán cấu hình tự động (config_audit_logs)',
      severity: 'MEDIUM',
      description: 'Khi quản lý đổi Org Default hoặc chi nhánh sửa Override, hệ thống chưa tự động ghi vết (Audit Log) ai làm, ngày giờ nào, giá trị cũ là gì.'
    });
    console.log('   ❌ PHÁT HIỆN THIẾU SÓT AUDIT-01: Bảng config_audit_logs và Trigger tự động ghi vết chưa tồn tại!');
  } else {
    console.log('   ✅ Bảng config_audit_logs đã sẵn sàng.');
  }

  console.log('\n=============================================================================');
  console.log(`📊 TỔNG HỢP RED TEAM AUDIT: PHÁT HIỆN ${findings.length} VẤN ĐỀ CẦN VÁ NGAY LẬP TỨC!`);
  console.log('=============================================================================');
  findings.forEach((f, idx) => {
    console.log(`[${idx + 1}] [${f.severity}] ${f.id}: ${f.title}`);
    console.log(`    ↳ Chi tiết: ${f.description}\n`);
  });

  await client.end();
}

runRedTeamAudit().catch(console.error);
