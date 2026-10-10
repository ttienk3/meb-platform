export interface IndustryDomain {
  id: string;
  name: string;
  shortName: string;
  iconName: string;
  badge: string;
  color: string;
  description: string;
  recommendedFeatures: Record<string, boolean>;
}

export interface BusinessLogicFeature {
  key: string;
  name: string;
  group: 'KHO' | 'BAN_HANG' | 'TAI_CHINH';
  badge: string;
  description: string;
  standardRule?: string;
}

export const INDUSTRY_DOMAINS: IndustryDomain[] = [
  {
    id: 'RETAIL_GROCERY',
    name: 'Bách Hóa / Siêu Thị Mini / Tiện Lợi',
    shortName: 'Bách Hóa',
    iconName: 'Store',
    badge: 'Bán lẻ FMCG',
    color: '#10b981',
    description: 'Bán nhanh bằng mã vạch, thanh toán tiền mặt/QR, đối soát ca bán, chặn nợ vãng lai.',
    recommendedFeatures: {
      pos_barcode: true,
      multi_uom: true,
      require_shifts: true,
      allow_debt: false,
      customer_required: false,
      credit_limit_guard: true,
      allow_negative_stock: false,
      rma_returns: true,
      tiered_pricing: false,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: false
    }
  },
  {
    id: 'BUILDING_PAINT',
    name: 'Vật Liệu Xây Dựng / Sơn / Sắt Thép',
    shortName: 'Sơn & Vật Liệu',
    iconName: 'Building',
    badge: 'Bán sỉ & Công nợ',
    color: '#f59e0b',
    description: 'Quy đổi Thùng/Bao/Kg, bán nợ gối đầu, phân cấp giá Thợ/Nhà thầu, chốt chặn hạn mức nợ.',
    recommendedFeatures: {
      pos_barcode: false,
      multi_uom: true,
      require_shifts: true,
      allow_debt: true,
      customer_required: true,
      credit_limit_guard: true,
      allow_negative_stock: true,
      rma_returns: true,
      tiered_pricing: true,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: true
    }
  },
  {
    id: 'CAFE_FNB',
    name: 'Quán Cà Phê / Trà Sữa / F&B',
    shortName: 'F&B / Cà Phê',
    iconName: 'Coffee',
    badge: 'Quầy Order',
    color: '#ec4899',
    description: 'Gọi món nhanh, thu tiền tại quầy, quản lý két ca trực cực kỳ chặt chẽ, không bán nợ.',
    recommendedFeatures: {
      pos_barcode: false,
      multi_uom: false,
      require_shifts: true,
      allow_debt: false,
      customer_required: false,
      credit_limit_guard: false,
      allow_negative_stock: false,
      rma_returns: false,
      tiered_pricing: false,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: false
    }
  },
  {
    id: 'PHARMACY',
    name: 'Nhà Thuốc / Dược Phẩm / Y Tế',
    shortName: 'Nhà Thuốc',
    iconName: 'Pill',
    badge: 'Theo dõi đơn vị',
    color: '#06b6d4',
    description: 'Đa đơn vị vỉ/hộp/viên, in hóa đơn rõ ràng, kiểm kê tồn kho định kỳ thẻ kho bất biến.',
    recommendedFeatures: {
      pos_barcode: true,
      multi_uom: true,
      require_shifts: true,
      allow_debt: false,
      customer_required: false,
      credit_limit_guard: false,
      allow_negative_stock: false,
      rma_returns: true,
      tiered_pricing: false,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: false
    }
  },
  {
    id: 'FASHION',
    name: 'Thời Trang / Quần Áo / Giày Dép',
    shortName: 'Thời Trang',
    iconName: 'Shirt',
    badge: 'Quét Barcode & Đổi trả',
    color: '#8b5cf6',
    description: 'Quét mã vạch nhanh, đổi trả hàng linh hoạt, thanh toán chuyển khoản và tiền mặt.',
    recommendedFeatures: {
      pos_barcode: true,
      multi_uom: false,
      require_shifts: true,
      allow_debt: false,
      customer_required: false,
      credit_limit_guard: false,
      allow_negative_stock: false,
      rma_returns: true,
      tiered_pricing: true,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: true
    }
  },
  {
    id: 'AUTO_PARTS',
    name: 'Gara Sửa Chữa / Phụ Tùng Xe',
    shortName: 'Gara & Phụ Tùng',
    iconName: 'Wrench',
    badge: 'Bán lẻ & Dịch vụ',
    color: '#ef4444',
    description: 'Bán lẻ phụ tùng kèm sửa chữa, cho phép ghi nợ công ty/đội xe, đặt trước linh kiện.',
    recommendedFeatures: {
      pos_barcode: true,
      multi_uom: true,
      require_shifts: true,
      allow_debt: true,
      customer_required: true,
      credit_limit_guard: true,
      allow_negative_stock: true,
      rma_returns: true,
      tiered_pricing: true,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: true
    }
  },
  {
    id: 'LOGISTICS_WAREHOUSE',
    name: 'Kho Trung Chuyển / Logistics Tổng',
    shortName: 'Kho Tổng',
    iconName: 'Warehouse',
    badge: 'Điều chuyển & Kiểm kê',
    color: '#38bdf8',
    description: 'Điều chuyển kho 2 pha có trạm ảo & hao hụt, đa đơn vị bao/thùng/kiện, cấm âm kho.',
    recommendedFeatures: {
      pos_barcode: true,
      multi_uom: true,
      require_shifts: false,
      allow_debt: false,
      customer_required: false,
      credit_limit_guard: false,
      allow_negative_stock: false,
      rma_returns: false,
      tiered_pricing: false,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: false
    }
  },
  {
    id: 'AGRI_FEED',
    name: 'Nông Nghiệp / Thức Ăn Chăn Nuôi',
    shortName: 'Nông Nghiệp',
    iconName: 'Wheat',
    badge: 'Bao & Nợ mùa vụ',
    color: '#84cc16',
    description: 'Bán theo bao/tấn, ghi nợ gối vụ cho nhà nông, thanh toán chia tiền linh hoạt.',
    recommendedFeatures: {
      pos_barcode: false,
      multi_uom: true,
      require_shifts: true,
      allow_debt: true,
      customer_required: true,
      credit_limit_guard: true,
      allow_negative_stock: true,
      rma_returns: true,
      tiered_pricing: true,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: true
    }
  },
  {
    id: 'CUSTOM',
    name: 'Tùy Biến Tự Do (No-Code Custom)',
    shortName: 'Tùy Biến Tự Do',
    iconName: 'Sliders',
    badge: 'Toàn quyền lựa chọn',
    color: '#14b8a6',
    description: 'Tự do tích chọn hoặc bỏ chọn toàn bộ các logic theo mô hình kinh doanh độc nhất của bạn.',
    recommendedFeatures: {
      pos_barcode: true,
      multi_uom: true,
      require_shifts: true,
      allow_debt: false,
      customer_required: false,
      credit_limit_guard: true,
      allow_negative_stock: false,
      rma_returns: true,
      tiered_pricing: false,
      stock_transfers: true,
      stock_audit: true,
      preorder_reservation: false
    }
  }
];

