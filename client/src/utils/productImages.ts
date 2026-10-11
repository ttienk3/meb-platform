// TẬP HỢP TÀI NGUYÊN HÌNH ẢNH SẢN PHẨM MEB POS (CLOUD CDN + LOCAL SVG VECTOR REGISTRY)
// Đảm bảo hoạt động 100% cả Online, Offline hoặc khi triển khai trên Cloud Render.

export interface ProductAssetInfo {
  code: string;
  name: string;
  cloudUrl?: string;
  localFile?: string;
  svgDataUri: string;
}

export const PRODUCT_IMAGE_REGISTRY: Record<string, ProductAssetInfo> = {
  'SP-BANH': {
    code: 'SP-BANH',
    name: "Bánh Quy Cosy Marie",
    cloudUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-BANH.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fef3c7"/><rect x="30" y="45" width="140" height="110" rx="10" fill="%23dc2626"/><rect x="40" y="85" width="120" height="55" rx="6" fill="%23fef08a"/><circle cx="100" cy="112" r="24" fill="%23f59e0b" stroke="%23b45309" stroke-width="2"/><text x="100" y="70" font-family="Arial,sans-serif" font-weight="900" font-size="16" fill="%23fef08a" text-anchor="middle">COSY</text><text x="100" y="80" font-family="Arial,sans-serif" font-weight="700" font-size="9" fill="%23ffffff" text-anchor="middle">MARIE</text></svg>`
  },

  'SP-TIGER': {
    code: 'SP-TIGER',
    name: "Bia Tiger Nâu 330ml",
    cloudUrl: 'https://images.unsplash.com/photo-1608270146039-652f144bfd72?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-TIGER.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f0f9ff"/><g transform="translate(65, 20)"><ellipse cx="35" cy="15" rx="28" ry="6" fill="%23cbd5e1"/><path d="M 7,15 L 7,145 Q 7,155 35,155 Q 63,155 63,145 L 63,15 Z" fill="%230284c7"/><rect x="7" y="45" width="56" height="70" fill="%230369a1"/><text x="35" y="82" font-family="Impact,Arial" font-weight="900" font-size="14" fill="%23fbbf24" text-anchor="middle">TIGER</text><text x="35" y="94" font-family="Arial" font-weight="700" font-size="7" fill="%23ffffff" text-anchor="middle">LAGER BEER</text><text x="35" y="130" font-family="Arial" font-weight="600" font-size="8" fill="%23f8fafc" text-anchor="middle">330ml</text></g></svg>`
  },

  'SP-HEINEKEN': {
    code: 'SP-HEINEKEN',
    name: "Bia Heineken Silver 330ml",
    localFile: '/products/SP-HEINEKEN.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f0fdf4"/><g transform="translate(65, 20)"><ellipse cx="35" cy="15" rx="28" ry="6" fill="%23e2e8f0"/><path d="M 7,15 L 7,145 Q 7,155 35,155 Q 63,155 63,145 L 63,15 Z" fill="%2315803d"/><rect x="7" y="45" width="56" height="70" fill="%23166534"/><polygon points="35,62 38,70 46,70 40,75 42,83 35,78 28,83 30,75 24,70 32,70" fill="%23dc2626"/><text x="35" y="96" font-family="Impact,Arial" font-weight="900" font-size="10" fill="%23ffffff" text-anchor="middle">HEINEKEN</text><text x="35" y="108" font-family="Arial" font-weight="800" font-size="7" fill="%23cbd5e1" text-anchor="middle">SILVER</text><text x="35" y="132" font-family="Arial" font-weight="600" font-size="8" fill="%23f0fdf4" text-anchor="middle">330ml</text></g></svg>`
  },

  'SP-CHOCOPIE': {
    code: 'SP-CHOCOPIE',
    name: "Bánh Chocopie Orion Hộp 12 Cái",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fef2f2"/><g transform="translate(30, 35)"><rect width="140" height="110" rx="10" fill="%23b91c1c"/><circle cx="70" cy="55" r="32" fill="%23451a03"/><path d="M 40,55 Q 70,62 100,55" stroke="%23ffffff" stroke-width="6" fill="none"/><text x="70" y="115" font-family="Arial,sans-serif" font-weight="900" font-size="14" fill="%23fef08a" text-anchor="middle">CHOCO PIE</text><text x="70" y="130" font-family="Arial,sans-serif" font-weight="700" font-size="9" fill="%23ffffff" text-anchor="middle">ORION 12P</text></g></svg>`
  },

  'SP-OREO': {
    code: 'SP-OREO',
    name: "Bánh Quy Oreo Socola Vani 133g",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23eff6ff"/><g transform="translate(40, 30)"><rect width="120" height="120" rx="10" fill="%231e40af"/><circle cx="60" cy="55" r="30" fill="%231e293b" stroke="%230f172a" stroke-width="3"/><circle cx="60" cy="55" r="22" fill="%23ffffff"/><circle cx="60" cy="55" r="18" fill="%231e293b"/><text x="60" y="60" font-family="Impact,Arial" font-weight="900" font-size="12" fill="%23ffffff" text-anchor="middle">OREO</text><text x="60" y="105" font-family="Arial" font-weight="800" font-size="11" fill="%2393c5fd" text-anchor="middle">VANILLA 133G</text></g></svg>`
  },

  'SP-COCA': {
    code: 'SP-COCA',
    name: "Nước Ngọt Coca Cola 320ml",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fef2f2"/><g transform="translate(65, 20)"><ellipse cx="35" cy="15" rx="28" ry="6" fill="%23cbd5e1"/><path d="M 7,15 L 7,145 Q 7,155 35,155 Q 63,155 63,145 L 63,15 Z" fill="%23dc2626"/><text x="35" y="85" font-family="'Brush Script MT',cursive,Arial" font-weight="900" font-size="18" fill="%23ffffff" text-anchor="middle">Coca-Cola</text><text x="35" y="130" font-family="Arial" font-weight="600" font-size="8" fill="%23fee2e2" text-anchor="middle">320ml</text></g></svg>`
  },

  'SP-AQUAFINA': {
    code: 'SP-AQUAFINA',
    name: "Nước Suối Aquafina 500ml",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f0f9ff"/><g transform="translate(70, 15)"><rect x="20" y="5" width="20" height="20" rx="3" fill="%230284c7"/><path d="M 12,25 L 12,150 Q 12,160 30,160 Q 48,160 48,150 L 48,25 Z" fill="%23e0f2fe" stroke="%2338bdf8" stroke-width="1.5"/><rect x="12" y="70" width="36" height="40" fill="%230284c7"/><text x="30" y="94" font-family="Arial" font-weight="900" font-size="7" fill="%23ffffff" text-anchor="middle">AQUAFINA</text><text x="30" y="140" font-family="Arial" font-weight="600" font-size="7" fill="%230369a1" text-anchor="middle">500ml</text></g></svg>`
  },

  'SP-REDBULL': {
    code: 'SP-REDBULL',
    name: "Nước Tăng Lực Red Bull Thái 250ml",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fefce8"/><g transform="translate(68, 25)"><rect x="5" y="15" width="54" height="125" rx="10" fill="%23ca8a04"/><circle cx="32" cy="70" r="18" fill="%23dc2626"/><text x="32" y="75" font-family="Impact,Arial" font-weight="900" font-size="10" fill="%23fef08a" text-anchor="middle">RED BULL</text><text x="32" y="115" font-family="Arial" font-weight="800" font-size="8" fill="%23713f12" text-anchor="middle">ENERGY 250ml</text></g></svg>`
  },

  'SP-VINAMILK': {
    code: 'SP-VINAMILK',
    name: "Sữa Tươi Tiệt Trùng Vinamilk 1L",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f0fdf4"/><g transform="translate(65, 20)"><polygon points="35,10 10,35 60,35" fill="%231e3a8a"/><rect x="10" y="35" width="50" height="120" rx="4" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="2"/><rect x="10" y="60" width="50" height="40" fill="%232563eb"/><text x="35" y="85" font-family="Arial" font-weight="900" font-size="8" fill="%23ffffff" text-anchor="middle">VINAMILK</text><text x="35" y="125" font-family="Arial" font-weight="700" font-size="9" fill="%231e3a8a" text-anchor="middle">100% SỮA</text></g></svg>`
  },

  'SP-TH-TRUE': {
    code: 'SP-TH-TRUE',
    name: "Sữa Tươi TH True MILK Ít Đường 180ml",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f0f9ff"/><g transform="translate(65, 25)"><rect x="10" y="20" width="50" height="115" rx="5" fill="%23ffffff" stroke="%2338bdf8" stroke-width="2"/><rect x="10" y="45" width="50" height="35" fill="%230284c7"/><text x="35" y="68" font-family="Arial" font-weight="900" font-size="12" fill="%23ffffff" text-anchor="middle">TH</text><text x="35" y="105" font-family="Arial" font-weight="700" font-size="8" fill="%230369a1" text-anchor="middle">true MILK</text></g></svg>`
  },

  'SP-ONG-THO': {
    code: 'SP-ONG-THO',
    name: "Sữa Đặc Có Đường Ông Thọ Đỏ 380g",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fef2f2"/><g transform="translate(60, 35)"><ellipse cx="40" cy="15" rx="35" ry="8" fill="%23e2e8f0"/><rect x="5" y="15" width="70" height="95" fill="%23dc2626"/><ellipse cx="40" cy="110" rx="35" ry="8" fill="%23b91c1c"/><text x="40" y="65" font-family="Arial" font-weight="900" font-size="11" fill="%23fef08a" text-anchor="middle">ÔNG THỌ</text><text x="40" y="80" font-family="Arial" font-weight="700" font-size="8" fill="%23ffffff" text-anchor="middle">SỮA ĐẶC 380G</text></g></svg>`
  },

  'SP-OMO': {
    code: 'SP-OMO',
    name: "Bột Giặt OMO Comfort Tinh Dầu Thơm 5.5kg",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fdf4ff"/><g transform="translate(50, 20)"><polygon points="20,15 80,15 90,145 10,145" fill="%23c026d3"/><circle cx="50" cy="70" r="25" fill="%23dc2626"/><text x="50" y="78" font-family="Impact,Arial" font-weight="900" font-size="18" fill="%23ffffff" text-anchor="middle">OMO</text><text x="50" y="115" font-family="Arial" font-weight="700" font-size="9" fill="%23fdf4ff" text-anchor="middle">COMFORT 5.5KG</text></g></svg>`
  },

  'SP-SUNLIGHT': {
    code: 'SP-SUNLIGHT',
    name: "Nước Rửa Chén Sunlight Chanh 3.6kg",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fefce8"/><g transform="translate(55, 20)"><rect x="15" y="10" width="60" height="135" rx="12" fill="%23eab308"/><circle cx="45" cy="75" r="22" fill="%23ffffff"/><text x="45" y="72" font-family="Arial" font-weight="900" font-size="8" fill="%23854d0e" text-anchor="middle">SUNLIGHT</text><text x="45" y="85" font-family="Arial" font-weight="800" font-size="8" fill="%2315803d" text-anchor="middle">CHANH</text></g></svg>`
  },

  'SP-DAU-TUONG-AN': {
    code: 'SP-DAU-TUONG-AN',
    name: "Dầu Ăn Tường An Cooking Oil 1L",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fffbeb"/><g transform="translate(65, 20)"><rect x="15" y="5" width="20" height="15" rx="2" fill="%23dc2626"/><path d="M 10,20 L 10,140 Q 10,150 35,150 Q 60,150 60,140 L 60,20 Z" fill="%23fef08a" stroke="%23ca8a04" stroke-width="1.5"/><rect x="10" y="60" width="50" height="40" fill="%23dc2626"/><text x="35" y="82" font-family="Arial" font-weight="900" font-size="8" fill="%23ffffff" text-anchor="middle">TƯỜNG AN</text></g></svg>`
  },

  'SP-MI-HAOHAO': {
    code: 'SP-MI-HAOHAO',
    name: "Mì Hảo Hảo Tôm Chua Cay 75g",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fff1f2"/><g transform="translate(30, 35)"><rect width="140" height="100" rx="8" fill="%23e11d48"/><rect x="10" y="10" width="120" height="80" rx="6" fill="%23f43f5e"/><text x="70" y="52" font-family="Arial,sans-serif" font-weight="900" font-size="18" fill="%23fef08a" text-anchor="middle">HẢO HẢO</text><text x="70" y="72" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="%23ffffff" text-anchor="middle">TÔM CHUA CAY</text></g></svg>`
  },

  'SP-LAYS': {
    code: 'SP-LAYS',
    name: "Snack Khoai Tây Lay's Tự Nhiên 54g",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fefce8"/><g transform="translate(45, 25)"><polygon points="20,10 90,10 100,135 10,135" fill="%23eab308"/><circle cx="55" cy="70" r="22" fill="%23dc2626"/><circle cx="55" cy="70" r="16" fill="%23ffffff"/><text x="55" y="75" font-family="Arial" font-weight="900" font-size="10" fill="%23dc2626" text-anchor="middle">Lay's</text></g></svg>`
  },

  'SP-GAO-ST25': {
    code: 'SP-GAO-ST25',
    name: "Gạo Đặc Sản ST25 Thượng Hạng 5kg",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fefce8"/><g transform="translate(45, 20)"><rect width="110" height="135" rx="10" fill="%23ca8a04"/><rect x="10" y="15" width="90" height="105" rx="6" fill="%23eab308"/><text x="55" y="60" font-family="Arial" font-weight="900" font-size="16" fill="%23713f12" text-anchor="middle">GẠO ST25</text><text x="55" y="80" font-family="Arial" font-weight="700" font-size="9" fill="%23ffffff" text-anchor="middle">THƯỢNG HẠNG 5KG</text></g></svg>`
  },

  'SP-THEP-HOAPHAT': {
    code: 'SP-THEP-HOAPHAT',
    name: "Thép Cuộn Hòa Phát Phi 6 D6",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f8fafc"/><g transform="translate(40, 30)"><circle cx="60" cy="60" r="50" fill="%2364748b" stroke="%23334155" stroke-width="8"/><circle cx="60" cy="60" r="30" fill="%23f8fafc" stroke="%23475569" stroke-width="6"/><text x="60" y="130" font-family="Arial" font-weight="900" font-size="11" fill="%231e293b" text-anchor="middle">HÒA PHÁT PHI 6</text></g></svg>`
  },

  'SP-DINH-THEP': {
    code: 'SP-DINH-THEP',
    name: "Đinh Thép Đóng Gỗ 5 Phân",
    cloudUrl: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-DINH-THEP.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f8fafc"/><g transform="translate(35, 45)"><rect width="130" height="85" rx="8" fill="%231e3a8a"/><text x="65" y="45" font-family="Arial" font-weight="800" font-size="12" fill="%23ffffff" text-anchor="middle">ĐINH THÉP 5CM</text></g></svg>`
  },

  'SP-COMBO': {
    code: 'SP-COMBO',
    name: "Giỏ Quà Tết Sum Vầy (1 Rượu + 2 Bánh)",
    cloudUrl: 'https://images.unsplash.com/photo-1543257580-7269da773bf5?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-COMBO.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fff1f2"/><g transform="translate(25, 20)"><path d="M 20,80 L 130,80 L 115,145 L 35,145 Z" fill="%23d97706"/><circle cx="75" cy="80" r="14" fill="%23ef4444"/><text x="75" y="120" font-family="Arial" font-weight="800" font-size="10" fill="%23ffffff" text-anchor="middle">QUÀ TẾT</text></g></svg>`
  },

  'SP-COMBO-TIEC': {
    code: 'SP-COMBO-TIEC',
    name: "Combo Tiệc Bia & Ăn Vặt",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23fdf2f8"/><g transform="translate(30, 25)"><rect width="140" height="120" rx="10" fill="%23a855f7"/><text x="70" y="65" font-family="Arial" font-weight="900" font-size="14" fill="%23ffffff" text-anchor="middle">COMBO TIỆC</text><text x="70" y="85" font-family="Arial" font-weight="700" font-size="10" fill="%23fbcfe8" text-anchor="middle">BIA + ĂN VẶT</text></g></svg>`
  },

  'SP-RUOU': {
    code: 'SP-RUOU',
    name: "Rượu Vang Đà Lạt Classic",
    cloudUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-RUOU.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23faf5ff"/><g transform="translate(75, 15)"><rect x="15" y="5" width="18" height="25" rx="3" fill="%23991b1b"/><path d="M 12,30 L 12,150 Q 12,160 24,160 Q 36,160 36,150 L 36,30 Z" fill="%234c0519"/><text x="24" y="100" font-family="Arial" font-weight="700" font-size="7" fill="%23fef08a" text-anchor="middle">ĐÀ LẠT</text></g></svg>`
  },

  'SP-SON-DULUX': {
    code: 'SP-SON-DULUX',
    name: "Sơn Nước Dulux EasyClean 5L",
    cloudUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-SON-DULUX.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f0fdf4"/><g transform="translate(45, 25)"><path d="M 12,35 L 22,130 Q 55,140 88,130 L 98,35 Z" fill="%230284c7"/><text x="55" y="85" font-family="Impact,Arial" font-weight="900" font-size="16" fill="%23ffffff" text-anchor="middle">DULUX</text></g></svg>`
  },

  'SP-XIMANG': {
    code: 'SP-XIMANG',
    name: "Xi Măng Hà Tiên Đa Dụng PCB40",
    cloudUrl: 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=500&auto=format&fit=crop&q=80',
    localFile: '/products/SP-XIMANG.svg',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" rx="16" fill="%23f8fafc"/><g transform="translate(45, 20)"><rect width="110" height="140" rx="10" fill="%23ea580c"/><rect x="15" y="45" width="80" height="50" rx="6" fill="%2315803d"/><text x="55" y="115" font-family="Impact,Arial" font-weight="900" font-size="14" fill="%23ffffff" text-anchor="middle">HÀ TIÊN</text></g></svg>`
  }
};

