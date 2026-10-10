const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * ============================================================================
 * MEB NO-CODE DYNAMIC DATA & CUSTOM ACTION RUNTIME ENGINE
 * Tự động sinh CRUD REST API & kích hoạt Nút hành động tùy biến cho mọi Bảng CSDL
 * ============================================================================
 */

// 1. TỰ ĐỘNG SINH API TRUY VẤN DỮ LIỆU ĐỘNG (GET /api/dynamic/:tableCode)
router.get('/:tableCode', async (req, res) => {
  try {
    const { tableCode } = req.params;
    const { branch_id, q, limit = 50, offset = 0, status } = req.query;

    // Lấy thông tin cấu trúc Bảng
    const tableRes = await db.query('SELECT id, code, name, description, icon, category FROM custom_schema_tables WHERE code = $1', [tableCode]);
    if (tableRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: `Bảng dữ liệu "${tableCode}" không tồn tại.` }
      });
    }

    const table = tableRes.rows[0];

    // Lấy danh sách trường (Fields) và nút hành động (Actions) của bảng
    const [fieldsRes, actionsRes] = await Promise.all([
      db.query(`SELECT id, field_key, field_label, data_type, options, is_required, default_value, sort_order 
                FROM custom_schema_fields WHERE table_id = $1 ORDER BY sort_order ASC`, [table.id]),
      db.query(`SELECT id, action_key, label, color, icon, action_type, config, sort_order 
                FROM custom_schema_actions WHERE table_id = $1 ORDER BY sort_order ASC`, [table.id])
    ]);

    // Xây dựng câu truy vấn dữ liệu động từ custom_entity_records
    let queryText = `
      SELECT r.id, r.table_id, r.table_code, r.branch_id, r.record_data, r.status, r.created_by, r.created_at, r.updated_at,
             b.name as branch_name, b.code as branch_code
      FROM custom_entity_records r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.table_id = $1
    `;
    const params = [table.id];

    if (branch_id && branch_id !== 'ALL') {
      params.push(branch_id);
      queryText += ` AND (r.branch_id = $${params.length} OR r.branch_id IS NULL)`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND r.status = $${params.length}`;
    }

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      queryText += ` AND LOWER(r.record_data::text) LIKE $${params.length}`;
    }

    queryText += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const recordsRes = await db.query(queryText, params);

    // Lấy tổng số bản ghi
    const countRes = await db.query('SELECT count(*)::int FROM custom_entity_records WHERE table_id = $1', [table.id]);

    return res.json({
      success: true,
      meta: {
        table,
        fields: fieldsRes.rows,
        actions: actionsRes.rows,
        total: countRes.rows[0].count,
        count: recordsRes.rows.length
      },
      data: recordsRes.rows
    });
  } catch (err) {
    console.error('🔥 [Dynamic Query Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'DYNAMIC_QUERY_ERROR', message: err.message }
    });
  }
});

// 2. TỰ ĐỘNG SINH API TẠO BẢN GHI ĐỘNG KÈM VALIDATION THEO SCHEMA (POST /api/dynamic/:tableCode)
router.post('/:tableCode', async (req, res) => {
  try {
    const { tableCode } = req.params;
    const { record_data = {}, branch_id = null, status = 'ACTIVE', created_by = 'HQ_ADMIN' } = req.body;

    const tableRes = await db.query('SELECT id, code, name FROM custom_schema_tables WHERE code = $1', [tableCode]);
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Bảng "${tableCode}" không tồn tại.` } });
    }
    const tableId = tableRes.rows[0].id;

    // Kiểm tra các trường bắt buộc
    const requiredFields = await db.query(`
      SELECT field_key, field_label 
      FROM custom_schema_fields 
      WHERE table_id = $1 AND is_required = true
    `, [tableId]);

    const missingFields = [];
    for (const f of requiredFields.rows) {
      const val = record_data[f.field_key];
      if (val === undefined || val === null || val === '') {
        missingFields.push(f.field_label);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: `Vui lòng nhập các trường bắt buộc: ${missingFields.join(', ')}` }
      });
    }

    const insertRes = await db.query(`
      INSERT INTO custom_entity_records (table_id, table_code, branch_id, record_data, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [tableId, tableCode, branch_id, JSON.stringify(record_data), status, created_by]);

    return res.status(201).json({
      success: true,
      message: `Đã lưu bản ghi mới vào bảng ${tableCode} thành công`,
      data: insertRes.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Dynamic Create Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'DYNAMIC_CREATE_ERROR', message: err.message }
    });
  }
});

// 3. CẬP NHẬT BẢN GHI ĐỘNG (PUT /api/dynamic/:tableCode/:id)
router.put('/:tableCode/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { record_data, status, branch_id } = req.body;

    const recordRes = await db.query('SELECT * FROM custom_entity_records WHERE id = $1', [id]);
    if (recordRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Không tìm thấy bản ghi' } });
    }

    const current = recordRes.rows[0];
    const newRecordData = record_data ? { ...current.record_data, ...record_data } : current.record_data;
    const newStatus = status !== undefined ? status : current.status;
    const newBranchId = branch_id !== undefined ? branch_id : current.branch_id;

    const updateRes = await db.query(`
      UPDATE custom_entity_records
      SET record_data = $1, status = $2, branch_id = $3, updated_at = clock_timestamp()
      WHERE id = $4
      RETURNING *
    `, [JSON.stringify(newRecordData), newStatus, newBranchId, id]);

    return res.json({
      success: true,
      message: 'Cập nhật bản ghi thành công',
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Dynamic Update Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'DYNAMIC_UPDATE_ERROR', message: err.message }
    });
  }
});

// 4. XÓA BẢN GHI ĐỘNG (DELETE /api/dynamic/:tableCode/:id)
router.delete('/:tableCode/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM custom_entity_records WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Đã xóa bản ghi thành công' });
  } catch (err) {
    console.error('🔥 [Dynamic Delete Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'DYNAMIC_DELETE_ERROR', message: err.message }
    });
  }
});

// 5. KÍCH HOẠT NÚT HÀNH ĐỘNG TÙY BIẾN TRÊN BẢN GHI (POST /api/dynamic/:tableCode/:id/action/:actionKey)
router.post('/:tableCode/:id/action/:actionKey', async (req, res) => {
  try {
    const { tableCode, id, actionKey } = req.params;
    const { note = '', payload = {} } = req.body;

    const [tableRes, recordRes] = await Promise.all([
      db.query('SELECT id, code, name FROM custom_schema_tables WHERE code = $1', [tableCode]),
      db.query('SELECT * FROM custom_entity_records WHERE id = $1', [id])
    ]);

    if (tableRes.rows.length === 0 || recordRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Bảng hoặc bản ghi không tồn tại' } });
    }

    const tableId = tableRes.rows[0].id;
    const record = recordRes.rows[0];

    // Lấy định nghĩa nút hành động
    const actionRes = await db.query(`
      SELECT * FROM custom_schema_actions 
      WHERE table_id = $1 AND action_key = $2
    `, [tableId, actionKey]);

    if (actionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Nút hành động "${actionKey}" không tồn tại trên bảng ${tableCode}` } });
    }

    const action = actionRes.rows[0];
    let newStatus = record.status;
    const updatedData = { ...record.record_data };

    // Xử lý loại hành động
    if (action.action_type === 'UPDATE_STATUS') {
      // Đổi trạng thái theo config hoặc theo key
      newStatus = action.config?.target_status || action.action_key.toUpperCase().replace('ACT_', '');
      updatedData._last_action = {
        action_key: actionKey,
        label: action.label,
        timestamp: new Date().toISOString(),
        note: note || `Đã thực thi nút "${action.label}"`
      };
    } else {
      updatedData._last_action = {
        action_key: actionKey,
        label: action.label,
        timestamp: new Date().toISOString(),
        payload
      };
    }

    const updateRes = await db.query(`
      UPDATE custom_entity_records
      SET status = $1, record_data = $2, updated_at = clock_timestamp()
      WHERE id = $3
      RETURNING *
    `, [newStatus, JSON.stringify(updatedData), id]);

    return res.json({
      success: true,
      message: `Đã thực thi thành công thao tác "${action.label}"`,
      action: {
        key: action.action_key,
        label: action.label,
        type: action.action_type
      },
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Dynamic Action Trigger Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'DYNAMIC_ACTION_ERROR', message: err.message }
    });
  }
});

module.exports = router;