export const BUSINESS_LOGIC_FEATURES: BusinessLogicFeature[] = [
  // 1. NHÓM QUẢN LÝ KHO & ĐA ĐƠN VỊ
  {
    key: 'multi_uom',
    name: 'Đa Đơn Vị Tính & Tự Động Rã Thùng (INV-04)',
    group: 'KHO',
    badge: 'UoM Engine',
    standardRule: 'INV-04',
    description: 'Nhập thùng/bao bán lẻ lon/bì, tự động quy đổi tồn cơ sở mà không cần lập phiếu rã thùng thủ công.'
  },
  {
    key: 'allow_negative_stock',
    name: 'Cho Phép Bán Âm Kho Khi Hàng Chưa Về',
    group: 'KHO',
    badge: 'Âm Kho',
    description: 'Cho phép thu ngân xuất hóa đơn ngay cả khi số lượng tồn thực tế trên hệ thống bằng 0.'
  },
  {
    key: 'stock_transfers',
    name: 'Điều Chuyển Kho 2 Pha & Biên Bản Hao Hụt (INV-06)',
    group: 'KHO',
    badge: '2-Phase Transfer',
    standardRule: 'INV-06',
    description: 'Xuất qua kho trung chuyển đi đường CN-TRANSIT và kiểm đếm xác nhận hao hụt tại kho nhận.'
  },
  {
    key: 'stock_audit',
    name: 'Kiểm Kê Kho Định Kỳ & Thẻ Kho Bất Biến (INV-10)',
    group: 'KHO',
    badge: 'Audit Ledger',
    standardRule: 'INV-10',
    description: 'Tạo phiếu kiểm kê đối soát tồn thực tế và tự sinh giao dịch điều chỉnh thẻ kho bất biến.'
  },

  // 2. NHÓM QUẦY BÁN HÀNG & THU NGÂN
  {
    key: 'pos_barcode',
    name: 'Quét Mã Vạch Barcode Siêu Tốc (F2 / Máy Quét)',
    group: 'BAN_HANG',
    badge: 'Barcode POS',
    description: 'Hỗ trợ máy quét cầm tay hoặc camera nhận diện mã EAN-13, tự động cộng dồn vào giỏ hàng.'
  },
  {
    key: 'require_shifts',
    name: 'Quản Lý Ca Bán & Đối Soát Két Tiền (F8)',
    group: 'BAN_HANG',
    badge: 'Cash Drawer',
    description: 'Thu ngân bắt buộc khai báo tiền đầu ca, hệ thống tự đối soát lệch két khi chốt ca.'
  },
  {
    key: 'tiered_pricing',
    name: 'Phân Cấp Giá Bán Tự Động (Giá Lẻ / Thợ / Sỉ)',
    group: 'BAN_HANG',
    badge: 'Pricelist',
    description: 'Tự động nhảy biểu giá tương ứng khi chọn nhóm khách (Khách vãng lai, Thợ, Nhà thầu).'
  },
  {
    key: 'preorder_reservation',
    name: 'Giữ Chỗ Đơn Hàng Cọc / Đặt Trước (Pre-order)',
    group: 'BAN_HANG',
    badge: 'Reservation',
    description: 'Khóa số lượng hàng đã nhận cọc trong trường reserved, ngăn các đơn khác bán tranh.'
  },

  // 3. NHÓM TÀI CHÍNH & CÔNG NỢ KHÁCH HÀNG
  {
    key: 'allow_debt',
    name: 'Bán Nợ Gối Đầu & Sổ Nợ Khách Hàng 2 Chiều (F3)',
    group: 'TAI_CHINH',
    badge: 'Customer Debt',
    description: 'Cho phép khách hàng mua nợ gối đầu, theo dõi công nợ chi tiết và lập phiếu thu nợ.'
  },
  {
    key: 'customer_required',
    name: 'Bắt Buộc Chọn Khách Hàng Khi Bán Nợ',
    group: 'TAI_CHINH',
    badge: 'Credit Guard',
    description: 'Chặn đứng việc bán nợ cho khách vãng lai/ẩn danh, bảo vệ an toàn dòng tiền.'
  },
  {
    key: 'credit_limit_guard',
    name: 'Chốt Chặn Trần Hạn Mức Tín Dụng (INV-08)',
    group: 'TAI_CHINH',
    badge: 'Limit Guard',
    standardRule: 'INV-08',
    description: 'Hệ thống tự động khóa xuất hàng nếu tổng nợ cũ + nợ mới vượt quá hạn mức nợ của đối tác.'
  },
  {
    key: 'rma_returns',
    name: 'Đổi Trả Hàng Cấn Trừ Trực Tiếp Vào Sổ Nợ (INV-07)',
    group: 'TAI_CHINH',
    badge: 'RMA Return',
    standardRule: 'INV-07',
    description: 'Khách trả hàng được hoàn tiền mặt hoặc cấn trừ trực tiếp làm giảm số dư nợ trên sổ.'
  }
];
