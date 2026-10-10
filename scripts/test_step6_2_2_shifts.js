const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_2_2() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.2.2: QUẢN LÝ CA BÁN HÀNG & KÉT TIỀN (SHIFTS API)');
  console.log('   Mục tiêu: Đảm bảo kiểm soát ca trực, mở ca, xem tóm tắt và chốt két F8');
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
    const q1 = (await query("SELECT id, code FROM public.branches WHERE code = 'CN-Q1';")).rows[0];
    const aliceId = '00000000-0000-0000-0000-000000000001'; // Thu ngân Q1

    // Dọn dẹp ca mở cũ của Q1 nếu có để khởi đầu baseline sạch
    await query("UPDATE public.shifts SET status = 'CLOSED' WHERE branch_id = $1 AND status = 'OPEN';", [q1.id]);

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/pos/shifts/current khi chưa có ca mở
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/pos/shifts/current`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': aliceId }
    });
    const data1 = await res1.json();
    const t1Ok = (res1.status === 200 && data1.data === null);
    record(
      'Kiểm tra ca hiện tại khi chưa mở ca -> Trả về null',
      t1Ok,
      `HTTP Status: ${res1.status} | Data: ${JSON.stringify(data1.data)}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: POST /api/pos/shifts/open mở ca mới thành công
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/pos/shifts/open`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staff_name: 'Thu Ngân Alice Test',
        initial_amount: 500000
      })
    });
    const data2 = await res2.json();
    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      data2.data?.status === 'OPEN' &&
      parseFloat(data2.data?.initial_amount) === 500000
    );
    const newShiftId = data2.data?.id;
    record(
      'Mở ca bán hàng mới với số dư đầu ca 500.000đ',
      t2Ok,
      `Shift ID: ${newShiftId} | Trạng thái: ${data2.data?.status} | Tiền đầu ca: ${data2.data?.initial_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Chặn đứng bẫy mở trùng 2 ca cùng lúc (Duplicate Shift Guard)
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/pos/shifts/open`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staff_name: 'Thu Ngân Khác',
        initial_amount: 1000000
      })
    });
    const data3 = await res3.json();
    const t3Ok = (res3.status === 400 && data3.error?.code === 'SHIFT_ALREADY_OPEN');
    record(
      'Chặn đứng hành vi mở trùng ca khi ca cũ chưa đóng',
      t3Ok,
      `HTTP Status: ${res3.status} | Mã lỗi: ${data3.error?.code} | Thông điệp: "${data3.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 4: GET /api/pos/shifts/current trả về đúng ca vừa mở
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/pos/shifts/current`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': aliceId }
    });
    const data4 = await res4.json();
    const t4Ok = (res4.status === 200 && data4.data?.id === newShiftId && data4.data?.status === 'OPEN');
    record(
      'GET /api/pos/shifts/current trả về đúng thông tin ca đang hoạt động',
      t4Ok,
      `Shift ID: ${data4.data?.id} | Nhân viên: ${data4.data?.staff_name}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: GET /api/pos/shifts/:id/summary xem báo cáo két tiền F8
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/pos/shifts/${newShiftId}/summary`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': aliceId }
    });
    const data5 = await res5.json();
    const t5Ok = (
      res5.status === 200 &&
      data5.success === true &&
      parseFloat(data5.data?.initial_amount) === 500000 &&
      parseFloat(data5.data?.system_cash_amount) === 500000
    );
    record(
      'Xem đối soát tóm tắt ca (F8 Cash Summary) chính xác',
      t5Ok,
      `Tiền đầu ca: ${data5.data?.initial_amount}đ | Tiền hệ thống tính: ${data5.data?.system_cash_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 6: POST /api/pos/shifts/:id/close chốt ca thành công
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/pos/shifts/${newShiftId}/close`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        actual_amount: 500000,
        note: 'Kiểm đếm ca thử nghiệm khớp 100%'
      })
    });
    const data6 = await res6.json();
    const shiftClosedDb = (await query("SELECT status FROM public.shifts WHERE id = $1::uuid;", [newShiftId])).rows[0];
    const t6Ok = (
      res6.status === 200 &&
      data6.success === true &&
      data6.data?.success === true &&
      shiftClosedDb?.status === 'CLOSED' &&
      parseFloat(data6.data?.discrepancy) === 0
    );
    record(
      'Chốt ca két tiền thành công & ghi nhận độ lệch 0đ',
      t6Ok,
      `Thành công: ${data6.data?.success} | DB Status: ${shiftClosedDb?.status} | Lệch (discrepancy): ${data6.data?.discrepancy}đ | Tiền đếm: ${data6.data?.actual_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 7: GET /api/pos/shifts/current sau khi chốt ca -> Trả về null
    // -------------------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/api/pos/shifts/current`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': aliceId }
    });
    const data7 = await res7.json();
    const t7Ok = (res7.status === 200 && data7.data === null);
    record(
      'Ca hiện tại tự động chuyển về null sau khi đã chốt ca',
      t7Ok,
      `Data: ${JSON.stringify(data7.data)}`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.2.2: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.2.2:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_2_2();
