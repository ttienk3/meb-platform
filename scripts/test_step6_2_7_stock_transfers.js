const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_2_7() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.2.7: ĐIỀU CHUYỂN KHO 2 PHA QUA HTTP (TRANSFER API)');
  console.log('   Mục tiêu: Đảm bảo luồng Điều chuyển DRAFT -> DANG_DI_DUONG -> RECEIVE & HAO HỤT');
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
    const q12 = (await query("SELECT id, code FROM public.branches WHERE code = 'CN-Q12';")).rows[0];
    const bossId = '00000000-0000-0000-0000-000000000003'; // Quản trị viên truy cập cả 2 chi nhánh
    const pTiger = (await query("SELECT id FROM public.products WHERE code = 'SP-TIGER';")).rows[0].id;

    // Reset tồn kho ban đầu để test
    await query("UPDATE public.inventory SET on_hand = 1000, reserved = 0 WHERE branch_id = $1 AND product_id = $2;", [q1.id, pTiger]);
    await query("UPDATE public.inventory SET on_hand = 100, reserved = 0 WHERE branch_id = $1 AND product_id = $2;", [q12.id, pTiger]);

    const codeTr = 'DC-HTTP-' + Date.now();
    let transferId = null;
    let itemId = null;

    // -------------------------------------------------------------------------
    // TEST 1: Lập phiếu điều chuyển (POST /api/transfers)
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transfer_code: codeTr,
        to_branch_id: q12.id,
        note: 'Chuyển 20 thùng Tiger bổ sung kho Q12',
        created_by: 'Thủ Kho Q1 Test',
        items: [
          {
            product_id: pTiger,
            uom: 'Thùng',
            conversion_rate: 24,
            send_qty: 20
          }
        ]
      })
    });
    const data1 = await res1.json();
    transferId = data1.data?.transfer_id;

    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      transferId !== undefined &&
      data1.data?.status === 'DRAFT'
    );
    record(
      'Lập phiếu điều chuyển trạng thái DRAFT qua HTTP API',
      t1Ok,
      `HTTP Status: ${res1.status} | Mã phiếu: ${data1.data?.transfer_code} | Trạng thái: ${data1.data?.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Xem chi tiết phiếu điều chuyển (GET /api/transfers/:id)
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/transfers/${transferId}`, {
      method: 'GET',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data2 = await res2.json();
    itemId = data2.data?.items?.[0]?.id;
    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      data2.data?.transfer_code === codeTr &&
      Array.isArray(data2.data?.items) &&
      data2.data.items.length === 1 &&
      parseFloat(data2.data.items[0].send_base_qty) === 480
    );
    record(
      'Xem chi tiết phiếu điều chuyển và mặt hàng kèm quy đổi đơn vị (20 Thùng = 480 Lon)',
      t2Ok,
      `HTTP Status: ${res2.status} | Item ID: ${itemId} | Quy đổi cơ sở: ${data2.data?.items?.[0]?.send_base_qty} lon`
    );

    // -------------------------------------------------------------------------
    // TEST 3: PHA 1 - Xuất kho chuyển đi (POST /api/transfers/:id/dispatch)
    // -------------------------------------------------------------------------
    const invQ1Pre = parseFloat((await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, pTiger])).rows[0].on_hand);
    const res3 = await fetch(`${baseUrl}/api/transfers/${transferId}/dispatch`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dispatched_by: 'Bác Tài Xe Tải 01'
      })
    });
    const data3 = await res3.json();
    const invQ1Post = parseFloat((await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, pTiger])).rows[0].on_hand);

    const t3Ok = (
      res3.status === 200 &&
      data3.success === true &&
      data3.data?.status === 'DANG_DI_DUONG' &&
      invQ1Post === (invQ1Pre - 480)
    );
    record(
      'Pha 1: Xuất kho thành công -> Trạng thái DANG_DI_DUONG & Kho xuất trừ đúng 480 lon',
      t3Ok,
      `HTTP Status: ${res3.status} | Kho Q1 trước: ${invQ1Pre} | Kho Q1 sau: ${invQ1Post} (Trừ: -480 lon)`
    );

    // -------------------------------------------------------------------------
    // TEST 4: PHA 2 - Nhập kho nhận hàng & Đối soát hao hụt (POST /api/transfers/:id/receive)
    // Thực nhận 19 thùng, hao hụt mất 1 thùng do vỡ đường
    // -------------------------------------------------------------------------
    const invQ12Pre = parseFloat((await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q12.id, pTiger])).rows[0].on_hand);
    const res4 = await fetch(`${baseUrl}/api/transfers/${transferId}/receive`, {
      method: 'POST',
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        received_by: 'Thủ Kho Q12 Nhận Hàng',
        loss_responsibility: 'SHIPPER',
        received_items: [
          {
            item_id: itemId,
            received_qty: 19,
            loss_qty: 1,
            loss_reason: 'Vỡ thùng do xe xóc đường đèo'
          }
        ]
      })
    });
    const data4 = await res4.json();
    const invQ12Post = parseFloat((await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q12.id, pTiger])).rows[0].on_hand);

    // 19 thùng x 24 = 456 lon
    const t4Ok = (
      res4.status === 200 &&
      data4.success === true &&
      (data4.data?.status === 'COMPLETED_WITH_LOSS' || data4.data?.status === 'CO_HAO_HUT') &&
      invQ12Post === (invQ12Pre + 456)
    );
    record(
      'Pha 2: Nhập kho nhận hàng thành công -> Kho đích cộng 456 lon (19 thùng), ghi nhận hao hụt 1 thùng',
      t4Ok,
      `HTTP Status: ${res4.status} | Trạng thái: ${data4.data?.status} | Kho Q12 trước: ${invQ12Pre} | Kho Q12 sau: ${invQ12Post} (Tăng: +456 lon)`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Tra cứu danh sách phiếu điều chuyển của chi nhánh (GET /api/transfers)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/transfers`, {
      method: 'GET',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data5 = await res5.json();
    const t5Ok = (
      res5.status === 200 &&
      data5.success === true &&
      Array.isArray(data5.data) &&
      data5.data.some(t => t.id === transferId)
    );
    record(
      'Tra cứu danh sách phiếu điều chuyển theo chi nhánh thành công',
      t5Ok,
      `HTTP Status: ${res5.status} | Tổng số phiếu: ${data5.count} | Tìm thấy phiếu ${codeTr}: true`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.2.7: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.2.7:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_2_7();
