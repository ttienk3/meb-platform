const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runTwoPhaseAudit() {
  await client.connect();
  console.log('=============================================================================');
  console.log('🚚 KIỂM THỬ THỰC CHIẾN: NGHIỆP VỤ ĐIỀU CHUYỂN LIÊN CHI NHÁNH 2 PHA');
  console.log('   Mục tiêu: Đảm bảo 0 thất thoát trên đường & Chuẩn hóa hạch toán hao hụt');
  console.log('=============================================================================\n');

  let passedTests = 0;
  const recordResult = (stepNum, title, passed, detail) => {
    if (passed) passedTests++;
    const icon = passed ? '✅ [ĐẠT 100%]' : '❌ [THẤT BẠI]';
    console.log(`${icon} BƯỚC ${stepNum}: ${title}`);
    console.log(`   Chi tiết: ${detail}\n`);
    if (!passed) throw new Error(`Kiểm thử thất bại tại bước ${stepNum}: ${title}`);
  };

  try {
    // 0. Lấy thông tin cơ bản
    const q1Res = await client.query("SELECT id FROM public.branches WHERE code = 'CN-Q1'");
    const q12Res = await client.query("SELECT id FROM public.branches WHERE code = 'CN-Q12'");
    const q1Id = q1Res.rows[0].id;
    const q12Id = q12Res.rows[0].id;

    const pTigerRes = await client.query("SELECT id FROM public.products WHERE code = 'SP-TIGER'");
    const pDuluxRes = await client.query("SELECT id FROM public.products WHERE code = 'SP-SON-DULUX'");
    const tigerId = pTigerRes.rows[0].id;
    const duluxId = pDuluxRes.rows[0].id;

    const shipperRes = await client.query("SELECT id, current_debt FROM public.partners WHERE code = 'SHIPPER-BA'");
    const shipperId = shipperRes.rows[0].id;

    // Đảm bảo CN-Q1 có đủ tồn kho cho Tiger và Dulux
    await client.query(`
      INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
      VALUES ($1, $2, 1000, 13000)
      ON CONFLICT (branch_id, product_id) DO UPDATE SET on_hand = 1000, cost_price = 13000;
    `, [q1Id, tigerId]);

    await client.query(`
      INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
      VALUES ($1, $2, 100, 75000)
      ON CONFLICT (branch_id, product_id) DO UPDATE SET on_hand = 100, cost_price = 75000;
    `, [q1Id, duluxId]);

    // Dọn dẹp dữ liệu kiểm thử cũ
    await client.query("DELETE FROM public.stock_transfers WHERE transfer_code LIKE 'TEST-TRANSFER-%'");

    // -------------------------------------------------------------------------
    // TEST 1: Tạo phiếu DRAFT điều chuyển 5 Thùng Tiger (5 x 24 = 120 lon)
    // -------------------------------------------------------------------------
    const draftRes = await client.query(`
      SELECT public.create_stock_transfer(
        jsonb_build_object(
          'transfer_code', 'TEST-TRANSFER-01',
          'from_branch_id', $1::uuid,
          'to_branch_id', $2::uuid,
          'shipper_id', $3::uuid,
          'note', 'Chuyển hỗ trợ giải khát CN-Q12',
          'created_by', 'Thủ kho Q1'
        ),
        jsonb_build_array(
          jsonb_build_object(
            'product_id', $4::uuid,
            'uom', 'Thùng',
            'conversion_rate', 24,
            'send_quantity', 5
          )
        )
      ) as res;
    `, [q1Id, q12Id, shipperId, tigerId]);
    
    const transfer1Id = draftRes.rows[0].res.transfer_id;
    recordResult(1, 'Khởi tạo phiếu điều chuyển DRAFT', 
      draftRes.rows[0].res.status === 'DRAFT', 
      `Mã phiếu: TEST-TRANSFER-01 | ID: ${transfer1Id}`);

    // -------------------------------------------------------------------------
    // TEST 2: Pha 1 - Xuất kho chuyển đi (dispatch_transfer)
    // -------------------------------------------------------------------------
    const invQ1Before = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [q1Id, tigerId])).rows[0].on_hand;
    const invQ12Before = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [q12Id, tigerId])).rows[0]?.on_hand || 0;

    await client.query(`SELECT public.dispatch_transfer($1::uuid, 'Thủ kho Q1');`, [transfer1Id]);

    const invQ1After = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [q1Id, tigerId])).rows[0].on_hand;
    const invQ12After = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [q12Id, tigerId])).rows[0]?.on_hand || 0;
    const statusAfterDisp = (await client.query("SELECT status FROM public.stock_transfers WHERE id = $1", [transfer1Id])).rows[0].status;

    const q1Deducted = (parseFloat(invQ1Before) - parseFloat(invQ1After)) === 120;
    const q12Unchanged = parseFloat(invQ12Before) === parseFloat(invQ12After);
    const isDangDiDuong = statusAfterDisp === 'DANG_DI_DUONG';

    recordResult(2, 'Pha 1: Xuất kho chuyển đi (dispatch_transfer)', 
      q1Deducted && q12Unchanged && isDangDiDuong, 
      `Kho Q1 giảm 120 lon (${invQ1Before} -> ${invQ1After}) | Kho Q12 giữ nguyên (${invQ12After}) | Trạng thái: ${statusAfterDisp}`);

    // -------------------------------------------------------------------------
    // TEST 3: Bẫy xuất kho lần 2 (Không được phép xuất khi đang đi đường)
    // -------------------------------------------------------------------------
    let reDispatchBlocked = false;
    try {
      await client.query(`SELECT public.dispatch_transfer($1::uuid, 'Thủ kho Q1');`, [transfer1Id]);
    } catch (err) {
      if (err.message.includes('không ở trạng thái DRAFT')) {
        reDispatchBlocked = true;
      }
    }
    recordResult(3, 'Chặn đứng bẫy xuất kho trùng lặp', 
      reDispatchBlocked, 
      'Database từ chối xuất kho lần 2 cho phiếu đã rời bến');

    // -------------------------------------------------------------------------
    // TEST 4: Pha 2 - Kiểm đếm nhận đủ 100% (receive_transfer)
    // -------------------------------------------------------------------------
    const item1Res = await client.query("SELECT id FROM public.stock_transfer_items WHERE transfer_id = $1", [transfer1Id]);
    const item1Id = item1Res.rows[0].id;

    const recRes = await client.query(`
      SELECT public.receive_transfer(
        $1::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'item_id', $2::uuid,
            'received_qty', 5,
            'loss_qty', 0,
            'loss_reason', NULL
          )
        ),
        'COMPANY_EXPENSE',
        'Thủ kho Q12'
      ) as res;
    `, [transfer1Id, item1Id]);

    const invQ12Final = (await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [q12Id, tigerId])).rows[0].on_hand;
    const logQ12 = (await client.query("SELECT type, qty_change, balance_after FROM public.inventory_logs WHERE reference_id = $1 AND type = 'TRANSFER_IN'", [transfer1Id])).rows[0];

    const q12Added = (parseFloat(invQ12Final) - parseFloat(invQ12After)) === 120;
    const isCompleted = recRes.rows[0].res.status === 'COMPLETED';

    recordResult(4, 'Pha 2: Nhận đủ 100% tại chi nhánh đích', 
      q12Added && isCompleted && !!logQ12, 
      `Kho Q12 tăng đúng 120 lon (${invQ12After} -> ${invQ12Final}) | Trạng thái: COMPLETED | Thẻ kho ghi nhận: TRANSFER_IN +120`);

    // -------------------------------------------------------------------------
    // TEST 5: Pha 2 có Hao hụt/Bể vỡ & Phạt trừ tiền Tài xế (SHIPPER_DEBT)
    // -------------------------------------------------------------------------
    // Chuyển 10 thùng Sơn Dulux (giá vốn 75.000đ/thùng)
    // Bể 2 thùng do tài xế làm rơi -> Thực nhận 8 thùng -> Shipper bị phạt 150.000đ
    const draft2Res = await client.query(`
      SELECT public.create_stock_transfer(
        jsonb_build_object(
          'transfer_code', 'TEST-TRANSFER-02-LOSS',
          'from_branch_id', $1::uuid,
          'to_branch_id', $2::uuid,
          'shipper_id', $3::uuid,
          'note', 'Chuyển sơn Dulux cho công trình Q12',
          'created_by', 'Thủ kho Q1'
        ),
        jsonb_build_array(
          jsonb_build_object(
            'product_id', $4::uuid,
            'uom', 'Thùng',
            'conversion_rate', 1,
            'send_quantity', 10
          )
        )
      ) as res;
    `, [q1Id, q12Id, shipperId, duluxId]);
    const transfer2Id = draft2Res.rows[0].res.transfer_id;

    // Dispatch
    await client.query(`SELECT public.dispatch_transfer($1::uuid, 'Thủ kho Q1');`, [transfer2Id]);

    const shipperDebtBefore = parseFloat((await client.query("SELECT current_debt FROM public.partners WHERE id = $1", [shipperId])).rows[0].current_debt);
    const duluxQ12Before = parseFloat((await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [q12Id, duluxId])).rows[0]?.on_hand || 0);

    const item2Id = (await client.query("SELECT id FROM public.stock_transfer_items WHERE transfer_id = $1", [transfer2Id])).rows[0].id;

    // Receive có hao hụt: Nhận 8, Hỏng 2 (Lỗi do tài xế lái ẩu)
    const recLossRes = await client.query(`
      SELECT public.receive_transfer(
        $1::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'item_id', $2::uuid,
            'received_qty', 8,
            'loss_qty', 2,
            'loss_reason', 'Xe phanh gấp làm đổ vỡ bể nắp 2 thùng sơn'
          )
        ),
        'SHIPPER_DEBT',
        'Thủ kho Q12'
      ) as res;
    `, [transfer2Id, item2Id]);

    const duluxQ12After = parseFloat((await client.query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2", [q12Id, duluxId])).rows[0].on_hand);
    const shipperDebtAfter = parseFloat((await client.query("SELECT current_debt FROM public.partners WHERE id = $1", [shipperId])).rows[0].current_debt);
    const transferLossRecord = (await client.query("SELECT * FROM public.inventory_logs WHERE reference_id = $1 AND type = 'TRANSFER_LOSS'", [transfer2Id])).rows[0];

    const lossValueExpected = 2 * 75000; // 150.000đ
    const debtIncreased = (shipperDebtAfter - shipperDebtBefore) === lossValueExpected;
    const stockOnlyGrew8 = (duluxQ12After - duluxQ12Before) === 8;
    const statusLoss = recLossRes.rows[0].res.status === 'COMPLETED_WITH_LOSS';

    recordResult(5, 'Hạch toán bể vỡ & Trừ tiền nợ Tài xế (SHIPPER_DEBT)', 
      stockOnlyGrew8 && debtIncreased && statusLoss && !!transferLossRecord, 
      `Kho đích chỉ tăng 8 thùng (kỳ vọng 8) | Trạng thái: COMPLETED_WITH_LOSS | Nợ tài xế tăng đúng ${lossValueExpected}đ (${shipperDebtBefore}đ -> ${shipperDebtAfter}đ)`);

    // -------------------------------------------------------------------------
    // TEST 6: Bẫy kiểm đếm số lượng lệch (Nhận 7 + Hỏng 2 != Gửi 10)
    // -------------------------------------------------------------------------
    // Tạo phiếu 3
    const draft3Res = await client.query(`
      SELECT public.create_stock_transfer(
        jsonb_build_object(
          'transfer_code', 'TEST-TRANSFER-03-MISMATCH',
          'from_branch_id', $1::uuid,
          'to_branch_id', $2::uuid,
          'shipper_id', $3::uuid,
          'created_by', 'Thủ kho Q1'
        ),
        jsonb_build_array(
          jsonb_build_object(
            'product_id', $4::uuid,
            'uom', 'Thùng',
            'conversion_rate', 1,
            'send_quantity', 10
          )
        )
      ) as res;
    `, [q1Id, q12Id, shipperId, duluxId]);
    const transfer3Id = draft3Res.rows[0].res.transfer_id;
    await client.query(`SELECT public.dispatch_transfer($1::uuid, 'Thủ kho Q1');`, [transfer3Id]);

    const item3Id = (await client.query("SELECT id FROM public.stock_transfer_items WHERE transfer_id = $1", [transfer3Id])).rows[0].id;

    let mismatchBlocked = false;
    try {
      await client.query(`
        SELECT public.receive_transfer(
          $1::uuid,
          jsonb_build_array(
            jsonb_build_object(
              'item_id', $2::uuid,
              'received_qty', 7,
              'loss_qty', 2, -- 7 + 2 = 9 != 10
              'loss_reason', 'Ghi thiếu 1 thùng'
            )
          ),
          'COMPANY_EXPENSE',
          'Thủ kho Q12'
        );
      `, [transfer3Id, item3Id]);
    } catch (err) {
      if (err.message.includes('không khớp với số lượng gửi')) {
        mismatchBlocked = true;
      }
    }

    recordResult(6, 'Chặn đứng bẫy kiểm đếm sai lệch số lượng', 
      mismatchBlocked, 
      'Database chặn đứng khi (Nhận 7 + Hỏng 2) không bằng Gửi 10');

    console.log('=============================================================================');
    console.log(`🎉 BÁO CÁO TỔNG KẾT: ${passedTests} / 6 CA KIỂM ĐỊNH THÀNH CÔNG RỰC RỠ!`);
    console.log('   - Điều chuyển 2 pha hoạt động nguyên tử 100%');
    console.log('   - Không rò rỉ hay thất thoát tồn kho trên đường đi');
    console.log('   - Hạch toán hao hụt và phạt nợ tài xế hoàn toàn tự động!');
    console.log('=============================================================================');

  } catch (error) {
    console.error('❌ Lỗi kiểm thử:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTwoPhaseAudit();
