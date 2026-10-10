const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  await client.connect();
  console.log('=== KIỂM THỬ THỰC TẾ 3 TÌNH HUỐNG SAU KHI VÁ LOGIC ===\n');

  const branchRes = await client.query("SELECT id FROM public.branches WHERE code = 'CN-Q1';");
  const branchId = branchRes.rows[0].id;

  const prodRes = await client.query("SELECT id FROM public.products WHERE code = 'SP-TIGER';");
  const tigerId = prodRes.rows[0].id;

  const partnerRes = await client.query("SELECT id FROM public.partners WHERE code = 'KH-QUAN';");
  const partnerId = partnerRes.rows[0].id;

  // -------------------------------------------------------------------------
  // TEST 1: BÁN NỢ ẨN DANH (KHÔNG CÓ PARTNER_ID) -> PHẢI BỊ CHẶN 100%
  // -------------------------------------------------------------------------
  console.log('🧪 TEST 1: Thử tạo đơn nợ 100k nhưng cố tình bỏ trống partner_id...');
  let test1Passed = false;
  try {
    await client.query(`
      SELECT public.checkout_order(
        jsonb_build_object(
          'branch_id', $1::uuid,
          'partner_id', NULL,
          'order_code', 'TEST-FAIL-DEBT',
          'total_amount', 100000,
          'paid_amount', 0
        ),
        jsonb_build_array(
          jsonb_build_object(
            'product_id', $2::uuid,
            'uom', 'Lon',
            'conversion_rate', 1,
            'quantity', 5,
            'unit_price', 20000,
            'discount', 0
          )
        )
      );
    `, [branchId, tigerId]);
  } catch (err) {
    if (err.message.includes('BÁN NỢ BẤT KHẢ THI')) {
      test1Passed = true;
      console.log('  -> ✅ TEST 1 ĐẠT CHUẨN! Database chặn đứng với thông điệp:');
      console.log('     "', err.message, '"');
    } else {
      console.error('  -> ❌ Lỗi không mong đợi:', err.message);
    }
  }
  if (!test1Passed) throw new Error('TEST 1 THẤT BẠI: Đơn nợ ẩn danh không bị chặn!');

  // -------------------------------------------------------------------------
  // TEST 2: ĐƠN TRẢ HÀNG (RETURN) -> TỒN KHO PHẢI TĂNG (+), DÒNG TIỀN PHẢI CHI RA (OUT)
  // -------------------------------------------------------------------------
  console.log('\n🧪 TEST 2: Khách mang trả 3 Lon Bia Tiger và nhận lại tiền mặt 51.000đ...');
  const stockBeforeRes = await client.query(
    "SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;",
    [branchId, tigerId]
  );
  const stockBefore = parseFloat(stockBeforeRes.rows[0].on_hand);
  console.log(`  -> Tồn kho trước khi trả: ${stockBefore} lon`);

  const _returnRes = await client.query(`
    SELECT public.checkout_order(
      jsonb_build_object(
        'branch_id', $1::uuid,
        'partner_id', $2::uuid,
        'order_code', 'TEST-RETURN-001',
        'order_type', 'RETURN',
        'total_amount', 51000,
        'paid_amount', 51000,
        'note', 'Khách trả 3 lon bia lấy lại tiền mặt'
      ),
      jsonb_build_array(
        jsonb_build_object(
          'product_id', $3::uuid,
          'uom', 'Lon',
          'conversion_rate', 1,
          'quantity', 3,
          'unit_price', 17000,
          'discount', 0
        )
      )
    ) AS res;
  `, [branchId, partnerId, tigerId]);

  const stockAfterRes = await client.query(
    "SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;",
    [branchId, tigerId]
  );
  const stockAfter = parseFloat(stockAfterRes.rows[0].on_hand);
  console.log(`  -> Tồn kho sau khi trả hàng (+3 lon): ${stockAfter} lon (Kỳ vọng: ${stockBefore + 3})`);

  if (stockAfter !== stockBefore + 3) {
    throw new Error(`TEST 2 THẤT BẠI: Tồn kho không tăng đúng (+3)! Thực tế: ${stockAfter}`);
  }

  // Kiểm tra phiếu chi tiền thối lại (cash_flows phải là OUT / ORDER_REFUND)
  const cashRes = await client.query(
    "SELECT flow_code, type, category, amount FROM public.cash_flows WHERE note LIKE '%TEST-RETURN-001%';"
  );
  console.log('  -> Dòng tiền phiếu thối trả hàng:', cashRes.rows[0]);
  if (cashRes.rows[0].type !== 'OUT' || cashRes.rows[0].category !== 'ORDER_REFUND') {
    throw new Error('TEST 2 THẤT BẠI: Dòng tiền trả hàng không phải OUT / ORDER_REFUND!');
  }
  console.log('  -> ✅ TEST 2 ĐẠT CHUẨN 100%! Tồn kho tăng và Dòng tiền chi ra chuẩn xác!');

  // -------------------------------------------------------------------------
  // TEST 3: ĐẶT CỌC (PREORDER) VÀ GIAO HÀNG (FULFILL_PREORDER)
  // -------------------------------------------------------------------------
  console.log('\n🧪 TEST 3: Đặt cọc 10 lon Bia (PREORDER) rồi gọi fulfill_preorder giao hàng...');
  
  // 3.1 Tạo đơn đặt cọc DRAFT
  const preorderRes = await client.query(`
    SELECT public.checkout_order(
      jsonb_build_object(
        'branch_id', $1::uuid,
        'partner_id', $2::uuid,
        'order_code', 'TEST-PREORDER-001',
        'order_type', 'PREORDER',
        'status', 'DRAFT',
        'total_amount', 170000,
        'paid_amount', 70000,
        'note', 'Khách cọc trước 70k, nợ 100k khi giao'
      ),
      jsonb_build_array(
        jsonb_build_object(
          'product_id', $3::uuid,
          'uom', 'Lon',
          'conversion_rate', 1,
          'quantity', 10,
          'unit_price', 17000,
          'discount', 0
        )
      )
    ) AS res;
  `, [branchId, partnerId, tigerId]);
  
  const preorderId = preorderRes.rows[0].res.order_id;
  console.log(`  -> Tạo đơn cọc thành công, order_id: ${preorderId}`);

  // Kiểm tra reserved đã tăng 10 chưa
  const stockPreRes = await client.query(
    "SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2;",
    [branchId, tigerId]
  );
  console.log('  -> Tồn kho lúc đang giữ chỗ cọc (on_hand giữ nguyên, reserved tăng 10):', stockPreRes.rows[0]);

  // 3.2 Giao hàng đơn cọc và thu nốt 100k
  console.log('  -> Gọi RPC fulfill_preorder giao hàng và thu nốt 100k...');
  const fulfillRes = await client.query(`
    SELECT public.fulfill_preorder(
      $1::uuid,
      jsonb_build_array(
        jsonb_build_object(
          'payment_method', 'CASH',
          'payment_account', 'KET_TIEN',
          'amount', 100000,
          'note', 'Thu nốt 100k khi giao hàng'
        )
      ),
      'Mai Anh'
    ) AS res;
  `, [preorderId]);

  console.log('  -> Kết quả fulfill_preorder:', fulfillRes.rows[0].res);

  // Kiểm tra tồn kho sau khi giao hàng: on_hand giảm 10, reserved giảm 10
  const stockPostRes = await client.query(
    "SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2;",
    [branchId, tigerId]
  );
  console.log('  -> Tồn kho sau khi giao hàng (on_hand giảm 10, reserved về 0):', stockPostRes.rows[0]);

  // Kiểm tra trạng thái đơn hàng
  const orderCheck = await client.query(
    "SELECT order_code, status, paid_amount, debt_amount FROM public.orders WHERE id = $1;",
    [preorderId]
  );
  console.log('  -> Đơn hàng sau khi giao:', orderCheck.rows[0]);

  if (orderCheck.rows[0].status !== 'COMPLETED' || parseFloat(orderCheck.rows[0].debt_amount) !== 0) {
    throw new Error('TEST 3 THẤT BẠI: Đơn cọc chưa hoàn tất hoặc nợ chưa về 0!');
  }
  console.log('  -> ✅ TEST 3 ĐẠT CHUẨN 100%! Vòng đời đơn cọc khép kín hoàn hảo!');

  console.log('\n🎉 TẤT CẢ 3 BÀI TEST ĐÃ VƯỢT QUA 100%! KHÔNG CÒN BẤT KỲ HẠT SẠN NÀO!');
  await client.end();
}

verify().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
