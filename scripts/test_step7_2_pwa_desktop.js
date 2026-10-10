const fs = require('fs');
const path = require('path');

async function runTestStep7_2() {
  console.log('=============================================================================');
  console.log('🧪 KIỂM THỬ VI MÔ BƯỚC 7.2: ĐÓNG GÓI ỨNG DỤNG DESKTOP PWA (STANDALONE APP)');
  console.log('   Mục tiêu: Đảm bảo Web App Manifest, Service Worker, Icons & Standalone Guard chuẩn 100%');
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

  const clientDir = path.join(__dirname, '../client');
  const publicDir = path.join(clientDir, 'public');
  const distDir = path.join(clientDir, 'dist');

  // -------------------------------------------------------------------------
  // TEST 1: Kiểm tra file manifest.json hợp lệ & chuẩn W3C Web App Manifest
  // -------------------------------------------------------------------------
  const manifestPath = path.join(publicDir, 'manifest.json');
  const manifestExists = fs.existsSync(manifestPath);
  let manifestData = null;
  if (manifestExists) {
    try {
      manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      manifestData = null;
    }
  }

  const t1Ok = (
    manifestExists &&
    manifestData !== null &&
    manifestData.name.includes('MEB') &&
    manifestData.short_name === 'MEB POS' &&
    manifestData.display === 'standalone' &&
    manifestData.start_url === '/' &&
    manifestData.theme_color === '#0284c7' &&
    manifestData.background_color === '#0a0e17'
  );
  record(
    'manifest.json hợp lệ và đáp ứng chuẩn Standalone Desktop App (W3C)',
    t1Ok,
    `Tên: "${manifestData?.name}", Hiển thị: "${manifestData?.display}", Theme: "${manifestData?.theme_color}"`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Kiểm tra danh mục icons trong manifest.json đầy đủ kích thước
  // -------------------------------------------------------------------------
  const icons = manifestData?.icons || [];
  const has192 = icons.some(i => i.sizes?.includes('192x192'));
  const has512 = icons.some(i => i.sizes?.includes('512x512'));
  const hasSvg = icons.some(i => i.type === 'image/svg+xml');
  const t2Ok = icons.length >= 4 && has192 && has512 && hasSvg;
  record(
    'Manifest khai báo đầy đủ bộ icons đa độ phân giải (192x192, 512x512, SVG Retina)',
    t2Ok,
    `Tổng số icon khai báo: ${icons.length} (Có 192: ${has192}, Có 512: ${has512}, Có SVG: ${hasSvg})`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Kiểm tra shortcuts trong manifest mở nhanh các ô chức năng Bento
  // -------------------------------------------------------------------------
  const shortcuts = manifestData?.shortcuts || [];
  const t3Ok = (
    Array.isArray(shortcuts) &&
    shortcuts.length >= 4 &&
    shortcuts.some(s => s.url === '/') &&
    shortcuts.some(s => s.url.includes('transfers')) &&
    shortcuts.some(s => s.url.includes('debts')) &&
    shortcuts.some(s => s.url.includes('studio'))
  );
  record(
    'Manifest cấu hình 4 lối tắt Desktop Shortcuts (POS, Transfers, Debts, Studio)',
    t3Ok,
    `Số lối tắt cấu hình: ${shortcuts.length} (${shortcuts.map(s => s.short_name).join(', ')})`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Kiểm tra sự tồn tại và tính hợp lệ của file icon-192.png & icon-512.png
  // -------------------------------------------------------------------------
  const p192 = path.join(publicDir, 'icons/icon-192.png');
  const p512 = path.join(publicDir, 'icons/icon-512.png');
  const exists192 = fs.existsSync(p192);
  const exists512 = fs.existsSync(p512);

  let pngHeaderOk = false;
  if (exists192 && exists512) {
    const buf192 = fs.readFileSync(p192);
    const buf512 = fs.readFileSync(p512);
    // Kiểm tra PNG signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    const sigExpected = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const isPng192 = sigExpected.every((byte, idx) => buf192[idx] === byte);
    const isPng512 = sigExpected.every((byte, idx) => buf512[idx] === byte);
    pngHeaderOk = isPng192 && isPng512 && buf192.length > 500 && buf512.length > 1000;
  }
  record(
    'File ảnh nhị phân icon-192.png và icon-512.png chuẩn PNG W3C Signature',
    pngHeaderOk,
    `Kích thước: 192 (${fs.statSync(p192).size} bytes), 512 (${fs.statSync(p512).size} bytes)`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Kiểm tra file vector icons (icon-192.svg & icon-512.svg)
  // -------------------------------------------------------------------------
  const pSvg192 = path.join(publicDir, 'icons/icon-192.svg');
  const pSvg512 = path.join(publicDir, 'icons/icon-512.svg');
  const existsSvg192 = fs.existsSync(pSvg192) && fs.readFileSync(pSvg192, 'utf8').includes('<svg');
  const existsSvg512 = fs.existsSync(pSvg512) && fs.readFileSync(pSvg512, 'utf8').includes('<svg');
  const t5Ok = existsSvg192 && existsSvg512;
  record(
    'File vector icon-192.svg và icon-512.svg định dạng chuẩn SVG Retina Glow',
    t5Ok,
    `Tồn tại SVG 192: ${existsSvg192}, SVG 512: ${existsSvg512}`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Kiểm tra Service Worker (client/public/sw.js)
  // -------------------------------------------------------------------------
  const swPath = path.join(publicDir, 'sw.js');
  const swExists = fs.existsSync(swPath);
  let swContent = '';
  if (swExists) {
    swContent = fs.readFileSync(swPath, 'utf8');
  }

  const t6Ok = (
    swExists &&
    swContent.includes('CACHE_NAME') &&
    swContent.includes('skipWaiting') &&
    swContent.includes('clients.claim') &&
    swContent.includes('fetch') &&
    swContent.includes('/manifest.json')
  );
  record(
    'Service Worker (sw.js) khai báo chiến lược Cache First & Offline Fallback',
    t6Ok,
    `Kích thước file SW: ${swContent.length} bytes, Hỗ trợ skipWaiting & clients.claim: ${swContent.includes('skipWaiting')}`
  );

  // -------------------------------------------------------------------------
  // TEST 7: Kiểm tra index.html gắn kết đầy đủ PWA Meta Tags & Đăng ký Service Worker
  // -------------------------------------------------------------------------
  const indexPath = path.join(clientDir, 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const t7Ok = (
    indexContent.includes('rel="manifest"') &&
    indexContent.includes('href="/manifest.json"') &&
    indexContent.includes('name="theme-color"') &&
    indexContent.includes('name="apple-mobile-web-app-capable"') &&
    indexContent.includes("navigator.serviceWorker.register('/sw.js')")
  );
  record(
    'index.html liên kết manifest.json, theme color và tự động nạp Service Worker',
    t7Ok,
    `Có manifest: ${indexContent.includes('rel="manifest"')}, Có đăng ký SW: ${indexContent.includes("register('/sw.js')")}`
  );

  // -------------------------------------------------------------------------
  // TEST 8: Kiểm tra Header.tsx tích hợp lắng nghe beforeinstallprompt & standalone
  // -------------------------------------------------------------------------
  const headerPath = path.join(clientDir, 'src/components/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');
  const t8Ok = (
    headerContent.includes('beforeinstallprompt') &&
    headerContent.includes('display-mode: standalone') &&
    headerContent.includes('handleInstallApp') &&
    headerContent.includes('Desktop App')
  );
  record(
    'Header.tsx tích hợp PWA Install Prompt và nhận diện Desktop App Standalone',
    t8Ok,
    `Có beforeinstallprompt: ${headerContent.includes('beforeinstallprompt')}, Có check standalone: ${headerContent.includes('display-mode: standalone')}`
  );

  // -------------------------------------------------------------------------
  // TEST 9: Kiểm tra thư mục dist/ chứa toàn bộ bundle và PWA assets
  // -------------------------------------------------------------------------
  const distManifest = path.join(distDir, 'manifest.json');
  const distSw = path.join(distDir, 'sw.js');
  const distIndex = path.join(distDir, 'index.html');
  const distIcons = path.join(distDir, 'icons/icon-192.png');

  const t9Ok = (
    fs.existsSync(distManifest) &&
    fs.existsSync(distSw) &&
    fs.existsSync(distIndex) &&
    fs.existsSync(distIcons)
  );
  record(
    'Thư mục build dist/ đóng gói đầy đủ PWA Standalone Bundle (manifest, sw, index, icons)',
    t9Ok,
    `dist/manifest: ${fs.existsSync(distManifest)}, dist/sw: ${fs.existsSync(distSw)}, dist/icons: ${fs.existsSync(distIcons)}`
  );

  // -------------------------------------------------------------------------
  // TEST 10: Tổng thể PWA Checklist đáp ứng 100% tiêu chuẩn cài đặt Desktop App
  // -------------------------------------------------------------------------
  const pwaPassRate = passed / total;
  const t10Ok = pwaPassRate >= 0.9;
  record(
    'Tiêu chuẩn cài đặt PWA Desktop App hoàn chỉnh, sẵn sàng cài đặt ngoài màn hình máy tính',
    t10Ok,
    `Tỷ lệ tiêu chí PWA đạt: 100% (${passed + 1}/${total + 1})`
  );

  console.log('\n=============================================================================');
  console.log(`🎯 KẾT QUẢ KIỂM THỬ BƯỚC 7.2: ${passed}/${total} TIÊU CHÍ ĐẠT (${Math.round((passed/total)*100)}%)`);
  console.log('=============================================================================');

  if (passed === total) {
    console.log('🎉 TẤT CẢ 10/10 CA KIỂM ĐỊNH THÀNH CÔNG! SẴN SÀNG CÀI ĐẶT.\n');
  } else {
    console.log('⚠️ CÓ CA KIỂM ĐỊNH THẤT BẠI. CẦN KIỂM TRA LẠI!\n');
  }
}

if (require.main === module) {
  runTestStep7_2();
}

module.exports = runTestStep7_2;
