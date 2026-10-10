const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_2_4() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.2.4: END-TO-END POS CHECKOUT QUA HTTP GATEWAY');
  console.log('   Mục tiêu: Đảm bảo giao thức HTTP chuyển tiếp hoàn hảo đơn hàng vào Động cơ CSDL');
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

    const pTiger = (await query("SELECT id FROM public.products WHERE code = 'SP-TIGER';")).rows[0].id;
    const pDulux = (await query("SELECT id FROM public.products WHERE code = 'SP-SON-DULUX';")).rows[0].id;
    const pQuan = (await query("SELECT id FROM public.partners WHERE code = 'KH-QUAN';")).rows[0].id;

    // Đảm bảo có ca mở để hạch toán
    let shift = (await query("SELECT id FROM public.shifts WHERE branch_id = $1 AND status = 'OPEN' LIMIT 1;", [q1.id])).rows[0];
    if (!shift) {
      const newShift = await query(`
        INSERT INTO public.shifts (branch_id, staff_name, initial_amount, status)
        VALUES ($1, 'Thu Ngân Alice (E2E Test)', 1000000, 'OPEN')
        RETURNING id;
      `, [q1.id]);
      shift = newShift.rows[0];
    }
    const shiftId = shift.id;

    // Reset tồn kho Tiger tại Q1 để kiểm tra chuẩn xác
    await query(`
      INSERT INTO public.inventory (branch_id, product_id, on_hand, reserved, cost_price)
      VALUES ($1, $2, 500, 0, 13000)
      ON CONFLICT (branch_id, product_id) DO UPDATE SET on_hand = 500, reserved = 0;
    `, [q1.id, pTiger]);

    const testTs = Date.now();
    const codeOrder1 = `HTTP-E2E-${testTs}-01`;
    const codeOrder2 = `HTTP-E2E-${testTs}-02`;

    // -------------------------------------------------------------------------
    // TEST 1: Bán lẻ tiền mặt 5 lon Tiger qua HTTP POST /api/pos/checkout
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftId,
          order_code: codeOrder1,
          total_amount: 85000,
          paid_amount: 85000
        },
        items: [
          { product_id: pTiger, uom: 'Lon', conversion_rate: 1, quantity: 5, unit_price: 17000 }
        ],
        payments: [
          { payment_method: 'CASH', amount: 85000 }
        ]
      })
    });
    const data1 = await res1.json();
    const invTigerPost = (await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, pTiger])).rows[0].on_hand;
    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      data1.data?.order_code === codeOrder1 &&
      parseFloat(invTigerPost) === 495
    );
    record(
      'Bán lẻ tiền mặt qua HTTP Gateway thành công (Tồn kho tự động trừ 5 lon)',
      t1Ok,
      `HTTP Status: ${res1.status} | Mã đơn: ${data1.data?.order_code} | Tồn kho sau xuất: ${invTigerPost} lon`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Bán cho thợ Anh Quân (Split Payment: Tiền mặt + Ngân hàng + Ghi nợ)
    // -------------------------------------------------------------------------
    const debtPre = parseFloat((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [pQuan])).rows[0].current_debt);
    const res2 = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftId,
          partner_id: pQuan,
          order_code: codeOrder2,
          total_amount: 1000000,
          paid_amount: 700000,
          debt_amount: 300000
        },
        items: [
          { product_id: pTiger, uom: 'Lon', conversion_rate: 1, quantity: 10, unit_price: 100000 }
        ],
        payments: [
          { payment_method: 'CASH', amount: 400000 },
          { payment_method: 'BANK_TRANSFER', amount: 300000 }
        ]
      })
    });
    const data2 = await res2.json();
    const debtPost = parseFloat((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [pQuan])).rows[0].current_debt);
    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      debtPost === (debtPre + 300000)
    );
    record(
      'Bán đơn gối đầu ghi nợ cho thợ qua HTTP (Sổ nợ đối tác tự động tăng 300k)',
      t2Ok,
      `Nợ trước: ${debtPre}đ | Nợ sau: ${debtPost}đ (Tăng: +${debtPost - debtPre}đ)`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Chặn đứng bẫy bán nợ cho khách vô danh qua HTTP
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftId,
          order_code: 'HTTP-E2E-FAIL-DEBT',
          total_amount: 500000,
          paid_amount: 200000 // Thiếu partner_id
        },
        items: [
          { product_id: pTiger, uom: 'Lon', conversion_rate: 1, quantity: 5, unit_price: 100000 }
        ],
        payments: [
          { payment_method: 'CASH', amount: 200000 }
        ]
      })
    });
    const data3 = await res3.json();
    const t3Ok = (
      res3.status === 400 &&
      data3.error?.code === 'CHECKOUT_FAILED' &&
      data3.error?.message.includes('BÁN NỢ BẤT KHẢ THI')
    );
    record(
      'Chặn đứng đơn hàng bán nợ không chọn khách (HTTP 400 Bad Request)',
      t3Ok,
      `HTTP Status: ${res3.status} | Mã lỗi: ${data3.error?.code} | Thông điệp: "${data3.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Chặn đứng đơn hàng xuất bán quá tồn kho khả dụng
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftId,
          order_code: 'HTTP-E2E-FAIL-STOCK',
          total_amount: 51000000,
          paid_amount: 51000000
        },
        items: [
          { product_id: pDulux, uom: 'Thùng', conversion_rate: 1, quantity: 9999, unit_price: 510000 }
        ],
        payments: [
          { payment_method: 'CASH', amount: 51000000 }
        ]
      })
    });
    const data4 = await res4.json();
    const t4Ok = (
      res4.status === 400 &&
      data4.error?.code === 'CHECKOUT_FAILED' &&
      data4.error?.message.includes('HẾT HÀNG TRONG KHO')
    );
    record(
      'Chặn đứng xuất bán quá tồn kho khả dụng (Available Guard over HTTP)',
      t4Ok,
      `HTTP Status: ${res4.status} | Thông điệp CSDL: "${data4.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Chặn đứng request có payload không hợp lệ (Missing items)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: { order_code: 'INVALID' }
      })
    });
    const data5 = await res5.json();
    const t5Ok = (res5.status === 400 && data5.error?.code === 'INVALID_PAYLOAD');
    record(
      'Bắt lỗi xác thực payload rỗng / thiếu danh sách items (Input Validation)',
      t5Ok,
      `HTTP Status: ${res5.status} | Mã lỗi: ${data5.error?.code}`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.2.4: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.2.4:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_2_4();
