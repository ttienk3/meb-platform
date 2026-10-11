const db = require('../db');

// In-Memory LRU/TTL Cache (High Performance < 1ms)
const configCache = new Map(); // branchId -> { data, expiresAt }
const accessCache = new Map(); // `${userId}:${branchId}` -> { hasAccess, expiresAt }

const CONFIG_TTL_MS = 30000; // 30s
const ACCESS_TTL_MS = 15000; // 15s

/**
 * Xóa cache khi có thay đổi cấu hình
 * @param {string} [branchId] 
 */
function invalidateBranchConfig(branchId) {
  if (branchId) {
    configCache.delete(branchId);
  } else {
    configCache.clear();
  }
}

/**
 * Xóa cache quyền người dùng
 * @param {string} [userId]
 */
function invalidateUserAccess(userId) {
  if (userId) {
    for (const key of accessCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        accessCache.delete(key);
      }
    }
  } else {
    accessCache.clear();
  }
}

/**
 * Kiểm tra quyền truy cập chi nhánh của người dùng qua RPC CSDL (có In-Memory Cache)
 * @param {string} userId - UUID người dùng
 * @param {string} branchId - UUID chi nhánh
 * @returns {Promise<boolean>}
 */
async function verifyBranchAccess(userId, branchId) {
  if (!userId || !branchId) return false;

  const cacheKey = `${userId}:${branchId}`;
  const cached = accessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.hasAccess;
  }
  
  const query = 'SELECT public.has_branch_access($1::uuid, $2::uuid) AS has_access;';
  const res = await db.query(query, [userId, branchId]);
  const hasAccess = Boolean(res.rows[0]?.has_access);

  accessCache.set(cacheKey, {
    hasAccess,
    expiresAt: Date.now() + ACCESS_TTL_MS
  });

  return hasAccess;
}

/**
 * Lấy cấu hình runtime hữu hiệu của chi nhánh qua RPC CSDL get_effective_branch_config (có In-Memory Cache)
 * @param {string} branchId - UUID chi nhánh
 * @returns {Promise<{ branch: object, features: object, featureMeta: object }>}
 */
async function getBranchRuntimeConfig(branchId) {
  if (!branchId) throw new Error('Yêu cầu branchId để lấy cấu hình runtime');

  // Kiểm tra cache bộ nhớ
  const cached = configCache.get(branchId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 1. Lấy thông tin cơ bản của chi nhánh (hỗ trợ cả UUID lẫn Mã chi nhánh như CN-Q1)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
  const branchRes = isUuid
    ? await db.query(
        'SELECT id, code, name, organization_id, is_active FROM public.branches WHERE id = $1::uuid;',
        [branchId]
      )
    : await db.query(
        'SELECT id, code, name, organization_id, is_active FROM public.branches WHERE code = $1 OR name = $1 LIMIT 1;',
        [branchId]
      );
  if (branchRes.rows.length === 0) {
    throw new Error(`Chi nhánh không tồn tại: ${branchId}`);
  }
  const branch = branchRes.rows[0];

  // 2. Gọi RPC get_effective_branch_config để giải quyết thừa kế 3 tầng
  const configRes = await db.query(
    'SELECT * FROM public.get_effective_branch_config($1::uuid);',
    [branch.id]
  );

  const features = {};
  const featureMeta = {};

  for (const row of configRes.rows) {
    let parsedVal = row.effective_value;
    if (row.data_type === 'BOOLEAN') {
      parsedVal = (parsedVal === true || parsedVal === 'true');
    } else if (row.data_type === 'NUMBER') {
      parsedVal = Number(parsedVal);
    }

    features[row.feature_key] = parsedVal;
    featureMeta[row.feature_key] = {
      group: row.group_name,
      label: row.label,
      dataType: row.data_type,
      source: row.source,
      isOverridden: row.is_overridden,
      isLocked: row.is_locked,
      options: row.options,
      dependencies: row.dependencies
    };
  }

  const result = {
    branch,
    features,
    featureMeta
  };

  configCache.set(branchId, {
    data: result,
    expiresAt: Date.now() + CONFIG_TTL_MS
  });

  return result;
}

/**
 * Phân giải toàn bộ Context của Request (Xác thực quyền + Tải cấu hình thừa kế)
 * @param {string} userId - UUID người dùng
 * @param {string} branchId - UUID chi nhánh
 */
async function resolveBranchContext(userId, branchId) {
  if (!branchId) {
    return {
      authorized: false,
      code: 'MISSING_BRANCH_CONTEXT',
      message: 'Thiếu định danh chi nhánh (Header x-branch-id)'
    };
  }

  // 1. Tải cấu hình hữu hiệu thời gian thực & phân giải chi nhánh
  const runtime = await getBranchRuntimeConfig(branchId);
  const resolvedBranchId = runtime.branch.id;

  // 2. Kiểm tra quyền truy cập nếu có userId
  if (userId) {
    const hasAccess = await verifyBranchAccess(userId, resolvedBranchId);
    if (!hasAccess) {
      return {
        authorized: false,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập hoặc làm việc tại chi nhánh này'
      };
    }
  }

  return {
    authorized: true,
    branch: runtime.branch,
    features: runtime.features,
    featureMeta: runtime.featureMeta
  };
}

module.exports = {
  verifyBranchAccess,
  getBranchRuntimeConfig,
  resolveBranchContext,
  invalidateBranchConfig,
  invalidateUserAccess
};
