const app = require('../server/src/index');
const { pool, query } = require('../server/src/db');

/**
 * Triển khai bản sao thuần JavaScript của MebApiClient để kiểm thử trực tiếp trong môi trường Node.js
 * (Đồng bộ 100% logic với client/src/services/api.ts)
 */
class TestMebApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.currentBranchId = null;
    this.currentUserId = '00000000-0000-0000-0000-000000000003'; // Boss
  }

  setBranchId(branchId) {
    this.currentBranchId = branchId;
  }

  getBranchId() {
    return this.currentBranchId;
  }

  setUserId(userId) {
    this.currentUserId = userId;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': this.currentUserId
    };
    if (this.currentBranchId) {
      headers['x-branch-id'] = this.currentBranchId;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const { headers: optHeaders = {}, ...rest } = options;
      const headers = {
        ...this.getHeaders(),
        ...optHeaders
      };

    const res = await fetch(url, { ...rest, headers });
    const data = await res.json();

    if (!res.ok || data.success === false) {
      const errorMsg = data.error?.message || data.message || `Lỗi HTTP ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.code = data.error?.code || 'API_ERROR';
      throw err;
    }

    return data;
  }

  async getBranches() {
    return this.request('/api/admin/branches');
  }

  async getRuntimeConfig() {
    if (!this.currentBranchId) {
      throw new Error('Chưa thiết lập branchId cho Client. Vui lòng setBranchId()');
    }
    return this.request('/api/context/runtime');
  }

  async getProducts(search) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/api/pos/products${q}`);
  }

  async getPartners(search, group) {
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (group) params.append('group', group);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/pos/partners${q}`);
  }

  async getCurrentShift() {
    return this.request('/api/pos/shifts/current');
  }

  async checkout(payload) {
    return this.request('/api/pos/checkout', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async overrideFeature(payload) {
    return this.request('/api/admin/features/override', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

async function runTestStep7_1_1() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.1: CLIENT API ADAPTER & RUNTIME CONTEXT BRIDGE');
  console.log('   Mục tiêu: Đảm bảo Client kết nối mượt mà với Backend và phản hồi cấu hình động');
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
  console.log(`🌐 Server Backend đang hoạt động tại: ${baseUrl}\n`);

  const client = new TestMebApiClient(baseUrl);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Client tải danh mục chi nhánh khi vừa mở ứng dụng
    // -------------------------------------------------------------------------
    const branchesRes = await client.getBranches();
    const branches = branchesRes.data;
    const q1 = branches.find(b => b.code === 'CN-Q1');
    const q12 = branches.find(b => b.code === 'CN-Q12');

    const t1Ok = (
      branchesRes.success === true &&
      Array.isArray(branches) &&
      branches.length >= 2 &&
      q1 !== undefined &&
      q12 !== undefined
    );
    record(
      'Client Adapter tải danh mục toàn bộ chi nhánh thành công',
      t1Ok,
      `Tổng số chi nhánh: ${branches.length} | Đã tìm thấy: ${q1?.name} & ${q12?.name}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Kích hoạt Chi nhánh 1 (Tạp hóa Q1) -> Tải Runtime Config qua Adapter
    // -------------------------------------------------------------------------
    client.setBranchId(q1.id);
    const configQ1Res = await client.getRuntimeConfig();
    const configQ1 = configQ1Res.data;

    const t2Ok = (
      configQ1Res.success === true &&
      configQ1.branch.id === q1.id &&
      configQ1.features.pos_barcode === true &&
      configQ1.features.allow_debt !== undefined
    );
    record(
      'Client kích hoạt CN-Q1: Nhận cấu hình thừa kế thời gian thực (Persona: Bách Hóa)',
      t2Ok,
      `Chi nhánh: ${configQ1.branch.name} | pos_barcode: ${configQ1.features.pos_barcode} | allow_debt: ${configQ1.features.allow_debt}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Chuyển sang Chi nhánh 2 (Vật liệu Q12) -> Nhận cấu hình khác biệt
    // -------------------------------------------------------------------------
    client.setBranchId(q12.id);
    const configQ12Res = await client.getRuntimeConfig();
    const configQ12 = configQ12Res.data;

    const t3Ok = (
      configQ12Res.success === true &&
      configQ12.branch.id === q12.id &&
      configQ12.features.allow_debt === true
    );
    record(
      'Client chuyển sang CN-Q12: Tự động đổi cấu hình sang Persona Sơn & Thép (allow_debt = true)',
      t3Ok,
      `Chi nhánh: ${configQ12.branch.name} | allow_debt: ${configQ12.features.allow_debt}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Tải danh mục hàng hóa qua Client Adapter (Độc lập tồn kho giữa Q1 và Q12)
    // -------------------------------------------------------------------------
    client.setBranchId(q1.id);
    const prodQ1Res = await client.getProducts('Tiger');
    client.setBranchId(q12.id);
    const prodQ12Res = await client.getProducts('Tiger');

    const t4Ok = (
      prodQ1Res.success === true &&
      prodQ12Res.success === true &&
      prodQ1Res.data.length > 0 &&
      prodQ12Res.data.length > 0 &&
      prodQ1Res.data[0].code === 'SP-TIGER' &&
      parseFloat(prodQ1Res.data[0].available_qty) > 0
    );
    record(
      'Client Adapter tải danh mục sản phẩm kèm tồn kho biệt lập theo chi nhánh',
      t4Ok,
      `Tồn Tiger tại Q1: ${prodQ1Res.data[0].available_qty} | Tồn Tiger tại Q12: ${prodQ12Res.data[0].available_qty}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Tải danh mục khách hàng & sổ nợ qua Client Adapter
    // -------------------------------------------------------------------------
    const partnersRes = await client.getPartners('Quan');
    const quan = partnersRes.data?.[0];
    const t5Ok = (
      partnersRes.success === true &&
      quan !== undefined &&
      quan.code === 'KH-QUAN' &&
      quan.debt_limit > 0
    );
    record(
      'Client Adapter tải hồ sơ đối tác kèm hạn mức tín dụng và công nợ',
      t5Ok,
      `Khách: ${quan?.name} | Nhóm: ${quan?.price_group} | Hạn mức: ${quan?.debt_limit}đ | Dư nợ: ${quan?.current_debt}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Bán hàng nguyên tử qua Client Adapter (POST /api/pos/checkout)
    // -------------------------------------------------------------------------
    client.setBranchId(q1.id);
    const pTiger = (await query("SELECT id FROM public.products WHERE code = 'SP-TIGER';")).rows[0].id;
    const checkoutCode = 'CLI-E2E-' + Date.now();

    const checkoutRes = await client.checkout({
      order: {
        order_code: checkoutCode,
        total_amount: 34000,
        paid_amount: 34000
      },
      items: [
        { product_id: pTiger, uom: 'Lon', conversion_rate: 1, quantity: 2, unit_price: 17000 }
      ],
      payments: [
        { payment_method: 'CASH', amount: 34000 }
      ]
    });

    const t6Ok = (
      checkoutRes.success === true &&
      checkoutRes.data?.order_code === checkoutCode
    );
    record(
      'Client Adapter đẩy đơn thanh toán POS nguyên tử thành công',
      t6Ok,
      `Mã đơn: ${checkoutRes.data?.order_code} | Tổng tiền: ${checkoutRes.data?.total_amount}đ`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Xử lý ngoại lệ chuẩn khi Client gọi thiếu Context (Bắt lỗi an toàn)
    // -------------------------------------------------------------------------
    const emptyClient = new TestMebApiClient(baseUrl);
    let errorCaught = false;
    let errorCode = '';
    try {
      await emptyClient.getRuntimeConfig();
    } catch (err) {
      errorCaught = true;
      errorCode = err.message;
    }

    const t7Ok = (errorCaught === true && errorCode.includes('Chưa thiết lập branchId'));
    record(
      'Client Adapter bắt lỗi an toàn ở tầng phía trước khi chưa chọn chi nhánh',
      t7Ok,
      `Thông điệp chặn: "${errorCode}"`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 7.1.1: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 7.1.1:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep7_1_1();
