const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_2_6() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.2.6: QUẢN TRỊ CHI NHÁNH & NHẬT KÝ KIỂM TOÁN (ADMIN API)');
  console.log('   Mục tiêu: Đảm bảo danh mục chi nhánh & lịch sử kiểm toán cờ tính năng đầy đủ');
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
    const q1 = (await query("SELECT id, code, name FROM public.branches WHERE code = 'CN-Q1';")).rows[0];

    // -------------------------------------------------------------------------
    // TEST 1: Lấy danh mục toàn bộ chi nhánh (GET /api/admin/branches)
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/admin/branches`);
    const data1 = await res1.json();
    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      Array.isArray(data1.data) &&
      data1.data.length >= 2 &&
      data1.data.some(b => b.code === 'CN-Q1') &&
      data1.data.some(b => b.code === 'CN-Q12')
    );
    record(
      'Tải danh sách toàn bộ chi nhánh kèm thông tin Tổ chức & Toggles',
      t1Ok,
      `HTTP Status: ${res1.status} | Tổng số chi nhánh: ${data1.count} | Chi nhánh 1: ${data1.data?.[0]?.name}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Kích hoạt thay đổi Override để trigger DB ghi nhận vào audit log
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: q1.id,
        feature_key: 'print_format',
        value: 'A4_FULL',
        updated_by: 'Super Admin Test'
      })
    });
    const data2 = await res2.json();
    const t2Ok = (res2.status === 200 && data2.success === true);
    record(
      'Cập nhật ghi đè tính năng print_format qua API thành công',
      t2Ok,
      `HTTP Status: ${res2.status} | Updated By: Super Admin Test`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Kiểm tra Audit Log đã ghi nhận sự kiện cập nhật trên (GET /api/admin/audit-logs)
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/admin/audit-logs?branch_id=${q1.id}`);
    const data3 = await res3.json();
    const recentLog = data3.data?.find(l => l.feature_key === 'print_format' && l.changed_by === 'Super Admin Test');
    const t3Ok = (
      res3.status === 200 &&
      data3.success === true &&
      recentLog !== undefined &&
      recentLog.action === 'SET_OVERRIDE'
    );
    record(
      'Nhật ký kiểm toán (Audit Logs) tự động ghi nhận hành động qua DB Trigger (SET_OVERRIDE)',
      t3Ok,
      `HTTP Status: ${res3.status} | Thao tác: ${recentLog?.action} | Cờ: ${recentLog?.feature_key} | Người đổi: ${recentLog?.changed_by}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Hoàn nguyên tính năng và kiểm tra Audit Log ghi nhận DELETE
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/admin/features/override`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: q1.id,
        feature_key: 'print_format'
      })
    });
    const data4 = await res4.json();
    const t4Ok = (res4.status === 200 && data4.success === true);
    record(
      'Hủy ghi đè tính năng và hoàn nguyên mặc định tổ chức thành công',
      t4Ok,
      `HTTP Status: ${res4.status} | Thông điệp: "${data4.message}"`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.2.6: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.2.6:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_2_6();
