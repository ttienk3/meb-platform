const { pool, query } = require('../server/src/db');
const requestContext = require('../server/src/middleware/requestContext');

function createMockRes() {
  const res = {
    statusCode: null,
    jsonData: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.jsonData = data;
      return res;
    }
  };
  return res;
}

async function runTestStep6_1_2() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.1.2: MIDDLEWARE REQUEST CONTEXT (EXPRESS LAYER)');
  console.log('   Mục tiêu: Đảm bảo Middleware bóc tách Header, chặn lỗi 400, 403 và bơm req.ctx');
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

  try {
    const q1 = (await query("SELECT id, code FROM public.branches WHERE code = 'CN-Q1';")).rows[0];
    const q12 = (await query("SELECT id, code FROM public.branches WHERE code = 'CN-Q12';")).rows[0];

    const aliceId = '00000000-0000-0000-0000-000000000001'; // Thu ngân Q1
    const bobId = '00000000-0000-0000-0000-000000000002';   // Cửa hàng trưởng Q12
    const bossId = '00000000-0000-0000-0000-000000000003';  // Chủ chuỗi

    // -------------------------------------------------------------------------
    // TEST 1: Thiếu Header x-branch-id -> Phải trả về HTTP 400 Bad Request
    // -------------------------------------------------------------------------
    const req1 = { headers: {} };
    const res1 = createMockRes();
    let next1Called = false;
    await requestContext(req1, res1, () => { next1Called = true; });

    const t1Ok = (
      res1.statusCode === 400 &&
      res1.jsonData?.error?.code === 'MISSING_BRANCH_CONTEXT' &&
      next1Called === false
    );
    record(
      'Chặn đứng request thiếu Header "x-branch-id" (HTTP 400 Bad Request)',
      t1Ok,
      `HTTP Status: ${res1.statusCode} | Error Code: ${res1.jsonData?.error?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Alice cố truy cập trái phép Q12 -> Phải trả về HTTP 403 Forbidden
    // -------------------------------------------------------------------------
    const req2 = { headers: { 'x-branch-id': q12.id, 'x-user-id': aliceId } };
    const res2 = createMockRes();
    let next2Called = false;
    await requestContext(req2, res2, () => { next2Called = true; });

    const t2Ok = (
      res2.statusCode === 403 &&
      res2.jsonData?.error?.code === 'BRANCH_ACCESS_DENIED' &&
      next2Called === false
    );
    record(
      'Alice bị từ chối truy cập Q12 (HTTP 403 Forbidden)',
      t2Ok,
      `HTTP Status: ${res2.statusCode} | Error Code: ${res2.jsonData?.error?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Alice truy cập đúng Q1 -> Gọi next(), bơm req.ctx đầy đủ
    // -------------------------------------------------------------------------
    const req3 = { headers: { 'x-branch-id': q1.id, 'x-user-id': aliceId } };
    const res3 = createMockRes();
    let next3Called = false;
    await requestContext(req3, res3, () => { next3Called = true; });

    const t3Ok = (
      next3Called === true &&
      req3.ctx?.branchId === q1.id &&
      req3.ctx?.branch?.code === 'CN-Q1' &&
      typeof req3.ctx?.features === 'object' &&
      req3.ctx?.features?.require_shifts === true
    );
    record(
      'Alice truy cập hợp lệ Q1 -> next() được kích hoạt, req.ctx được bơm đủ cờ',
      t3Ok,
      `Branch: ${req3.ctx?.branch?.code} | req.ctx.features count: ${Object.keys(req3.ctx?.features || {}).length} | require_shifts: ${req3.ctx?.features?.require_shifts}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Bob truy cập Q12 -> req.ctx.features.allow_debt = true
    // -------------------------------------------------------------------------
    const req4 = { headers: { 'x-branch-id': q12.id, 'x-user-id': bobId } };
    const res4 = createMockRes();
    let next4Called = false;
    await requestContext(req4, res4, () => { next4Called = true; });

    const t4Ok = (
      next4Called === true &&
      req4.ctx?.branch?.code === 'CN-Q12' &&
      req4.ctx?.features?.allow_debt === true &&
      req4.ctx?.featureMeta?.allow_debt?.isOverridden === true
    );
    record(
      'Bob truy cập hợp lệ Q12 -> req.ctx chứa đúng giá trị Override riêng',
      t4Ok,
      `Branch: ${req4.ctx?.branch?.code} | allow_debt: ${req4.ctx?.features?.allow_debt} | isOverridden: ${req4.ctx?.featureMeta?.allow_debt?.isOverridden}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Boss truy cập Q1 -> Hợp lệ và có đầy đủ quyền
    // -------------------------------------------------------------------------
    const req5 = { headers: { 'x-branch-id': q1.id, 'x-user-id': bossId } };
    const res5 = createMockRes();
    let next5Called = false;
    await requestContext(req5, res5, () => { next5Called = true; });

    const t5Ok = (
      next5Called === true &&
      req5.ctx?.branchId === q1.id &&
      req5.ctx?.userId === bossId
    );
    record(
      'Boss (Chủ chuỗi) truy cập hợp lệ qua Middleware',
      t5Ok,
      `Branch: ${req5.ctx?.branch?.code} | User: ${req5.ctx?.userId}`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.1.2: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.1.2:', err);
  } finally {
    await pool.end();
  }
}

runTestStep6_1_2();
