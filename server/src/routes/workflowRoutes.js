const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/workflows
 * Lấy danh sách toàn bộ luật tự động hóa của chi nhánh & hệ thống
 */
router.get('/', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const result = await db.query(`
      SELECT id, branch_id, name, trigger_event, condition_config, action_config, is_active, created_at
      FROM public.automation_rules
      WHERE branch_id = $1::uuid OR branch_id IS NULL
      ORDER BY created_at DESC;
    `, [branchId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Workflow Rules Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'WORKFLOW_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/workflows
 * Tạo luật tự động hóa mới
 */
router.post('/', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { name, trigger_event, condition_config = {}, action_config = {} } = req.body;

    if (!name || !trigger_event) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Tên luật và Sự kiện kích hoạt (trigger_event) là bắt buộc' }
      });
    }

    const result = await db.query(`
      INSERT INTO public.automation_rules (branch_id, name, trigger_event, condition_config, action_config, is_active)
      VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, TRUE)
      RETURNING *;
    `, [branchId, name.trim(), trigger_event, JSON.stringify(condition_config), JSON.stringify(action_config)]);

    res.json({
      success: true,
      message: 'Đã tạo luật tự động hóa thành công',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Create Workflow Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'WORKFLOW_CREATE_FAILED', message: err.message }
    });
  }
});

/**
 * PUT /api/workflows/:id/toggle
 * Bật / tắt trạng thái hoạt động của luật
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const result = await db.query(`
      UPDATE public.automation_rules
      SET is_active = NOT is_active
      WHERE id = $1::uuid
      RETURNING *;
    `, [ruleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Luật không tồn tại' }
      });
    }

    res.json({
      success: true,
      message: `Đã ${result.rows[0].is_active ? 'BẬT' : 'TẮT'} luật tự động hóa thành công`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Toggle Workflow Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'WORKFLOW_TOGGLE_FAILED', message: err.message }
    });
  }
});

/**
 * DELETE /api/workflows/:id
 * Xóa luật tự động hóa
 */
router.delete('/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    await db.query('DELETE FROM public.automation_rules WHERE id = $1::uuid;', [ruleId]);

    res.json({
      success: true,
      message: 'Đã xóa luật tự động hóa thành công'
    });
  } catch (err) {
    console.error('🔥 [Delete Workflow Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'WORKFLOW_DELETE_FAILED', message: err.message }
    });
  }
});

module.exports = router;
