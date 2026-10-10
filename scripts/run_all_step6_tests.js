const { execSync } = require('child_process');

const tests = [
  { step: '6.1.1', file: 'scripts/test_step6_1_1_config_service.js', name: 'Postgres Pool & In-Memory TTL Cache Engine' },
  { step: '6.1.2', file: 'scripts/test_step6_1_2_middleware.js', name: 'Dynamic Request Context & Header Security Guard' },
  { step: '6.1.3', file: 'scripts/test_step6_1_3_api_server.js', name: 'Express API Server & Runtime Config Endpoints' },
  { step: '6.2.1', file: 'scripts/test_step6_2_1_pos_data.js', name: 'POS Catalog & Partners Isolated by Branch' },
  { step: '6.2.2', file: 'scripts/test_step6_2_2_shifts.js', name: 'POS Shift Management & F8 Cash Drawer Reconciliation' },
  { step: '6.2.3', file: 'scripts/test_step6_2_3_admin_features.js', name: 'Admin No-Code Feature Registry & Override Guard' },
  { step: '6.2.4', file: 'scripts/test_step6_2_4_pos_checkout_e2e.js', name: 'Atomic POS Checkout via HTTP Gateway' },
  { step: '6.2.5', file: 'scripts/test_step6_2_5_debt_and_orders.js', name: 'Debt Collection F3 & Recent Orders API' },
  { step: '6.2.6', file: 'scripts/test_step6_2_6_admin_branches_and_audit.js', name: 'Admin Branches Directory & Config Audit Logs' },
  { step: '6.2.7', file: 'scripts/test_step6_2_7_stock_transfers.js', name: 'Two-Phase Stock Transfer (Pending -> In-Transit -> Loss)' },
  { step: '7.1.1', file: 'scripts/test_step7_1_1_client_adapter_integration.js', name: 'Client API Adapter & Runtime Context Bridge' },
  { step: '7.1.2', file: 'scripts/test_step7_1_2_header_branch_switcher.js', name: 'Header Dynamic Branch Switcher & Persona Indicator' },
  { step: '7.1.3a', file: 'scripts/test_step7_1_3a_product_catalog.js', name: 'Product Catalog Bento Block & Barcode Scanner' },
  { step: '7.1.3b', file: 'scripts/test_step7_1_3b_cart_checkout.js', name: 'Cart Multi-UoM, Customer Debt & F9 Atomic Checkout' },
  { step: '7.1.4', file: 'scripts/test_step7_1_4_shift_modal.js', name: 'Shift Management & Cash Drawer Reconciliation F8' },
  { step: '7.1.5', file: 'scripts/test_step7_1_5_customer_debt.js', name: 'Customer Debt Ledger & F3 Collection Bento Tab' },
  { step: '7.1.6', file: 'scripts/test_step7_1_6_stock_transfer.js', name: 'Stock Transfer Two-Phase (INV-06) Bento Tab' },
  { step: '7.1.7', file: 'scripts/test_step7_1_7_studio_features.js', name: 'No-Code Studio & Dynamic Feature Flags Bento Tab' },
  { step: '7.2', file: 'scripts/test_step7_2_pwa_desktop.js', name: 'PWA Desktop App Packaging, Manifest & Offline SW' },
  { step: '7.3', file: 'scripts/test_step7_3_multi_branch_creation.js', name: 'Zero-Touch Multi-Branch Creation & Persona Onboarding' },
  { step: '8.0', file: 'scripts/test_step8_inbound_return_audit.js', name: 'Purchase Inbound, RMA Returns (INV-07) & Stocktake Audit (INV-10)' },
  { step: '9.0', file: 'scripts/test_step9_hq_nocode_dynamic_platform.js', name: 'HQ Command Center & No-Code Dynamic Entity Platform' }
];

console.log('=============================================================================');
console.log('🏁 CHẠY TOÀN BỘ SUITE KIỂM THỬ HỆ THỐNG (TỪ 6.1.1 ĐẾN 9.0)');
console.log('   Mục tiêu: Đảm bảo 100% tính năng backend & giao diện Client tích hợp hoàn hảo');
console.log('=============================================================================\n');

let allPassed = true;
const summary = [];

for (const t of tests) {
  process.stdout.write(`⏳ Đang chạy [Bước ${t.step}] ${t.name}... `);
  try {
    const out = execSync(`node "${t.file}"`, { stdio: 'pipe' }).toString();
    const hasFail = out.includes('❌ [THẤT BẠI]') || out.includes('❌ LỖI') || out.includes('❌ FAIL');
    const isSuccess = (out.includes('CA KIỂM ĐỊNH THÀNH CÔNG!') || out.includes('100%') || out.includes('PASS')) && !hasFail;
    if (isSuccess) {
      console.log('✅ ĐẠT 100%');
      summary.push({ step: t.step, name: t.name, status: 'PASSED' });
    } else {
      allPassed = false;
      console.log('❌ THẤT BẠI');
      summary.push({ step: t.step, name: t.name, status: 'FAILED' });
    }
  } catch (err) {
    allPassed = false;
    console.log('❌ LỖI EXCEPTION');
    summary.push({ step: t.step, name: t.name, status: 'ERROR', error: err.message });
  }
}

console.log('\n=============================================================================');
console.log('📊 BẢNG TỔNG KẾT TOÀN BỘ CÁC BƯỚC KIỂM ĐỊNH BƯỚC 6:');
console.log('=============================================================================');
summary.forEach(s => {
  const icon = s.status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} [Bước ${s.step}] ${s.name.padEnd(55)}: ${s.status}`);
});
console.log('=============================================================================');

if (allPassed) {
  console.log('🎉 TẤT CẢ 10 BỘ TEST VI MÔ ĐÃ PASS 100%! HỆ THỐNG SẴN SÀNG VÀ CHUẨN XÁC.');
  process.exit(0);
} else {
  console.log('⚠️ CÒN BƯỚC BỊ LỖI, CẦN SỬA CHỮA NGAY!');
  process.exit(1);
}
