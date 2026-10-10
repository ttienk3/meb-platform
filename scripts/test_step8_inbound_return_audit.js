/**
 * TEST SUITE BƯỚC 8: KIỂM ĐỊNH TOÀN DIỆN 3 PHÂN HỆ NÂNG CẤP
 * 1. Nhập hàng từ Nhà Cung Cấp (Purchase Inbound)
 * 2. Đổi trả hàng & Cấn trừ công nợ (RMA Return - INV-07)
 * 3. Kiểm kê kho định kỳ & Cân bằng thẻ kho (Stocktake Audit - INV-10)
 */

const app = require('../server/src/index');
const { query } = require('../server/src/db');

async function runStep8Tests() {
  console.log('=============================================================================');
  console.log('🧪 BẮT ĐẦU TEST BƯỚC 8: NHẬP HÀNG NCC, ĐỔI TRẢ RMA (INV-07) & KIỂM KÊ KHO (INV-10)');
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

  let createdPurchaseOrderId = null;
  let _createdReturnOrderId = null;
  let createdAuditId = null;

  try {
    const q1 = (await query("SELECT id, code, name FROM public.branches WHERE code = 'CN-Q1';")).rows[0];
    const bossId = '00000000-0000-0000-0000-000000000003';

    // Lấy 1 NCC và 1 Khách hàng
    const supplier = (await query("SELECT id, code, name, current_debt FROM public.partners WHERE is_supplier = TRUE LIMIT 1;")).rows[0];
    const customer = (await query("SELECT id, code, name, current_debt FROM public.partners WHERE is_customer = TRUE LIMIT 1;")).rows[0];

    // Lấy 2 sản phẩm để test
    const prods = (await query("SELECT id, code, name, default_cost_price FROM public.products ORDER BY id LIMIT 2;")).rows;
    const prod1 = prods[0];
    const prod2 = prods[1];

    const headers = {
      'Content-Type': 'application/json',
      'x-branch-id': q1.id,
      'x-user-id': bossId
    };

    // =========================================================================
    // PHẦN 1: NHẬP HÀNG TỪ NHÀ CUNG CẤP (PURCHASE INBOUND)
    // =========================================================================

    // TEST 1: GET /api/inbound/suppliers
    const res1 = await fetch(`${baseUrl}/api/inbound/suppliers`, { headers });
    const data1 = await res1.json();
    record(
      'GET /api/inbound/suppliers trả về danh sách nhà cung cấp hợp lệ',
      res1.status === 200 && data1.success === true && Array.isArray(data1.data) && data1.data.length > 0,
      `Số lượng NCC: ${data1.count}`
    );

    // Lấy tồn kho trước khi nhập
    const inv1Before = (await query("SELECT COALESCE(on_hand, 0) AS on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, prod1.id])).rows[0]?.on_hand || 0;

    // TEST 2: POST /api/inbound/purchase
    const purchasePayload = {
      supplier_id: supplier.id,
      items: [
        {
          product_id: prod1.id,
          uom: 'THUNG',
          conversion_rate: 24,
          quantity: 2, // 2 thùng = 48 lon
          unit_price: 360000 // 360k/thùng
        }
      ],
      paid_amount: 200000, // Trả trước 200k
      payment_method: 'BANK_TRANSFER',
      note: 'Nhập hàng đợt 1 từ nhà máy'
    };

    const res2 = await fetch(`${baseUrl}/api/inbound/purchase`, {
      method: 'POST',
      headers,
      body: JSON.stringify(purchasePayload)
    });
    const data2 = await res2.json();
    createdPurchaseOrderId = data2.data?.order_id;

    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      data2.data?.total_amount === 720000 &&
      data2.data?.paid_amount === 200000 &&
      data2.data?.debt_amount === 520000
    );
    record('POST /api/inbound/purchase lập phiếu nhập kho, tính toán công nợ NCC chính xác', t2Ok, `Mã phiếu: ${data2.data?.order_code}`);

    // TEST 3: Kiểm tra tồn kho sau nhập tăng đúng 48 đơn vị và thẻ kho inventory_logs
    const inv1After = (await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, prod1.id])).rows[0]?.on_hand || 0;
    const invLog1 = (await query("SELECT type, qty_change, balance_after FROM public.inventory_logs WHERE reference_id = $1::uuid;", [createdPurchaseOrderId])).rows[0];

    const t3Ok = (
      Number(inv1After) === Number(inv1Before) + 48 &&
      invLog1?.type === 'PURCHASE' &&
      Number(invLog1?.qty_change) === 48
    );
    record(
      'Tồn kho tăng đúng 48 lon và thẻ kho bất biến inventory_logs ghi nhận type PURCHASE (INV-10)',
      t3Ok,
      `Tồn cũ: ${inv1Before} -> Tồn mới: ${inv1After}`
    );

    // TEST 4: GET /api/inbound/receipts
    const res4 = await fetch(`${baseUrl}/api/inbound/receipts`, { headers });
    const data4 = await res4.json();
    const foundReceipt = data4.data?.find(r => r.id === createdPurchaseOrderId);
    record(
      'GET /api/inbound/receipts tra cứu phiếu nhập vừa lập',
      res4.status === 200 && Boolean(foundReceipt),
      `Tìm thấy phiếu: ${foundReceipt?.order_code}`
    );

    // =========================================================================
    // PHẦN 2: ĐỔI TRẢ HÀNG & CẤN TRỪ NỢ (RMA RETURN - INV-07)
    // =========================================================================

    // Lấy công nợ khách hàng trước khi trả
    const custDebtBefore = Number((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [customer.id])).rows[0]?.current_debt || 0);
    const invProd2Before = Number((await query("SELECT COALESCE(on_hand, 0) AS on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, prod2.id])).rows[0]?.on_hand || 0);

    // TEST 5: POST /api/pos/returns cấn trừ công nợ (DEBT_OFFSET - INV-07)
    const returnPayload = {
      partner_id: customer.id,
      items: [
        {
          product_id: prod2.id,
          uom: 'LON',
          conversion_rate: 1,
          quantity: 2,
          unit_price: 25000,
          reason: 'Khách mua thừa công trình'
        }
      ],
      refund_mode: 'DEBT_OFFSET',
      note: 'Khách trả 2 lon sơn cấn trừ nợ (INV-07)'
    };

    const res5 = await fetch(`${baseUrl}/api/pos/returns`, {
      method: 'POST',
      headers,
      body: JSON.stringify(returnPayload)
    });
    const data5 = await res5.json();
    _createdReturnOrderId = data5.data?.order?.id || data5.data?.id;

    record(
      'POST /api/pos/returns lập phiếu trả hàng và xử lý cấn trừ nợ (INV-07)',
      res5.status === 200 && data5.success === true,
      `Mã phiếu trả: ${data5.data?.order?.order_code || data5.data?.order_code}`
    );

    // TEST 6: Kiểm tra công nợ khách hàng được cấn trừ giảm đúng 50.000đ và tồn kho được hoàn trả
    const custDebtAfter = Number((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [customer.id])).rows[0]?.current_debt || 0);
    const invProd2After = Number((await query("SELECT COALESCE(on_hand, 0) AS on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, prod2.id])).rows[0]?.on_hand || 0);

    const t6Ok = (
      custDebtAfter === custDebtBefore - 50000 &&
      invProd2After === invProd2Before + 2
    );
    record(
      'Công nợ khách tự động cấn trừ giảm 50.000đ và hoàn trả tồn kho +2 đơn vị (INV-07)',
      t6Ok,
      `Nợ cũ: ${custDebtBefore} -> Nợ mới: ${custDebtAfter}`
    );

    // TEST 7: GET /api/pos/returns/recent
    const res7 = await fetch(`${baseUrl}/api/pos/returns/recent`, { headers });
    const data7 = await res7.json();
    record(
      'GET /api/pos/returns/recent lấy danh sách phiếu trả hàng gần đây',
      res7.status === 200 && data7.success === true && data7.data.length > 0,
      `Số phiếu trả: ${data7.count}`
    );

    // =========================================================================
    // PHẦN 3: KIỂM KÊ KHO ĐỊNH KỲ & CÂN BẰNG THẺ KHO (INV-10)
    // =========================================================================

    // TEST 8: GET /api/inventory/audit-products
    const res8 = await fetch(`${baseUrl}/api/inventory/audit-products`, { headers });
    const data8 = await res8.json();
    record(
      'GET /api/inventory/audit-products lấy danh mục sản phẩm kèm tồn sổ sách',
      res8.status === 200 && data8.success === true && data8.data.length > 0,
      `Tổng số mặt hàng: ${data8.count}`
    );

    // TEST 9: POST /api/inventory/audit (Chốt kiểm kê cân bằng kho)
    const currentProd1Stock = Number((await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, prod1.id])).rows[0]?.on_hand || 0);
    const targetActualQty = currentProd1Stock + 5; // Giả sử thừa 5 đơn vị

    const auditPayload = {
      items: [
        {
          product_id: prod1.id,
          actual_qty: targetActualQty,
          reason: 'Kiểm đếm định kỳ phát hiện dư 5 lon'
        }
      ],
      note: 'Biên bản kiểm kê kho định kỳ cuối tháng'
    };

    const res9 = await fetch(`${baseUrl}/api/inventory/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(auditPayload)
    });
    const data9 = await res9.json();
    createdAuditId = data9.data?.audit_id;

    record(
      'POST /api/inventory/audit chốt biên bản kiểm kê và cân bằng tồn kho',
      res9.status === 200 && data9.success === true && data9.data?.over_items_count === 1,
      `Mã kiểm kê: ${data9.data?.audit_code}`
    );

    // TEST 10: Kiểm tra tồn kho đã cân bằng và thẻ kho ghi nhận STOCKTAKE_AUDIT (INV-10)
    const invAfterAudit = Number((await query("SELECT on_hand FROM public.inventory WHERE branch_id = $1 AND product_id = $2;", [q1.id, prod1.id])).rows[0]?.on_hand || 0);
    const auditLog = (await query("SELECT type, qty_change, balance_after FROM public.inventory_logs WHERE reference_id = $1::uuid;", [createdAuditId])).rows[0];

    const t10Ok = (
      invAfterAudit === targetActualQty &&
      auditLog?.type === 'STOCKTAKE_AUDIT' &&
      Number(auditLog?.qty_change) === 5
    );
    record(
      'Tồn kho cân bằng về đúng số thực tế và thẻ kho ghi nhận STOCKTAKE_AUDIT (INV-10)',
      t10Ok,
      `Tồn sau cân bằng: ${invAfterAudit}, Thẻ kho log: ${auditLog?.type}`
    );

    // TEST 11: GET /api/inventory/audit-history
    const res11 = await fetch(`${baseUrl}/api/inventory/audit-history`, { headers });
    const data11 = await res11.json();
    const foundAudit = data11.data?.find(a => a.id === createdAuditId);
    record(
      'GET /api/inventory/audit-history hiển thị lịch sử đợt kiểm kê với chi tiết mặt hàng',
      res11.status === 200 && Boolean(foundAudit) && Array.isArray(foundAudit.items),
      `Mã đợt kiểm kê: ${foundAudit?.audit_code}`
    );

  } catch (err) {
    console.error('🔥 Lỗi nghiêm trọng khi chạy Test Bước 8:', err);
  } finally {
    server.close();
  }

  console.log('\n-----------------------------------------------------------------------------');
  console.log(`🎯 KẾT QUẢ TEST BƯỚC 8: ${passed}/${total} TEST CASES PASS (${Math.round((passed / total) * 100)}%)`);
  console.log('-----------------------------------------------------------------------------');

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStep8Tests();
