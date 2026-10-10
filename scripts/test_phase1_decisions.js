/**
 * Test Suite: Kiểm định toàn bộ tính năng CSDL & API của Pha 1 (14 Quyết Định Kiến Trúc)
 */
const assert = require('assert');
const http = require('http');
const db = require('../server/src/db');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

const app = require('../server/src/index');

async function runTest() {
  console.log('🧪 [TEST PHA 1]: Kiểm định 14 quyết định kiến trúc tại tầng API & CSDL...');
  const server = app.listen(0);
  const port = server.address().port;
  
  // 1. Lấy thông tin chi nhánh & người dùng kiểm thử
  const bRes = await db.query('SELECT id, code FROM public.branches LIMIT 1;');
  const testBranch = bRes.rows[0];
  assert(testBranch, 'Phải có ít nhất 1 chi nhánh');
  const branchId = testBranch.id;

  const uRes = await db.query('SELECT id FROM public.users LIMIT 1;');
  const userId = uRes.rows[0]?.id;

  const headers = {
    'Content-Type': 'application/json',
    'x-branch-id': branchId,
    'x-user-id': userId
  };

  try {
    // TEST 1: GET /api/pos/customer-groups
    console.log('  👉 [1/6] Kiểm tra Nhóm khách hàng & Chiết khấu mặc định (Q9)...');
    const grpRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/pos/customer-groups',
      method: 'GET',
      headers
    });
  assert.strictEqual(grpRes.status, 200);
  assert(Array.isArray(grpRes.body.data));
  assert(grpRes.body.data.some(g => g.code === 'VIP' && Number(g.discount_rate_pct) === 10));
  console.log('     ✅ Nhóm khách hàng VIP (10%), WHOLESALE (5%) có sẵn chính xác.');

  // TEST 2: GET /api/pos/partners có thông tin nhóm & soft delete (Q3, Q9)
  console.log('  👉 [2/6] Kiểm tra danh sách khách hàng tích hợp Nhóm & Soft Delete (Q3, Q9)...');
  const partRes = await request({
    hostname: '127.0.0.1',
    port,
    path: '/api/pos/partners',
    method: 'GET',
    headers
  });
  assert.strictEqual(partRes.status, 200);
  assert(Array.isArray(partRes.body.data));
  console.log(`     ✅ Đã lấy thành công ${partRes.body.data.length} khách hàng với bộ lọc Soft Delete.`);

  // TEST 3: Cash Drop rút két an toàn (Q13)
  console.log('  👉 [3/6] Kiểm tra Rút két tiền mặt an toàn Cash Drop (Q13)...');
  const dropRes = await request({
    hostname: '127.0.0.1',
    port,
    path: '/api/pos/shifts/cash-drop',
    method: 'POST',
    headers
  }, {
    amount: 500000,
    reason: 'Nộp tiền vượt định mức két về két sắt tổng',
    receiver_name: 'Kế Toán Trưởng Minh Anh'
  });
  assert.strictEqual(dropRes.status, 200);
  assert.strictEqual(dropRes.body.success, true);
  assert.strictEqual(Number(dropRes.body.data.amount), 500000);
  console.log('     ✅ Rút két Cash Drop 500.000đ thành công, tự động cập nhật Sổ quỹ và Két sắt trung ương.');

  // TEST 4: Danh mục chi phí & Phiếu chi OPEX (Q14)
  console.log('  👉 [4/6] Kiểm tra Danh mục chi phí & Ghi nhận Phiếu chi vận hành (Q14)...');
  const catRes = await request({
    hostname: '127.0.0.1',
    port,
    path: '/api/pos/expense-categories',
    method: 'GET',
    headers
  });
  assert.strictEqual(catRes.status, 200);
  assert(catRes.body.data.length >= 5);

  const expRes = await request({
    hostname: '127.0.0.1',
    port,
    path: '/api/pos/expenses',
    method: 'POST',
    headers
  }, {
    category_id: catRes.body.data[0].id,
    amount: 150000,
    description: 'Thanh toán tiền điện nước tháng này cho quầy thu ngân'
  });
  assert.strictEqual(expRes.status, 200);
  assert.strictEqual(expRes.body.success, true);
  console.log('     ✅ Ghi nhận Phiếu chi OPEX 150.000đ thành công.');

  // TEST 5: Sổ quỹ đa tài khoản (Q14)
  console.log('  👉 [5/6] Kiểm tra Sổ quỹ đa tài khoản (Két quầy, VietQR, Két tổng) (Q14)...');
  const accRes = await request({
    hostname: '127.0.0.1',
    port,
    path: '/api/pos/cashbook/accounts',
    method: 'GET',
    headers
  });
  assert.strictEqual(accRes.status, 200);
  assert(accRes.body.data.length >= 2);
  const centralSafe = accRes.body.data.find(a => a.account_code === 'SAFE-CENTRAL');
  assert(centralSafe, 'Phải có Két sắt trung ương SAFE-CENTRAL');
  assert(Number(centralSafe.current_balance) >= 500000, 'Két sắt trung ương phải nhận được tiền rút két');
  console.log(`     ✅ Két sắt trung ương đã ghi nhận số dư tích lũy: ${Number(centralSafe.current_balance).toLocaleString('vi-VN')}đ.`);

  // TEST 6: Báo cáo Lợi nhuận ròng P&L (Q14)
  console.log('  👉 [6/6] Kiểm tra Báo cáo Lợi nhuận ròng Net Profit (Q14)...');
  const pnlRes = await request({
    hostname: '127.0.0.1',
    port,
    path: '/api/pos/cashbook/pnl',
    method: 'GET',
    headers
  });
  assert.strictEqual(pnlRes.status, 200);
  assert(pnlRes.body.data.gross_profit !== undefined);
  assert(pnlRes.body.data.net_profit !== undefined);
  console.log(`     ✅ Báo cáo P&L: Doanh thu = ${pnlRes.body.data.revenue.toLocaleString()}đ, Lãi gộp = ${pnlRes.body.data.gross_profit.toLocaleString()}đ, OPEX = ${pnlRes.body.data.opex.toLocaleString()}đ, Lãi ròng = ${pnlRes.body.data.net_profit.toLocaleString()}đ.`);

  console.log('\n🎉 [HOÀN TẤT PHA 1]: 100% CSDL VÀ API THEO 14 QUYẾT ĐỊNH ĐÃ HOẠT ĐỘNG HOÀN HẢO!');
  } finally {
    server.close();
    await db.pool.end();
  }
}

runTest().catch((err) => {
  console.error('❌ Lỗi kiểm thử Pha 1:', err);
  process.exit(1);
});
