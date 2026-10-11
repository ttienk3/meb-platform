/**
 * SEED SẢN PHẨM & TỒN KHO ĐA CHI NHÁNH CHUẨN THỰC CHIẾN MEB POS
 * Bơm danh mục 24 sản phẩm đa ngành hàng kèm tồn kho và giá bán chi nhánh
 */

const { pool } = require('../server/src/db');

const BRANCH_Q1 = '01a10c53-0367-7d6e-9a77-48fa6504cc23'; // CN-Q1
const BRANCH_Q12 = '01a10c53-0370-78bd-9fea-db96c1e16565'; // CN-Q12
const BRANCH_03 = '01a11a0d-738d-757b-8649-9fa8dc60c836'; // CN-03 Kho Tổng

const PRODUCTS = [
  // 1. Đồ uống
  {
    code: 'SP-TIGER',
    name: 'Bia Tiger Nâu 330ml',
    category: 'Đồ uống',
    base_uom: 'Lon',
    barcodes: [
      { uom: 'Lon', rate: 1, barcode: '8934822101018', price_retail: 17000, price_wholesale: 16000, price_contractor: 16500 },
      { uom: 'Thùng', rate: 24, barcode: '8934822101025', price_retail: 385000, price_wholesale: 375000, price_contractor: 375000 }
    ],
    default_cost_price: 13000,
    default_selling_price: 17000,
    image_url: 'https://images.unsplash.com/photo-1608270146039-652f144bfd72?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 530, [BRANCH_Q12]: 96, [BRANCH_03]: 2400 }
  },
  {
    code: 'SP-HEINEKEN',
    name: 'Bia Heineken Silver 330ml',
    category: 'Đồ uống',
    base_uom: 'Lon',
    barcodes: [
      { uom: 'Lon', rate: 1, barcode: '8934822202015', price_retail: 21000, price_wholesale: 19500, price_contractor: 20000 },
      { uom: 'Thùng', rate: 24, barcode: '8934822202022', price_retail: 440000, price_wholesale: 425000, price_contractor: 430000 }
    ],
    default_cost_price: 16500,
    default_selling_price: 21000,
    image_url: 'https://images.unsplash.com/photo-1618886614638-80e3c15cd819?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 288, [BRANCH_Q12]: 48, [BRANCH_03]: 1200 }
  },
  {
    code: 'SP-COCA',
    name: 'Nước Ngọt Coca Cola 320ml',
    category: 'Đồ uống',
    base_uom: 'Lon',
    barcodes: [
      { uom: 'Lon', rate: 1, barcode: '8934588012117', price_retail: 10000, price_wholesale: 9000, price_contractor: 9500 },
      { uom: 'Lốc', rate: 6, barcode: '8934588012124', price_retail: 58000, price_wholesale: 53000, price_contractor: 55000 },
      { uom: 'Thùng', rate: 24, barcode: '8934588012131', price_retail: 215000, price_wholesale: 205000, price_contractor: 210000 }
    ],
    default_cost_price: 7500,
    default_selling_price: 10000,
    image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 450, [BRANCH_Q12]: 120, [BRANCH_03]: 3000 }
  },
  {
    code: 'SP-AQUAFINA',
    name: 'Nước Suối Aquafina 500ml',
    category: 'Đồ uống',
    base_uom: 'Chai',
    barcodes: [
      { uom: 'Chai', rate: 1, barcode: '8934588111117', price_retail: 6000, price_wholesale: 5000, price_contractor: 5500 },
      { uom: 'Thùng', rate: 24, barcode: '8934588111124', price_retail: 105000, price_wholesale: 98000, price_contractor: 100000 }
    ],
    default_cost_price: 4000,
    default_selling_price: 6000,
    image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 600, [BRANCH_Q12]: 150, [BRANCH_03]: 5000 }
  },
  {
    code: 'SP-REDBULL',
    name: 'Nước Tăng Lực Red Bull Thái 250ml',
    category: 'Đồ uống',
    base_uom: 'Lon',
    barcodes: [
      { uom: 'Lon', rate: 1, barcode: '8850228000151', price_retail: 14000, price_wholesale: 12500, price_contractor: 13000 },
      { uom: 'Thùng', rate: 24, barcode: '8850228000243', price_retail: 310000, price_wholesale: 295000, price_contractor: 300000 }
    ],
    default_cost_price: 11000,
    default_selling_price: 14000,
    image_url: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 340, [BRANCH_Q12]: 80, [BRANCH_03]: 1800 }
  },
  {
    code: 'SP-RUOU',
    name: 'Rượu Vang Đà Lạt Classic 750ml',
    category: 'Đồ uống',
    base_uom: 'Chai',
    barcodes: [
      { uom: 'Chai', rate: 1, barcode: '8935001100012', price_retail: 250000, price_wholesale: 230000, price_contractor: 240000 }
    ],
    default_cost_price: 150000,
    default_selling_price: 250000,
    image_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 25, [BRANCH_Q12]: 12, [BRANCH_03]: 200 }
  },

  // 2. Bánh kẹo & Ăn vặt
  {
    code: 'SP-BANH',
    name: 'Bánh Quy Cosy Marie 336g',
    category: 'Bánh kẹo',
    base_uom: 'Hộp',
    barcodes: [
      { uom: 'Hộp', rate: 1, barcode: '8934680010115', price_retail: 50000, price_wholesale: 44000, price_contractor: 46000 }
    ],
    default_cost_price: 30000,
    default_selling_price: 50000,
    image_url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 85, [BRANCH_Q12]: 20, [BRANCH_03]: 500 }
  },
  {
    code: 'SP-CHOCOPIE',
    name: 'Bánh Chocopie Orion Hộp 12 Cái',
    category: 'Bánh kẹo',
    base_uom: 'Hộp',
    barcodes: [
      { uom: 'Hộp', rate: 1, barcode: '8936036010018', price_retail: 58000, price_wholesale: 52000, price_contractor: 54000 },
      { uom: 'Thùng', rate: 8, barcode: '8936036010087', price_retail: 440000, price_wholesale: 410000, price_contractor: 420000 }
    ],
    default_cost_price: 45000,
    default_selling_price: 58000,
    image_url: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 120, [BRANCH_Q12]: 35, [BRANCH_03]: 800 }
  },
  {
    code: 'SP-OREO',
    name: 'Bánh Quy Oreo Socola Vani 133g',
    category: 'Bánh kẹo',
    base_uom: 'Gói',
    barcodes: [
      { uom: 'Gói', rate: 1, barcode: '8934680020114', price_retail: 18000, price_wholesale: 15500, price_contractor: 16500 }
    ],
    default_cost_price: 13000,
    default_selling_price: 18000,
    image_url: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 160, [BRANCH_Q12]: 40, [BRANCH_03]: 1000 }
  },
  {
    code: 'SP-LAYS',
    name: 'Snack Khoai Tây Lay\'s Tự Nhiên 54g',
    category: 'Bánh kẹo',
    base_uom: 'Gói',
    barcodes: [
      { uom: 'Gói', rate: 1, barcode: '8934588301112', price_retail: 12000, price_wholesale: 10000, price_contractor: 11000 }
    ],
    default_cost_price: 8500,
    default_selling_price: 12000,
    image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 220, [BRANCH_Q12]: 50, [BRANCH_03]: 1500 }
  },

  // 3. Sữa & Thực phẩm dinh dưỡng
  {
    code: 'SP-VINAMILK',
    name: 'Sữa Tươi Tiệt Trùng Vinamilk 1L',
    category: 'Sữa & Bơ phẩm',
    base_uom: 'Hộp',
    barcodes: [
      { uom: 'Hộp', rate: 1, barcode: '8934673100014', price_retail: 38000, price_wholesale: 34000, price_contractor: 35000 },
      { uom: 'Thùng', rate: 12, barcode: '8934673100120', price_retail: 430000, price_wholesale: 400000, price_contractor: 410000 }
    ],
    default_cost_price: 29000,
    default_selling_price: 38000,
    image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 140, [BRANCH_Q12]: 30, [BRANCH_03]: 900 }
  },
  {
    code: 'SP-TH-TRUE',
    name: 'Sữa Tươi TH True MILK Ít Đường 180ml',
    category: 'Sữa & Bơ phẩm',
    base_uom: 'Lốc',
    barcodes: [
      { uom: 'Lốc', rate: 1, barcode: '8936034100018', price_retail: 34000, price_wholesale: 31000, price_contractor: 32000 },
      { uom: 'Thùng', rate: 12, barcode: '8936034100124', price_retail: 390000, price_wholesale: 365000, price_contractor: 375000 }
    ],
    default_cost_price: 26000,
    default_selling_price: 34000,
    image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 95, [BRANCH_Q12]: 25, [BRANCH_03]: 600 }
  },
  {
    code: 'SP-ONG-THO',
    name: 'Sữa Đặc Có Đường Ông Thọ Đỏ 380g',
    category: 'Sữa & Bơ phẩm',
    base_uom: 'Lon',
    barcodes: [
      { uom: 'Lon', rate: 1, barcode: '8934673200011', price_retail: 26000, price_wholesale: 23500, price_contractor: 24500 },
      { uom: 'Thùng', rate: 24, barcode: '8934673200240', price_retail: 590000, price_wholesale: 550000, price_contractor: 565000 }
    ],
    default_cost_price: 20000,
    default_selling_price: 26000,
    image_url: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 180, [BRANCH_Q12]: 60, [BRANCH_03]: 1200 }
  },

  // 4. Gia vị & Thực phẩm khô
  {
    code: 'SP-MI-HAOHAO',
    name: 'Mì Hảo Hảo Tôm Chua Cay 75g',
    category: 'Gia vị & Hàng khô',
    base_uom: 'Gói',
    barcodes: [
      { uom: 'Gói', rate: 1, barcode: '8934563138171', price_retail: 4500, price_wholesale: 3800, price_contractor: 4000 },
      { uom: 'Thùng', rate: 30, barcode: '8934563138300', price_retail: 125000, price_wholesale: 112000, price_contractor: 118000 }
    ],
    default_cost_price: 3300,
    default_selling_price: 4500,
    image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 720, [BRANCH_Q12]: 240, [BRANCH_03]: 4500 }
  },
  {
    code: 'SP-DAU-TUONG-AN',
    name: 'Dầu Ăn Tường An Cooking Oil 1L',
    category: 'Gia vị & Hàng khô',
    base_uom: 'Chai',
    barcodes: [
      { uom: 'Chai', rate: 1, barcode: '8934591010018', price_retail: 48000, price_wholesale: 43000, price_contractor: 45000 },
      { uom: 'Thùng', rate: 12, barcode: '8934591010124', price_retail: 550000, price_wholesale: 505000, price_contractor: 520000 }
    ],
    default_cost_price: 38000,
    default_selling_price: 48000,
    image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 110, [BRANCH_Q12]: 45, [BRANCH_03]: 800 }
  },
  {
    code: 'SP-GAO-ST25',
    name: 'Gạo Đặc Sản ST25 Thượng Hạng 5kg',
    category: 'Gia vị & Hàng khô',
    base_uom: 'Túi',
    barcodes: [
      { uom: 'Túi', rate: 1, barcode: '8938501234015', price_retail: 175000, price_wholesale: 155000, price_contractor: 160000 },
      { uom: 'Bao', rate: 5, barcode: '8938501234053', price_retail: 820000, price_wholesale: 750000, price_contractor: 780000 }
    ],
    default_cost_price: 135000,
    default_selling_price: 175000,
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 65, [BRANCH_Q12]: 30, [BRANCH_03]: 500 }
  },

  // 5. Kim khí, Xây dựng & Sơn
  {
    code: 'SP-XIMANG',
    name: 'Xi Măng Hà Tiên Đa Dụng PCB40',
    category: 'Vật liệu & Xây dựng',
    base_uom: 'Bao',
    barcodes: [
      { uom: 'Bao', rate: 1, barcode: 'XM-HT-BAO', price_retail: 92000, price_wholesale: 84000, price_contractor: 87000 },
      { uom: 'Tấn', rate: 20, barcode: 'XM-HT-TAN', price_retail: 1800000, price_wholesale: 1650000, price_contractor: 1700000 }
    ],
    default_cost_price: 78000,
    default_selling_price: 92000,
    image_url: 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 80, [BRANCH_Q12]: 650, [BRANCH_03]: 3000 }
  },
  {
    code: 'SP-DINH-THEP',
    name: 'Đinh Thép Đóng Gỗ 5 Phân',
    category: 'Kim khí',
    base_uom: 'Kg',
    barcodes: [
      { uom: 'Kg', rate: 1, barcode: 'DINH-5P-KG', price_retail: 35000, price_wholesale: 30000, price_contractor: 32000 }
    ],
    default_cost_price: 24000,
    default_selling_price: 35000,
    image_url: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 290, [BRANCH_Q12]: 480, [BRANCH_03]: 2000 }
  },
  {
    code: 'SP-SON-DULUX',
    name: 'Sơn Nước Dulux EasyClean 5L',
    category: 'Sơn & Hóa chất',
    base_uom: 'Thùng',
    barcodes: [
      { uom: 'Thùng', rate: 1, barcode: 'DULUX-5L', price_retail: 550000, price_wholesale: 480000, price_contractor: 510000 }
    ],
    default_cost_price: 400000,
    default_selling_price: 550000,
    image_url: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 40, [BRANCH_Q12]: 320, [BRANCH_03]: 1200 }
  },
  {
    code: 'SP-THEP-HOAPHAT',
    name: 'Thép Cuộn Hòa Phát Phi 6 D6',
    category: 'Vật liệu & Xây dựng',
    base_uom: 'Kg',
    barcodes: [
      { uom: 'Kg', rate: 1, barcode: 'THEP-HP-D6', price_retail: 17500, price_wholesale: 16000, price_contractor: 16800 }
    ],
    default_cost_price: 14500,
    default_selling_price: 17500,
    image_url: 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 0, [BRANCH_Q12]: 2500, [BRANCH_03]: 15000 }
  },

  // 6. Hóa mỹ phẩm & Tẩy rửa
  {
    code: 'SP-OMO',
    name: 'Bột Giặt OMO Comfort Tinh Dầu Thơm 5.5kg',
    category: 'Hóa mỹ phẩm',
    base_uom: 'Túi',
    barcodes: [
      { uom: 'Túi', rate: 1, barcode: '8934868120015', price_retail: 245000, price_wholesale: 220000, price_contractor: 230000 }
    ],
    default_cost_price: 185000,
    default_selling_price: 245000,
    image_url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 75, [BRANCH_Q12]: 90, [BRANCH_03]: 600 }
  },
  {
    code: 'SP-SUNLIGHT',
    name: 'Nước Rửa Chén Sunlight Chanh 3.6kg',
    category: 'Hóa mỹ phẩm',
    base_uom: 'Can',
    barcodes: [
      { uom: 'Can', rate: 1, barcode: '8934868210013', price_retail: 98000, price_wholesale: 88000, price_contractor: 92000 }
    ],
    default_cost_price: 72000,
    default_selling_price: 98000,
    image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 130, [BRANCH_Q12]: 85, [BRANCH_03]: 750 }
  },

  // 7. Combo & Quà tặng
  {
    code: 'SP-COMBO',
    name: 'Giỏ Quà Tết Sum Vầy (1 Rượu + 2 Bánh)',
    category: 'Quà tặng',
    base_uom: 'Giỏ',
    barcodes: [
      { uom: 'Giỏ', rate: 1, barcode: 'GIO-TET-01', price_retail: 340000, price_wholesale: 320000, price_contractor: 330000 }
    ],
    is_combo: true,
    combo_items: [
      { qty: 1, code: 'SP-RUOU' },
      { qty: 2, code: 'SP-BANH' }
    ],
    default_cost_price: 210000,
    default_selling_price: 340000,
    image_url: 'https://images.unsplash.com/photo-1543257580-7269da773bf5?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 15, [BRANCH_Q12]: 8, [BRANCH_03]: 100 }
  },
  {
    code: 'SP-COMBO-TIEC',
    name: 'Combo Tiệc Bia & Ăn Vặt (1 Thùng Tiger + 2 Bánh)',
    category: 'Quà tặng',
    base_uom: 'Combo',
    barcodes: [
      { uom: 'Combo', rate: 1, barcode: 'COMBO-TIEC-01', price_retail: 470000, price_wholesale: 450000, price_contractor: 460000 }
    ],
    is_combo: true,
    combo_items: [
      { qty: 1, code: 'SP-TIGER' },
      { qty: 2, code: 'SP-BANH' }
    ],
    default_cost_price: 345000,
    default_selling_price: 470000,
    image_url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=500&auto=format&fit=crop&q=80',
    stock: { [BRANCH_Q1]: 20, [BRANCH_Q12]: 10, [BRANCH_03]: 150 }
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🚀 Đang nạp dữ liệu danh mục 24 sản phẩm và tồn kho đa chi nhánh...');
    await client.query('BEGIN');

    for (const p of PRODUCTS) {
      // 1. Upsert product
      const productRes = await client.query(`
        INSERT INTO public.products (
          code, name, category, base_uom, barcodes, is_combo, combo_items,
          default_cost_price, default_selling_price, image_url, is_active, is_deleted
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, FALSE)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          base_uom = EXCLUDED.base_uom,
          barcodes = EXCLUDED.barcodes,
          is_combo = EXCLUDED.is_combo,
          combo_items = EXCLUDED.combo_items,
          default_cost_price = EXCLUDED.default_cost_price,
          default_selling_price = EXCLUDED.default_selling_price,
          image_url = EXCLUDED.image_url,
          is_active = TRUE,
          is_deleted = FALSE,
          updated_at = NOW()
        RETURNING id;
      `, [
        p.code,
        p.name,
        p.category,
        p.base_uom,
        JSON.stringify(p.barcodes || []),
        Boolean(p.is_combo),
        JSON.stringify(p.combo_items || []),
        p.default_cost_price,
        p.default_selling_price,
        p.image_url
      ]);

      const productId = productRes.rows[0].id;

      // 2. Upsert inventory cho 3 chi nhánh
      for (const [branchId, onHand] of Object.entries(p.stock)) {
        await client.query(`
          INSERT INTO public.inventory (
            branch_id, product_id, on_hand, reserved, cost_price, updated_at
          )
          VALUES ($1, $2, $3, 0, $4, NOW())
          ON CONFLICT (branch_id, product_id) DO UPDATE SET
            on_hand = EXCLUDED.on_hand,
            cost_price = EXCLUDED.cost_price,
            updated_at = NOW();
        `, [
          branchId,
          productId,
          onHand,
          p.default_cost_price
        ]);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Đã nạp thành công ${PRODUCTS.length} sản phẩm & cập nhật tồn kho 3 chi nhánh!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi nạp dữ liệu:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
