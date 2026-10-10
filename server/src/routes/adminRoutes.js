const express = require('express');
const db = require('../db');
const { invalidateBranchConfig } = require('../services/configService');

const router = express.Router();

/**
 * GET /api/admin/features/registry
 * Lấy toàn bộ từ điển tính năng gốc của hệ thống (Feature Registry)
 */
router.get('/features/registry', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT key, group_name, label, description, data_type, default_value, is_locked, options, dependencies
      FROM public.feature_registry
      WHERE is_active = TRUE
      ORDER BY group_name, key;
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Admin Feature Registry Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRY_QUERY_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/admin/features/branch/:branchId
 * Lấy ma trận cấu hình thừa kế thời gian thực của một chi nhánh
 */
router.get('/features/branch/:branchId', async (req, res) => {
  try {
    const branchId = req.params.branchId;
    const branchRes = await db.query('SELECT id, code, name, organization_id FROM public.branches WHERE id = $1::uuid;', [branchId]);
    if (branchRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'BRANCH_NOT_FOUND', message: 'Chi nhánh không tồn tại' }
      });
    }

    const configRes = await db.query('SELECT * FROM public.get_effective_branch_config($1::uuid);', [branchId]);

    res.json({
      success: true,
      branch: branchRes.rows[0],
      count: configRes.rows.length,
      data: configRes.rows
    });
  } catch (err) {
    console.error('🔥 [Admin Branch Config Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'BRANCH_CONFIG_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/admin/features/override
 * Lưu thiết lập ghi đè (Override) cờ tính năng cho chi nhánh
 * (Kích hoạt Trigger fn_guard_branch_override và fn_audit_branch_overrides)
 */
router.post('/features/override', async (req, res) => {
  try {
    const { branch_id, feature_key, value, updated_by } = req.body;

    if (!branch_id || !feature_key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu branch_id, feature_key và value' }
      });
    }

    // Insert hoặc Update Override
    const result = await db.query(`
      INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
      VALUES ($1::uuid, $2, $3::jsonb, $4)
      ON CONFLICT (branch_id, feature_key) DO UPDATE 
      SET value = EXCLUDED.value, 
          updated_by = EXCLUDED.updated_by, 
          updated_at = clock_timestamp()
      RETURNING branch_id, feature_key, value, updated_at;
    `, [branch_id, feature_key, JSON.stringify(value), updated_by || 'Admin Studio']);

    // Tự động xóa In-Memory Cache của chi nhánh để phản hồi tức thì
    invalidateBranchConfig(branch_id);

    res.json({
      success: true,
      message: `Đã cập nhật tính năng "${feature_key}" cho chi nhánh thành công`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Admin Override Error]:', err.message);
    res.status(400).json({
      success: false,
      error: {
        code: 'OVERRIDE_REJECTED',
        message: err.message
      }
    });
  }
});

/**
 * POST /api/admin/features/batch-override
 * Lưu hàng loạt thiết lập cờ tính năng cho chi nhánh (Ma trận No-Code)
 */
router.post('/features/batch-override', async (req, res) => {
  try {
    const { branch_id, overrides, updated_by } = req.body;

    if (!branch_id || !overrides || typeof overrides !== 'object') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu branch_id và overrides object' }
      });
    }

    // Sắp xếp các key: đảm bảo dependencies (như customer_required) được insert trước các cờ phụ thuộc (như allow_debt)
    if (overrides.allow_debt && overrides.customer_required === undefined) {
      overrides.customer_required = true;
    }

    const sortedEntries = Object.entries(overrides).sort(([aKey], [bKey]) => {
      if (aKey === 'customer_required') return -1;
      if (bKey === 'customer_required') return 1;
      return 0;
    });

    for (const [featKey, featVal] of sortedEntries) {
      await db.query(`
        INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
        VALUES ($1::uuid, $2, $3::jsonb, $4)
        ON CONFLICT (branch_id, feature_key) DO UPDATE 
        SET value = EXCLUDED.value, 
            updated_by = EXCLUDED.updated_by, 
            updated_at = clock_timestamp();
      `, [branch_id, featKey, JSON.stringify(featVal), updated_by || 'Admin No-Code Studio']);
    }

    // Đồng bộ vào toggles trên bảng branches nếu có các key tương ứng
    const branchToggles = {};
    if (overrides.multi_uom !== undefined) branchToggles.has_uom = Boolean(overrides.multi_uom);
    if (overrides.allow_debt !== undefined) branchToggles.has_debt = Boolean(overrides.allow_debt);
    if (overrides.require_shifts !== undefined) branchToggles.has_shifts = Boolean(overrides.require_shifts);
    if (overrides.pos_barcode !== undefined) branchToggles.has_barcode = Boolean(overrides.pos_barcode);
    if (overrides.allow_negative_stock !== undefined) branchToggles.allow_negative_stock = Boolean(overrides.allow_negative_stock);

    if (Object.keys(branchToggles).length > 0) {
      await db.query(`
        UPDATE public.branches 
        SET toggles = toggles || $2::jsonb 
        WHERE id = $1::uuid;
      `, [branch_id, JSON.stringify(branchToggles)]);
    }

    // Xóa cache
    invalidateBranchConfig(branch_id);

    res.json({
      success: true,
      message: `Đã áp dụng thành công ${Object.keys(overrides).length} tính năng cho chi nhánh`
    });
  } catch (err) {
    console.error('🔥 [Admin Batch Override Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'BATCH_OVERRIDE_FAILED', message: err.message }
    });
  }
});

