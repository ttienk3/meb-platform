/**
 * TEST SUITE 7.3: TẠO THÊM CHI NHÁNH MỚI & KHỞI TẠO PERSONA NGHIỆP VỤ ĐỘC LẬP
 * Kiểm chứng tính năng mở rộng chuỗi đa chi nhánh theo thời gian thực (Zero-Restart)
 */

const app = require('../server/src/index');
const http = require('http');
const { query } = require('../server/src/db');

let server;
let serverPort;

function request(path, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: serverPort,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      method: options.method || 'GET'
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function runStep7_3Tests() {
  server = app.listen(0);
  serverPort = server.address().port;
  console.log('===============================================================');
  console.log(`🚀 BẮT ĐẦU TEST BƯỚC 7.3 (PORT: ${serverPort}): TẠO CHI NHÁNH MỚI & KHỞI TẠO PERSONA`);
  console.log('===============================================================');

  let passed = 0;
  let total = 0;
  let createdBranchId = null;
  const testCode = 'CN-TEST-' + Date.now().toString().slice(-4);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Chặn tạo chi nhánh thiếu dữ liệu bắt buộc (code, name)
    // -------------------------------------------------------------------------
    total++;
    console.log('\n▶ [Test 1] Kiểm tra validation khi thiếu mã hoặc tên chi nhánh:');
    const res1 = await request('/api/admin/branches', { method: 'POST' }, {
      code: '',
      name: 'Chi Nhánh Thiếu Mã'
    });

    if (res1.status === 400 && res1.data?.error?.code === 'INVALID_INPUT') {
      console.log('  ✅ PASS: Server từ chối đúng quy chuẩn khi thiếu mã chi nhánh');
      passed++;
    } else {
      console.error('  ❌ FAIL: Kỳ vọng status 400 INVALID_INPUT, nhận được:', res1);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Tạo thành công chi nhánh mới với Persona CONTRACTOR
    // -------------------------------------------------------------------------
    total++;
    console.log(`\n▶ [Test 2] Tạo chi nhánh mới (${testCode}) với Persona CONTRACTOR (Vật liệu, nợ gối đầu):`);
    const res2 = await request('/api/admin/branches', { method: 'POST' }, {
      code: testCode,
      name: `Chi Nhánh Thử Nghiệm ${testCode}`,
      phone: '0988776655',
      address: '789 Đường Test Mở Rộng, TP.HCM',
      persona_type: 'CONTRACTOR'
    });

    if (res2.status === 201 && res2.data?.success && res2.data?.data?.id) {
      createdBranchId = res2.data.data.id;
      console.log(`  ✅ PASS: Tạo thành công chi nhánh mới. ID: ${createdBranchId}`);
      passed++;
    } else {
      console.error('  ❌ FAIL: Tạo chi nhánh thất bại:', res2);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Chặn tạo trùng mã chi nhánh (DUPLICATE_BRANCH_CODE)
    // -------------------------------------------------------------------------
    total++;
    console.log(`\n▶ [Test 3] Kiểm tra chặn tạo trùng mã chi nhánh (${testCode}):`);
    const res3 = await request('/api/admin/branches', { method: 'POST' }, {
      code: testCode,
      name: 'Chi Nhánh Trùng Mã',
      persona_type: 'RETAIL'
    });

    if (res3.status === 400 && res3.data?.error?.code === 'DUPLICATE_BRANCH_CODE') {
      console.log('  ✅ PASS: Server chặn đứng việc tạo trùng mã chi nhánh (DUPLICATE_BRANCH_CODE)');
      passed++;
    } else {
      console.error('  ❌ FAIL: Không chặn được mã trùng:', res3);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Kiểm tra tồn kho inventory được tự động cấp phát cho chi nhánh mới
    // -------------------------------------------------------------------------
    total++;
    console.log('\n▶ [Test 4] Kiểm tra kho hàng khởi tạo (inventory) cho chi nhánh mới:');
    const invCheck = await query(
      'SELECT count(*) as total_items FROM public.inventory WHERE branch_id = $1::uuid;',
      [createdBranchId]
    );
    const totalItems = parseInt(invCheck.rows[0]?.total_items || '0', 10);

    if (totalItems > 0) {
      console.log(`  ✅ PASS: Tự động cấp phát tồn kho khởi tạo cho ${totalItems} sản phẩm`);
      passed++;
    } else {
      console.error('  ❌ FAIL: Chi nhánh mới không có bản ghi inventory nào!');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Kiểm tra Runtime Config kế thừa đúng Persona CONTRACTOR của chi nhánh mới
    // -------------------------------------------------------------------------
    total++;
    console.log('\n▶ [Test 5] Kiểm tra Runtime Config của chi nhánh mới (x-branch-id):');
    const res5 = await request('/api/context/runtime', {
      method: 'GET',
      headers: { 'x-branch-id': createdBranchId }
    });

    if (
      res5.status === 200 &&
      res5.data?.success &&
      res5.data?.data?.branch?.code === testCode &&
      res5.data?.data?.features?.allow_debt === true
    ) {
      console.log(`  ✅ PASS: Chi nhánh mới kế thừa chuẩn xác Persona CONTRACTOR (allow_debt = true)`);
      passed++;
    } else {
      console.error('  ❌ FAIL: Runtime Config của chi nhánh mới không đúng:', res5);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Kiểm tra chi nhánh mới xuất hiện trong danh sách GET /api/admin/branches
    // -------------------------------------------------------------------------
    total++;
    console.log('\n▶ [Test 6] Kiểm tra danh sách chi nhánh (GET /api/admin/branches):');
    const res6 = await request('/api/admin/branches', { method: 'GET' });
    const found = res6.data?.data?.find(b => b.id === createdBranchId);

    if (res6.status === 200 && found) {
      console.log(`  ✅ PASS: Chi nhánh mới xuất hiện ngay lập tức trong danh sách API (${found.name})`);
      passed++;
    } else {
      console.error('  ❌ FAIL: Chi nhánh mới không có trong danh sách:', res6);
    }

  } catch (err) {
    console.error('🔥 Lỗi nghiêm trọng khi chạy Test Bước 7.3:', err);
  } finally {
    // Dọn dẹp chi nhánh test để không để lại rác dữ liệu
    if (createdBranchId) {
      try {
        await query('DELETE FROM public.inventory WHERE branch_id = $1::uuid;', [createdBranchId]);
        await query('DELETE FROM public.branch_feature_overrides WHERE branch_id = $1::uuid;', [createdBranchId]);
        await query('DELETE FROM public.config_audit_logs WHERE branch_id = $1::uuid;', [createdBranchId]);
        await query('DELETE FROM public.branches WHERE id = $1::uuid;', [createdBranchId]);
        console.log(`\n🧹 [Dọn dẹp]: Đã xóa sạch dữ liệu test của chi nhánh ${createdBranchId}`);
      } catch (cleanErr) {
        console.warn('⚠️ Cảnh báo dọn dẹp:', cleanErr.message);
      }
    }
    if (server) {
      server.close();
    }
  }

  console.log('\n---------------------------------------------------------------');
  console.log(`🎯 KẾT QUẢ TEST BƯỚC 7.3: ${passed}/${total} TEST CASES PASS (${Math.round(passed/total*100)}%)`);
  console.log('---------------------------------------------------------------');

  if (passed !== total) {
    process.exit(1);
  }
}

runStep7_3Tests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
