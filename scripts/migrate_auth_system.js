/**
 * Migration & Seed: Hệ thống Xác thực Chuẩn hóa (Standardized Auth - A3)
 * Tạo bảng public.users, băm mật khẩu bằng bcryptjs, và liên kết phân quyền với public.user_branch_access
 */
const bcrypt = require('bcryptjs');
const db = require('../server/src/db');

async function migrateAuth() {
  console.log('🚀 [Auth Migration]: Bắt đầu cài đặt hệ thống người dùng & phân quyền chuẩn hóa...');
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Tạo bảng public.users
    console.log('📌 [1/3] Tạo bảng public.users...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
          organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
          email VARCHAR(255) UNIQUE,
          phone VARCHAR(50) UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'CASHIER', -- 'SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'
          avatar_url TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_users_login_lookup ON public.users(email, phone, is_active);
      CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(organization_id);
    `);

    // 2. Lấy organization_id & branches
    const orgRes = await client.query('SELECT id FROM public.organizations WHERE code = \'ORG-MEB-01\' LIMIT 1;');
    if (orgRes.rows.length === 0) {
      throw new Error('Không tìm thấy tổ chức ORG-MEB-01');
    }
    const orgId = orgRes.rows[0].id;

    const branchesRes = await client.query('SELECT id, code FROM public.branches;');
    const branchMap = {};
    for (const b of branchesRes.rows) {
      branchMap[b.code] = b.id;
    }

    // 3. Chuẩn bị danh sách tài khoản mẫu
    console.log('📌 [2/3] Băm mật khẩu và nạp tài khoản chuẩn hóa...');
    const salt = await bcrypt.genSalt(10);
    const usersToSeed = [
      {
        email: 'admin@meb.local',
        phone: '0901000001',
        password: 'Admin123456',
        full_name: 'Quản Trị Viên Hệ Thống',
        role: 'SUPER_ADMIN',
        is_all_branches: true,
        branch_id: null
      },
      {
        email: 'manager.q1@meb.local',
        phone: '0901000002',
        password: 'Manager123',
        full_name: 'Trần Quản Lý (CN Q1)',
        role: 'BRANCH_MANAGER',
        is_all_branches: false,
        branch_id: branchMap['CN-Q1']
      },
      {
        email: 'cashier.q1@meb.local',
        phone: '0901000003',
        password: 'Cashier123',
        full_name: 'Nguyễn Thu Ngân 01 (CN Q1)',
        role: 'CASHIER',
        is_all_branches: false,
        branch_id: branchMap['CN-Q1']
      },
      {
        email: 'cashier.q12@meb.local',
        phone: '0901000004',
        password: 'Cashier123',
        full_name: 'Lê Thu Ngân 02 (CN Q12)',
        role: 'CASHIER',
        is_all_branches: false,
        branch_id: branchMap['CN-Q12']
      }
    ];

    for (const u of usersToSeed) {
      const hash = await bcrypt.hash(u.password, salt);

      // Upsert vào public.users
      const userRes = await client.query(`
        INSERT INTO public.users (
          organization_id, email, phone, password_hash, full_name, role, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, TRUE
        )
        ON CONFLICT (email) DO UPDATE SET 
          password_hash = $4,
          full_name = $5,
          role = $6,
          updated_at = clock_timestamp()
        RETURNING id;
      `, [orgId, u.email, u.phone, hash, u.full_name, u.role]);

      const userId = userRes.rows[0].id;

      // Xóa quyền cũ nếu có để gán lại sạch sẽ
      await client.query('DELETE FROM public.user_branch_access WHERE user_id = $1;', [userId]);

      // Gán quyền truy cập chi nhánh vào public.user_branch_access
      await client.query(`
        INSERT INTO public.user_branch_access (
          user_id, organization_id, branch_id, role, is_all_branches, is_primary, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, TRUE, TRUE
        );
      `, [userId, orgId, u.branch_id, u.role, u.is_all_branches]);

      console.log(`   ✅ Đã nạp tài khoản: ${u.email} [${u.role}] (Pass: ${u.password})`);
    }

    await client.query('COMMIT;');
    console.log('📌 [3/3] Hoàn tất cài đặt hệ thống Xác thực Chuẩn hóa!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('🔥 [Auth Migration Error]:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrateAuth();