/**
 * DELETE /api/admin/features/override
 * Hủy ghi đè riêng của chi nhánh -> Hoàn nguyên về mặc định của tổ chức
 */
router.delete('/features/override', async (req, res) => {
  try {
    const { branch_id, feature_key } = req.body;

    if (!branch_id || !feature_key) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu branch_id và feature_key' }
      });
    }

    await db.query(`
      DELETE FROM public.branch_feature_overrides 
      WHERE branch_id = $1::uuid AND feature_key = $2;
    `, [branch_id, feature_key]);

    // Xóa cache để khôi phục mặc định tổ chức ngay lập tức
    invalidateBranchConfig(branch_id);

    res.json({
      success: true,
      message: `Đã khôi phục tính năng "${feature_key}" về mặc định của doanh nghiệp`
    });
  } catch (err) {
    console.error('🔥 [Admin Reset Override Error]:', err.message);
    res.status(400).json({
      success: false,
      error: {
        code: 'RESET_OVERRIDE_FAILED',
        message: err.message
      }
    });
  }
});

// =============================================================================
// QUẢN TRỊ DANH MỤC CHI NHÁNH & NHẬT KÝ KIỂM TOÁN (BRANCHES & AUDIT LOGS)
// =============================================================================

/**
 * GET /api/admin/branches
 * Lấy danh sách toàn bộ chi nhánh của hệ thống (kèm thông tin Toggles & Tổ chức)
 */
