const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep7_1_5() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.5: SỔ NỢ KHÁCH HÀNG & THU NỢ F3 (CUSTOMER DEBT TAB)');
  console.log('   Mục tiêu: Đảm bảo tra cứu nợ, lọc theo hạn mức và thu nợ F3 cấn trừ sổ sách');
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
    const bossId = '00000000-0000-0000-0000-000000000003';

    // 0. Đảm bảo CN-Q1 có ca bán hàng mở để kiểm tra hạch toán tiền két khi thu nợ mặt
    let shiftQ1 = (await query("SELECT id FROM public.shifts WHERE branch_id = $1 AND status = 'OPEN' LIMIT 1;", [q1.id])).rows[0];
    if (!shiftQ1) {
      const s = await query("INSERT INTO public.shifts (branch_id, staff_name, initial_amount, status) VALUES ($1, 'Thu Ngân Q1 (Test Sổ Nợ)', 1000000, 'OPEN') RETURNING id;", [q1.id]);
      shiftQ1 = s.rows[0];
    }

    // Lấy thông tin đối tác có nợ để thử nghiệm thu nợ
    let pQuan = (await query("SELECT id, code, name, phone, current_debt, debt_limit FROM public.partners WHERE code = 'KH-QUAN';")).rows[0];
    // Đảm bảo đối tác có ít nhất 1.000.000đ tiền nợ để kiểm thử cấn trừ
    if (parseFloat(pQuan.current_debt) < 500000) {
      await query("UPDATE public.partners SET current_debt = 2000000 WHERE id = $1;", [pQuan.id]);
      pQuan.current_debt = 2000000;
    }

    const initialDebt = parseFloat(pQuan.current_debt);

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/pos/partners tải danh sách đối tác kèm số dư nợ
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/pos/partners`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data1 = await res1.json();
    const partnerFound = data1.data?.find(p => p.id === pQuan.id);

    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      Array.isArray(data1.data) &&
      data1.data.length >= 3 &&
      partnerFound !== undefined &&
      parseFloat(partnerFound.current_debt) > 0
    );
    record(
      'Tải danh sách đối tác kèm sổ nợ thời gian thực (GET /api/pos/partners)',
      t1Ok,
      `Số đối tác: ${data1.count} | Đối tác ${partnerFound?.name}: Nợ ${partnerFound?.current_debt}đ / Hạn mức ${partnerFound?.debt_limit}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Phân loại danh sách đối tác đang có nợ (> 0đ)
    // -------------------------------------------------------------------------
    const debtPartners = data1.data?.filter(p => parseFloat(p.current_debt) > 0);
    const t2Ok = (debtPartners && debtPartners.length > 0);
    record(
      'Phân loại và tính tổng hợp danh sách khách hàng đang có nợ gối đầu',
      t2Ok,
      `Số khách đang có nợ: ${debtPartners?.length} | Tổng tiền nợ đối tác đầu tiên: ${debtPartners?.[0]?.current_debt}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Thu nợ Tiền Mặt (CASH - F3) cấn trừ sổ nợ
    // -------------------------------------------------------------------------
    const collectCashAmount = 300000;
    const res3 = await fetch(`${baseUrl}/api/pos/debt-collection`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partner_id: pQuan.id,
        shift_id: shiftQ1.id,
        amount: collectCashAmount,
        payment_method: 'CASH',
        note: 'Thu nợ tiền mặt đợt 1 tại quầy'
      })
    });
    const data3 = await res3.json();
    const debtAfterCash = parseFloat((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [pQuan.id])).rows[0].current_debt);

    const t3Ok = (
      res3.status === 200 &&
      data3.success === true &&
      debtAfterCash === (initialDebt - collectCashAmount)
    );
    record(
      'Thu nợ Tiền Mặt (CASH) cấn trừ trực tiếp sổ nợ đối tác (-300.000đ)',
      t3Ok,
      `Nợ ban đầu: ${initialDebt}đ | Nợ sau khi thu: ${debtAfterCash}đ | Cấn trừ: ${initialDebt - debtAfterCash}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Thu nợ Chuyển Khoản (BANK_TRANSFER - F3)
    // -------------------------------------------------------------------------
    const collectBankAmount = 200000;
    const res4 = await fetch(`${baseUrl}/api/pos/debt-collection`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partner_id: pQuan.id,
        shift_id: shiftQ1.id,
        amount: collectBankAmount,
        payment_method: 'BANK_TRANSFER',
        note: 'Khách chuyển khoản VCB thanh toán nợ'
      })
    });
    const data4 = await res4.json();
    const debtAfterBank = parseFloat((await query("SELECT current_debt FROM public.partners WHERE id = $1;", [pQuan.id])).rows[0].current_debt);

    const t4Ok = (
      res4.status === 200 &&
      data4.success === true &&
      debtAfterBank === (debtAfterCash - collectBankAmount)
    );
    record(
      'Thu nợ Chuyển Khoản (BANK_TRANSFER) cấn trừ tiếp sổ nợ (-200.000đ)',
      t4Ok,
      `Nợ trước: ${debtAfterCash}đ | Nợ sau: ${debtAfterBank}đ | Cấn trừ: ${debtAfterCash - debtAfterBank}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Chốt chặn kiểm tra: Thu nợ số tiền <= 0 (Invalid Amount)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/pos/debt-collection`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partner_id: pQuan.id,
        amount: -50000
      })
    });
    const data5 = await res5.json();
    const t5Ok = (res5.status === 400 && data5.error?.code === 'INVALID_PAYLOAD');
    record(
      'Validation: Chặn đứng thu nợ số tiền <= 0 (HTTP 400 Bad Request)',
      t5Ok,
      `HTTP Status: ${res5.status} | Mã lỗi: ${data5.error?.code} | Lỗi: "${data5.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Chốt chặn kiểm tra: Thu nợ thiếu partner_id
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/pos/debt-collection`, {
      method: 'POST',
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 500000
      })
    });
    const data6 = await res6.json();
    const t6Ok = (res6.status === 400 && data6.error?.code === 'INVALID_PAYLOAD');
    record(
      'Validation: Chặn đứng thu nợ thiếu định danh đối tác partner_id',
      t6Ok,
      `HTTP Status: ${res6.status} | Mã lỗi: ${data6.error?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Kiểm tra ca bán hàng cập nhật doanh thu thu nợ tiền mặt
    // -------------------------------------------------------------------------
    const res7 = await fetch(`${baseUrl}/api/pos/shifts/${shiftQ1.id}/summary`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data7 = await res7.json();
    const shiftSummary = data7.data;

    const t7Ok = (
      res7.status === 200 &&
      data7.success === true &&
      parseFloat(shiftSummary?.total_debt_collected_cash) >= collectCashAmount
    );
    record(
      'Dòng tiền két ca trực tự động tăng khớp với số tiền thu nợ mặt (Cash Drawer Sync)',
      t7Ok,
      `Thu nợ mặt trong ca: ${shiftSummary?.total_debt_collected_cash}đ | Tổng két hệ thống: ${shiftSummary?.system_cash_amount}đ`
    );

  } catch (err) {
    console.error('🔥 Ngoại lệ ngoài ý muốn trong quá trình kiểm thử Bước 7.1.5:', err);
  } finally {
    server.close();
    await pool.end();
  }

  console.log('\n=============================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ BƯỚC 7.1.5: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed / total) * 100)}%)`);
  console.log('=============================================================================');

  if (passed === total) {
    console.log('🎉 TẤT CẢ CA KIỂM ĐỊNH THÀNH CÔNG! BƯỚC 7.1.5 HOÀN THIỆN XUẤT SẮC.');
    process.exit(0);
  } else {
    console.log('❌ CÓ BÀI TEST CHƯA ĐẠT. CẦN KIỂM TRA LẠI.');
    process.exit(1);
  }
}

runTestStep7_1_5();
