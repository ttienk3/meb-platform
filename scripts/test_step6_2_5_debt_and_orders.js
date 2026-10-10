const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_2_5() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.2.5: THU NỢ KHÁCH HÀNG & LỊCH SỬ ĐƠN HÀNG (POS API)');
  console.log('   Mục tiêu: Đảm bảo thu nợ F3 tự động cấn trừ sổ nợ và tra cứu đơn gần đây');
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
    const pQuan = (await query("SELECT id FROM public.partners WHERE code = 'KH-QUAN';")).rows[0].id;

    // -------------------------------------------------------------------------
    // TEST 1: Thu nợ 200.000đ từ khách Anh Quân -> Nợ giảm chính xác 200.000đ
    // -------------------------------------------------------------------------
    const debtPre = parseFloat((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [pQuan])).rows[0].current_debt);
    const collectAmount = 200000;

    const res1 = await fetch(`${baseUrl}/api/pos/debt-collection`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partner_id: pQuan,
        amount: collectAmount,
        payment_method: 'CASH',
        note: 'Anh Quân thanh toán nợ đợt 1',
        created_by: 'Thu Ngân Alice'
      })
    });
    const data1 = await res1.json();
    const debtPost = parseFloat((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [pQuan])).rows[0].current_debt);

    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      data1.data?.amount_collected === collectAmount &&
      debtPost === (debtPre - collectAmount)
    );
    record(
      'Thu nợ khách hàng thành công (Sổ nợ đối tác tự động cấn trừ 200.000đ)',
      t1Ok,
      `HTTP Status: ${res1.status} | Nợ trước: ${debtPre}đ | Nợ sau: ${debtPost}đ | Mã phiếu thu: ${data1.data?.flow_code}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Chặn đứng thu nợ số tiền <= 0 (Invalid Amount)
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/pos/debt-collection`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partner_id: pQuan,
        amount: -50000
      })
    });
    const data2 = await res2.json();
    const t2Ok = (res2.status === 400 && data2.error?.code === 'INVALID_PAYLOAD');
    record(
      'Chặn đứng thu nợ số tiền không hợp lệ <= 0 (Input Validation)',
      t2Ok,
      `HTTP Status: ${res2.status} | Mã lỗi: ${data2.error?.code} | Thông điệp: "${data2.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Chặn đứng thu nợ thiếu partner_id
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/pos/debt-collection`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 100000
      })
    });
    const data3 = await res3.json();
    const t3Ok = (res3.status === 400 && data3.error?.code === 'INVALID_PAYLOAD');
    record(
      'Chặn đứng thu nợ khi không chọn đối tác (Missing partner_id)',
      t3Ok,
      `HTTP Status: ${res3.status} | Mã lỗi: ${data3.error?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Tra cứu danh sách hóa đơn gần đây của chi nhánh
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/pos/orders/recent`, {
      method: 'GET',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId
      }
    });
    const data4 = await res4.json();
    const t4Ok = (
      res4.status === 200 &&
      data4.success === true &&
      Array.isArray(data4.data) &&
      data4.data.length > 0 &&
      data4.data[0].order_code !== undefined
    );
    record(
      'Tra cứu danh sách hóa đơn gần nhất của chi nhánh thành công',
      t4Ok,
      `HTTP Status: ${res4.status} | Tổng số hóa đơn: ${data4.count} | Mã đơn mới nhất: ${data4.data?.[0]?.order_code}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Phân trang / Giới hạn số lượng hóa đơn (?limit=2)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/pos/orders/recent?limit=2`, {
      method: 'GET',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId
      }
    });
    const data5 = await res5.json();
    const t5Ok = (
      res5.status === 200 &&
      data5.success === true &&
      data5.data.length <= 2
    );
    record(
      'Bộ lọc giới hạn hóa đơn (?limit=2) hoạt động chính xác',
      t5Ok,
      `HTTP Status: ${res5.status} | Số lượng trả về: ${data5.data?.length}`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.2.5: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.2.5:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_2_5();