router.get('/branches', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        b.id,
        b.code,
        b.name,
        b.organization_id,
        o.name AS organization_name,
        b.phone,
        b.address,
        b.toggles,
        b.is_active,
        b.created_at
      FROM public.branches b
      LEFT JOIN public.organizations o ON b.organization_id = o.id
      ORDER BY b.created_at ASC;
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Admin Branches Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'BRANCHES_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/admin/branches
 * Tạo thêm chi nhánh hoàn toàn mới & khởi tạo Persona nghiệp vụ
 */
router.post('/branches', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { 
      code, 
      name, 
      phone, 
      address, 
      persona_type, 
      industry_domain, 
      feature_overrides, 
      toggles, 
      organization_id 
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Mã và Tên chi nhánh là bắt buộc' }
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    // 1. Kiểm tra mã chi nhánh không được trùng
    const checkDup = await client.query('SELECT id FROM public.branches WHERE code = $1;', [cleanCode]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_BRANCH_CODE', message: `Mã chi nhánh "${cleanCode}" đã tồn tại trên hệ thống` }
      });
    }

    // 2. Lấy organization_id (mặc định lấy tổ chức của CN-Q1 nếu không truyền)
    let orgId = organization_id;
    if (!orgId) {
      const orgRes = await client.query("SELECT organization_id FROM public.branches WHERE code = 'CN-Q1' LIMIT 1;");
      orgId = orgRes.rows[0]?.organization_id;
    }

    // Cấu hình toggles khởi tạo
    const initialToggles = toggles || {
      has_uom: feature_overrides?.multi_uom !== undefined ? Boolean(feature_overrides.multi_uom) : true,
      has_debt: feature_overrides?.allow_debt !== undefined ? Boolean(feature_overrides.allow_debt) : (persona_type === 'CONTRACTOR'),
      has_shifts: feature_overrides?.require_shifts !== undefined ? Boolean(feature_overrides.require_shifts) : true,
      has_barcode: feature_overrides?.pos_barcode !== undefined ? Boolean(feature_overrides.pos_barcode) : (persona_type !== 'CONTRACTOR'),
      allow_negative_stock: feature_overrides?.allow_negative_stock !== undefined ? Boolean(feature_overrides.allow_negative_stock) : false,
      industry_domain: industry_domain || (persona_type === 'CONTRACTOR' ? 'BUILDING_PAINT' : persona_type === 'WAREHOUSE' ? 'LOGISTICS_WAREHOUSE' : 'RETAIL_GROCERY')
    };

    await client.query('BEGIN');

    // 3. Tạo chi nhánh mới
    const branchRes = await client.query(`
      INSERT INTO public.branches (code, name, phone, address, organization_id, toggles, is_active)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE)
      RETURNING *;
    `, [cleanCode, cleanName, phone || '', address || '', orgId, JSON.stringify(initialToggles)]);

    const newBranch = branchRes.rows[0];

    // 4. Khởi tạo tồn kho ban đầu (inventory) cho chi nhánh mới với tất cả sản phẩm
    await client.query(`
      INSERT INTO public.inventory (branch_id, product_id, on_hand, reserved, cost_price)
      SELECT $1::uuid, id, 100, 0, default_cost_price 
      FROM public.products
      ON CONFLICT DO NOTHING;
    `, [newBranch.id]);

    if (feature_overrides && typeof feature_overrides === 'object' && Object.keys(feature_overrides).length > 0) {
      if (feature_overrides.allow_debt && feature_overrides.customer_required === undefined) {
        feature_overrides.customer_required = true;
      }
      const sortedEntries = Object.entries(feature_overrides).sort(([aKey], [bKey]) => {
        if (aKey === 'customer_required') return -1;
        if (bKey === 'customer_required') return 1;
        return 0;
      });
      for (const [featKey, featVal] of sortedEntries) {
        await client.query(`
          INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
          VALUES ($1::uuid, $2, $3::jsonb, 'No-Code Matrix Onboarding')
          ON CONFLICT (branch_id, feature_key) DO UPDATE SET value = EXCLUDED.value;
        `, [newBranch.id, featKey, JSON.stringify(featVal)]);
      }
    } else {
      // Fallback theo Persona nghiệp vụ cũ
      if (persona_type === 'CONTRACTOR') {
        await client.query(`
          INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
          VALUES 
            ($1::uuid, 'customer_required', 'true'::jsonb, 'System Onboarding'),
            ($1::uuid, 'allow_debt', 'true'::jsonb, 'System Onboarding')
          ON CONFLICT (branch_id, feature_key) DO UPDATE SET value = EXCLUDED.value;
        `, [newBranch.id]);
      } else if (persona_type === 'RETAIL') {
        await client.query(`
          INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
          VALUES 
            ($1::uuid, 'pos_barcode', 'true'::jsonb, 'System Onboarding'),
            ($1::uuid, 'allow_debt', 'false'::jsonb, 'System Onboarding')
          ON CONFLICT (branch_id, feature_key) DO UPDATE SET value = EXCLUDED.value;
        `, [newBranch.id]);
      } else if (persona_type === 'WAREHOUSE') {
        await client.query(`
          INSERT INTO public.branch_feature_overrides (branch_id, feature_key, value, updated_by)
          VALUES 
            ($1::uuid, 'multi_uom', 'true'::jsonb, 'System Onboarding'),
            ($1::uuid, 'allow_negative_stock', 'false'::jsonb, 'System Onboarding')
          ON CONFLICT (branch_id, feature_key) DO UPDATE SET value = EXCLUDED.value;
        `, [newBranch.id]);
      }
    }

    await client.query('COMMIT');

    // 6. Xóa cache cấu hình chi nhánh mới
    invalidateBranchConfig(newBranch.id);

    res.status(201).json({
      success: true,
      message: `Đã tạo thành công chi nhánh mới "${newBranch.code} - ${newBranch.name}"`,
      data: newBranch
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('🔥 [Create Branch Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'BRANCH_CREATE_FAILED', message: err.message }
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/audit-logs
 * Xem nhật ký kiểm toán thay đổi cấu hình tính năng (Config Audit Ledger)
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { branch_id, limit } = req.query;
    const maxLimit = parseInt(limit, 10) || 50;

    let queryText = `
      SELECT 
        l.id,
        l.organization_id,
        l.branch_id,
        b.name AS branch_name,
        b.code AS branch_code,
        l.feature_key,
        l.action,
        l.old_value,
        l.new_value,
        l.changed_by,
        l.created_at
      FROM public.config_audit_logs l
      LEFT JOIN public.branches b ON l.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (branch_id) {
      params.push(branch_id);
      queryText += ` AND l.branch_id = $${params.length}::uuid`;
    }

    queryText += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1};`;
    params.push(maxLimit);

    const result = await db.query(queryText, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Admin Audit Logs Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'AUDIT_LOGS_QUERY_FAILED', message: err.message }
    });
  }
});

module.exports = router;
