const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

async function runTestStep6_1_3() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ TÍCH HỢP BƯỚC 6.1.3: EXPRESS API GATEWAY & CONTEXT ENDPOINTS');
  console.log('   Mục tiêu: Đảm bảo máy chủ HTTP thật phản hồi chính xác qua giao thức mạng');
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

  // Khởi động server trên cổng ngẫu nhiên khả dụng để test độc lập
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
    // TEST 1: Public endpoint GET /health -> HTTP 200
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/health`);
    const data1 = await res1.json();
    const t1Ok = (res1.status === 200 && data1.status === 'ok');
    record(
      'Public endpoint GET /health phản hồi HTTP 200',
      t1Ok,
      `HTTP Status: ${res1.status} | Data: ${JSON.stringify(data1)}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/context/runtime không có Header x-branch-id -> HTTP 400
    // -------------------------------------------------------------------------
    const res2 = await fetch(`${baseUrl}/api/context/runtime`);
    const data2 = await res2.json();
    const t2Ok = (res2.status === 400 && data2.error?.code === 'MISSING_BRANCH_CONTEXT');
    record(
      'Chặn đứng gọi API thiếu Header x-branch-id (HTTP 400 Bad Request)',
      t2Ok,
      `HTTP Status: ${res2.status} | Error Code: ${data2.error?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Alice cố truy cập Q12 -> HTTP 403 Forbidden
    // -------------------------------------------------------------------------
    const res3 = await fetch(`${baseUrl}/api/context/runtime`, {
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': aliceId
      }
    });
    const data3 = await res3.json();
    const t3Ok = (res3.status === 403 && data3.error?.code === 'BRANCH_ACCESS_DENIED');
    record(
      'Alice bị từ chối truy cập chi nhánh Q12 qua HTTP (HTTP 403 Forbidden)',
      t3Ok,
      `HTTP Status: ${res3.status} | Error Code: ${data3.error?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Alice truy cập đúng Q1 -> HTTP 200 + dữ liệu cấu hình
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${baseUrl}/api/context/runtime`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': aliceId
      }
    });
    const data4 = await res4.json();
    const t4Ok = (
      res4.status === 200 &&
      data4.success === true &&
      data4.data?.branch?.code === 'CN-Q1' &&
      data4.data?.features?.require_shifts === true
    );
    record(
      'Alice truy cập thành công CN-Q1 qua HTTP (HTTP 200 OK + Full Config)',
      t4Ok,
      `HTTP Status: ${res4.status} | Branch: ${data4.data?.branch?.code} | require_shifts: ${data4.data?.features?.require_shifts}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Bob truy cập Q12 -> HTTP 200 + cờ Override riêng
    // -------------------------------------------------------------------------
    const res5 = await fetch(`${baseUrl}/api/context/runtime`, {
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': bobId
      }
    });
    const data5 = await res5.json();
    const t5Ok = (
      res5.status === 200 &&
      data5.data?.branch?.code === 'CN-Q12' &&
      data5.data?.features?.allow_debt === true &&
      data5.data?.featureMeta?.allow_debt?.source === 'BRANCH_OVERRIDE'
    );
    record(
      'Bob truy cập CN-Q12 nhận đúng cờ Override riêng qua HTTP',
      t5Ok,
      `Branch: ${data5.data?.branch?.code} | allow_debt: ${data5.data?.features?.allow_debt} | Source: ${data5.data?.featureMeta?.allow_debt?.source}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: POST /api/context/invalidate làm mới cache
    // -------------------------------------------------------------------------
    const res6 = await fetch(`${baseUrl}/api/context/invalidate`, {
      method: 'POST',
      headers: {
        'x-branch-id': q12.id,
        'x-user-id': bobId
      }
    });
    const data6 = await res6.json();
    const t6Ok = (res6.status === 200 && data6.success === true);
    record(
      'Gọi API làm mới Cache (Invalidate) thành công',
      t6Ok,
      `HTTP Status: ${res6.status} | Message: ${data6.message}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Benchmark độ trễ mạng HTTP Gateway (Network SLA)
    // -------------------------------------------------------------------------
    const ITERATIONS = 30;
    const tStart = Date.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await fetch(`${baseUrl}/api/context/runtime`, {
        headers: {
          'x-branch-id': q1.id,
          'x-user-id': aliceId
        }
      });
    }
    const avgLatency = (Date.now() - tStart) / ITERATIONS;
    const t7Ok = (avgLatency < 10);
    record(
      'Đo lường độ trễ mạng HTTP Gateway hoàn chỉnh (Network SLA)',
      t7Ok,
      `Độ trễ trung bình: ${avgLatency.toFixed(2)}ms / HTTP request (Mục tiêu SLA < 10ms)`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.1.3: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.1.3:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep6_1_3();
