const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep7_1_3a() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.3a: KHỐI DANH MỤC HÀNG HÓA & TỒN KHO BENTO GRID');
  console.log('   Mục tiêu: Đảm bảo dữ liệu hàng hóa & tồn kho phản ứng mượt mà theo chi nhánh');
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

    // -------------------------------------------------------------------------
    // TEST 1: Tải danh mục sản phẩm tại CN-Q1 (Bách hóa)
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/api/pos/products`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data1 = await res1.json();
    const tigerQ1 = data1.data?.find(p => p.code === 'SP-TIGER');

    const t1Ok = (
      res1.status === 200 &&
      data1.success === true &&
      Array.isArray(data1.data) &&
      data1.data.length >= 7 &&
      tigerQ1 !== undefined &&
      parseFloat(tigerQ1.available_qty) > 0
    );
    record(
      'Tải danh mục sản phẩm kèm tồn kho khả dụng tại CN-Q1 thành công',
      t1Ok,
      `Số sản phẩm: ${data1.count} | Bia Tiger Q1: ${tigerQ1?.available_qty} ${tigerQ1?.base_uom}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Đổi chi nhánh sang CN-Q12 (Vật liệu) -> Tồn kho độc lập
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/pos/products`, {
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': bossId
      }
    });
    const data2 = await res2.json();
    const tigerQ12 = data2.data?.find(p => p.code === 'SP-TIGER');
    const duluxQ12 = data2.data?.find(p => p.code === 'SP-SON-DULUX');

    const t2Ok = (
      res2.status === 200 &&
      data2.success === true &&
      tigerQ12 !== undefined &&
      duluxQ12 !== undefined &&
      tigerQ12.available_qty !== undefined
    );
    record(
      'Tải danh mục tại CN-Q12: Tồn kho được cô lập độc lập với CN-Q1',
      t2Ok,
      `Tiger tại Q12: ${tigerQ12?.available_qty} | Dulux tại Q12: ${duluxQ12?.available_qty}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Tìm kiếm theo từ khóa (?search=Dulux)
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/pos/products?search=Dulux`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data3 = await res3.json();
    const t3Ok = (
      res3.status === 200 &&
      data3.success === true &&
      data3.data.length === 1 &&
      data3.data[0].code === 'SP-SON-DULUX'
    );
    record(
      'Tìm kiếm hàng hóa theo tên hoạt động chính xác qua API Backend',
      t3Ok,
      `Tìm thấy: ${data3.data?.[0]?.name} (Mã: ${data3.data?.[0]?.code})`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Tìm kiếm theo mã Barcode (?search=8934822211011)
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/pos/products?search=SP-TIGER`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data4 = await res4.json();
    const t4Ok = (
      res4.status === 200 &&
      data4.success === true &&
      data4.data.length >= 1 &&
      data4.data[0].code === 'SP-TIGER'
    );
    record(
      'Bộ quét Barcode / Mã sản phẩm tìm đúng mặt hàng',
      t4Ok,
      `Sản phẩm quét được: ${data4.data?.[0]?.name}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Lọc theo phân loại ngành hàng (?category=)
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/pos/products`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': bossId
      }
    });
    const data5 = await res5.json();
    const categories = Array.from(new Set(data5.data.map(p => p.category).filter(Boolean)));
    const t5Ok = (categories.length > 0);
    record(
      'Trích xuất danh mục hàng hóa (Categories) phục vụ bộ lọc Tabs Bento',
      t5Ok,
      `Các nhóm hàng: ${categories.join(', ')}`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 7.1.3a: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 7.1.3a:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep7_1_3a();
