/**
 * ============================================================================
 * ANOMALY & FRAUD DETECTION ALERTS ROUTER (Trụ cột 15 - Cảnh Báo Bất Thường)
 * ============================================================================
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. DANH SÁCH CẢNH BÁO BẤT THƯỜNG
router.get('/', async (req, res) => {
  try {
    const branchId = req.ctx?.branchId;
    const { is_resolved } = req.query;

    let query = `
      SELECT a.*, b.name as branch_name, b.code as branch_code
      FROM public.anomaly_alerts a
      LEFT JOIN public.branches b ON a.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (branchId) {
      params.push(branchId);
      query += ` AND (a.branch_id = $${params.length} OR a.branch_id IS NULL)`;
    }

    if (is_resolved !== undefined) {
      params.push(is_resolved === 'true');
      query += ` AND a.is_resolved = $${params.length}`;
    }

    query += ` ORDER BY a.created_at DESC LIMIT 100`;

    const result = await db.query(query, params);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('🔥 [Anomaly List Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách cảnh báo bất thường' });
  }
});

// 2. KÍCH HOẠT CẢNH BÁO BẤT THƯỜNG MỚI
router.post('/trigger', async (req, res) => {
  try {
    const branchId = req.ctx?.branchId;
    const { alert_type, severity, title, description, metadata } = req.body;

    if (!alert_type || !title) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin cảnh báo bắt buộc' });
    }

    const result = await db.query(
      `INSERT INTO public.anomaly_alerts (
        branch_id, alert_type, severity, title, description, metadata
      ) VALUES ($1, $2, COALESCE($3, 'MEDIUM'), $4, $5, $6)
      RETURNING *`,
      [branchId || null, alert_type, severity, title, description || '', JSON.stringify(metadata || {})]
    );

    res.json({
      success: true,
      message: 'Đã kích hoạt cảnh báo bất thường thành công',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('🔥 [Trigger Anomaly Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi ghi nhận cảnh báo bất thường' });
  }
});

// 3. ĐÁNH DẤU ĐÃ XỬ LÝ CẢNH BÁO
router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.ctx?.userId;

    const result = await db.query(
      `UPDATE public.anomaly_alerts
       SET is_resolved = true,
           resolved_by = $1
       WHERE id = $2
       RETURNING *`,
      [userId || 'MANAGER', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
    }

    res.json({
      success: true,
      message: 'Đã xác nhận giải quyết cảnh báo bất thường',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('🔥 [Resolve Anomaly Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi xử lý cảnh báo' });
  }
});

module.exports = router;
