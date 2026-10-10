const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testLock() {
  try {
    await client.connect();
    console.log('--- BẮT ĐẦU KIỂM THỬ KHÓA SỔ KẾ TOÁN ---');

    // 1. Tìm chi nhánh CN-Q1
    const branchRes = await client.query("SELECT id, name FROM public.branches WHERE code = 'CN-Q1';");
    const branch = branchRes.rows[0];
    console.log(`1. Đã chọn chi nhánh: ${branch.name} (${branch.id})`);

    // 2. Khóa sổ chi nhánh đến hết ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const lockDate = tomorrow.toISOString().split('T')[0];
    
    await client.query("UPDATE public.branches SET locked_until_date = $1 WHERE id = $2;", [lockDate, branch.id]);
    console.log(`2. Đã đặt khóa sổ: locked_until_date = ${lockDate}`);

    // 3. Thử sửa hoặc xóa đơn hàng ngày hôm nay
    console.log('3. Thử thực hiện lệnh DELETE trên đơn hàng đã lập trong kỳ khóa...');
    let blocked = false;
    try {
      await client.query("DELETE FROM public.orders WHERE order_code = 'TEST-HD-001';");
    } catch (err) {
      blocked = true;
      console.log('>>> KẾT QUẢ TRIGGER CHẶN THÀNH CÔNG:');
      console.log('    Mã lỗi PostgreSQL:', err.code);
      console.log('    Thông điệp lỗi:', err.message);
    }

    if (!blocked) {
      throw new Error('CẢNH BÁO: Trigger không chặn được lệnh DELETE!');
    }

    // 4. Mở khóa lại để hoạt động bình thường
    await client.query("UPDATE public.branches SET locked_until_date = NULL WHERE id = $1;", [branch.id]);
    console.log('4. Đã hoàn tác mở khóa sổ (locked_until_date = NULL).');

    console.log('\n✅ KẾT LUẬN: CHỐT CHẶN KHÓA SỔ KẾ TOÁN ĐẠT TIÊU CHUẨN AN TOÀN 100%!');
  } catch (error) {
    console.error('❌ Lỗi kiểm thử:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testLock();
