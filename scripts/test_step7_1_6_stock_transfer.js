const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep7_1_6() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.6: ĐIỀU CHUYỂN KHO 2 PHA & ĐỐI SOÁT HAO HỤT (INV-06)');
  console.log('   Mục tiêu: Đảm bảo giao diện Bento Tab StockTransferTab liên kết chuẩn với DB');
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
    const pTiger = (await query("SELECT id, code, name FROM public.products WHERE code = 'SP-TIGER';")).rows[0];

    // Chuẩn bị tồn kho ban đầu tại 2 chi nhánh
    await query("UPDATE public.inventory SET on_hand = 500, reserved = 0 WHERE branch_id = $1 AND product_id = $2;", [q1.id, pTiger.id]);
    await query("UPDATE public.inventory SET on_hand = 50, reserved = 0 WHERE branch_id = $1 AND product_id = $2;", [q12.id, pTiger.id]);

    const initialQ1Stock = (await query("SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, pTiger.id])).rows[0];
    const initialQ12Stock = (await query("SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q12.id, pTiger.id])).rows[0];

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/transfers tải danh sách phiếu điều chuyển cho CN-Q1
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/transfers`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data1 = await res1.json();
    const t1Ok = res1.status === 200 && data1.success === true && Array.isArray(data1.data);
    record('GET /api/transfers trả về danh sách phiếu điều chuyển phân lập theo chi nhánh', t1Ok, `Tìm thấy ${data1.data?.length || 0} phiếu`);

    // -------------------------------------------------------------------------
    // TEST 2: Chặn lập phiếu chuyển nội bộ đến chính chi nhánh hiện tại
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transfer_code: 'TEST-SELF-' + Date.now(),
        to_branch_id: q1.id, // Trùng chi nhánh gửi
        items: [{ product_id: pTiger.id, uom: 'Thùng', send_qty: 5 }]
      })
    });
    const data2 = await res2.json();
    const t2Ok = res2.status >= 400 && data2.success === false;
    record('Chặn thành công lập phiếu điều chuyển có chi nhánh đích trùng chi nhánh gửi', t2Ok, `HTTP ${res2.status}: ${data2.error?.message || data2.message}`);

    // -------------------------------------------------------------------------
    // TEST 3: Chặn xuất kho đi đường (POST /dispatch) khi vượt tồn kho khả dụng
    // -------------------------------------------------------------------------
    // Tạo 1 phiếu nháp vượt số lượng tồn kho (99999 thùng)
    const resDraftOver = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transfer_code: 'TEST-OVER-' + Date.now(),
        to_branch_id: q12.id,
        items: [{ product_id: pTiger.id, uom: 'Thùng', conversion_rate: 1, send_qty: 99999 }]
      })
    });
    const dataDraftOver = await resDraftOver.json();
    const overTransferId = dataDraftOver.data?.id || dataDraftOver.data?.transfer_id;

    // Cố tình xuất kho phiếu vượt tồn
    const res3 = await fetch(`${baseUrl}/api/transfers/${overTransferId}/dispatch`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dispatched_by: 'Thủ kho xuất Q1' })
    });
    const data3 = await res3.json();
    const t3Ok = res3.status >= 400 && data3.success === false && (data3.error?.message || '').includes('tồn khả dụng');
    record('Chặn xuất kho đi đường thành công khi vượt tồn khả dụng tại chi nhánh gửi', t3Ok, `HTTP ${res3.status}: ${data3.error?.message || data3.message}`);

    // -------------------------------------------------------------------------
    // TEST 4: Tạo phiếu điều chuyển DRAFT hợp lệ từ CN-Q1 sang CN-Q12
    // -------------------------------------------------------------------------
    const transferCode = 'DC-BENTO-' + Date.now();
    const res4 = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transfer_code: transferCode,
        to_branch_id: q12.id,
        note: 'Bento Grid Test: Điều chuyển 20 Thùng Tiger từ Q1 sang Q12',
        created_by: 'Thủ kho Bento Q1',
        items: [
          {
            product_id: pTiger.id,
            uom: 'Thùng',
            conversion_rate: 1,
            send_qty: 20
          }
        ]
      })
    });
    const data4 = await res4.json();
    const transferId = data4.data?.id || data4.data?.transfer_id;
    const t4Ok = res4.status === 200 && data4.success === true && transferId !== undefined && data4.data.status === 'DRAFT';
    record('Lập phiếu điều chuyển DRAFT thành công (POST /api/transfers)', t4Ok, `Mã: ${transferCode}, ID: ${transferId}, Trạng thái: ${data4.data?.status}`);

    // -------------------------------------------------------------------------
    // TEST 5: Tra cứu chi tiết phiếu điều chuyển (GET /api/transfers/:id)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/transfers/${transferId}`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data5 = await res5.json();
    const t5Ok = (
      res5.status === 200 &&
      data5.success === true &&
      data5.data?.id === transferId &&
      Array.isArray(data5.data?.items) &&
      data5.data.items.length === 1 &&
      Number(data5.data.items[0].send_qty) === 20
    );
    record('Tra cứu chi tiết phiếu điều chuyển kèm danh sách mặt hàng (GET /api/transfers/:id)', t5Ok, `Số mặt hàng: ${data5.data?.items?.length}, Số lượng gửi: ${data5.data?.items?.[0]?.send_qty}`);

    // -------------------------------------------------------------------------
    // TEST 6: Pha 1 - Xuất kho điều phối (POST /api/transfers/:id/dispatch)
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/transfers/${transferId}/dispatch`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dispatched_by: 'Thủ kho xuất Q1'
      })
    });
    const data6 = await res6.json();
    const t6Ok = (
      res6.status === 200 &&
      data6.success === true &&
      data6.data?.status === 'DANG_DI_DUONG'
    );

    // Kiểm tra tồn kho tại chi nhánh gửi sau khi xuất (đã trừ 20 thùng)
    const stockAfterDispatch = (await query("SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, pTiger.id])).rows[0];
    const stockDeducted = Number(stockAfterDispatch.on_hand) === Number(initialQ1Stock.on_hand) - 20;

    record('Pha 1: Xuất kho thành công, chuyển trạng thái DANG_DI_DUONG và trừ kho xuất', t6Ok && stockDeducted, `Trạng thái: ${data6.data?.status}, Kho Q1 từ ${initialQ1Stock.on_hand} -> ${stockAfterDispatch.on_hand}`);

    // -------------------------------------------------------------------------
    // TEST 7: Lọc phiếu theo loại điều chuyển OUT tại CN-Q1 và IN tại CN-Q12
    // -------------------------------------------------------------------------
    const res7Out = await fetch(`${baseUrl}/api/transfers?type=OUT&status=DANG_DI_DUONG`, {
      headers: { 'x-branch-id': q1.id, 'x-user-id': bossId }
    });
    const data7Out = await res7Out.json();
    const hasInOut = data7Out.data?.some(t => t.id === transferId);

    const res7In = await fetch(`${baseUrl}/api/transfers?type=IN&status=DANG_DI_DUONG`, {
      headers: { 'x-branch-id': q12.id, 'x-user-id': bossId }
    });
    const data7In = await res7In.json();
    const hasInIn = data7In.data?.some(t => t.id === transferId);

    record('Lọc phiếu OUT tại chi nhánh gửi và IN tại chi nhánh nhận đồng bộ', hasInOut && hasInIn, `CN-Q1 thấy chuyển đi: ${hasInOut}, CN-Q12 thấy chuyển đến: ${hasInIn}`);

    // -------------------------------------------------------------------------
    // TEST 8: Pha 2 - Nhận hàng tại CN-Q12 kèm biên bản hao hụt (INV-06)
    // -------------------------------------------------------------------------
    // Gửi 20 thùng, nhận 18 thùng, hao hụt 2 thùng do va đập vận chuyển (SHIPPER chịu trách nhiệm)
    const res8 = await fetch(`${baseUrl}/api/transfers/${transferId}/receive`, {
      method: 'POST',
      headers: {
        'x-branch-id': q12.id, // Chi nhánh nhận là CN-Q12
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        received_by: 'Thủ kho nhận Q12',
        loss_responsibility: 'SHIPPER',
        received_items: [
          {
            product_id: pTiger.id,
            received_qty: 18,
            loss_qty: 2,
            loss_reason: 'Bể 2 thùng trong lúc vận chuyển xe tải'
          }
        ]
      })
    });
    const data8 = await res8.json();
    const t8Ok = (
      res8.status === 200 &&
      data8.success === true &&
      (data8.data?.status === 'COMPLETED' || data8.data?.status === 'COMPLETED_WITH_LOSS' || data8.data?.status === 'HOAN_THANH')
    );

    // Kiểm tra tồn kho tại CN-Q12: tăng đúng 18 thùng (thực nhận), không tăng 2 thùng hao hụt
    const stockAfterReceive = (await query("SELECT on_hand, reserved FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q12.id, pTiger.id])).rows[0];
    const stockReceivedCorrect = Number(stockAfterReceive.on_hand) === Number(initialQ12Stock.on_hand) + 18;

    record('Pha 2: Nhận hàng tại chi nhánh đích, hạch toán hao hụt INV-06 và cộng kho thực nhận', t8Ok && stockReceivedCorrect, `Trạng thái: ${data8.data?.status}, Kho Q12 từ ${initialQ12Stock.on_hand} -> ${stockAfterReceive.on_hand} (+18 thực nhận)`);

    // -------------------------------------------------------------------------
    // TEST 9: Kiểm tra dữ liệu đối soát hao hụt được lưu trữ bất biến (INV-10)
    // -------------------------------------------------------------------------
    const checkItem = (await query("SELECT send_quantity, received_quantity, loss_quantity, loss_reason FROM public.stock_transfer_items WHERE transfer_id = $1 AND product_id = $2;", [transferId, pTiger.id])).rows[0];
    const t9Ok = (
      checkItem !== undefined &&
      Number(checkItem.send_quantity) === 20 &&
      Number(checkItem.received_quantity) === 18 &&
      Number(checkItem.loss_quantity) === 2 &&
      checkItem.loss_reason.includes('Bể 2 thùng')
    );
    record('Dữ liệu đối soát hao hụt lưu trữ toàn vẹn (send: 20, received: 18, loss: 2)', t9Ok, `Chi tiết: Gửi ${checkItem?.send_quantity}, Nhận ${checkItem?.received_quantity}, Hao hụt ${checkItem?.loss_quantity}, Lý do: "${checkItem?.loss_reason}"`);

    // -------------------------------------------------------------------------
    // TEST 10: Bento Metrics thống kê toàn vẹn trên giao diện
    // -------------------------------------------------------------------------
    const res10 = await fetch(`${baseUrl}/api/transfers`, {
      headers: { 'x-branch-id': q12.id, 'x-user-id': bossId }
    });
    const data10 = await res10.json();
    const targetTransfer = data10.data?.find(t => t.id === transferId);
    const t10Ok = targetTransfer !== undefined && (targetTransfer.status === 'COMPLETED' || targetTransfer.status === 'COMPLETED_WITH_LOSS' || targetTransfer.status === 'HOAN_THANH');
    record('Bento Grid tải danh sách hoàn tất, sẵn sàng hiển thị thẻ thống kê', t10Ok, `Phiếu ${transferCode} đã hiển thị tại tab điều chuyển với trạng thái ${targetTransfer?.status}`);

    console.log('\n=============================================================================');
    console.log(`🎯 KẾT QUẢ KIỂM THỬ BƯỚC 7.1.6: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed/total)*100)}%)`);
    console.log('=============================================================================');

    if (passed === total) {
      console.log('🎉 TẤT CẢ 10/10 CA KIỂM ĐỊNH THÀNH CÔNG! SẴN SÀNG TÍCH HỢP TOÀN HỆ THỐNG.\n');
    } else {
      console.log('⚠️ CÓ CA KIỂM ĐỊNH THẤT BẠI. CẦN KIỂM TRA LẠI!\n');
    }
  } catch (err) {
    console.error('🔥 [LỖI NGOẠI LỆ]:', err);
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTestStep7_1_6().then(() => pool.end());
}

module.exports = runTestStep7_1_6;
