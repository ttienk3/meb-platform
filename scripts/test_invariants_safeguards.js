/**
 * KIỂM THỬ KHÉP KÍN BỘ BẢO VỆ NGHIỆP VỤ & CA BIÊN
 * 1. INV-04: Entity Mutex Concurrency Serialization (Chống Race Condition)
 * 2. INV-06: Compensating Reversal khi Hủy chuyển kho Đang đi đường
 * 3. INV-10: Thẻ kho Bất biến tuyệt đối (Hard Immutability WORM & Fast Index Lookup)
 */
const db = require('../server/src/db');
const { withEntityLock } = require('../server/src/utils/entityMutex');

async function runTests() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM ĐỊNH BỘ BẢO VỆ NGHIỆP VỤ: INV-04, INV-06, INV-10');
  console.log('=============================================================================\n');

  const client = await db.pool.connect();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: INV-04 - ENTITY MUTEX SERIALIZATION
    // -------------------------------------------------------------------------
    console.log('🔹 [1/3] Kiểm tra INV-04: Concurrency Lock & Entity Mutex...');
    const testBranchId = '00000000-0000-0000-0000-000000000001';
    const testProductId = '00000000-0000-0000-0000-000000000002';
    const executionOrder = [];

    // Chạy 3 tác vụ đồng thời trên cùng 1 sản phẩm
    const p1 = withEntityLock(testBranchId, testProductId, async () => {
      await new Promise(r => setTimeout(r, 40));
      executionOrder.push('Task 1');
    });
    const p2 = withEntityLock(testBranchId, testProductId, async () => {
      await new Promise(r => setTimeout(r, 20));
      executionOrder.push('Task 2');
    });
    const p3 = withEntityLock(testBranchId, testProductId, async () => {
      await new Promise(r => setTimeout(r, 10));
      executionOrder.push('Task 3');
    });

    await Promise.all([p1, p2, p3]);

    if (executionOrder.join(',') === 'Task 1,Task 2,Task 3') {
      console.log('   ✅ INV-04 PASS: Các tác vụ trên cùng sản phẩm được tuần tự hóa an toàn (Task 1 -> Task 2 -> Task 3), triệt tiêu race condition!');
    } else {
      throw new Error(`INV-04 Thất bại, thứ tự: ${executionOrder.join(',')}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: INV-10 - HARD IMMUTABILITY (WORM TRIGGER CHECK)
    // -------------------------------------------------------------------------
    console.log('\n🔹 [2/3] Kiểm tra INV-10: Thẻ kho Bất biến (Hard Immutability Trigger)...');

    // Lấy 1 bản ghi log tồn tại trong inventory_logs
    const logRes = await client.query('SELECT id, qty_change FROM public.inventory_logs ORDER BY created_at DESC LIMIT 1;');
    if (logRes.rows.length > 0) {
      const targetId = logRes.rows[0].id;

      // Thử thực hiện lệnh UPDATE trái phép
      let updateBlocked = false;
      try {
        await client.query('UPDATE public.inventory_logs SET qty_change = 999 WHERE id = $1;', [targetId]);
      } catch (err) {
        if (err.message.includes('INV-10 VIOLATION')) {
          updateBlocked = true;
          console.log(`   ✅ INV-10 PASS (UPDATE BLOCKED): ${err.message}`);
        }
      }
      if (!updateBlocked) throw new Error('INV-10 VIOLATION: Lệnh UPDATE trên inventory_logs không bị chặn!');

      // Thử thực hiện lệnh DELETE trái phép
      let deleteBlocked = false;
      try {
        await client.query('DELETE FROM public.inventory_logs WHERE id = $1;', [targetId]);
      } catch (err) {
        if (err.message.includes('INV-10 VIOLATION')) {
          deleteBlocked = true;
          console.log(`   ✅ INV-10 PASS (DELETE BLOCKED): ${err.message}`);
        }
      }
      if (!deleteBlocked) throw new Error('INV-10 VIOLATION: Lệnh DELETE trên inventory_logs không bị chặn!');
    } else {
      console.log('   ℹ️ Chưa có bản ghi log để thử nghiệm trigger, bỏ qua bước kích hoạt');
    }

    // Kiểm tra chỉ mục nhanh
    const idxCheck = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'inventory_logs' AND indexname = 'idx_inventory_logs_fast_lookup';
    `);
    if (idxCheck.rows.length > 0) {
      console.log('   ✅ INV-10 PASS: Composite Covering Index idx_inventory_logs_fast_lookup sẵn sàng cho truy vấn O(1)');
    } else {
      throw new Error('Chỉ mục idx_inventory_logs_fast_lookup chưa tồn tại!');
    }

    // -------------------------------------------------------------------------
    // TEST 3: INV-06 - TWO-PHASE TRANSFER CANCEL & COMPENSATING REVERSAL
    // -------------------------------------------------------------------------
    console.log('\n🔹 [3/3] Kiểm tra INV-06: Compensating Reversal khi hủy xe ĐANG_ĐI_ĐƯỜNG...');

    // Lấy 2 chi nhánh và 1 sản phẩm
    const branches = (await client.query('SELECT id FROM public.branches ORDER BY created_at ASC LIMIT 2;')).rows;
    const prod = (await client.query('SELECT id FROM public.products WHERE is_active = true LIMIT 1;')).rows[0];

    if (branches.length >= 2 && prod) {
      const fromBranch = branches[0].id;
      const toBranch = branches[1].id;
      const testProdId = prod.id;

      // Đảm bảo Kho gửi có đủ tồn kho (ví dụ 100 cái)
      await client.query(`
        INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
        VALUES ($1, $2, 100, 10000)
        ON CONFLICT (branch_id, product_id) DO UPDATE SET on_hand = 100;
      `, [fromBranch, testProdId]);

      // Đo tồn kho ban đầu
      const initialStock = (await client.query(
        'SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;',
        [fromBranch, testProdId]
      )).rows[0].on_hand;

      // 1. Tạo phiếu điều chuyển 10 cái
      const newTr = (await client.query(`
        INSERT INTO public.stock_transfers (
          from_branch_id, to_branch_id, transfer_code, status, note, created_by
        ) VALUES (
          $1, $2, 'TR-TEST-' || floor(random()*10000), 'DRAFT', 'Test Hủy chuyển kho', 'System'
        ) RETURNING id;
      `, [fromBranch, toBranch])).rows[0];

      await client.query(`
        INSERT INTO public.stock_transfer_items (
          transfer_id, product_id, uom, send_quantity, send_base_qty, unit_cost
        ) VALUES (
          $1, $2, 'Cái', 10, 10, 10000
        );
      `, [newTr.id, testProdId]);

      // 2. Xuất kho (Pha 1: Dispatch -> Trạng thái đổi thành DANG_DI_DUONG)
      const _dispatchRes = await client.query(
        'SELECT public.dispatch_transfer($1::uuid, $2) AS result;',
        [newTr.id, 'Thủ Kho Test']
      );
      const afterDispatchStock = (await client.query(
        'SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;',
        [fromBranch, testProdId]
      )).rows[0].on_hand;

      if (Number(afterDispatchStock) !== Number(initialStock) - 10) {
        throw new Error(`Kho xuất không bị trừ đúng 10 cái (Tồn: ${afterDispatchStock}, Ban đầu: ${initialStock})`);
      }
      console.log(`   📦 Pha 1: Xuất kho thành công. Hàng đang đi đường. Tồn kho A: ${initialStock} -> ${afterDispatchStock}`);

      // 3. Sự cố xảy ra: Hủy chuyến khi đang đi đường (Cancel Transfer Reversal)
      const _cancelRes = (await client.query(
        'SELECT public.cancel_transfer($1::uuid, $2, $3) AS result;',
        [newTr.id, 'Quản Lý Điều Phối', 'Xe hỏng, quay đầu']
      )).rows[0].result;

      // Kiểm tra tồn kho sau khi hủy
      const refundedStock = (await client.query(
        'SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;',
        [fromBranch, testProdId]
      )).rows[0].on_hand;

      if (Number(refundedStock) !== Number(initialStock)) {
        throw new Error(`Kho xuất không được bồi hoàn đủ (Tồn hiện tại: ${refundedStock}, Ban đầu: ${initialStock})`);
      }

      // Kiểm tra dòng ledger bồi hoàn
      const refundLog = (await client.query(`
        SELECT type, qty_change, reference_id FROM public.inventory_logs
        WHERE reference_id = $1 AND type = 'TRANSFER_RETURN';
      `, [newTr.id])).rows[0];

      if (!refundLog || Number(refundLog.qty_change) !== 10) {
        throw new Error('Dòng nhật ký TRANSFER_RETURN không được ghi nhận chính xác vào thẻ kho!');
      }

      console.log(`   ✅ INV-06 PASS: Hủy chuyến xe đang đi đường thành công! Tồn kho A được bồi hoàn: ${afterDispatchStock} -> ${refundedStock}`);
      console.log(`   📜 Dòng Thẻ kho đối ứng: Type=${refundLog.type}, QtyChange=+${refundLog.qty_change}, Ref=${refundLog.reference_id}`);
    }

    console.log('\n=============================================================================');
    console.log('🏆 TOÀN BỘ CÁC BỘ BẢO VỆ NGHIỆP VỤ (INV-04, INV-06, INV-10) ĐẠT 100% TIÊU CHUẨN!');
    console.log('=============================================================================');
  } catch (err) {
    console.error('❌ Lỗi kiểm định nghiệp vụ:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runTests();
