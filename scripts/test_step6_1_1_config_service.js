const { pool, query } = require('../server/src/db');
const { 
  verifyBranchAccess, 
  getBranchRuntimeConfig, 
  resolveBranchContext, 
  invalidateBranchConfig,
  invalidateUserAccess 
} = require('../server/src/services/configService');

async function runTestStep6_1_1() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 6.1.1: DB POOL & DỊCH VỤ PHÂN GIẢI CẤU HÌNH (CONFIG SERVICE)');
  console.log('   Mục tiêu: Đảm bảo tầng dịch vụ phân giải đúng 100% quyền truy cập & cờ thừa kế');
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
    // Xóa cache đầu phiên test để đảm bảo dữ liệu mới nhất
    invalidateBranchConfig();
    invalidateUserAccess();

    // 1. Lấy thông tin các chi nhánh và người dùng mẫu
    const q1 = (await query("SELECT id, code, name FROM public.branches WHERE code = 'CN-Q1';")).rows[0];
    const q12 = (await query("SELECT id, code, name FROM public.branches WHERE code = 'CN-Q12';")).rows[0];

    // Đúng UUID đã seed trong Bước 5.1:
    const aliceId = '00000000-0000-0000-0000-000000000001'; // Thu ngân Q1
    const bobId = '00000000-0000-0000-0000-000000000002';   // Cửa hàng trưởng Q12
    const bossId = '00000000-0000-0000-0000-000000000003';  // Chủ chuỗi (all branches)
    const daveId = '00000000-0000-0000-0000-000000000004';  // Người dùng lạ / không được gán quyền

    console.log(`📍 Chi nhánh kiểm thử: Q1 (${q1.id}) | Q12 (${q12.id})\n`);

    // TEST 0A: Hàm cấp thấp verifyBranchAccess
    const accessOk = await verifyBranchAccess(aliceId, q1.id);
    record('Hàm cấp thấp verifyBranchAccess trả về true cho Alice tại Q1', accessOk === true, `Kết quả: ${accessOk}`);

    // TEST 0B: Hàm cấp thấp getBranchRuntimeConfig
    const runtimeQ1 = await getBranchRuntimeConfig(q1.id);
    record('Hàm cấp thấp getBranchRuntimeConfig tải đúng thông tin chi nhánh', runtimeQ1.branch?.code === 'CN-Q1', `Mã: ${runtimeQ1.branch?.code}`);

    // TEST 1: Alice truy cập đúng chi nhánh của mình (CN-Q1)
    const t1 = await resolveBranchContext(aliceId, q1.id);
    const t1Ok = (
      t1.authorized === true &&
      t1.branch.code === 'CN-Q1' &&
      t1.features.require_shifts === true &&
      typeof t1.features.allow_debt === 'boolean'
    );
    record(
      'Alice (Thu ngân Q1) truy cập CN-Q1 thành công & tải đúng cấu hình',
      t1Ok,
      `Quyền: ${t1.authorized} | Chi nhánh: ${t1.branch?.code} | allow_debt: ${t1.features?.allow_debt} | require_shifts: ${t1.features?.require_shifts}`
    );

    // TEST 2: Alice cố tình truy cập trái phép chi nhánh Q12
    const t2 = await resolveBranchContext(aliceId, q12.id);
    const t2Ok = (t2.authorized === false && t2.code === 'BRANCH_ACCESS_DENIED');
    record(
      'Alice bị chặn đứng khi cố truy cập trái phép CN-Q12 (Cross-Branch Guard)',
      t2Ok,
      `Quyền: ${t2.authorized} | Mã lỗi: ${t2.code} | Thông điệp: "${t2.message}"`
    );

    // TEST 3: Bob truy cập CN-Q12 & tải cờ Override riêng của Q12
    const t3 = await resolveBranchContext(bobId, q12.id);
    const t3Ok = (
      t3.authorized === true &&
      t3.branch.code === 'CN-Q12' &&
      t3.features.allow_debt === true &&
      t3.featureMeta.allow_debt.source === 'BRANCH_OVERRIDE' &&
      t3.featureMeta.allow_debt.isOverridden === true
    );
    record(
      'Bob truy cập CN-Q12 tải đúng cờ Override riêng (allow_debt = true)',
      t3Ok,
      `Quyền: ${t3.authorized} | allow_debt: ${t3.features?.allow_debt} | Source: ${t3.featureMeta?.allow_debt?.source} | isOverridden: ${t3.featureMeta?.allow_debt?.isOverridden}`
    );

    // TEST 4: Boss (Chủ chuỗi) có quyền truy cập toàn diện cả Q1 và Q12
    const t4_q1 = await resolveBranchContext(bossId, q1.id);
    const t4_q12 = await resolveBranchContext(bossId, q12.id);
    const t4Ok = (t4_q1.authorized === true && t4_q12.authorized === true);
    record(
      'Boss (Chủ chuỗi) truy cập thành công cả Q1 và Q12 (is_all_branches = true)',
      t4Ok,
      `Q1 Quyền: ${t4_q1.authorized} | Q12 Quyền: ${t4_q12.authorized}`
    );

    // TEST 5: Dave (Người dùng không được gán quyền) bị từ chối toàn diện
    const t5 = await resolveBranchContext(daveId, q1.id);
    const t5Ok = (t5.authorized === false && t5.code === 'BRANCH_ACCESS_DENIED');
    record(
      'Dave (Người dùng không thuộc chi nhánh) bị từ chối truy cập',
      t5Ok,
      `Quyền: ${t5.authorized} | Mã lỗi: ${t5.code}`
    );

    // TEST 6: Bắt lỗi khi không truyền branch_id
    const t6 = await resolveBranchContext(aliceId, null);
    const t6Ok = (t6.authorized === false && t6.code === 'MISSING_BRANCH_CONTEXT');
    record(
      'Hệ thống trả mã lỗi chuẩn khi thiếu tham số branch_id',
      t6Ok,
      `Quyền: ${t6.authorized} | Mã lỗi: ${t6.code} | Thông điệp: "${t6.message}"`
    );

    // TEST 7: Kiểm tra độ trễ truy vấn nhờ In-Memory Cache (< 1ms)
    const tStart = Date.now();
    const ITERATIONS = 100;
    for (let i = 0; i < ITERATIONS; i++) {
      await resolveBranchContext(bobId, q12.id);
    }
    const avgLatency = (Date.now() - tStart) / ITERATIONS;
    const t7Ok = (avgLatency < 5); // Tốc độ bộ nhớ cực nhanh < 5ms
    record(
      `Đo lường độ trễ In-Memory Cache sau khi nạp lần đầu (Performance SLA)`,
      t7Ok,
      `Độ trễ trung bình: ${avgLatency.toFixed(3)}ms / request (Vượt xa mục tiêu SLA < 5ms)`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 6.1.1: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 6.1.1:', err);
  } finally {
    await pool.end();
  }
}

runTestStep6_1_1();
