const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runStep2_1() {
  await client.connect();
  console.log('=============================================================================');
  console.log('📖 BƯỚC 2.1 (VI MÔ): TẠO BẢNG TỪ ĐIỂN TÍNH NĂNG (FEATURE_REGISTRY) & NẠP METADATA');
  console.log('=============================================================================\n');

  try {
    // 1. Tạo bảng feature_registry
    console.log('1. Đang tạo bảng public.feature_registry...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.feature_registry (
          key VARCHAR(50) PRIMARY KEY,
          group_name VARCHAR(50) NOT NULL,
          label VARCHAR(255) NOT NULL,
          description TEXT,
          data_type VARCHAR(20) NOT NULL,
          default_value JSONB NOT NULL,
          options JSONB DEFAULT '[]'::jsonb,
          dependencies JSONB DEFAULT '[]'::jsonb,
          allow_branch_override BOOLEAN NOT NULL DEFAULT TRUE,
          is_locked BOOLEAN NOT NULL DEFAULT FALSE,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_feature_registry_group ON public.feature_registry(group_name);
      CREATE INDEX IF NOT EXISTS idx_feature_registry_active ON public.feature_registry(is_active);
    `);
    console.log('   ✅ Bảng public.feature_registry và Indexes đã sẵn sàng.');

    // 2. Nạp danh mục 8 tính năng chuẩn
    console.log('2. Đang nạp danh mục 8 tính năng chuẩn vào Registry...');
    const features = [
      {
        key: 'pos_barcode',
        group_name: 'GIAO_DIEN',
        label: 'Quét mã vạch siêu tốc',
        description: 'Tự động focus ô tìm kiếm, nhập liên tục, quét tít tít tự tăng số lượng giỏ hàng',
        data_type: 'BOOLEAN',
        default_value: JSON.stringify(true),
        options: JSON.stringify([]),
        dependencies: JSON.stringify([]),
        allow_branch_override: true,
        is_locked: false
      },
      {
        key: 'allow_debt',
        group_name: 'TAI_CHINH',
        label: 'Cho phép bán nợ & Hạn mức tín dụng',
        description: 'Cho phép xuất hóa đơn công nợ gối đầu, kiểm tra trần nợ và khóa đơn nợ quá hạn',
        data_type: 'BOOLEAN',
        default_value: JSON.stringify(false),
        options: JSON.stringify([]),
        dependencies: JSON.stringify(['customer_required']),
        allow_branch_override: true,
        is_locked: false
      },
      {
        key: 'customer_required',
        group_name: 'TAI_CHINH',
        label: 'Bắt buộc chọn hồ sơ khách hàng',
        description: 'Không cho phép bán cho khách vãng lai ẩn danh (bắt buộc phải có số điện thoại/tên)',
        data_type: 'BOOLEAN',
        default_value: JSON.stringify(false),
        options: JSON.stringify([]),
        dependencies: JSON.stringify([]),
        allow_branch_override: true,
        is_locked: false
      },
      {
        key: 'allow_negative_stock',
        group_name: 'KHO_HANG',
        label: 'Cho phép xuất bán âm kho',
        description: 'Cho phép xuất kho khi tồn kho = 0 (dành cho hàng đang về chưa kịp nhập máy)',
        data_type: 'BOOLEAN',
        default_value: JSON.stringify(false),
        options: JSON.stringify([]),
        dependencies: JSON.stringify([]),
        allow_branch_override: true,
        is_locked: false
      },
      {
        key: 'require_shifts',
        group_name: 'VAN_HANH',
        label: 'Bắt buộc bàn giao ca & Đối soát két tiền',
        description: 'Mở ca đầu ngày, kiểm đếm tiền mặt thực tế cuối ca để phát hiện lệch két',
        data_type: 'BOOLEAN',
        default_value: JSON.stringify(true),
        options: JSON.stringify([]),
        dependencies: JSON.stringify([]),
        allow_branch_override: false, // Khoá cứng toàn chuỗi theo chuẩn Cal.com
        is_locked: true
      },
      {
        key: 'print_format',
        group_name: 'IN_AN',
        label: 'Khổ in hóa đơn mặc định',
        description: 'Định dạng phiếu khi bấm in: K80 mini nhiệt, A4 phiếu xuất kho hoặc A5',
        data_type: 'SELECT',
        default_value: JSON.stringify('K80'),
        options: JSON.stringify(['K80', 'A4', 'A5']),
        dependencies: JSON.stringify([]),
        allow_branch_override: true,
        is_locked: false
      },
      {
        key: 'track_serial',
        group_name: 'HANG_HOA',
        label: 'Bắt buộc quét mã Serial / IMEI',
        description: 'Bắt buộc nhập Serial từng món để kích hoạt bảo hành điện tử',
        data_type: 'BOOLEAN',
        default_value: JSON.stringify(false),
        options: JSON.stringify([]),
        dependencies: JSON.stringify([]),
        allow_branch_override: true,
        is_locked: false
      },
      {
        key: 'multi_uom',
        group_name: 'HANG_HOA',
        label: 'Bán đa đơn vị quy đổi (Thùng/Lon, Bao/Kg)',
        description: 'Tự động tính tỷ lệ quy đổi và kích hoạt cơ chế rã thùng bán bì INV-04',
        data_type: 'BOOLEAN',
        default_value: JSON.stringify(true),
        options: JSON.stringify([]),
        dependencies: JSON.stringify([]),
        allow_branch_override: true,
        is_locked: false
      }
    ];

    for (const f of features) {
      await client.query(`
        INSERT INTO public.feature_registry (
          key, group_name, label, description, data_type, default_value,
          options, dependencies, allow_branch_override, is_locked
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
        ON CONFLICT (key) DO UPDATE SET
          group_name = EXCLUDED.group_name,
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          data_type = EXCLUDED.data_type,
          default_value = EXCLUDED.default_value,
          options = EXCLUDED.options,
          dependencies = EXCLUDED.dependencies,
          allow_branch_override = EXCLUDED.allow_branch_override,
          is_locked = EXCLUDED.is_locked;
      `, [
        f.key, f.group_name, f.label, f.description, f.data_type,
        f.default_value, f.options, f.dependencies, f.allow_branch_override, f.is_locked
      ]);
    }
    console.log(`   ✅ Đã nạp thành công ${features.length} tính năng vào Registry.`);

    // 3. Kiểm định truy vấn độc lập
    console.log('\n3. Đang kiểm tra xác thực dữ liệu Registry...');
    const regRes = await client.query(`
      SELECT key, group_name, label, data_type, default_value, is_locked, dependencies
      FROM public.feature_registry
      ORDER BY group_name, key;
    `);

    console.log(`   ✅ Tìm thấy ${regRes.rows.length} tính năng hợp lệ trong CSDL:`);
    regRes.rows.forEach(r => {
      const lockBadge = r.is_locked ? '🔒 [LOCKED BY ADMIN]' : '🔓 [CHO PHÉP OVERRIDE]';
      const depBadge = r.dependencies && r.dependencies.length > 0 ? ` (Phụ thuộc: ${JSON.stringify(r.dependencies)})` : '';
      console.log(`      - [${r.group_name}] ${r.key} (${r.data_type}) -> Mặc định: ${JSON.stringify(r.default_value)} | ${lockBadge}${depBadge}`);
    });

    if (regRes.rows.length === 8) {
      console.log('\n=============================================================================');
      console.log('🎉 KẾT QUẢ BƯỚC 2.1: ĐẠT CHUẨN 100%! BẢNG FEATURE_REGISTRY HOÀN HẢO.');
      console.log('=============================================================================');
    } else {
      throw new Error(`Kiểm định thất bại: Số lượng tính năng là ${regRes.rows.length} (Kỳ vọng: 8)`);
    }

  } catch (error) {
    console.error('❌ Lỗi tại Bước 2.1:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep2_1();
