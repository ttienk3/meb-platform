const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep7_1_4() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.4: MODAL QUẢN LÝ CA BÁN HÀNG & CHỐT KÉT F8');
  console.log('   Mục tiêu: Đảm bảo vòng đời ca thu ngân, tóm tắt dòng tiền & đối soát két F8');
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

    // 0. Dọn dẹp ca đang mở của CN-Q1 để bắt đầu baseline sạch
    await query("UPDATE public.shifts SET status = 'CLOSED' WHERE branch_id = $1 AND status = 'OPEN';", [q1.id]);

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/pos/shifts/current khi chưa có ca mở -> Trả về null
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/pos/shifts/current`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data1 = await res1.json();
    const t1Ok = (res1.status === 200 && data1.success === true && data1.data === null);
    record(
      'Kiểm tra ca hiện tại khi chi nhánh chưa mở ca -> Trả về null',
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
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staff_name: 'Nguyễn Thị Lan (Ca Sáng)',
        initial_amount: 1000000
      })
    });
    const data2 = await res2.json();
    const shift = data2.data;
    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      shift?.status === 'OPEN' &&
      shift?.staff_name === 'Nguyễn Thị Lan (Ca Sáng)' &&
      parseFloat(shift?.initial_amount) === 1000000
    );
    record(
      'Mở ca bán hàng mới thành công với số dư tiền đầu ca 1.000.000đ',
      t2Ok,
      `Mã ca: ${shift?.id} | Nhân viên: ${shift?.staff_name} | Tiền két: ${shift?.initial_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Chặn đứng hành vi mở ca trùng lặp khi đang có ca mở
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/pos/shifts/open`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staff_name: 'Trần Văn C (Mở đè)',
        initial_amount: 500000
      })
    });
    const data3 = await res3.json();
    const t3Ok = (
      res3.status === 400 &&
      data3.success === false &&
      data3.error?.code === 'SHIFT_ALREADY_OPEN'
    );
    record(
      'Chặn đứng hành vi mở ca trùng lặp (Anti-Double-Open Guard)',
      t3Ok,
      `HTTP Status: ${res3.status} | Mã lỗi: ${data3.error?.code} | Thông điệp: "${data3.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Tải tóm tắt dòng tiền ca trực (Summary API)
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/pos/shifts/${shift.id}/summary`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data4 = await res4.json();
    const summary = data4.data;
    const t4Ok = (
      res4.status === 200 &&
      data4.success === true &&
      summary?.shift_id === shift.id &&
      parseFloat(summary?.initial_amount) === 1000000 &&
      parseFloat(summary?.system_cash_amount) >= 1000000
    );
    record(
      'Tải tóm tắt dòng tiền mặt ca trực (Shift Cash Summary)',
      t4Ok,
      `Tiền đầu ca: ${summary?.initial_amount}đ | Tiền két hệ thống: ${summary?.system_cash_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Chốt ca bán hàng & Bàn giao đối soát két tiền F8
    // -------------------------------------------------------------------------
    const actualCash = parseFloat(summary?.system_cash_amount);
    const res5 = await fetch(`${baseUrl}/api/pos/shifts/${shift.id}/close`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        actual_amount: actualCash,
        note: 'Bàn giao ca sáng khớp 100% tiền két'
      })
    });
    const data5 = await res5.json();
    const closeRes = data5.data;
    const shiftClosedDb = (await query("SELECT status FROM public.shifts WHERE id = $1::uuid;", [shift.id])).rows[0];
    const t5Ok = (
      res5.status === 200 &&
      data5.success === true &&
      closeRes?.success === true &&
      shiftClosedDb?.status === 'CLOSED' &&
      parseFloat(closeRes?.discrepancy) === 0
    );
    record(
      'Chốt ca bán hàng & Bàn giao đối soát két tiền F8 (Khớp 100% tiền)',
      t5Ok,
      `Thực tế: ${closeRes?.actual_amount}đ | Lý thuyết: ${closeRes?.system_amount}đ | Lệch (discrepancy): ${closeRes?.discrepancy}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Kiểm tra ca hiện tại sau khi chốt -> Trả về null
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/pos/shifts/current`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data6 = await res6.json();
    const t6Ok = (res6.status === 200 && data6.data === null);
    record(
      'Xác nhận ca đã chuyển sang trạng thái CLOSED (getCurrentShift trả về null)',
      t6Ok,
      `Current Shift: ${JSON.stringify(data6.data)}`
    );

  } catch (err) {
    console.error('🔥 Ngoại lệ ngoài ý muốn trong quá trình kiểm thử Bước 7.1.4:', err);
  } finally {
    server.close();
    await pool.end();
  }

  console.log('\n=============================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ BƯỚC 7.1.4: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed / total) * 100)}%)`);
  console.log('=============================================================================');

  if (passed === total) {
    console.log('🎉 TẤT CẢ CA KIỂM ĐỊNH THÀNH CÔNG! BƯỚC 7.1.4 HOÀN THIỆN XUẤT SẮC.');
    process.exit(0);
  } else {
    console.log('❌ CÓ BÀI TEST CHƯA ĐẠT. CẦN KIỂM TRA LẠI.');
    process.exit(1);
  }
}

runTestStep7_1_4();
