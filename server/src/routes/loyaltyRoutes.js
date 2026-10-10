/**
 * ============================================================================
 * LOYALTY & REWARD POINTS ROUTER (Trụ cột 5 - Tích Điểm & Đổi Thưởng)
 * ============================================================================
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. LẤY CẤU HÌNH TÍCH ĐIỂM CỦA CHI NHÁNH
router.get('/config', async (req, res) => {
  try {
    const branchId = req.ctx?.branchId;
    const result = await db.query(
      `SELECT * FROM public.loyalty_configs 
       WHERE branch_id = $1 OR branch_id IS NULL 
       ORDER BY branch_id NULLS LAST LIMIT 1`,
      [branchId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          earn_rate_pct: 1.0,
          redeem_value_per_point: 1000,
          min_points_to_redeem: 10,
          expiry_months: 12,
          is_active: true
        }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('🔥 [Loyalty Config Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải cấu hình Loyalty' });
  }
});

// 2. CẬP NHẬT CẤU HÌNH TÍCH ĐIỂM
router.post('/config', async (req, res) => {
  try {
    const branchId = req.ctx?.branchId;
    const { earn_rate_pct, redeem_value_per_point, min_points_to_redeem, expiry_months, is_active } = req.body;

    const existing = await db.query(
      `SELECT id FROM public.loyalty_configs WHERE branch_id = $1`,
      [branchId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE public.loyalty_configs
         SET earn_rate_pct = COALESCE($1, earn_rate_pct),
             redeem_value_per_point = COALESCE($2, redeem_value_per_point),
             min_points_to_redeem = COALESCE($3, min_points_to_redeem),
             expiry_months = COALESCE($4, expiry_months),
             is_active = COALESCE($5, is_active),
             updated_at = clock_timestamp()
         WHERE branch_id = $6
         RETURNING *`,
        [earn_rate_pct, redeem_value_per_point, min_points_to_redeem, expiry_months, is_active, branchId]
      );
    } else {
      result = await db.query(
        `INSERT INTO public.loyalty_configs (branch_id, earn_rate_pct, redeem_value_per_point, min_points_to_redeem, expiry_months, is_active)
         VALUES ($1, COALESCE($2, 1.0), COALESCE($3, 1000), COALESCE($4, 10), COALESCE($5, 12), COALESCE($6, true))
         RETURNING *`,
        [branchId, earn_rate_pct, redeem_value_per_point, min_points_to_redeem, expiry_months, is_active]
      );
    }

    res.json({
      success: true,
      message: 'Cập nhật cấu hình tích điểm thành công',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('🔥 [Update Loyalty Config Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi lưu cấu hình Loyalty' });
  }
});

// 3. TRA CỨU SỐ ĐIỂM & LỊCH SỬ TÍCH/TIÊU CỦA KHÁCH HÀNG
router.get('/balance/:partnerId', async (req, res) => {
  try {
    const { partnerId } = req.params;
    const partnerRes = await db.query(
      `SELECT id, name, phone, loyalty_points FROM public.partners WHERE id = $1`,
      [partnerId]
    );

    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }

    const ledgerRes = await db.query(
      `SELECT * FROM public.loyalty_ledger 
       WHERE partner_id = $1 
       ORDER BY created_at DESC LIMIT 50`,
      [partnerId]
    );

    res.json({
      success: true,
      data: {
        partner: partnerRes.rows[0],
        points: Number(partnerRes.rows[0].loyalty_points || 0),
        history: ledgerRes.rows
      }
    });
  } catch (error) {
    console.error('🔥 [Loyalty Balance Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi kiểm tra điểm tích lũy' });
  }
});

// 4. ĐIỀU CHỈNH ĐIỂM THƯỞNG THỦ CÔNG
router.post('/adjust', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { partnerId, pointsChange, reason } = req.body;
    if (!partnerId || !pointsChange) {
      return res.status(400).json({ success: false, message: 'Thiếu partnerId hoặc pointsChange' });
    }

    await client.query('BEGIN;');
    const partnerRes = await client.query(
      `SELECT loyalty_points FROM public.partners WHERE id = $1 FOR UPDATE`,
      [partnerId]
    );

    if (partnerRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }

    const currentPts = Number(partnerRes.rows[0].loyalty_points || 0);
    const newPts = Math.max(0, currentPts + Number(pointsChange));

    await client.query(
      `UPDATE public.partners SET loyalty_points = $1 WHERE id = $2`,
      [newPts, partnerId]
    );

    await client.query(
      `INSERT INTO public.loyalty_ledger (partner_id, points_change, balance_after, reason)
       VALUES ($1, $2, $3, $4)`,
      [partnerId, pointsChange, newPts, reason || 'Điều chỉnh điểm thủ công']
    );

    await client.query('COMMIT;');
    res.json({
      success: true,
      message: 'Điều chỉnh điểm tích lũy thành công',
      data: { newBalance: newPts }
    });
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('🔥 [Adjust Points Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi điều chỉnh điểm thưởng' });
  } finally {
    client.release();
  }
});

module.exports = router;
