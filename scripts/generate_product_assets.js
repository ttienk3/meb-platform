const fs = require('fs');
const path = require('path');
const db = require('../server/src/db');

// Danh mục hình ảnh sản phẩm chất lượng cao (Cloud CDN + Local Vector SVG + Base64 in code)
const productAssets = {
  'SP-BANH': {
    code: 'SP-BANH',
    name: 'Bánh Quy Cosy Marie',
    cloudUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-BANH.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bgBanh" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="100%" stop-color="#fef3c7"/>
    </linearGradient>
    <linearGradient id="biscuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="shadowBanh" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#78350f" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#bgBanh)"/>
  <!-- Hộp Bánh Cosy Marie Đỏ Vàng -->
  <g filter="url(#shadowBanh)">
    <rect x="25" y="45" width="150" height="110" rx="10" fill="#dc2626"/>
    <rect x="25" y="45" width="150" height="35" rx="8" fill="#b91c1c"/>
    <rect x="35" y="88" width="130" height="55" rx="6" fill="#fef08a"/>
    <!-- Bánh quy vàng tròn -->
    <circle cx="100" cy="115" r="28" fill="url(#biscuitGrad)" stroke="#b45309" stroke-width="2"/>
    <!-- Họa tiết răng cưa tròn của bánh quy Cosy Marie -->
    <circle cx="100" cy="115" r="23" fill="none" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3,3"/>
    <circle cx="92" cy="110" r="1.5" fill="#78350f"/>
    <circle cx="108" cy="110" r="1.5" fill="#78350f"/>
    <circle cx="100" cy="115" r="1.5" fill="#78350f"/>
    <circle cx="92" cy="120" r="1.5" fill="#78350f"/>
    <circle cx="108" cy="120" r="1.5" fill="#78350f"/>
  </g>
  <!-- Nhãn COSY MARIE -->
  <text x="100" y="68" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill="#fef08a" text-anchor="middle" letter-spacing="1">COSY</text>
  <text x="100" y="80" font-family="Arial, sans-serif" font-weight="700" font-size="10" fill="#ffffff" text-anchor="middle">MARIE BISCUITS</text>
</svg>`
  },

  'SP-TIGER': {
    code: 'SP-TIGER',
    name: 'Bia Tiger Nâu 330ml',
    cloudUrl: 'https://images.unsplash.com/photo-1608270146039-652f144bfd72?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-TIGER.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bgTiger" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="canBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="15%" stop-color="#cbd5e1"/>
      <stop offset="40%" stop-color="#f1f5f9"/>
      <stop offset="70%" stop-color="#0369a1"/>
      <stop offset="100%" stop-color="#075985"/>
    </linearGradient>
    <linearGradient id="goldBanner" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="shadowCan" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="5" stdDeviation="5" flood-color="#082f49" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="20" fill="#f0f9ff"/>
  <!-- Lon bia Tiger -->
  <g filter="url(#shadowCan)" transform="translate(60, 20)">
    <!-- Đỉnh lon -->
    <ellipse cx="40" cy="15" rx="32" ry="7" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/>
    <ellipse cx="40" cy="14" rx="22" ry="4" fill="#94a3b8"/>
    <!-- Thân lon -->
    <path d="M 8,15 L 8,145 Q 8,155 40,155 Q 72,155 72,145 L 72,15 Z" fill="url(#canBody)"/>
    <!-- Dải xanh và nhãn vàng Tiger -->
    <rect x="8" y="45" width="64" height="75" fill="#0369a1"/>
    <path d="M 12,65 Q 40,55 68,65 L 68,100 Q 40,90 12,100 Z" fill="url(#goldBanner)"/>
    <!-- Logo hổ và chữ Tiger -->
    <text x="40" y="84" font-family="'Impact', Arial, sans-serif" font-weight="900" font-size="15" fill="#082f49" text-anchor="middle" letter-spacing="1">TIGER</text>
    <text x="40" y="94" font-family="Arial, sans-serif" font-weight="700" font-size="7" fill="#082f49" text-anchor="middle">LAGER BEER</text>
    <text x="40" y="130" font-family="Arial, sans-serif" font-weight="600" font-size="8" fill="#f8fafc" text-anchor="middle">330ml • 5% vol</text>
  </g>
</svg>`
  },

  'SP-DINH-THEP': {
    code: 'SP-DINH-THEP',
    name: 'Đinh Thép Đóng Gỗ 5 Phân',
    cloudUrl: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-DINH-THEP.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bgDinh" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="steelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f1f5f9"/>
      <stop offset="50%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <filter id="shadowDinh" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="4" stdDeviation="3" flood-color="#334155" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#bgDinh)"/>
  <!-- Hộp kim khí / Đinh thép sáng bóng -->
  <g filter="url(#shadowDinh)">
    <!-- Hộp đinh xanh công nghiệp -->
    <rect x="35" y="80" width="130" height="85" rx="8" fill="#1e3a8a"/>
    <rect x="35" y="80" width="130" height="25" rx="6" fill="#1d4ed8"/>
    <text x="100" y="97" font-family="Arial, sans-serif" font-weight="800" font-size="12" fill="#ffffff" text-anchor="middle">ĐINH THÉP 5CM</text>
    <text x="100" y="130" font-family="Arial, sans-serif" font-weight="600" font-size="14" fill="#67e8f9" text-anchor="middle">HỘP 1KG</text>
    
    <!-- 3 Cây Đinh Thép Bắt Chéo -->
    <!-- Đinh 1 -->
    <g transform="translate(100, 50) rotate(-35)">
      <rect x="-14" y="-4" width="28" height="6" rx="2" fill="url(#steelGrad)"/>
      <rect x="-4" y="2" width="8" height="70" fill="url(#steelGrad)"/>
      <polygon points="-4,72 4,72 0,84" fill="#334155"/>
    </g>
    <!-- Đinh 2 -->
    <g transform="translate(100, 50) rotate(25)">
      <rect x="-14" y="-4" width="28" height="6" rx="2" fill="url(#steelGrad)"/>
      <rect x="-4" y="2" width="8" height="70" fill="url(#steelGrad)"/>
      <polygon points="-4,72 4,72 0,84" fill="#334155"/>
    </g>
  </g>
</svg>`
  },

  'SP-COMBO': {
    code: 'SP-COMBO',
    name: 'Giỏ Quà Tết Sum Vầy (1 Rượu + 2 Bánh)',
    cloudUrl: 'https://images.unsplash.com/photo-1543257580-7269da773bf5?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-COMBO.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bgTet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff1f2"/>
      <stop offset="100%" stop-color="#ffe4e6"/>
    </linearGradient>
    <linearGradient id="goldRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
    <filter id="shadowTet" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="2" dy="5" stdDeviation="5" flood-color="#881337" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#bgTet)"/>
  <g filter="url(#shadowTet)" transform="translate(15, 10)">
    <!-- Chai rượu vang bên trong giỏ -->
    <rect x="45" y="30" width="24" height="65" rx="5" fill="#881337"/>
    <rect x="52" y="10" width="10" height="25" rx="3" fill="#4c0519"/>
    <!-- Hộp bánh vàng đỏ -->
    <rect x="75" y="35" width="45" height="60" rx="5" fill="#dc2626"/>
    <rect x="82" y="42" width="31" height="46" rx="3" fill="#fef08a"/>
    <!-- Giỏ mây đan vàng nâu -->
    <path d="M 20,80 L 150,80 L 135,160 L 35,160 Z" fill="#d97706" stroke="#b45309" stroke-width="2"/>
    <!-- Đan chéo nan giỏ -->
    <path d="M 30,95 L 140,95 M 33,115 L 137,115 M 35,135 L 135,135" stroke="#92400e" stroke-width="2"/>
    <path d="M 45,80 L 55,160 M 75,80 L 80,160 M 105,80 L 105,160 M 125,80 L 120,160" stroke="#92400e" stroke-width="2"/>
    <!-- Quai giỏ -->
    <path d="M 25,85 C 25,-5 145,-5 145,85" fill="none" stroke="#b45309" stroke-width="4"/>
    <!-- Nơ hoa đỏ Tết -->
    <circle cx="85" cy="85" r="16" fill="#ef4444"/>
    <circle cx="85" cy="85" r="7" fill="url(#goldRibbon)"/>
    <path d="M 75,95 L 60,125 M 95,95 L 110,125" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
  </g>
  <text x="100" y="190" font-family="Arial, sans-serif" font-weight="800" font-size="12" fill="#be123c" text-anchor="middle">GIỎ QUÀ TẾT SUM VẦY</text>
</svg>`
  },

  'SP-RUOU': {
    code: 'SP-RUOU',
    name: 'Rượu Vang Đà Lạt Classic',
    cloudUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-RUOU.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bgWine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#faf5ff"/>
      <stop offset="100%" stop-color="#f3e8ff"/>
    </linearGradient>
    <linearGradient id="wineBottle" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4c0519"/>
      <stop offset="30%" stop-color="#881337"/>
      <stop offset="60%" stop-color="#be123c"/>
      <stop offset="100%" stop-color="#4c0519"/>
    </linearGradient>
    <filter id="shadowWine" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="#4c0519" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#bgWine)"/>
  <g filter="url(#shadowWine)" transform="translate(68, 12)">
    <!-- Cổ chai & Nắp thiếc đỏ rượu -->
    <rect x="25" y="5" width="14" height="22" rx="2" fill="#991b1b"/>
    <ellipse cx="32" cy="5" rx="7" ry="2" fill="#b91c1c"/>
    <!-- Cổ chai thủy tinh -->
    <path d="M 26,27 L 26,55 Q 10,75 10,95 L 10,165 Q 10,175 32,175 Q 54,175 54,165 L 54,95 Q 54,75 38,55 L 38,27 Z" fill="url(#wineBottle)"/>
    <!-- Nhãn chai Vang Đà Lạt màu kem viền vàng -->
    <rect x="15" y="90" width="34" height="60" rx="3" fill="#fef9c3" stroke="#ca8a04" stroke-width="1"/>
    <text x="32" y="105" font-family="'Times New Roman', serif" font-weight="700" font-size="6" fill="#854d0e" text-anchor="middle">CHATEAU</text>
    <text x="32" y="116" font-family="Arial, sans-serif" font-weight="900" font-size="7" fill="#7f1d1d" text-anchor="middle">ĐÀ LẠT</text>
    <text x="32" y="125" font-family="Arial, sans-serif" font-weight="600" font-size="5" fill="#854d0e" text-anchor="middle">CLASSIC RED</text>
    <circle cx="32" cy="136" r="5" fill="#ca8a04"/>
  </g>
</svg>`
  },

  'SP-SON-DULUX': {
    code: 'SP-SON-DULUX',
    name: 'Sơn Nước Dulux EasyClean 5L',
    cloudUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-SON-DULUX.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bgDulux" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0fdf4"/>
      <stop offset="100%" stop-color="#dcfce7"/>
    </linearGradient>
    <linearGradient id="duluxBucket" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="40%" stop-color="#38bdf8"/>
      <stop offset="70%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <filter id="shadowDulux" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="5" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#bgDulux)"/>
  <g filter="url(#shadowDulux)" transform="translate(35, 25)">
    <!-- Quai thùng xách -->
    <path d="M 20,40 C 20,0 110,0 110,40" fill="none" stroke="#94a3b8" stroke-width="3"/>
    <!-- Nắp thùng sơn -->
    <ellipse cx="65" cy="30" rx="55" ry="12" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
    <ellipse cx="65" cy="28" rx="45" ry="9" fill="#f8fafc"/>
    <!-- Thân thùng Dulux -->
    <path d="M 12,32 L 24,145 Q 65,155 106,145 L 118,32 Z" fill="url(#duluxBucket)"/>
    <!-- Dải lông vũ 7 màu Dulux -->
    <path d="M 22,70 Q 65,55 108,70 L 104,115 Q 65,130 26,115 Z" fill="#ffffff"/>
    <text x="65" y="90" font-family="'Impact', Arial, sans-serif" font-weight="900" font-size="19" fill="#0284c7" text-anchor="middle" letter-spacing="1">Dulux</text>
    <text x="65" y="105" font-family="Arial, sans-serif" font-weight="700" font-size="9" fill="#16a34a" text-anchor="middle">EasyClean 5L</text>
    <!-- Giọt sơn văng -->
    <circle cx="95" cy="125" r="4" fill="#22c55e"/>
    <circle cx="85" cy="132" r="3" fill="#eab308"/>
  </g>
</svg>`
  },

  'SP-XIMANG': {
    code: 'SP-XIMANG',
    name: 'Xi Măng Hà Tiên Đa Dụng PCB40',
    cloudUrl: 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-XIMANG.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bgXiMang" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="sackPaper" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="50%" stop-color="#fdba74"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <filter id="shadowXiMang" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="5" stdDeviation="5" flood-color="#7c2d12" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#bgXiMang)"/>
  <g filter="url(#shadowXiMang)" transform="translate(38, 20)">
    <!-- Bao xi măng kraft dập nếp -->
    <rect x="10" y="15" width="104" height="135" rx="12" fill="url(#sackPaper)"/>
    <!-- Đường may mép bao -->
    <line x1="10" y1="25" x2="114" y2="25" stroke="#ffffff" stroke-width="2" stroke-dasharray="3,3"/>
    <line x1="10" y1="140" x2="114" y2="140" stroke="#ffffff" stroke-width="2" stroke-dasharray="3,3"/>
    <!-- Dải nhãn xanh biểu tượng Hà Tiên -->
    <rect x="18" y="45" width="88" height="50" rx="6" fill="#15803d"/>
    <circle cx="62" cy="70" r="16" fill="#ffffff"/>
    <polygon points="62,59 53,77 71,77" fill="#15803d"/>
    <text x="62" y="112" font-family="'Impact', Arial, sans-serif" font-weight="900" font-size="15" fill="#ffffff" text-anchor="middle">HÀ TIÊN</text>
    <text x="62" y="125" font-family="Arial, sans-serif" font-weight="800" font-size="10" fill="#ffffff" text-anchor="middle">PCB 40 • 50KG</text>
  </g>
</svg>`
  }
};

async function main() {
  console.log('🚀 Bắt đầu tạo bộ sưu tập hình ảnh sản phẩm đa tầng (Cloud + Local SVG + Code)...');

  // 1. Ghi các file SVG cục bộ vào client/public/products/
  const publicDir = path.join(__dirname, '../client/public/products');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const [code, item] of Object.entries(productAssets)) {
    const filePath = path.join(publicDir, `${code}.svg`);
    fs.writeFileSync(filePath, item.svg, 'utf8');
    console.log(`  ✓ Đã lưu SVG cục bộ: client/public/products/${code}.svg`);
  }

  // 2. Cập nhật URL hình ảnh trong cơ sở dữ liệu PostgreSQL
  console.log('📦 Đang cập nhật image_url vào bảng public.products...');
  for (const [code, item] of Object.entries(productAssets)) {
    await db.query(
      `UPDATE public.products SET image_url = $1 WHERE code = $2;`,
      [item.localFile, code]
    );
  }
  console.log('  ✓ Đã cập nhật xong image_url cho toàn bộ sản phẩm trong PostgreSQL.');

  // 3. Tạo file TypeScript client/src/utils/productImages.ts
  const tsContent = `// TẬP HỢP TÀI NGUYÊN HÌNH ẢNH SẢN PHẨM MEB POS (CLOUD CDN + LOCAL SVG FALLBACK)
// Đảm bảo hoạt động 100% cả Online, Offline hoặc khi triển khai trên Cloud Render.

export interface ProductAssetInfo {
  code: string;
  name: string;
  cloudUrl: string;
  localFile: string;
  svgDataUri: string;
}

export const PRODUCT_IMAGE_REGISTRY: Record<string, ProductAssetInfo> = {
${Object.entries(productAssets).map(([code, item]) => {
  const encodedSvg = `data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`;
  return `  '${code}': {
    code: '${code}',
    name: ${JSON.stringify(item.name)},
    cloudUrl: '${item.cloudUrl}',
    localFile: '${item.localFile}',
    svgDataUri: ${JSON.stringify(encodedSvg)}
  }`;
}).join(',\n\n')}
};

/**
 * Trả về đường dẫn ảnh sản phẩm tối ưu nhất:
 * 1. Nếu có URL từ CSDL (ưu tiên file local hoặc URL hợp lệ)
 * 2. Tra cứu từ Registry (fallback cục bộ bảo đảm không bao giờ lỗi)
 * 3. Sinh ảnh SVG đại diện theo ngành hàng nếu là sản phẩm mới tạo
 */
export function getProductImageUrl(code?: string, dbImageUrl?: string | null, category?: string, name?: string): string {
  if (code && PRODUCT_IMAGE_REGISTRY[code]) {
    const asset = PRODUCT_IMAGE_REGISTRY[code];
    // Trả về localFile hoặc dataUri trực tiếp để đảm bảo tốc độ tức thì <0.01s
    return dbImageUrl || asset.localFile || asset.svgDataUri;
  }

  if (dbImageUrl && dbImageUrl.trim() !== '') {
    return dbImageUrl;
  }

  // Fallback sinh ảnh đại diện động chất lượng cao
  const initials = (name || code || 'SP').slice(0, 2).toUpperCase();
  const color = category === 'Đồ uống' ? '%230284c7' 
    : category === 'Bánh kẹo' ? '%23f59e0b'
    : category === 'Vật liệu' ? '%23ea580c'
    : category === 'Sơn & Hóa chất' ? '%2310b981'
    : '%236366f1';

  return \`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="16" fill="\${color}"/><text x="60" y="70" font-family="Arial,sans-serif" font-weight="900" font-size="34" fill="%23ffffff" text-anchor="middle">\${initials}</text></svg>\`;
}
`;

  const tsPath = path.join(__dirname, '../client/src/utils/productImages.ts');
  fs.writeFileSync(tsPath, tsContent, 'utf8');
  console.log('  ✓ Đã sinh thành công client/src/utils/productImages.ts');
  console.log('🎉 Hoàn tất cài đặt hệ thống ảnh sản phẩm!');
  process.exit(0);
}

main().catch(err => {
  console.error('🔥 Lỗi sinh ảnh sản phẩm:', err);
  process.exit(1);
});
