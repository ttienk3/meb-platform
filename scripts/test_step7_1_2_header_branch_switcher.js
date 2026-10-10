const app = require('../server/src/index');
const { pool } = require('../server/src/db');

/**
 * Bản sao Node.js của branchStore để kiểm thử luồng hoạt động của Header
 */
class TestBranchContextStore {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.currentBranch = null;
    this.currentConfig = null;
    this.branches = [];
    this.listeners = new Set();
    this.currentUserId = '00000000-0000-0000-0000-000000000003';
  }

  subscribe(listener) {
    this.listeners.add(listener);
    if (this.currentConfig && this.currentBranch) {
      listener(this.currentConfig, this.currentBranch);
    }
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    const res = await fetch(`${this.baseUrl}/api/admin/branches`);
    const data = await res.json();
    this.branches = data.data || [];
    if (this.branches.length === 0) throw new Error('Không có chi nhánh');
    return this.switchBranch(this.branches[0].id);
  }

  async switchBranch(branchId) {
    const branch = this.branches.find(b => b.id === branchId);
    if (!branch) throw new Error(`Chi nhánh ${branchId} không tồn tại`);

    const res = await fetch(`${this.baseUrl}/api/context/runtime`, {
      headers: {
        'x-branch-id': branchId,
        'x-user-id': this.currentUserId
      }
    });
    const configData = await res.json();
    this.currentBranch = branch;
    this.currentConfig = configData.data;

    this.notify();
    return { branch: this.currentBranch, config: this.currentConfig };
  }

  async reloadConfig() {
    if (!this.currentBranch) throw new Error('Chưa chọn chi nhánh');
    const res = await fetch(`${this.baseUrl}/api/context/runtime`, {
      headers: {
        'x-branch-id': this.currentBranch.id,
        'x-user-id': this.currentUserId
      }
    });
    const configData = await res.json();
    this.currentConfig = configData.data;
    this.notify();
    return this.currentConfig;
  }

  notify() {
    for (const l of this.listeners) {
      l(this.currentConfig, this.currentBranch);
    }
  }
}

async function runTestStep7_1_2() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.1.2: HEADER THANH ĐIỀU HƯỚNG & TRẠNG THÁI CA TRỰC');
  console.log('   Mục tiêu: Đảm bảo chuyển đổi chi nhánh mượt mà, phản ứng Persona tức thì');
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

  const store = new TestBranchContextStore(baseUrl);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Khởi tạo store ban đầu -> Tự động nạp chi nhánh mặc định
    // -------------------------------------------------------------------------
    const initRes = await store.initialize();
    const t1Ok = (
      initRes.branch !== null &&
      initRes.config !== null &&
      store.branches.length >= 2
    );
    record(
      'Khởi tạo store ban đầu: Tự động nạp danh sách chi nhánh và chọn mặc định',
      t1Ok,
      `Chi nhánh mặc định: ${initRes.branch?.name} (${initRes.branch?.code})`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Đăng ký Subscriber lắng nghe sự kiện đổi chi nhánh
    // -------------------------------------------------------------------------
    let receivedBranch = null;
    let receivedConfig = null;
    let eventCount = 0;

    store.subscribe((config, branch) => {
      eventCount++;
      receivedBranch = branch;
      receivedConfig = config;
    });

    const t2Ok = (eventCount === 1 && receivedBranch?.id === initRes.branch.id);
    record(
      'Cơ chế Reactive Subscriber: Component Header nhận ngay dữ liệu khi mount',
      t2Ok,
      `Đã phát sự kiện: ${eventCount} lần | Chi nhánh nhận được: ${receivedBranch?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Chuyển đổi sang Chi nhánh 2 (CN-Q12: Tiệm Sơn & Vật Liệu)
    // -------------------------------------------------------------------------
    const q12 = store.branches.find(b => b.code === 'CN-Q12');
    await store.switchBranch(q12.id);

    const isTradePersona = receivedConfig?.features?.allow_debt === true;
    const t3Ok = (
      receivedBranch?.code === 'CN-Q12' &&
      isTradePersona === true
    );
    record(
      'Chuyển chi nhánh sang CN-Q12: Persona tự động đổi sang Tiệm Sơn & Thép (allow_debt = true)',
      t3Ok,
      `Chi nhánh hiện tại: ${receivedBranch?.name} | Sổ nợ: ${receivedConfig?.features?.allow_debt}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Chuyển ngược lại Chi nhánh 1 (CN-Q1: Bách Hóa & Tạp Hóa)
    // -------------------------------------------------------------------------
    const q1 = store.branches.find(b => b.code === 'CN-Q1');
    await store.switchBranch(q1.id);

    const hasBarcode = receivedConfig?.features?.pos_barcode === true;
    const t4Ok = (
      receivedBranch?.code === 'CN-Q1' &&
      hasBarcode === true
    );
    record(
      'Chuyển chi nhánh sang CN-Q1: Persona tự động đổi sang Bách Hóa (pos_barcode = true)',
      t4Ok,
      `Chi nhánh hiện tại: ${receivedBranch?.name} | Quét Barcode: ${hasBarcode}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Đồng bộ trạng thái ca bán hàng theo từng chi nhánh qua API
    // -------------------------------------------------------------------------
    const shiftRes = await fetch(`${baseUrl}/api/pos/shifts/current`, {
      headers: {
        'x-branch-id': q1.id,
        'x-user-id': store.currentUserId
      }
    });
    const shiftData = await shiftRes.json();
    const t5Ok = (shiftRes.status === 200 && shiftData.success === true);
    record(
      'Header đồng bộ trạng thái ca trực (Shift Info) từ backend thành công',
      t5Ok,
      `HTTP Status: ${shiftRes.status} | Trạng thái ca: ${shiftData.data ? 'Đang mở' : 'Chưa mở'}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Bắt lỗi an toàn khi chọn chi nhánh không tồn tại
    // -------------------------------------------------------------------------
    let invalidCaught = false;
    try {
      await store.switchBranch('00000000-0000-0000-0000-000000000000');
    } catch {
      invalidCaught = true;
    }
    const t6Ok = (invalidCaught === true);
    record(
      'Chặn đứng chuyển đổi sang chi nhánh không hợp lệ (Safety Guard)',
      t6Ok,
      `Bắt lỗi thành công: true`
    );

    console.log('\n=============================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC 7.1.2: ${passed} / ${total} CA KIỂM ĐỊNH THÀNH CÔNG!`);
    console.log('=============================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG BƯỚC 7.1.2:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

runTestStep7_1_2();
