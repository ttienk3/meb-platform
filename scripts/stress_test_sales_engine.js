const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMasterAudit() {
  await client.connect();
  console.log('=============================================================================');
  console.log('🏛️  HỘI ĐỒNG KIỂM TOÁN HỆ THỐNG MEB: BÁO CÁO STRESS-TEST THƯƠNG MẠI');
  console.log('   Tiêu chuẩn kiểm định: ISO/IEC 25010 & Chế độ Chấm Điểm Gắt Gao (Zero-Tolerance)');
  console.log('=============================================================================\n');

  let passedTests = 0;
  const totalTests = 12;
  const auditLogs = [];

  const recordResult = (stepNum, title, passed, detail) => {
    if (passed) passedTests++;
    auditLogs.push({ stepNum, title, passed, detail });
    const icon = passed ? '✅ [ĐẠT 100%]' : '❌ [THẤT BẠI]';
    console.log(`${icon} BƯỚC ${stepNum}: ${title}`);
    console.log(`   Chi tiết: ${detail}\n`);
  };

  try {
    // =========================================================================
    // 0. THIẾT LẬP DỮ LIỆU ĐẦU KỲ (BASELINE SETUP)
    // =========================================================================
    console.log('⚙️  Đang khởi tạo baseline dữ liệu sạch theo đúng kịch bản...');
    
    // 0.1 Chi nhánh CN-Q1
    const bRes = await client.query("SELECT id FROM public.branches WHERE code = 'CN-Q1'");
    const branchId = bRes.rows[0].id;
    await client.query("UPDATE public.branches SET locked_until_date = NULL WHERE id = $1", [branchId]);
    await client.query(`
      INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
      VALUES 
        ($1, 'customer_required', 'true'::jsonb, 'Stress Test Baseline'),
        ($1, 'allow_debt', 'true'::jsonb, 'Stress Test Baseline')
      ON CONFLICT (branch_id, feature_key) DO UPDATE SET value = EXCLUDED.value;
    `, [branchId]);

    // 0.2 Dọn dẹp dữ liệu stress test cũ
    await client.query("DELETE FROM public.cash_flows WHERE note LIKE '%STRESS-%' OR order_id IN (SELECT id FROM public.orders WHERE order_code LIKE 'STRESS-%');");
    await client.query("DELETE FROM public.inventory_logs WHERE note LIKE '%STRESS-%' OR reference_id IN (SELECT id FROM public.orders WHERE order_code LIKE 'STRESS-%');");
    await client.query("DELETE FROM public.orders WHERE order_code LIKE 'STRESS-%';");

    // 0.3 Đảm bảo các sản phẩm: Tiger, Dulux, Rượu Vang, Bánh Cosy, Giỏ Quà Tết
    await client.query(`
      INSERT INTO public.products (code, name, category, base_uom, default_cost_price, default_selling_price)
      VALUES 
      ('SP-RUOU', 'Rượu Vang Đà Lạt Classic', 'Đồ uống', 'Chai', 150000, 250000),
      ('SP-BANH', 'Bánh Quy Cosy Marie', 'Bánh kẹo', 'Hộp', 30000, 50000)
      ON CONFLICT (code) DO UPDATE SET default_cost_price = EXCLUDED.default_cost_price, default_selling_price = EXCLUDED.default_selling_price;
    `);
    
    const pTiger = (await client.query("SELECT id FROM public.products WHERE code = 'SP-TIGER'")).rows[0].id;
    const pDulux = (await client.query("SELECT id FROM public.products WHERE code = 'SP-SON-DULUX'")).rows[0].id;
    const pRuou = (await client.query("SELECT id FROM public.products WHERE code = 'SP-RUOU'")).rows[0].id;
    const pBanh = (await client.query("SELECT id FROM public.products WHERE code = 'SP-BANH'")).rows[0].id;

    // Chuẩn hóa Barcode cho Dulux & Tiger để có giá thợ
    await client.query(`
      UPDATE public.products 
      SET barcodes = '[
        {"barcode": "8934822101018", "uom": "Lon", "rate": 1, "price_retail": 17000, "price_contractor": 16500, "price_wholesale": 16000},
        {"barcode": "8934822101025", "uom": "Thùng", "rate": 24, "price_retail": 385000, "price_contractor": 375000, "price_wholesale": 375000}
      ]'::jsonb,
      default_cost_price = 13000
      WHERE id = $1;
    `, [pTiger]);

    await client.query(`
      UPDATE public.products 
      SET barcodes = '[
        {"barcode": "DULUX-5L", "uom": "Thùng", "rate": 1, "price_retail": 510000, "price_contractor": 480000, "price_wholesale": 480000}
      ]'::jsonb,
      default_cost_price = 400000
      WHERE id = $1;
    `, [pDulux]);

    // Insert Combo Giỏ quà Tết
    await client.query(`
      INSERT INTO public.products (code, name, category, base_uom, is_combo, combo_items, barcodes, default_cost_price, default_selling_price)
      VALUES (
        'SP-COMBO', 
        'Giỏ Quà Tết Sum Vầy (1 Rượu + 2 Bánh)', 
        'Quà tặng', 
        'Giỏ', 
        true, 
        jsonb_build_array(
          jsonb_build_object('product_id', $1::uuid, 'qty', 1),
          jsonb_build_object('product_id', $2::uuid, 'qty', 2)
        ),
        '[{"barcode": "GIO-TET-01", "uom": "Giỏ", "rate": 1, "price_retail": 340000, "price_contractor": 340000, "price_wholesale": 340000}]'::jsonb,
        210000, 
        340000
      )
      ON CONFLICT (code) DO UPDATE SET 
        combo_items = EXCLUDED.combo_items,
        is_combo = true,
        barcodes = EXCLUDED.barcodes;
    `, [pRuou, pBanh]);
    const pCombo = (await client.query("SELECT id FROM public.products WHERE code = 'SP-COMBO'")).rows[0].id;

    // Reset tồn kho
    const resetStock = async (prodId, onHand, cost) => {
      await client.query(`
        INSERT INTO public.inventory (branch_id, product_id, on_hand, reserved, cost_price)
        VALUES ($1, $2, $3, 0, $4)
        ON CONFLICT (branch_id, product_id) DO UPDATE SET on_hand = $3, reserved = 0, cost_price = $4;
      `, [branchId, prodId, onHand, cost]);
    };
    await resetStock(pTiger, 240, 13000); // 10 Thùng
    await resetStock(pDulux, 10, 400000);  // 10 Thùng
    await resetStock(pRuou, 10, 150000);   // 10 Chai
    await resetStock(pBanh, 20, 30000);    // 20 Hộp

    // Partner Anh Quân
    const pQuan = (await client.query("SELECT id FROM public.partners WHERE code = 'KH-QUAN'")).rows[0].id;
    await client.query(`
      UPDATE public.partners 
      SET price_group = 'CONTRACTOR', debt_limit = 10000000, current_debt = 3000000 
      WHERE id = $1;
    `, [pQuan]);

    // Mở ca mới cho Thu ngân Mai Anh
    const shiftRes = await client.query(`
      INSERT INTO public.shifts (branch_id, staff_name, initial_amount, status)
      VALUES ($1, 'Thu Ngân Mai Anh (Stress Test)', 1000000, 'OPEN')
      RETURNING id;
    `, [branchId]);
    const shiftId = shiftRes.rows[0].id;

    console.log('   Baseline sẵn sàng: CN-Q1 | Ca tiền đầu: 1.000.000đ | Nợ Anh Quân: 3.000.000đ\n');

    // =========================================================================
    // BƯỚC 1: KHÁCH VÃNG LAI MUA LẺ (Base Unit Deduction)
    // =========================================================================
    await client.query(
      "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb);",
      [
        JSON.stringify({ branch_id: branchId, shift_id: shiftId, order_code: 'STRESS-B1', total_amount: 85000, paid_amount: 85000 }),
        JSON.stringify([{ product_id: pTiger, uom: 'Lon', conversion_rate: 1, quantity: 5, unit_price: 17000 }]),
        JSON.stringify([{ payment_method: 'CASH', amount: 85000 }])
      ]
    );

    const inv1 = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pTiger])).rows[0].on_hand;
    const cash1 = (await client.query("SELECT amount FROM public.cash_flows WHERE order_id = (SELECT id FROM public.orders WHERE order_code = 'STRESS-B1')")).rows[0].amount;
    const b1Ok = (parseFloat(inv1) === 235 && parseFloat(cash1) === 85000);
    recordResult(1, 'Khách vãng lai mua lẻ 5 lon Bia Tiger', b1Ok, 
      `Tồn kho Tiger: ${inv1} lon (Kỳ vọng: 235) | Tiền mặt thu: ${cash1}đ (Kỳ vọng: 85.000đ)`);

    // =========================================================================
    // BƯỚC 2: BÁN CHO THỢ (Giá thợ + Split payment + Ghi nợ)
    // =========================================================================
    await client.query(
      "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb);",
      [
        JSON.stringify({
          branch_id: branchId, partner_id: pQuan, shift_id: shiftId, order_code: 'STRESS-B2',
          total_amount: 1335000, paid_amount: 835000, debt_amount: 500000
        }),
        JSON.stringify([
          { product_id: pTiger, uom: 'Thùng', conversion_rate: 24, quantity: 1, unit_price: 375000 },
          { product_id: pDulux, uom: 'Thùng', conversion_rate: 1, quantity: 2, unit_price: 480000 }
        ]),
        JSON.stringify([
          { payment_method: 'CASH', amount: 335000 },
          { payment_method: 'BANK_TRANSFER', payment_account: 'VIETCOMBANK_CN1', amount: 500000 }
        ])
      ]
    );

    const invTiger2 = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pTiger])).rows[0].on_hand;
    const invDulux2 = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pDulux])).rows[0].on_hand;
    const debt2 = (await client.query("SELECT current_debt FROM public.partners WHERE id = $1", [pQuan])).rows[0].current_debt;
    const splits = (await client.query("SELECT payment_method, amount FROM public.cash_flows WHERE order_id = (SELECT id FROM public.orders WHERE order_code = 'STRESS-B2') ORDER BY amount ASC")).rows;
    
    const b2Ok = (parseFloat(invTiger2) === 211 && parseFloat(invDulux2) === 8 && parseFloat(debt2) === 3500000 && splits.length === 2);
    recordResult(2, 'Bán cho thợ Anh Quân (Giá thợ, Split payment, Ghi nợ 500k)', b2Ok,
      `Tồn Tiger: ${invTiger2} lon (Kỳ vọng: 211) | Tồn Dulux: ${invDulux2} thùng (Kỳ vọng: 8) | Nợ Anh Quân: ${debt2}đ (Kỳ vọng: 3.500.000đ) | Dòng tiền: ${splits.map(s => `${s.payment_method}: ${s.amount}đ`).join(' + ')}`);

    // =========================================================================
    // BƯỚC 3: BẪY GIAN LẬN - THỬ BÁN NỢ ẨN DANH (Chặn nợ vô chủ)
    // =========================================================================
    let b3Blocked = false;
    let b3Error = '';
    try {
      await client.query(
        "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb);",
        [
          JSON.stringify({ branch_id: branchId, shift_id: shiftId, order_code: 'STRESS-B3', total_amount: 510000, paid_amount: 310000 }),
          JSON.stringify([{ product_id: pDulux, uom: 'Thùng', conversion_rate: 1, quantity: 1, unit_price: 510000 }]),
          JSON.stringify([])
        ]
      );
    } catch (e) {
      b3Blocked = e.message.includes('BÁN NỢ BẤT KHẢ THI');
      b3Error = e.message;
    }
    recordResult(3, 'Chặn đứng bẫy Bán Nợ Ẩn Danh (Orphan Debt Trap)', b3Blocked,
      `Kết quả chặn: ${b3Blocked ? `ĐÃ CHẶN CƯỠNG CHẾ THÀNH CÔNG: "${b3Error.split('\n')[0]}"` : 'NGUY HIỂM: Không chặn được nợ ẩn danh!'}`);

    // =========================================================================
    // BƯỚC 4: BẪY TÍN DỤNG - THỬ BÁN NỢ VƯỢT HẠN MỨC
    // =========================================================================
    let b4Blocked = false;
    let b4Error = '';
    try {
      await client.query(
        "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb);",
        [
          JSON.stringify({ branch_id: branchId, partner_id: pQuan, shift_id: shiftId, order_code: 'STRESS-B4', total_amount: 7200000, paid_amount: 0 }),
          JSON.stringify([{ product_id: pDulux, uom: 'Thùng', conversion_rate: 1, quantity: 15, unit_price: 480000 }]),
          JSON.stringify([])
        ]
      );
    } catch (e) {
      b4Blocked = e.message.includes('VƯỢT HẠN MỨC TÍN DỤNG');
      b4Error = e.message;
    }
    recordResult(4, 'Chặn đứng bẫy Vượt Hạn Mức Tín Dụng (Credit Limit Guard)', b4Blocked,
      `Kết quả chặn: ${b4Blocked ? `ĐÃ CHẶN CƯỠNG CHẾ THÀNH CÔNG: "${b4Error.split('\n')[0]}"` : 'NGUY HIỂM: Cho phép nợ vượt hạn mức!'}`);

    // =========================================================================
    // BƯỚC 5: BÁN HÀNG COMBO - GIẢI NÉN TRỪ KHO ĐA TẦNG
    // =========================================================================
    // Khách mua 3 Giỏ Quà Tết (Thanh toán VietQR 1.020.000đ)
    await client.query(
      "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb);",
      [
        JSON.stringify({ branch_id: branchId, shift_id: shiftId, order_code: 'STRESS-B5-COMBO', total_amount: 1020000, paid_amount: 1020000 }),
        JSON.stringify([{ product_id: pCombo, uom: 'Giỏ', conversion_rate: 1, quantity: 3, unit_price: 340000 }]),
        JSON.stringify([{ payment_method: 'BANK_TRANSFER', payment_account: 'VIETCOMBANK_CN1', amount: 1020000 }])
      ]
    );

    const invRuou = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pRuou])).rows[0].on_hand;
    const invBanh = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pBanh])).rows[0].on_hand;
    const comboLogs = (await client.query("SELECT COUNT(*) FROM public.inventory_logs WHERE reference_id = (SELECT id FROM public.orders WHERE order_code = 'STRESS-B5-COMBO')")).rows[0].count;
    
    const b5Ok = (parseFloat(invRuou) === 7 && parseFloat(invBanh) === 14 && parseInt(comboLogs) === 2);
    recordResult(5, 'Bán 3 Hàng Combo Giỏ Quà Tết (Tự động trừ 3 Rượu và 6 Bánh)', b5Ok,
      `Tồn Rượu Vang: ${invRuou} chai (Kỳ vọng: 7) | Tồn Bánh Cosy: ${invBanh} hộp (Kỳ vọng: 14) | Thẻ kho sinh: ${comboLogs} dòng độc lập`);

    // =========================================================================
    // BƯỚC 6: ĐẶT CỌC GIAO SAU (PREORDER - Tồn giữ chỗ reserved)
    // =========================================================================
    const preOrderRes = await client.query(
      "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb) AS res;",
      [
        JSON.stringify({
          branch_id: branchId, partner_id: pQuan, shift_id: shiftId, order_code: 'STRESS-B6-PREORDER',
          order_type: 'PREORDER', status: 'DRAFT',
          total_amount: 1020000, paid_amount: 200000
        }),
        JSON.stringify([{ product_id: pDulux, uom: 'Thùng', conversion_rate: 1, quantity: 2, unit_price: 510000 }]),
        JSON.stringify([{ payment_method: 'CASH', amount: 200000 }])
      ]
    );
    const preOrderId = preOrderRes.rows[0].res.order_id;

    const stockPre = (await client.query("SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pDulux])).rows[0];
    const b6Ok = (parseFloat(stockPre.on_hand) === 8 && parseFloat(stockPre.reserved) === 2);
    recordResult(6, 'Nhận đặt cọc 2 thùng sơn Dulux (Tăng reserved giữ chỗ, giữ nguyên on_hand)', b6Ok,
      `Tồn thực (on_hand): ${stockPre.on_hand} (Kỳ vọng: 8) | Tồn giữ chỗ (reserved): ${stockPre.reserved} (Kỳ vọng: 2) | Tồn khả dụng bán tiếp: ${stockPre.on_hand - stockPre.reserved} thùng`);

    // =========================================================================
    // BƯỚC 7: BẪY XUẤT QUÁ TỒN KHẢ DỤNG KHI ĐANG GIỮ CỌC
    // =========================================================================
    let b7Blocked = false;
    let b7Error = '';
    try {
      await client.query(
        "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb);",
        [
          JSON.stringify({ branch_id: branchId, shift_id: shiftId, order_code: 'STRESS-B7-FAIL', total_amount: 3570000, paid_amount: 3570000 }),
          JSON.stringify([{ product_id: pDulux, uom: 'Thùng', conversion_rate: 1, quantity: 7, unit_price: 510000 }]),
          JSON.stringify([{ payment_method: 'CASH', amount: 3570000 }])
        ]
      );
    } catch (e) {
      b7Blocked = e.message.includes('HẾT HÀNG TRONG KHO');
      b7Error = e.message;
    }
    recordResult(7, 'Chặn bán hàng tranh khi tồn khả dụng không đủ (Available Guard)', b7Blocked,
      `Kết quả chặn: ${b7Blocked ? `ĐÃ CHẶN THÀNH CÔNG: "${b7Error.split('\n')[0]}"` : 'LỖI: Cho phép bán tranh hàng của khách đã cọc!'}`);

    // =========================================================================
    // BƯỚC 8: XUẤT GIAO HÀNG ĐƠN CỌC (fulfill_preorder)
    // =========================================================================
    await client.query(
      "SELECT public.fulfill_preorder($1::uuid, $2::jsonb, $3);",
      [
        preOrderId,
        JSON.stringify([{ payment_method: 'CASH', amount: 820000 }]),
        'Thu Ngân Mai Anh'
      ]
    );

    const stockPostFulfill = (await client.query("SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pDulux])).rows[0];
    const orderCheck = (await client.query("SELECT status, paid_amount, debt_amount FROM public.orders WHERE id = $1", [preOrderId])).rows[0];
    
    const b8Ok = (parseFloat(stockPostFulfill.on_hand) === 6 && parseFloat(stockPostFulfill.reserved) === 0 && orderCheck.status === 'COMPLETED' && parseFloat(orderCheck.debt_amount) === 0);
    recordResult(8, 'Giao hàng đơn cọc (fulfill_preorder) & Thu nốt 820.000đ tiền mặt', b8Ok,
      `Tồn thực sau giao: ${stockPostFulfill.on_hand} thùng (Kỳ vọng: 6) | Giữ chỗ: ${stockPostFulfill.reserved} (Kỳ vọng: 0) | Đơn: ${orderCheck.status} | Đã thanh toán đủ: ${orderCheck.paid_amount}đ`);

    // =========================================================================
    // BƯỚC 9: KHÁCH TRẢ LẠI HÀNG (Cộng lại kho & Rút két thối tiền)
    // =========================================================================
    await client.query(
      "SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb);",
      [
        JSON.stringify({ branch_id: branchId, shift_id: shiftId, order_code: 'STRESS-B9-RETURN', order_type: 'RETURN', total_amount: 34000, paid_amount: 34000 }),
        JSON.stringify([{ product_id: pTiger, uom: 'Lon', conversion_rate: 1, quantity: 2, unit_price: 17000 }]),
        JSON.stringify([{ payment_method: 'CASH', amount: 34000 }])
      ]
    );

    const invTigerPostReturn = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [branchId, pTiger])).rows[0].on_hand;
    const refundFlow = (await client.query("SELECT type, category, amount FROM public.cash_flows WHERE order_id = (SELECT id FROM public.orders WHERE order_code = 'STRESS-B9-RETURN')")).rows[0];
    
    const b9Ok = (parseFloat(invTigerPostReturn) === 213 && refundFlow.type === 'OUT' && refundFlow.category === 'ORDER_REFUND' && parseFloat(refundFlow.amount) === 34000);
    recordResult(9, 'Khách trả lại 2 lon Tiger (Tăng kho + Chi tiền két thối lại)', b9Ok,
      `Tồn Tiger tăng lên: ${invTigerPostReturn} lon (Kỳ vọng: 213) | Sổ quỹ ghi: ${refundFlow.type} / ${refundFlow.category} / ${refundFlow.amount}đ`);

    // =========================================================================
    // BƯỚC 10: THU NỢ CŨ KHÁCH QUEN (collect_debt F3)
    // =========================================================================
    await client.query(
      "SELECT public.collect_debt($1::uuid, $2::uuid, $3::uuid, 1000000, 'CASH', 'KET_TIEN', 'Anh Quân trả bớt 1 triệu nợ cũ');",
      [branchId, shiftId, pQuan]
    );

    const debtFinal = (await client.query("SELECT current_debt FROM public.partners WHERE id = $1", [pQuan])).rows[0].current_debt;
    const debtFlow = (await client.query("SELECT type, category, amount FROM public.cash_flows WHERE shift_id = $1 AND category = 'DEBT_COLLECTION'", [shiftId])).rows[0];
    
    const b10Ok = (parseFloat(debtFinal) === 2500000 && debtFlow.type === 'IN' && parseFloat(debtFlow.amount) === 1000000);
    recordResult(10, 'Thu nợ cũ Anh Quân 1.000.000đ tiền mặt (F3)', b10Ok,
      `Dư nợ mới của Anh Quân: ${debtFinal}đ (Kỳ vọng: 2.500.000đ) | Sổ quỹ ghi nhận phiếu thu: ${debtFlow.amount}đ`);

    // =========================================================================
    // BƯỚC 11: ĐỐI SOÁT & CHỐT CA KÉT TIỀN (F8 Cash Discrepancy Reconciliation)
    // =========================================================================
    const summaryBeforeClose = (await client.query("SELECT public.get_shift_summary($1) AS s", [shiftId])).rows[0].s;
    const closeRes = (await client.query("SELECT public.close_shift($1, 3406000, 'Kiểm đếm khớp từng đồng') AS c", [shiftId])).rows[0].c;

    const b11Ok = (
      parseFloat(summaryBeforeClose.system_cash_amount) === 3406000 &&
      parseFloat(summaryBeforeClose.bank_in) === 1520000 &&
      parseFloat(closeRes.discrepancy) === 0
    );
    recordResult(11, 'Đối soát két tiền & Chốt ca bán hàng (F8)', b11Ok,
      `Tiền mặt hệ thống tính: ${summaryBeforeClose.system_cash_amount}đ | Tiền thực đếm: ${closeRes.actual_amount}đ | Lệch (discrepancy): ${closeRes.discrepancy}đ | Tiền ngân hàng VietQR: ${summaryBeforeClose.bank_in}đ`);

    // =========================================================================
    // BƯỚC 12: CHỐT CHẶN KHÓA SỔ KẾ TOÁN (Period Closing Lock Attempt)
    // =========================================================================
    await client.query("UPDATE public.branches SET locked_until_date = CURRENT_DATE WHERE id = $1", [branchId]);
    
    let b12Blocked = false;
    let b12Error = '';
    try {
      await client.query("DELETE FROM public.orders WHERE order_code = 'STRESS-B1'");
    } catch (e) {
      b12Blocked = e.message.includes('KHÓA SỔ KẾ TOÁN');
      b12Error = e.message;
    }
    await client.query("UPDATE public.branches SET locked_until_date = NULL WHERE id = $1", [branchId]);

    recordResult(12, 'Chặn đứng hành vi sửa/xóa dữ liệu sau Ngày Khóa Sổ', b12Blocked,
      `Kết quả kiểm định: ${b12Blocked ? `TRIGGER ĐÃ CHẶN ĐỨNG: "${b12Error.split('\n')[0]}"` : 'NGUY HIỂM: Cho phép xóa đơn sau ngày khóa sổ!'}`);

    // =========================================================================
    // BÁO CÁO TỔNG HỢP & CHẤM ĐIỂM CHUYÊN GIA
    // =========================================================================
    console.log('=============================================================================');
    console.log('📊 KẾT QUẢ CHẤM ĐIỂM TỔNG HỢP TỪ HỘI ĐỒNG KIỂM ĐỊNH HỆ THỐNG');
    console.log('=============================================================================');
    console.log(`Tổng số ca kiểm thử cân não: ${totalTests}`);
    console.log(`Số ca vượt qua chuẩn xác:    ${passedTests} / ${totalTests}`);
    const score = (passedTests / totalTests) * 100;
    console.log(`Điểm số kiểm định:           ${score.toFixed(1)} / 100`);

    if (passedTests === totalTests) {
      console.log('\n🏆 ĐÁNH GIÁ CHUYÊN GIA: XUẤT SẮC - ĐẠT CHUẨN SẢN XUẤT (COMMERCIAL GRADE A+)');
      console.log('   - 0 Lệch kho (Số lượng Base Unit, Combo, Reserved khớp 100%)');
      console.log('   - 0 Lệch két (Tiền mặt và Chuyển khoản VietQR khớp từng đồng xu)');
      console.log('   - 0 Thất thoát nợ (Bẫy nợ ẩn danh & Vượt hạn mức bị khóa cưỡng chế)');
      console.log('   - 0 Gian lận lịch sử (Khóa sổ kế toán bảo vệ số liệu bất biến)');
    } else {
      console.log('\n⚠️ CẢNH BÁO: HỆ THỐNG CÒN ĐIỂM YẾU, CẦN KHẮC PHỤC TRƯỚC KHI VẬN HÀNH!');
    }
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI NGHIÊM TRỌNG TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  } finally {
    await client.end();
  }
}

runMasterAudit();
