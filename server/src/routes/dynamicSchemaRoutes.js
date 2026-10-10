const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * ============================================================================
 * MEB NO-CODE DYNAMIC SCHEMA ENGINE - QUẢN LÝ BẢNG, TRƯỜNG & NÚT HÀNH ĐỘNG TỰ ĐỘNG
 * ============================================================================
 */

// 1. LẤY DANH SÁCH BẢNG CSDL TÙY TẠO
router.get('/tables', async (req, res) => {
  try {
    const tablesRes = await db.query(`
      SELECT 
        t.id, t.code, t.name, t.description, t.icon, t.category, t.is_active, t.created_at,
        COUNT(DISTINCT f.id)::int as fields_count,
        COUNT(DISTINCT a.id)::int as actions_count,
        COUNT(DISTINCT r.id)::int as records_count
      FROM custom_schema_tables t
      LEFT JOIN custom_schema_fields f ON t.id = f.table_id
      LEFT JOIN custom_schema_actions a ON t.id = a.table_id
      LEFT JOIN custom_entity_records r ON t.id = r.table_id
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `);

    return res.json({
      success: true,
      count: tablesRes.rows.length,
      data: tablesRes.rows
    });
  } catch (err) {
    console.error('🔥 [Schema Get Tables Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_GET_TABLES_ERROR', message: err.message }
    });
  }
});

// 2. TẠO BẢNG CSDL MỚI HOÀN TOÀN KHÔNG CẦN VIẾT CODE
router.post('/tables', async (req, res) => {
  try {
    const { code, name, description, icon = 'Database', category = 'GENERAL', organization_id } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Mã bảng (code) và Tên bảng (name) là bắt buộc' }
      });
    }

    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Kiểm tra trùng mã
    const existing = await db.query('SELECT id FROM custom_schema_tables WHERE code = $1', [cleanCode]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: `Bảng với mã "${cleanCode}" đã tồn tại trên hệ thống.` }
      });
    }

    const orgId = organization_id || '01a10f4b-b9dc-7cd4-b40d-607315c6587d'; // Mặc định MEB Group

    const insertRes = await db.query(`
      INSERT INTO custom_schema_tables (organization_id, code, name, description, icon, category, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [orgId, cleanCode, name.trim(), description || '', icon, category]);

    const newTable = insertRes.rows[0];

    // Tự động tạo sẵn 1 trường định danh mặc định cho bảng (Code / Tên)
    await db.query(`
      INSERT INTO custom_schema_fields (table_id, field_key, field_label, data_type, is_required, sort_order)
      VALUES 
        ($1, 'title', 'Tiêu Đề / Tên Định Danh', 'TEXT', true, 1),
        ($1, 'notes', 'Ghi Chú Nghiệp Vụ', 'TEXT', false, 2)
    `, [newTable.id]);

    // Tự động tạo 1 nút hành động đổi trạng thái mặc định
    await db.query(`
      INSERT INTO custom_schema_actions (table_id, action_key, label, color, icon, action_type, sort_order)
      VALUES ($1, 'act_approve', 'Phê Duyệt', 'success', 'CheckCircle2', 'UPDATE_STATUS', 1)
    `, [newTable.id]);

    return res.status(201).json({
      success: true,
      message: `Đã tạo thành công Bảng dữ liệu "${name}" (${cleanCode})`,
      data: newTable
    });
  } catch (err) {
    console.error('🔥 [Schema Create Table Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_CREATE_TABLE_ERROR', message: err.message }
    });
  }
});

// 3. XÓA BẢNG CSDL TÙY TẠO (KÈM TOÀN BỘ CỘT & DỮ LIỆU)
router.delete('/tables/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tableRes = await db.query('SELECT id, code, name FROM custom_schema_tables WHERE id = $1', [id]);
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Không tìm thấy bảng' } });
    }

    const table = tableRes.rows[0];

    // Xóa cascade dữ liệu con
    await db.query('DELETE FROM custom_entity_records WHERE table_id = $1', [id]);
    await db.query('DELETE FROM custom_schema_actions WHERE table_id = $1', [id]);
    await db.query('DELETE FROM custom_schema_fields WHERE table_id = $1', [id]);
    await db.query('DELETE FROM custom_schema_tables WHERE id = $1', [id]);

    return res.json({
      success: true,
      message: `Đã xóa hoàn toàn bảng "${table.name}" (${table.code}) và toàn bộ dữ liệu đi kèm`
    });
  } catch (err) {
    console.error('🔥 [Schema Delete Table Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_DELETE_TABLE_ERROR', message: err.message }
    });
  }
});

// 4. LẤY DANH SÁCH TRƯỜNG DỮ LIỆU CỦA 1 BẢNG
router.get('/tables/:tableCode/fields', async (req, res) => {
  try {
    const { tableCode } = req.params;
    const tableRes = await db.query('SELECT id, code, name FROM custom_schema_tables WHERE code = $1', [tableCode]);
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Không tìm thấy bảng ${tableCode}` } });
    }

    const tableId = tableRes.rows[0].id;
    const fieldsRes = await db.query(`
      SELECT id, field_key, field_label, data_type, options, relation_table, is_required, default_value, sort_order
      FROM custom_schema_fields
      WHERE table_id = $1
      ORDER BY sort_order ASC, created_at ASC
    `, [tableId]);

    return res.json({
      success: true,
      table: tableRes.rows[0],
      count: fieldsRes.rows.length,
      data: fieldsRes.rows
    });
  } catch (err) {
    console.error('🔥 [Schema Get Fields Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_GET_FIELDS_ERROR', message: err.message }
    });
  }
});

