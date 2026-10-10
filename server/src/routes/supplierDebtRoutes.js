/**
 * ============================================================================
 * SUPPLIER DEBTS ROUTER (Trụ cột 9 - Quản Trị Công Nợ Phải Trả NCC - AP)
 * ============================================================================
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. DANH SÁCH CÔNG NỢ NHÀ CUNG CẤP & HẠN THANH TOÁN
router.get('/debts', async (req, res) => {
  try {
    const suppliersRes = await db.query(
      `SELECT id, code, name, phone, address, tax_code, current_debt, debt_limit, payment_term_days
       FROM public.partners
       WHERE is_supplier = true AND is_deleted = false
       ORDER BY current_debt DESC`
    );

    const historyRes = await db.query(
      `SELECT sd.*, p.name as supplier_name, p.code as supplier_code
       FROM public.supplier_debts sd
       JOIN public.partners p ON sd.supplier_id = p.id
       ORDER BY sd.created_at DESC LIMIT 50`
    );

    res.json({
      success: true,
      suppliers: suppliersRes.rows,
      recent_transactions: historyRes.rows
    });
  } catch (error) {
    console.error('🔥 [Supplier Debts Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách công nợ NCC' });
  }
});

// 2. THANH TOÁN NỢ CHO NHÀ CUNG CẤP
router.post('/debts/pay', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const branchId = req.ctx?.branchId;
    const userId = req.ctx?.userId;
    const { supplier_id, amount, payment_account_id, payment_method, note } = req.body;

    const payAmount = Number(amount);
    if (!supplier_id || !payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Thông tin thanh toán không hợp lệ' });
    }

    await client.query('BEGIN;');

    // Khóa nhà cung cấp để cập nhật nợ
    const supplierRes = await client.query(
      `SELECT id, name, current_debt FROM public.partners WHERE id = $1 AND is_supplier = true FOR UPDATE`,
      [supplier_id]
    );

    if (supplierRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      return res.status(404).json({ success: false, message: 'Không tìm thấy Nhà Cung Cấp' });
    }

    const currentDebt = Number(supplierRes.rows[0].current_debt || 0);
    const newDebt = Math.max(0, currentDebt - payAmount);

    // Cập nhật nợ của nhà cung cấp
    await client.query(
      `UPDATE public.partners 
       SET current_debt = $1, updated_at = clock_timestamp() 
       WHERE id = $2`,
      [newDebt, supplier_id]
    );

    // Ghi nhật ký vào supplier_debts
    const refCode = `PAY-NCC-${Date.now().toString().slice(-6)}`;
    await client.query(
      `INSERT INTO public.supplier_debts (
        supplier_id, reference_code, transaction_type, amount, balance_after, status, note
      ) VALUES ($1, $2, 'DEBT_PAYMENT', $3, $4, 'PAID', $5)`,
      [supplier_id, refCode, payAmount, newDebt, note || `Thanh toán nợ cho ${supplierRes.rows[0].name}`]
    );

    // Trừ số dư tài khoản tiền nếu có chỉ định
    if (payment_account_id) {
      await client.query(
        `UPDATE public.cash_accounts 
         SET current_balance = current_balance - $1, updated_at = clock_timestamp() 
         WHERE id = $2`,
        [payAmount, payment_account_id]
      );
    }

    // Ghi nhận vào sổ quỹ chi nhánh cash_flows (INV-01)
    await client.query(
      `INSERT INTO public.cash_flows (
        flow_code, branch_id, type, category, payment_method, amount, note, created_by
      ) VALUES (
        $1, $2, 'OUT', 'PURCHASE', $3, $4, $5, $6
      )`,
      [refCode, branchId, payment_method || 'BANK_TRANSFER', payAmount, note || `Chi trả nợ NCC: ${supplierRes.rows[0].name}`, userId || 'ACCOUNTANT']
    );

    await client.query('COMMIT;');
    res.json({
      success: true,
      message: 'Thanh toán nợ Nhà Cung Cấp thành công',
      data: {
        supplier_id,
        paid_amount: payAmount,
        remaining_debt: newDebt
      }
    });
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('🔥 [Supplier Debt Pay Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi thanh toán nợ NCC' });
  } finally {
    client.release();
  }
});

module.exports = router;
