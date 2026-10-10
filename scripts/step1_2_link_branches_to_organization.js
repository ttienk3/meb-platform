const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runStep1_2() {
  await client.connect();
  console.log('=============================================================================');
  console.log('🔗 BƯỚC 1.2 (VI MÔ): BỔ SUNG KHÓA NGOẠI VÀ LIÊN KẾT 2 CHI NHÁNH VỀ TỔ CHỨC MẸ');
  console.log('=============================================================================\n');

  try {
    // 1. Lấy ID của Tổ chức mẹ ORG-MEB-01
    const orgRes = await client.query(`SELECT id, code, name FROM public.organizations WHERE code = 'ORG-MEB-01';`);
    if (orgRes.rows.length === 0) {
      throw new Error('Chưa tìm thấy tổ chức ORG-MEB-01. Cần chạy bước 1.1 trước!');
    }
    const orgId = orgRes.rows[0].id;
    console.log(`1. Xác định Tổ chức mẹ: ${orgRes.rows[0].name} (ID: ${orgId})`);

    // 2. Thêm cột organization_id vào bảng branches (nếu chưa có)
    console.log('2. Đang bổ sung cột organization_id và Khóa ngoại vào bảng public.branches...');
    await client.query(`
      ALTER TABLE public.branches 
      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

      CREATE INDEX IF NOT EXISTS idx_branches_organization ON public.branches(organization_id);
    `);
    console.log('   ✅ Đã thêm cột organization_id và Index thành công.');

    // 3. Cập nhật 2 chi nhánh hiện hữu về tổ chức mẹ
    console.log('3. Đang liên kết 2 chi nhánh CN-Q1 và CN-Q12 vào Tổ chức mẹ...');
    const updateRes = await client.query(`
      UPDATE public.branches 
      SET organization_id = $1,
          updated_at = clock_timestamp()
      WHERE code IN ('CN-Q1', 'CN-Q12')
      RETURNING code, name, organization_id;
    `, [orgId]);

    console.log(`   ✅ Đã cập nhật ${updateRes.rows.length} chi nhánh:`);
    updateRes.rows.forEach(r => {
      console.log(`      - Chi nhánh: [${r.code}] ${r.name} -> Thuộc Org ID: ${r.organization_id}`);
    });

    // 4. Kiểm định toàn vẹn qua phép JOIN thực tế
    console.log('\n4. Đang kiểm định truy vấn JOIN giữa branches và organizations...');
    const joinRes = await client.query(`
      SELECT b.code as branch_code, b.name as branch_name, o.code as org_code, o.name as org_name
      FROM public.branches b
      JOIN public.organizations o ON o.id = b.organization_id
      WHERE o.code = 'ORG-MEB-01'
      ORDER BY b.code;
    `);

    if (joinRes.rows.length < 2) {
      throw new Error(`Kiểm định thất bại: Chỉ tìm thấy ${joinRes.rows.length} chi nhánh liên kết (Kỳ vọng >= 2)`);
    }

    // 5. Thử nghiệm bẫy an toàn: Cố tình xóa Organization mẹ khi còn chi nhánh -> Phải bị chặn đứng
    console.log('5. Đang kiểm tra bẫy an toàn (Chặn xóa cha khi còn con)...');
    let deleteBlocked = false;
    try {
      await client.query(`DELETE FROM public.organizations WHERE id = $1;`, [orgId]);
    } catch (err) {
      if (err.message.includes('violates foreign key constraint') || err.message.includes('update or delete on table')) {
        deleteBlocked = true;
      }
    }

    if (deleteBlocked) {
      console.log('   ✅ Ràng buộc toàn vẹn đạt chuẩn: CSDL từ chối xóa tổ chức mẹ khi còn chi nhánh!');
    } else {
      throw new Error('Ràng buộc thất bại: Database cho phép xóa mồ côi tổ chức cha!');
    }

    console.log('\n=============================================================================');
    console.log('🎉 KẾT QUẢ BƯỚC 1.2: ĐẠT CHUẨN 100%! QUAN HỆ TỔ CHỨC -> CHI NHÁNH HOÀN THIỆN.');
    console.log('=============================================================================');

  } catch (error) {
    console.error('❌ Lỗi tại Bước 1.2:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStep1_2();
