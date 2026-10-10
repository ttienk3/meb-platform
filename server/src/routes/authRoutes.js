const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'meb_super_secret_jwt_key_2026';

/**
 * POST /api/auth/login
 * Đăng nhập chuẩn hóa bằng Email hoặc SĐT + Mật khẩu cá nhân (A3)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, emailOrPhone, password } = req.body;
    const loginIdentifier = (username || emailOrPhone || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Vui lòng nhập Email/Số điện thoại và Mật khẩu.' }
      });
    }

    // 1. Tìm tài khoản trong public.users
    const userRes = await db.query(`
      SELECT id, organization_id, email, phone, password_hash, full_name, role, is_active
      FROM public.users
      WHERE (LOWER(email) = LOWER($1) OR phone = $1) AND is_active = TRUE
      LIMIT 1;
    `, [loginIdentifier]);

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Tài khoản hoặc mật khẩu không chính xác.' }
      });
    }

    const user = userRes.rows[0];

    // 2. Kiểm tra mật khẩu bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Tài khoản hoặc mật khẩu không chính xác.' }
      });
    }

    // 3. Lấy danh sách chi nhánh được phép truy cập
    let branches = [];
    const accessRes = await db.query(`
      SELECT uba.branch_id, uba.role, uba.is_all_branches, b.code, b.name
      FROM public.user_branch_access uba
      LEFT JOIN public.branches b ON b.id = uba.branch_id
      WHERE uba.user_id = $1 AND uba.is_active = TRUE;
    `, [user.id]);

    const hasAllBranches = accessRes.rows.some(r => r.is_all_branches);
    if (hasAllBranches) {
      // Nếu có quyền toàn chuỗi -> Lấy toàn bộ chi nhánh đang hoạt động
      const allBranchesRes = await db.query(`
        SELECT id, code, name, address, phone 
        FROM public.branches 
        WHERE is_active = TRUE 
        ORDER BY created_at ASC;
      `);
      branches = allBranchesRes.rows;
    } else {
      branches = accessRes.rows
        .filter(r => r.branch_id)
        .map(r => ({
          id: r.branch_id,
          code: r.code,
          name: r.name
        }));
    }

    // 4. Sinh JWT Token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        role: user.role
      },
      accessible_branches: branches
    });
  } catch (err) {
    console.error('🔥 [Auth Login Error]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Lỗi máy chủ khi xác thực đăng nhập: ' + err.message }
    });
  }
});

/**
 * GET /api/auth/me
 * Lấy thông tin tài khoản hiện tại từ Token
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const userIdHeader = req.headers['x-user-id'];
    let userId = userIdHeader;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        userId = decoded.userId;
      } catch {}
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' }
      });
    }

    const userRes = await db.query(`
      SELECT id, organization_id, email, phone, full_name, role, is_active
      FROM public.users
      WHERE id = $1 AND is_active = TRUE
      LIMIT 1;
    `, [userId]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy thông tin tài khoản.' }
      });
    }

    const user = userRes.rows[0];

    // Lấy lại danh sách chi nhánh
    let branches = [];
    const accessRes = await db.query(`
      SELECT uba.branch_id, uba.is_all_branches, b.code, b.name
      FROM public.user_branch_access uba
      LEFT JOIN public.branches b ON b.id = uba.branch_id
      WHERE uba.user_id = $1 AND uba.is_active = TRUE;
    `, [user.id]);

    const hasAll = accessRes.rows.some(r => r.is_all_branches);
    if (hasAll) {
      const allB = await db.query('SELECT id, code, name FROM public.branches WHERE is_active = TRUE ORDER BY created_at ASC;');
      branches = allB.rows;
    } else {
      branches = accessRes.rows.filter(r => r.branch_id).map(r => ({ id: r.branch_id, code: r.code, name: r.name }));
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        role: user.role
      },
      accessible_branches: branches
    });
  } catch (err) {
    console.error('🔥 [Auth Me Error]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Đăng xuất tài khoản thành công.'
  });
});

module.exports = router;
