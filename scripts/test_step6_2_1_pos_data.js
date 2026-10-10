const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_2_1() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.2.1: API HÀNG HÓA & KHÁCH HÀNG (POS DATA ENDPOINTS)');
  console.log('   Mục tiêu: Đảm bảo quầy POS lấy đúng tồn kho theo chi nhánh & sổ nợ khách hàng');
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

    const aliceId = '00000000-0000-0000-0000-000000000001'; // Thu ngân Q1
    const bobId = '00000000-0000-0000-0000-000000000002';   // Quản lý Q12

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/pos/products tại CN-Q1
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/pos/products`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId
      }
    });
    const data1 = await res1.json();
    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      data1.data.length > 0 &&
      data1.data.some(p => p.code === 'SP-TIGER')
    );
    const tigerQ1 = data1.data?.find(p => p.code === 'SP-TIGER');
    record(
      'Tải danh mục sản phẩm kèm tồn kho tại CN-Q1',
      t1Ok,
      `Số mặt hàng: ${data1.data?.length} | Tồn Bia Tiger Q1 (on_hand): ${tigerQ1?.on_hand} | Khả dụng: ${tigerQ1?.available_qty}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/pos/products với bộ lọc tìm kiếm ?search=Dulux
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/pos/products?search=Dulux`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId
      }
    });
    const data2 = await res2.json();
    const t2Ok = (
      res2.status === 200 &&
      data2.data.length >= 1 &&
      data2.data.every(p => p.name.includes('Dulux') || p.code.includes('DULUX'))
    );
    record(
      'Tìm kiếm hàng hóa theo từ khóa ?search=Dulux hoạt động chính xác',
      t2Ok,
      `Tìm thấy: ${data2.data?.length} sản phẩm (Tên: ${data2.data?.[0]?.name})`
    );

    // -------------------------------------------------------------------------
    // TEST 3: GET /api/pos/products tại CN-Q12 (Tồn kho độc lập)
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/pos/products`, {
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': bobId
      }
    });
    const data3 = await res3.json();
    const tigerQ12 = data3.data?.find(p => p.code === 'SP-TIGER');
    const t3Ok = (res3.status === 200 && data3.branchCode === 'CN-Q12');
    record(
      'Tồn kho được cô lập độc lập giữa các chi nhánh (Q1 vs Q12)',
      t3Ok,
      `Tồn Tiger Q1: ${tigerQ1?.on_hand} | Tồn Tiger Q12: ${tigerQ12?.on_hand}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: GET /api/pos/partners (Tra cứu toàn bộ khách hàng & hạn mức)
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/pos/partners`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId
      }
    });
    const data4 = await res4.json();
    const quan = data4.data?.find(p => p.code === 'KH-QUAN');
    const t4Ok = (
      res4.status === 200 &&
      data4.success === true &&
      quan !== undefined &&
      parseFloat(quan.debt_limit) > 0
    );
    record(
      'Tải danh sách đối tác & hồ sơ công nợ đầy đủ',
      t4Ok,
      `Tổng đối tác: ${data4.data?.length} | Anh Quân: ${quan?.name} | Nhóm giá: ${quan?.price_group} | Dư nợ: ${quan?.current_debt}đ | Hạn mức: ${quan?.debt_limit}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 5: GET /api/pos/partners?q=Quan (Tìm kiếm khách hàng theo tên)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/pos/partners?q=Quan`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId
      }
    });
    const data5 = await res5.json();
    const t5Ok = (
      res5.status === 200 &&
      data5.data.length === 1 &&
      data5.data[0].code === 'KH-QUAN'
    );
    record(
      'Tìm kiếm đối tác theo từ khóa ?q=Quan trả về đúng duy nhất 1 khách hàng',
      t5Ok,
      `Khách: ${data5.data?.[0]?.name} (Mã: ${data5.data?.[0]?.code}) | Hạn mức còn lại: ${data5.data?.[0]?.remaining_credit}đ`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.2.1: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.2.1:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_2_1();