// 5. THÊM TRƯỜNG MỚI VÀO BẢNG CSDL (TEXT, NUMBER, CURRENCY, SELECT, DATE, BOOLEAN...)
router.post('/tables/:tableCode/fields', async (req, res) => {
  try {
    const { tableCode } = req.params;
    const { field_key, field_label, data_type = 'TEXT', options = [], relation_table = null, is_required = false, default_value = null, sort_order = 0 } = req.body;

    if (!field_key || !field_label) {
      return res.status(400).json({
        success: false,
        error: { message: 'Mã trường (field_key) và Nhãn trường (field_label) là bắt buộc' }
      });
    }

    const cleanKey = field_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const tableRes = await db.query('SELECT id, code, name FROM custom_schema_tables WHERE code = $1', [tableCode]);
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Không tìm thấy bảng ${tableCode}` } });
    }

    const tableId = tableRes.rows[0].id;

    // Kiểm tra trùng field_key trong cùng bảng
    const existing = await db.query('SELECT id FROM custom_schema_fields WHERE table_id = $1 AND field_key = $2', [tableId, cleanKey]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: `Trường "${cleanKey}" đã tồn tại trong bảng ${tableCode}` }
      });
    }

    const insertRes = await db.query(`
      INSERT INTO custom_schema_fields (table_id, field_key, field_label, data_type, options, relation_table, is_required, default_value, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [tableId, cleanKey, field_label.trim(), data_type.toUpperCase(), JSON.stringify(options), relation_table, is_required, default_value, sort_order]);

    return res.status(201).json({
      success: true,
      message: `Đã thêm trường "${field_label}" (${cleanKey}) vào bảng ${tableCode}`,
      data: insertRes.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Schema Create Field Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_CREATE_FIELD_ERROR', message: err.message }
    });
  }
});

// 6. XÓA TRƯỜNG DỮ LIỆU CỦA BẢNG
router.delete('/tables/:tableCode/fields/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;
    await db.query('DELETE FROM custom_schema_fields WHERE id = $1', [fieldId]);
    return res.json({ success: true, message: 'Đã xóa trường dữ liệu thành công' });
  } catch (err) {
    console.error('🔥 [Schema Delete Field Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_DELETE_FIELD_ERROR', message: err.message }
    });
  }
});

// 7. LẤY DANH SÁCH NÚT HÀNH ĐỘNG TÙY BIẾN CỦA BẢNG
router.get('/tables/:tableCode/actions', async (req, res) => {
  try {
    const { tableCode } = req.params;
    const tableRes = await db.query('SELECT id FROM custom_schema_tables WHERE code = $1', [tableCode]);
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Không tìm thấy bảng ${tableCode}` } });
    }

    const actionsRes = await db.query(`
      SELECT id, action_key, label, color, icon, action_type, config, sort_order
      FROM custom_schema_actions
      WHERE table_id = $1
      ORDER BY sort_order ASC, created_at ASC
    `, [tableRes.rows[0].id]);

    return res.json({
      success: true,
      count: actionsRes.rows.length,
      data: actionsRes.rows
    });
  } catch (err) {
    console.error('🔥 [Schema Get Actions Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_GET_ACTIONS_ERROR', message: err.message }
    });
  }
});

// 8. TẠO NÚT HÀNH ĐỘNG TÙY BIẾN CHO GIAO DIỆN (ACTION BUTTON BUILDER)
router.post('/tables/:tableCode/actions', async (req, res) => {
  try {
    const { tableCode } = req.params;
    const { action_key, label, color = 'primary', icon = 'Zap', action_type = 'UPDATE_STATUS', config = {}, sort_order = 0 } = req.body;

    if (!action_key || !label) {
      return res.status(400).json({
        success: false,
        error: { message: 'Mã nút (action_key) và Nhãn nút (label) là bắt buộc' }
      });
    }

    const tableRes = await db.query('SELECT id FROM custom_schema_tables WHERE code = $1', [tableCode]);
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Không tìm thấy bảng ${tableCode}` } });
    }

    const cleanKey = action_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const insertRes = await db.query(`
      INSERT INTO custom_schema_actions (table_id, action_key, label, color, icon, action_type, config, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [tableRes.rows[0].id, cleanKey, label.trim(), color, icon, action_type, JSON.stringify(config), sort_order]);

    return res.status(201).json({
      success: true,
      message: `Đã tạo nút hành động "${label}" cho bảng ${tableCode}`,
      data: insertRes.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Schema Create Action Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_CREATE_ACTION_ERROR', message: err.message }
    });
  }
});

// 9. XÓA NÚT HÀNH ĐỘNG
router.delete('/tables/:tableCode/actions/:actionId', async (req, res) => {
  try {
    const { actionId } = req.params;
    await db.query('DELETE FROM custom_schema_actions WHERE id = $1', [actionId]);
    return res.json({ success: true, message: 'Đã xóa nút hành động thành công' });
  } catch (err) {
    console.error('🔥 [Schema Delete Action Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEMA_DELETE_ACTION_ERROR', message: err.message }
    });
  }
});

module.exports = router;
