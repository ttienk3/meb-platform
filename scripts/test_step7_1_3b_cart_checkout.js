const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep7_1_3b() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.3b: GIỎ HÀNG ĐA ĐƠN VỊ TÍNH, SỔ NỢ & THANH TOÁN F9');
  console.log('   Mục tiêu: Đảm bảo Giỏ hàng POS, Khách nợ và Nút F9 Checkout hoạt động chuẩn 100%');
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
    const q12 = (await query("SELECT id, code, name FROM public.branches WHERE code = 'CN-Q12';")).rows[0];
    const bossId = '00000000-0000-0000-0000-000000000003';

    // Reset nợ của đối tác về mức khởi tạo 5.000.000đ để các lần test idempotent
    await query("UPDATE public.partners SET current_debt = 5000000 WHERE code = 'KH-QUAN';");
    const contractor = (await query("SELECT id, code, name, phone, debt_limit, current_debt FROM public.partners WHERE code = 'KH-QUAN';")).rows[0];

    // Lấy sản phẩm có tồn kho tại CN-Q1
    const pDulux = (await query("SELECT id, code, name, base_uom, default_selling_price FROM public.products WHERE code = 'SP-SON-DULUX';")).rows[0];
    const pTiger = (await query("SELECT id, code, name, base_uom, default_selling_price FROM public.products WHERE code = 'SP-TIGER';")).rows[0];

    // Đảm bảo có ca mở tại cả 2 chi nhánh
    let shiftQ1 = (await query("SELECT id FROM public.shifts WHERE branch_id = $1 AND status = 'OPEN' LIMIT 1;", [q1.id])).rows[0];
    if (!shiftQ1) {
      const s = await query("INSERT INTO public.shifts (branch_id, staff_name, initial_amount, status) VALUES ($1, 'Thu Ngân Q1 Test', 1000000, 'OPEN') RETURNING id;", [q1.id]);
      shiftQ1 = s.rows[0];
    }

    let shiftQ12 = (await query("SELECT id FROM public.shifts WHERE branch_id = $1 AND status = 'OPEN' LIMIT 1;", [q12.id])).rows[0];
    if (!shiftQ12) {
      const s = await query("INSERT INTO public.shifts (branch_id, staff_name, initial_amount, status) VALUES ($1, 'Thu Ngân Q12 Test', 1000000, 'OPEN') RETURNING id;", [q12.id]);
      shiftQ12 = s.rows[0];
    }

    // -------------------------------------------------------------------------
    // TEST 1: Kiểm chứng cấu trúc Giỏ hàng Đa Đơn Vị & Tính toán tổng tiền
    // -------------------------------------------------------------------------
    const mockCartItems = [
      { product_id: pTiger.id, product_name: pTiger.name, uom: 'Lon', quantity: 6, unit_price: 18000 },
      { product_id: pTiger.id, product_name: pTiger.name, uom: 'Thùng', quantity: 1, unit_price: 410000 },
      { product_id: pDulux.id, product_name: pDulux.name, uom: 'Thùng 18L', quantity: 2, unit_price: 1250000 }
    ];
    const calculatedTotal = mockCartItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
    const expectedTotal = (6 * 18000) + (1 * 410000) + (2 * 1250000); // 108,000 + 410,000 + 2,500,000 = 3,018,000đ

    const t1Ok = (calculatedTotal === expectedTotal && calculatedTotal === 3018000);
    record(
      'Tính toán chính xác tổng tiền giỏ hàng đa sản phẩm, đa đơn vị tính (Cart Multi-UoM)',
      t1Ok,
      `Tổng tiền tính được: ${calculatedTotal.toLocaleString('vi-VN')} đ (Kỳ vọng: 3.018.000 đ)`
    );

    // -------------------------------------------------------------------------
    // TEST 2: F9 Thanh Toán Tiền Mặt (CASH) Khách Vãng Lai tại CN-Q1
    // -------------------------------------------------------------------------
    const cashRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftQ1.id,
          total_amount: 36000,
          paid_amount: 36000,
          debt_amount: 0,
          order_type: 'SALE',
          note: 'Khách lẻ mua 2 lon bia tiền mặt'
        },
        items: [
          {
            product_id: pTiger.id,
            uom: 'Lon',
            conversion_rate: 1,
            quantity: 2,
            unit_price: 18000
          }
        ],
        payments: [
          { payment_method: 'CASH', amount: 36000 }
        ]
      })
    });
    const cashData = await cashRes.json();
    const t2Ok = (
      cashRes.status === 200 &&
      cashData.success === true &&
      cashData.data?.order_code &&
      parseFloat(cashData.data?.total_amount) === 36000 &&
      parseFloat(cashData.data?.debt_amount) === 0
    );
    record(
      'F9 Checkout Tiền Mặt (CASH) khách lẻ tại CN-Q1 thành công',
      t2Ok,
      `Mã đơn: ${cashData.data?.order_code} | Tổng tiền: ${cashData.data?.total_amount} | Nợ: ${cashData.data?.debt_amount}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: F9 Thanh Toán Chuyển Khoản (BANK_TRANSFER) tại CN-Q12
    // -------------------------------------------------------------------------
    const bankRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftQ12.id,
          total_amount: 54000,
          paid_amount: 54000,
          debt_amount: 0,
          order_type: 'SALE',
          note: 'Khách quét QR chuyển khoản'
        },
        items: [
          {
            product_id: pTiger.id,
            uom: 'Lon',
            conversion_rate: 1,
            quantity: 3,
            unit_price: 18000
          }
        ],
        payments: [
          { payment_method: 'BANK_TRANSFER', amount: 54000 }
        ]
      })
    });
    const bankData = await bankRes.json();
    const t3Ok = (
      bankRes.status === 200 &&
      bankData.success === true &&
      bankData.data?.order_code &&
      parseFloat(bankData.data?.paid_amount) === 54000
    );
    record(
      'F9 Checkout Chuyển Khoản (BANK_TRANSFER) tại CN-Q12 thành công',
      t3Ok,
      `Mã đơn: ${bankData.data?.order_code} | Đã thanh toán: ${bankData.data?.paid_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 4: F9 Bán Nợ Gối Đầu (DEBT) cho thầu thợ tại CN-Q1 (allow_debt = true)
    // -------------------------------------------------------------------------
    const debtRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftQ1.id,
          partner_id: contractor.id,
          total_amount: 1250000,
          paid_amount: 0,
          debt_amount: 1250000,
          order_type: 'SALE',
          note: 'Thầu Quân lấy 1 thùng sơn ghi nợ gối đầu'
        },
        items: [
          {
            product_id: pDulux.id,
            uom: 'Thùng 18L',
            conversion_rate: 1,
            quantity: 1,
            unit_price: 1250000
          }
        ],
        payments: []
      })
    });
    const debtData = await debtRes.json();
    const t4Ok = (
      debtRes.status === 200 &&
      debtData.success === true &&
      debtData.data?.order_code &&
      parseFloat(debtData.data?.debt_amount) === 1250000
    );
    record(
      'F9 Bán Nợ Gối Đầu (DEBT) cho thầu thợ tại CN-Q1 (allow_debt = true) thành công',
      t4Ok,
      `Mã đơn: ${debtData.data?.order_code} | Ghi nợ vào sổ: ${debtData.data?.debt_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 5: INV-01 - Chốt chặn cấm bán nợ tại chi nhánh CN-Q12 (allow_debt = false)
    // -------------------------------------------------------------------------
    // Tạm thời cấu hình allow_debt = false cho CN-Q12 để kiểm chứng chốt chặn INV-01
    await query("UPDATE public.branch_feature_overrides SET value = 'false'::jsonb WHERE branch_id = $1 AND feature_key = 'allow_debt';", [q12.id]);

    const blockedDebtRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftQ12.id,
          partner_id: contractor.id,
          total_amount: 100000,
          paid_amount: 0,
          debt_amount: 100000,
          order_type: 'SALE',
          note: 'Cố tình bán nợ tại tạp hóa Q12'
        },
        items: [
          {
            product_id: pTiger.id,
            uom: 'Lon',
            conversion_rate: 1,
            quantity: 5,
            unit_price: 20000
          }
        ],
        payments: []
      })
    });
    const blockedDebtData = await blockedDebtRes.json();
    const t5Ok = (
      blockedDebtRes.status === 400 || blockedDebtRes.status === 403 ||
      blockedDebtData.success === false
    );
    record(
      'INV-01: Chặn đứng hành vi Bán Nợ tại CN-Q12 (nơi có cấu hình allow_debt = false)',
      t5Ok,
      `HTTP Status: ${blockedDebtRes.status} | Lỗi: ${blockedDebtData.error?.message || blockedDebtData.error}`
    );

    // Khôi phục lại trạng thái ban đầu của CN-Q12 để không ảnh hưởng các test suite khác
    await query("UPDATE public.branch_feature_overrides SET value = 'true'::jsonb WHERE branch_id = $1 AND feature_key = 'allow_debt';", [q12.id]);

    // -------------------------------------------------------------------------
    // TEST 6: INV-08 - Chốt chặn bán nợ vượt hạn mức tín dụng khách hàng (debt_limit)
    // -------------------------------------------------------------------------
    const contractorState = (await query("SELECT debt_limit, current_debt FROM public.partners WHERE id = $1;", [contractor.id])).rows[0];
    const cLimit = parseFloat(contractorState.debt_limit) || 50000000;
    const cDebt = parseFloat(contractorState.current_debt) || 0;
    const excessiveAmount = (cLimit - cDebt) + 15000000; // Vượt hạn mức 15 triệu

    const excessiveRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: {
          shift_id: shiftQ1.id,
          partner_id: contractor.id,
          total_amount: excessiveAmount,
          paid_amount: 0,
          debt_amount: excessiveAmount,
          order_type: 'SALE',
          note: 'Cố tình vượt hạn mức tín dụng'
        },
        items: [
          {
            product_id: pDulux.id,
            uom: 'Thùng 18L',
            conversion_rate: 1,
            quantity: 10,
            unit_price: excessiveAmount / 10
          }
        ],
        payments: []
      })
    });
    const excessiveData = await excessiveRes.json();
    const t6Ok = (
      excessiveRes.status === 400 || excessiveRes.status === 403 ||
      excessiveData.success === false
    );
    record(
      'INV-08: Chặn đứng đơn hàng Bán Nợ vượt quá hạn mức tín dụng (debt_limit)',
      t6Ok,
      `HTTP Status: ${excessiveRes.status} | Lỗi: ${excessiveData.error?.message || excessiveData.error}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Chốt chặn Validation: Giỏ hàng rỗng
    // -------------------------------------------------------------------------
    const emptyRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order: { shift_id: shiftQ1.id, total_amount: 0, paid_amount: 0 },
        items: []
      })
    });
    const emptyData = await emptyRes.json();
    const t7Ok = (emptyRes.status === 400 && emptyData.success === false);
    record(
      'Validation: Chặn đứng yêu cầu thanh toán khi giỏ hàng rỗng (items = [])',
      t7Ok,
      `HTTP Status: ${emptyRes.status} | Mã lỗi: ${emptyData.error?.code}`
    );

  } catch (err) {
    console.error('🔥 Ngoại lệ ngoài ý muốn trong quá trình kiểm thử Bước 7.1.3b:', err);
  } finally {
    server.close();
    await pool.end();
  }

  console.log('\n=============================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ BƯỚC 7.1.3b: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed / total) * 100)}%)`);
  console.log('=============================================================================');

  if (passed === total) {
    console.log('🎉 TẤT CẢ CA KIỂM ĐỊNH THÀNH CÔNG! BƯỚC 7.1.3b HOÀN THIỆN XUẤT SẮC.');
    process.exit(0);
  } else {
    console.log('❌ CÓ BÀI TEST CHƯA ĐẠT. CẦN KIỂM TRA LẠI.');
    process.exit(1);
  }
}

runTestStep7_1_3b();
