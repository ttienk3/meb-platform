const { resolveBranchContext } = require('../services/configService');

/**
 * Middleware phân giải ngữ cảnh chi nhánh & thẩm quyền (RequestContext)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function requestContext(req, res, next) {
  const branchId = req.headers['x-branch-id'];
  const userId = req.headers['x-user-id'];

  if (!branchId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_BRANCH_CONTEXT',
        message: 'Yêu cầu Header "x-branch-id" để xác định ngữ cảnh vận hành của chi nhánh.'
      }
    });
  }

  try {
    const context = await resolveBranchContext(userId, branchId);

    if (!context.authorized) {
      return res.status(403).json({
        success: false,
        error: {
          code: context.code || 'BRANCH_ACCESS_DENIED',
          message: context.message || 'Bạn không có quyền truy cập hoặc làm việc tại chi nhánh này.'
        }
      });
    }

    req.ctx = {
      userId: userId || null,
      branchId: context.branch.id,
      branch: context.branch,
      features: context.features,
      featureMeta: context.featureMeta
    };

    next();
  } catch (err) {
    console.error('🔥 [RequestContext Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Lỗi máy chủ khi phân giải ngữ cảnh chi nhánh.',
        detail: err.message
      }
    });
  }
}

module.exports = requestContext;
