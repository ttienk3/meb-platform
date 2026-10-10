/**
 * ============================================================================
 * RMA RETURN & EXCHANGE ROUTER (Trụ cột 6 - Đổi Trả Hàng & Cấn Trừ Nợ INV-07)
 * ============================================================================
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. TẠO PHIẾU ĐỔI TRẢ HÀNG (RMA) CẤN TRỪ NỢ TỰ ĐỘNG (INV-07)
router.post('/create', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const branchId = req.ctx?.branchId;
    const userId = req.ctx?.userId;
    const { original_order_id, partner_id, items, note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách sản phẩm trả về không hợp lệ' });
    }

    await client.query('BEGIN;');

    // Tạo mã RMA duy nhất
    const rmaCode = `RMA-${Date.now().toString().slice(-6)}`;

    // Tính toán tổng tiền hoàn lại
    let totalRefundAmount = 0;
    for (const item of items) {
      const lineRefund = Number(item.quantity) * Number(item.return_price);
      totalRefundAmount += lineRefund;
    }

    // Kiểm tra nợ của khách hàng (INV-07)
    let debtDeductionAmount = 0;
    let cashRefundAmount = totalRefundAmount;

    if (partner_id) {
      const partnerRes = await client.query(
        `SELECT current_debt FROM public.partners WHERE id = $1 FOR UPDATE`,
        [partner_id]
      );
      if (partnerRes.rows.length > 0) {
        const currentDebt = Number(partnerRes.rows[0].current_debt || 0);
        if (currentDebt > 0) {
          debtDeductionAmount = Math.min(totalRefundAmount, currentDebt);
          cashRefundAmount = totalRefundAmount - debtDeductionAmount;

          // Giảm nợ khách hàng
          await client.query(
            `UPDATE public.partners 
             SET current_debt = current_debt - $1,
                 updated_at = clock_timestamp()
             WHERE id = $2`,
            [debtDeductionAmount, partner_id]
          );
        }
      }
    }

    // Tạo bản ghi rma_records
    const rmaRes = await client.query(
      `INSERT INTO public.rma_records (
        rma_code, original_order_id, partner_id, branch_id, return_type,
        refund_amount, debt_deduction_amount, cash_refund_amount, status, note, created_by
      ) VALUES ($1, $2, $3, $4, 'REFUND', $5, $6, $7, 'COMPLETED', $8, $9)
      RETURNING *`,
      [rmaCode, original_order_id || null, partner_id || null, branchId, totalRefundAmount, debtDeductionAmount, cashRefundAmount, note || 'Trả hàng quầy POS', userId || 'CASHIER']
    );

    const rmaId = rmaRes.rows[0].id;

    // Xử lý từng sản phẩm trả hàng và nhập lại kho (INV-02)
    for (const item of items) {
      await client.query(
        `INSERT INTO public.rma_items (rma_id, product_id, uom, quantity, return_price, condition, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [rmaId, item.product_id, item.uom, item.quantity, item.return_price, item.condition || 'GOOD', item.note || '']
      );

      // Nếu hàng còn tốt: Tăng tồn kho và ghi thẻ kho bất biến
      if (item.condition !== 'DAMAGED') {
        const invRes = await client.query(
          `INSERT INTO public.inventory (branch_id, product_id, on_hand, reserved)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (branch_id, product_id)
           DO UPDATE SET on_hand = public.inventory.on_hand + $3,
                         updated_at = clock_timestamp()
           RETURNING on_hand`,
          [branchId, item.product_id, item.quantity]
        );

        const newOnHand = invRes.rows[0]?.on_hand || item.quantity;

        await client.query(
          `INSERT INTO public.inventory_logs (branch_id, product_id, type, qty_change, balance_after, reference_id, note)
           VALUES ($1, $2, 'RETURN_INBOUND', $3, $4, $5, $6)`,
          [branchId, item.product_id, item.quantity, newOnHand, rmaId, `Khách trả hàng mã ${rmaCode}`]
        );
      }
    }

    // Nếu có hoàn tiền mặt: Ghi nhận phiếu chi sổ quỹ (INV-01)
    if (cashRefundAmount > 0) {
      await client.query(
        `INSERT INTO public.cash_flows (
          flow_code, branch_id, type, category, payment_method, amount, note, created_by
        ) VALUES (
          $1, $2, 'OUT', 'EXPENSE', 'CASH', $3, $4, $5
        )`,
        [`CF-RMA-${Date.now().toString().slice(-6)}`, branchId, cashRefundAmount, `Hoàn tiền trả hàng phiếu ${rmaCode}`, userId || 'CASHIER']
      );
    }

    await client.query('COMMIT;');
    res.json({
      success: true,
      message: 'Lập phiếu đổi trả hàng RMA thành công (Đã cấn trừ nợ tự động)',
      data: {
        rma: rmaRes.rows[0],
        total_refund: totalRefundAmount,
        debt_deducted: debtDeductionAmount,
        cash_refunded: cashRefundAmount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('🔥 [RMA Create Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi lập phiếu đổi trả RMA' });
  } finally {
    client.release();
  }
});

// 2. DANH SÁCH PHIẾU RMA
router.get('/list', async (req, res) => {
  try {
    const branchId = req.ctx?.branchId;
    const result = await db.query(
      `SELECT r.*, p.name as customer_name, p.phone as customer_phone
       FROM public.rma_records r
       LEFT JOIN public.partners p ON r.partner_id = p.id
       WHERE r.branch_id = $1
       ORDER BY r.created_at DESC LIMIT 50`,
      [branchId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('🔥 [RMA List Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách RMA' });
  }
});

module.exports = router;