/**
 * Trả về Data URI vector SVG fallback chắc chắn hiển thị 100%
 */
export function getProductFallbackSvg(code?: string, category?: string, name?: string): string {
  if (code && PRODUCT_IMAGE_REGISTRY[code]?.svgDataUri) {
    return PRODUCT_IMAGE_REGISTRY[code].svgDataUri;
  }
  const initials = (name || code || 'SP').slice(0, 2).toUpperCase();
  const color = category === 'Đồ uống' ? '%230284c7' 
    : category === 'Bánh kẹo' ? '%23f59e0b'
    : category === 'Vật liệu' ? '%23ea580c'
    : category === 'Sơn & Hóa chất' ? '%2310b981'
    : category === 'Gia vị & Hàng khô' ? '%23d97706'
    : category === 'Quà tặng' ? '%23a855f7'
    : '%234f46e5';

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="16" fill="${color}"/><text x="60" y="70" font-family="Arial,sans-serif" font-weight="900" font-size="34" fill="%23ffffff" text-anchor="middle">${initials}</text></svg>`;
}

/**
 * Trả về đường dẫn ảnh sản phẩm tối ưu nhất:
 * 1. Nếu có ảnh cục bộ / data uri thì dùng ngay
 * 2. Nếu có registry asset thì dùng asset
 * 3. Nếu có dbImageUrl thì dùng, kèm fallback qua onError
 */
export function getProductImageUrl(code?: string, dbImageUrl?: string | null, category?: string, name?: string): string {
  if (code && PRODUCT_IMAGE_REGISTRY[code]) {
    const asset = PRODUCT_IMAGE_REGISTRY[code];
    return asset.svgDataUri;
  }

  if (dbImageUrl && dbImageUrl.trim() !== '') {
    return dbImageUrl;
  }

  return getProductFallbackSvg(code, category, name);
}
