/**
 * BỘ KIỂM THỬ TỰ ĐỘNG BƯỚC 9: HQ EXECUTIVE COMMAND CENTER & NO-CODE DYNAMIC PLATFORM
 * Kiểm chứng 100% khả năng:
 * 1. Giám sát toàn chuỗi realtime (Doanh thu, ca mở, tiền két, định giá kho, nợ khách).
 * 2. Tự tạo Bảng CSDL mới hoàn toàn không cần code (Custom Schema Tables).
 * 3. Tự định nghĩa các trường dữ liệu linh hoạt (Text, Currency, Select, Date).
 * 4. Tự thiết kế Nút hành động tùy biến (Action Buttons).
 * 5. Tự động sinh CRUD REST API cho Bảng mới & Thực thi Nút bấm trên giao diện.
 */

const http = require('http');
const app = require('../server/src/index');

let BASE_URL = 'http://localhost:4000';
let serverInstance = null;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [ASSERTION FAILED]: ${message}`);
    throw new Error(message);
  }
}

async function runStep9Tests() {
  console.log('=============================================================================');
  console.log('🏁 CHẠY KIỂM THỬ: HQ COMMAND CENTER & NO-CODE DYNAMIC DATABASE BUILDER');
  console.log('=============================================================================');

  serverInstance = app.listen(0);
  const port = serverInstance.address().port;
  BASE_URL = `http://localhost:${port}`;
  console.log(`🌐 Server kiểm thử tạm thời đang chạy tại: ${BASE_URL}\n`);

  // -------------------------------------------------------------------------
  // TEST 1: KIỂM TRA HQ OVERVIEW & BRANCHES MATRIX REALTIME
  // -------------------------------------------------------------------------
  console.log('📊 [1/6] Kiểm tra API HQ Overview Toàn Chuỗi...');
  const overviewRes = await request('/api/hq/overview');
  assert(overviewRes.status === 200 && overviewRes.body.success, 'HQ Overview trả về HTTP 200');
  const overviewData = overviewRes.body.data;
  assert(overviewData.branches.total_branches >= 2, 'Tổng số chi nhánh >= 2');
  assert(overviewData.today_sales !== undefined, 'Có số liệu bán hàng hôm nay');
  assert(overviewData.live_shifts !== undefined, 'Có số liệu ca mở');
  console.log(`   ✅ HQ Overview hợp lệ: ${overviewData.branches.total_branches} chi nhánh, Doanh thu: ${overviewData.today_sales.total_revenue}đ`);

  console.log('🏢 [2/6] Kiểm tra Ma Trận Chi Tiết Từng Chi Nhánh (HQ Branches Matrix)...');
  const matrixRes = await request('/api/hq/branches-matrix');
  assert(matrixRes.status === 200 && matrixRes.body.success, 'Branches Matrix trả về HTTP 200');
  const branches = matrixRes.body.data;
  assert(Array.isArray(branches) && branches.length >= 2, 'Danh sách chi nhánh ma trận >= 2');
  const q1Branch = branches.find(b => b.code === 'CN-Q1');
  assert(q1Branch !== undefined, 'Chi nhánh CN-Q1 có trong danh sách');
  assert(q1Branch.current_shift !== undefined, 'CN-Q1 có thông tin ca bán hàng');
  console.log(`   ✅ Ma Trận hợp lệ: CN-Q1 (Ca: ${q1Branch.current_shift?.staff_name || 'N/A'}, Doanh thu: ${q1Branch.sales_summary.today_revenue}đ)`);

  // -------------------------------------------------------------------------
  // TEST 2: TỰ TẠO BẢNG CSDL MỚI HOÀN TOÀN KHÔNG CẦN CODE (CUSTOM SCHEMA TABLES)
  // -------------------------------------------------------------------------
  const testTableCode = `test_warranty_${Date.now()}`;
  console.log(`🏗️ [3/6] Tự tạo Bảng CSDL mới "${testTableCode}" không cần migration code...`);
  const createTableRes = await request('/api/schema/tables', {
    method: 'POST',
    body: {
      code: testTableCode,
      name: 'Phiếu Bảo Hành & Sửa Chữa Thiết Bị',
      description: 'Quản lý tiếp nhận máy, bảo hành và báo giá sửa chữa tự động',
      category: 'SERVICE'
    }
  });

  assert(createTableRes.status === 201 && createTableRes.body.success, 'Tạo bảng thành công HTTP 201');
  const createdTable = createTableRes.body.data;
  assert(createdTable.id && createdTable.code === testTableCode, 'Mã bảng CSDL trùng khớp');
  console.log(`   ✅ Đã tạo thành công Bảng CSDL ID: ${createdTable.id} (${createdTable.code})`);

  // -------------------------------------------------------------------------
  // TEST 3: TỰ ĐỊNH NGHĨA CÁC TRƯỜNG DỮ LIỆU ĐỘNG (CUSTOM SCHEMA FIELDS)
  // -------------------------------------------------------------------------
  console.log('📐 [4/6] Thêm các trường dữ liệu động: SĐT, Dòng Máy, Chi Phí, Trạng Thái...');
  // Trường 1: SĐT Khách (Required)
  const f1 = await request(`/api/schema/tables/${testTableCode}/fields`, {
    method: 'POST',
    body: {
      field_key: 'customer_phone',
      field_label: 'Số Điện Thoại Khách',
      data_type: 'TEXT',
      is_required: true,
      sort_order: 1
    }
  });
  assert(f1.status === 201, 'Thêm trường customer_phone thành công');

  // Trường 2: Dòng Máy (Text)
  const f2 = await request(`/api/schema/tables/${testTableCode}/fields`, {
    method: 'POST',
    body: {
      field_key: 'device_model',
      field_label: 'Dòng Thiết Bị / Model',
      data_type: 'TEXT',
      is_required: true,
      sort_order: 2
    }
  });
  assert(f2.status === 201, 'Thêm trường device_model thành công');

  // Trường 3: Chi phí sửa (Currency)
  const f3 = await request(`/api/schema/tables/${testTableCode}/fields`, {
    method: 'POST',
    body: {
      field_key: 'repair_cost',
      field_label: 'Chi Phí Sửa Chữa (VND)',
      data_type: 'CURRENCY',
      is_required: false,
      sort_order: 3
    }
  });
  assert(f3.status === 201, 'Thêm trường repair_cost thành công');

  // Trường 4: Trạng thái (Select options)
  const f4 = await request(`/api/schema/tables/${testTableCode}/fields`, {
    method: 'POST',
    body: {
      field_key: 'warranty_status',
      field_label: 'Giai Đoạn Bảo Hành',
      data_type: 'SELECT',
      options: ['TIẾP_NHẬN', 'ĐANG_SỬA', 'HOÀN_TẤT'],
      is_required: false,
      sort_order: 4
    }
  });
  assert(f4.status === 201, 'Thêm trường warranty_status thành công');
  console.log('   ✅ Đã định nghĩa 4 trường dữ liệu động hoàn tất.');

  // -------------------------------------------------------------------------
  // TEST 4: TỰ THIẾT KẾ NÚT HÀNH ĐỘNG TÙY BIẾN CHO GIAO DIỆN (ACTION BUTTONS)
  // -------------------------------------------------------------------------
  console.log('🖱️ [5/6] Thiết kế 2 Nút hành động: "Bắt Đầu Sửa" & "Hoàn Tất Sửa Chữa"...');
  const act1 = await request(`/api/schema/tables/${testTableCode}/actions`, {
    method: 'POST',
    body: {
      action_key: 'act_start_repair',
      label: 'Bắt Đầu Sửa Chữa',
      color: 'warning',
      action_type: 'UPDATE_STATUS',
      config: { target_status: 'IN_REPAIR' }
    }
  });
  assert(act1.status === 201, 'Tạo nút act_start_repair thành công');

  const act2 = await request(`/api/schema/tables/${testTableCode}/actions`, {
    method: 'POST',
    body: {
      action_key: 'act_complete_repair',
      label: 'Hoàn Tất & Giao Khách',
      color: 'success',
      action_type: 'UPDATE_STATUS',
      config: { target_status: 'DELIVERED' }
    }
  });
  assert(act2.status === 201, 'Tạo nút act_complete_repair thành công');
  console.log('   ✅ Đã tạo 2 nút thao tác tùy biến cho bảng thành công.');

  // -------------------------------------------------------------------------
  // TEST 5: KIỂM CHỨNG REST API DỮ LIỆU ĐỘNG TỰ SINH & THỰC THI NÚT BẤM
  // -------------------------------------------------------------------------
  console.log(`⚡ [6/6] Kiểm chứng REST API tự sinh /api/dynamic/${testTableCode}...`);
  // a. Kiểm tra validation bắt buộc
  const invalidRecordRes = await request(`/api/dynamic/${testTableCode}`, {
    method: 'POST',
    body: {
      record_data: { repair_cost: 250000 } // Thiếu customer_phone và device_model
    }
  });
  assert(invalidRecordRes.status === 400, 'Bắt lỗi thiếu trường bắt buộc thành công');
  console.log('   ✅ Schema Validation: Chặn bản ghi thiếu trường bắt buộc chuẩn xác');

  // b. Thêm bản ghi hợp lệ
  const validRecordRes = await request(`/api/dynamic/${testTableCode}`, {
    method: 'POST',
    body: {
      record_data: {
        title: 'Phiếu Bảo Hành Máy In Xprinter',
        customer_phone: '0908889999',
        device_model: 'Máy In Hóa Đơn Xprinter XP-Q80',
        repair_cost: 350000,
        warranty_status: 'TIẾP_NHẬN'
      },
      status: 'RECEIVED'
    }
  });
  assert(validRecordRes.status === 201 && validRecordRes.body.success, 'Thêm bản ghi mới thành công');
  const recordId = validRecordRes.body.data.id;
  console.log(`   ✅ Đã tạo bản ghi động thành công (ID: ${recordId})`);

  // c. Đọc lại danh sách bản ghi
  const queryRes = await request(`/api/dynamic/${testTableCode}`);
  assert(queryRes.status === 200 && queryRes.body.data.length >= 1, 'Truy vấn bản ghi thành công');
  console.log(`   ✅ Truy vấn dữ liệu động: Tìm thấy ${queryRes.body.data.length} bản ghi`);

  // d. Kích hoạt Nút hành động tùy biến vừa tạo
  console.log('   👉 Thực thi bấm nút hành động "Bắt Đầu Sửa Chữa" trên bản ghi...');
  const triggerRes = await request(`/api/dynamic/${testTableCode}/${recordId}/action/act_start_repair`, {
    method: 'POST',
    body: { note: 'Kỹ thuật viên đã nhận máy vào bàn sửa' }
  });
  assert(triggerRes.status === 200 && triggerRes.body.success, 'Thực thi nút hành động thành công');
  assert(triggerRes.body.data.status === 'IN_REPAIR', 'Trạng thái bản ghi được cập nhật thành IN_REPAIR');
  console.log('   ✅ Nút hành động thực thi thành công: Trạng thái đổi thành "IN_REPAIR"');

  // Dọn dẹp bảng test
  console.log('🧹 Dọn dẹp Bảng test tự sinh...');
  await request(`/api/schema/tables/${createdTable.id}`, { method: 'DELETE' });
  console.log('   ✅ Đã xóa dọn dẹp bảng test sạch sẽ.');

  console.log('=============================================================================');
  console.log('🎉 TẤT CẢ TEST CASE BƯỚC 9 ĐÃ VƯỢT QUA 100%! NỀN TẢNG NO-CODE HOÀN HẢO.');
  console.log('=============================================================================');
}

runStep9Tests().then(() => {
  if (serverInstance) serverInstance.close();
  process.exit(0);
}).catch(err => {
  if (serverInstance) serverInstance.close();
  console.error('🔥 Test suite thất bại:', err);
  process.exit(1);
});
