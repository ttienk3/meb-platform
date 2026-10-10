const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_2_3() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.2.3: API QUẢN TRỊ ĐỘNG NO-CODE (ADMIN FEATURES API)');
  console.log('   Mục tiêu: Đảm bảo Chủ chuỗi bật/tắt cờ qua API, chặn vượt quyền và xóa cờ');
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
  console.log(`🌐 Server kiểm thử tạm thời đang chạy tại: ${baseUrl}\n`);

  try {
    const q12 = (await query("SELECT id, code FROM public.branches WHERE code = 'CN-Q12';")).rows[0];

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/admin/features/registry tải danh mục từ điển tính năng
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/admin/features/registry`);
    const data1 = await res1.json();
    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      data1.data.length >= 8 &&
      data1.data.some(f => f.key === 'allow_debt')
    );
    record(
      'Tải danh mục 8 cờ tính năng chuẩn từ Feature Registry',
      t1Ok,
      `Số cờ tính năng: ${data1.data?.length} | Chứa allow_debt: ${data1.data?.some(f => f.key === 'allow_debt')}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/admin/features/branch/:branchId xem ma trận cấu hình của chi nhánh
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/admin/features/branch/${q12.id}`);
    const data2 = await res2.json();
    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      data2.branch?.code === 'CN-Q12' &&
      data2.data.length >= 8
    );
    record(
      'Xem ma trận cấu hình thừa kế của CN-Q12',
      t2Ok,
      `Chi nhánh: ${data2.branch?.code} | Số lượng cờ hiệu lực: ${data2.data?.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Cố tình lách luật override tính năng bị Admin khóa cứng (require_shifts)
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: q12.id,
        feature_key: 'require_shifts',
        value: false,
        updated_by: 'Kẻ Phá Hoại'
      })
    });
    const data3 = await res3.json();
    const t3Ok = (
      res3.status === 400 &&
      data3.error?.code === 'OVERRIDE_REJECTED' &&
      data3.error?.message.includes('VƯỢT QUYỀN KHÓA ADMIN')
    );
    record(
      'Chặn đứng cưỡng chế hành vi override tính năng bị khóa cứng (is_locked = true)',
      t3Ok,
      `HTTP Status: ${res3.status} | Mã lỗi: ${data3.error?.code} | Thông điệp CSDL: "${data3.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Override hợp lệ cờ allow_debt = true cho Q12
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: q12.id,
        feature_key: 'allow_debt',
        value: true,
        updated_by: 'Chủ Doanh Nghiệp'
      })
    });
    const data4 = await res4.json();
    const t4Ok = (res4.status === 200 && data4.success === true);
    record(
      'Cập nhật Override hợp lệ thành công qua API',
      t4Ok,
      `Thông điệp: "${data4.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 5: DELETE /api/admin/features/override đặt lại về mặc định tổ chức
    // -------------------------------------------------------------------------
    // Thử tạo một override tạm 'print_format' rồi xóa
    await query(`
      INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
      VALUES ($1, 'print_format', '"A4"'::jsonb, 'Test')
      ON CONFLICT (branch_id, feature_key) DO UPDATE SET value = '"A4"'::jsonb;
    `, [q12.id]);

    const res5 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: q12.id,
        feature_key: 'print_format'
      })
    });
    const data5 = await res5.json();
    const t5Ok = (res5.status === 200 && data5.success === true);
    record(
      'Xóa Override và hoàn nguyên về mặc định tổ chức qua DELETE API',
      t5Ok,
      `Thông điệp: "${data5.message}"`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.2.3: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.2.3:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_2_3();
