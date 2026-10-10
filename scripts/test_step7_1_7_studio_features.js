const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep7_1_7() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.7: NO-CODE STUDIO & QUẢN TRỊ CỜ TÍNH NĂNG (STUDIO TAB)');
  console.log('   Mục tiêu: Đảm bảo giao diện StudioTab điều khiển Sparse Config & Audit Log chuẩn xác');
  console.log('=============================================================================\n');

  let passed = 0;
  let total = 0;

  function record(desc, ok, details) {
    total++;
    if (ok) {
      passed++;
      console.log(`✅ [ĐẠT] TEST ${total}: ${desc}`);
    } else {
      console.log(`❌ [THẤT BẠI] TEST ${total}: ${desc}`);
    }
    if (details) console.log(`   Chi tiết: ${details}`);
  }

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`🌐 Server Backend kiểm thử đang chạy tại: ${baseUrl}\n`);

  try {
    const q1 = (await query("SELECT id, code, name FROM public.branches WHERE code = 'CN-Q1';")).rows[0];
    const bossId = '00000000-0000-0000-0000-000000000003';

    // Dọn dẹp override trước đó của allow_debt để test sạch sẽ
    await query("DELETE FROM public.branch_feature_overrides WHERE branch_id = $1 AND feature_key = 'allow_debt';", [q1.id]);

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/admin/features/registry tải danh mục cờ tính năng hệ thống
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/admin/features/registry`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });
    const data1 = await res1.json();
    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      Array.isArray(data1.data) &&
      data1.data.length >= 8 &&
      data1.data.some(f => f.key === 'allow_debt')
    );
    record('GET /api/admin/features/registry tải danh mục từ điển tính năng gốc', t1Ok, `Tìm thấy ${data1.data?.length || 0} cờ tính năng`);

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/admin/features/branch/:branchId tải ma trận thừa kế chi nhánh
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/admin/features/branch/${q1.id}`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });
    const data2 = await res2.json();
    const debtFeatureInitial = data2.data?.find(f => f.feature_key === 'allow_debt');
    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      Array.isArray(data2.data) &&
      debtFeatureInitial !== undefined &&
      (debtFeatureInitial.source === 'ORGANIZATION_DEFAULT' || debtFeatureInitial.is_overridden === false)
    );
    record('GET /api/admin/features/branch/:id tải ma trận thừa kế thời gian thực (source: ORGANIZATION_DEFAULT)', t2Ok, `Chi nhánh: ${data2.branch?.code}, Cờ allow_debt nguồn: ${debtFeatureInitial?.source}, is_overridden: ${debtFeatureInitial?.is_overridden}`);

    // -------------------------------------------------------------------------
    // TEST 3: POST /api/admin/features/override ghi đè tính năng cho chi nhánh
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch_id: q1.id,
        feature_key: 'allow_debt',
        value: false,
        updated_by: 'Owner Studio Test'
      })
    });
    const data3 = await res3.json();
    const t3Ok = res3.status === 200 && data3.success === true;
    record('POST /api/admin/features/override lưu thiết lập ghi đè (allow_debt: false)', t3Ok, `Thông báo: ${data3.message}`);

    // -------------------------------------------------------------------------
    // TEST 4: Xác nhận ma trận thừa kế cập nhật nguồn gốc sang 'BRANCH_OVERRIDE'
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/admin/features/branch/${q1.id}`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });
    const data4 = await res4.json();
    const debtFeatureOverridden = data4.data?.find(f => f.feature_key === 'allow_debt');
    const t4Ok = (
      res4.status === 200 &&
      debtFeatureOverridden !== undefined &&
      (debtFeatureOverridden.source === 'BRANCH_OVERRIDE' || debtFeatureOverridden.is_overridden === true) &&
      debtFeatureOverridden.effective_value === false
    );
    record('Ma trận cấu hình chuyển nguồn sang BRANCH_OVERRIDE và giá trị hiệu lực thành false', t4Ok, `Nguồn: ${debtFeatureOverridden?.source}, Giá trị hiệu lực: ${debtFeatureOverridden?.effective_value}`);

    // -------------------------------------------------------------------------
    // TEST 5: Invalidate Cache và kiểm chứng /api/context/runtime phản hồi giá trị mới
    // -------------------------------------------------------------------------
    await fetch(`${baseUrl}/api/context/invalidate`, {
      method: 'POST',
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });

    const res5 = await fetch(`${baseUrl}/api/context/runtime`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });
    const data5 = await res5.json();
    const t5Ok = res5.status === 200 && data5.success === true && data5.data?.features?.allow_debt === false;
    record('Invalidate Cache đồng bộ tức thì sang runtime context (features.allow_debt === false)', t5Ok, `Runtime features.allow_debt: ${data5.data?.features?.allow_debt}`);

    // -------------------------------------------------------------------------
    // TEST 6: Chặn ghi đè cờ tính năng bị khóa bởi tổ chức (require_shifts: is_locked = true)
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch_id: q1.id,
        feature_key: 'require_shifts',
        value: false,
        updated_by: 'Unauthorized Test'
      })
    });
    const data6 = await res6.json();
    const t6Ok = res6.status >= 400 && data6.success === false && (data6.error?.message || '').includes('VƯỢT QUYỀN KHÓA ADMIN');
    record('Chặn thành công ghi đè cờ tính năng bị khóa toàn hệ thống (require_shifts)', t6Ok, `HTTP ${res6.status}: ${data6.error?.message || data6.message}`);

    // -------------------------------------------------------------------------
    // TEST 7: DELETE /api/admin/features/override khôi phục thừa kế mặc định
    // -------------------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'DELETE',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch_id: q1.id,
        feature_key: 'allow_debt'
      })
    });
    const data7 = await res7.json();
    const t7Ok = res7.status === 200 && data7.success === true;
    record('DELETE /api/admin/features/override xóa ghi đè, khôi phục thừa kế mặc định', t7Ok, `Thông báo: ${data7.message}`);

    // -------------------------------------------------------------------------
    // TEST 8: Xác nhận ma trận thừa kế quay lại nguồn gốc 'ORGANIZATION_DEFAULT'
    // -------------------------------------------------------------------------
    const res8 = await fetch(`${baseUrl}/api/admin/features/branch/${q1.id}`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });
    const data8 = await res8.json();
    const debtFeatureReset = data8.data?.find(f => f.feature_key === 'allow_debt');
    const t8Ok = (
      res8.status === 200 &&
      debtFeatureReset !== undefined &&
      (debtFeatureReset.source === 'ORGANIZATION_DEFAULT' || debtFeatureReset.is_overridden === false) &&
      debtFeatureReset.effective_value === false
    );
    record('Ma trận cấu hình chuyển lại nguồn ORGANIZATION_DEFAULT và giá trị mặc định false', t8Ok, `Nguồn: ${debtFeatureReset?.source}, Giá trị hiệu lực: ${debtFeatureReset?.effective_value}`);

    // -------------------------------------------------------------------------
    // TEST 9: GET /api/admin/audit-logs ghi nhận đầy đủ lịch sử thay đổi cấu hình
    // -------------------------------------------------------------------------
    const res9 = await fetch(`${baseUrl}/api/admin/audit-logs?branch_id=${q1.id}`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });
    const data9 = await res9.json();
    const logFound = data9.data?.find(l => l.feature_key === 'allow_debt');
    const t9Ok = (
      res9.status === 200 &&
      data9.success === true &&
      Array.isArray(data9.data) &&
      logFound !== undefined
    );
    record('GET /api/admin/audit-logs tra cứu lịch sử can thiệp cấu hình lưu trữ bất biến', t9Ok, `Tìm thấy ${data9.data?.length || 0} bản ghi audit log, bản ghi gần nhất hành động: ${logFound?.action}`);

    // -------------------------------------------------------------------------
    // TEST 10: Thống kê Bento Studio Metrics trên giao diện đồng nhất với DB
    // -------------------------------------------------------------------------
    const totalCount = data1.data?.length;
    const overriddenCount = data8.data?.filter(f => f.is_overridden || f.source === 'BRANCH_OVERRIDE').length;
    const defaultCount = data8.data?.filter(f => !f.is_overridden && (f.source === 'ORGANIZATION_DEFAULT' || f.source === 'DEFAULT' || f.source === 'SYSTEM_DEFAULT')).length;
    const t10Ok = totalCount > 0 && overriddenCount !== undefined && defaultCount > 0 && (overriddenCount + defaultCount === data8.data?.length);
    record('Bento Studio Metrics tính toán toàn vẹn (Tổng cờ, Override chi nhánh, Kế thừa chuỗi)', t10Ok, `Tổng: ${totalCount}, Override: ${overriddenCount}, Kế thừa mặc định: ${defaultCount}`);

    // Khôi phục lại allow_debt: true cho CN-Q1 để bảo toàn hệ sinh thái test toàn cục
    await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'POST',
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: q1.id, feature_key: 'allow_debt', value: true, updated_by: 'System Auto Restore' })
    });
    await fetch(`${baseUrl}/api/context/invalidate`, {
      method: 'POST',
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });

    console.log('\n=============================================================================');
    console.log(`🎯 KẾT QUẢ KIỂM THỬ BƯỚC 7.1.7: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed/total)*100)}%)`);
    console.log('=============================================================================');

    if (passed === total) {
      console.log('🎉 TẤT CẢ 10/10 CA KIỂM ĐỊNH THÀNH CÔNG! SẴN SÀNG TÍCH HỢP TOÀN HỆ THỐNG.\n');
    } else {
      console.log('⚠️ CÓ CA KIỂM ĐỊNH THẤT BẠI. CẦN KIỂM TRA LẠI!\n');
    }
  } catch (err) {
    console.error('🔥 [LỖI NGOẠI LỆ]:', err);
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTestStep7_1_7().then(() => pool.end());
}

module.exports = runTestStep7_1_7;
