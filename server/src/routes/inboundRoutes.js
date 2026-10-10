const express = require('express');
const { pool } = require('../db');
const requestContext = require('../middleware/requestContext');

const router = express.Router();
router.use(requestContext);

/**
 * GET /api/inbound/suppliers
 * Lấy danh sách nhà cung cấp của hệ thống
 */
router.get('/suppliers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, code, name, phone, address, tax_code, COALESCE(current_debt, 0)::numeric AS current_debt
      FROM public.partners
      WHERE is_supplier = TRUE AND is_active = TRUE
      ORDER BY name ASC;
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Inbound Suppliers Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'SUPPLIERS_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inbound/suppliers
 * Tạo mới Nhà Cung Cấp
 */
router.post('/suppliers', async (req, res) => {
  try {
    const { name, phone, address, tax_code } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_NAME', message: 'Tên nhà cung cấp không được để trống.' }
      });
    }

    const supplierCode = req.body.code && req.body.code.trim()
      ? req.body.code.trim().toUpperCase()
      : `NCC-${Date.now().toString().slice(-6)}`;

    const result = await pool.query(`
      INSERT INTO public.partners (
        code, name, phone, address, tax_code, is_customer, is_supplier, is_active, current_debt, debt_limit
      ) VALUES ($1, $2, $3, $4, $5, FALSE, TRUE, TRUE, 0, 0)
      RETURNING id, code, name, phone, address, tax_code, current_debt::numeric, is_active;
    `, [supplierCode, name.trim(), phone || null, address || null, tax_code || null]);

    res.json({
      success: true,
      message: 'Tạo nhà cung cấp mới thành công.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('🔥 [Inbound Create Supplier Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_SUPPLIER_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/inbound/receipts
 * Lấy danh sách phiếu nhập kho gần đây của chi nhánh
 */
router.get('/receipts', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const result = await pool.query(`
      SELECT 
        o.id, 
        o.order_code, 
        o.created_at, 
        o.total_amount::numeric, 
        o.paid_amount::numeric, 
        o.debt_amount::numeric, 
        o.status, 
        o.note,
        p.id AS supplier_id,
        p.name AS supplier_name, 
        p.code AS supplier_code,
        (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id)::int AS items_count,
        (
          SELECT json_agg(json_build_object(
            'product_name', pr.name,
            'product_code', pr.code,
            'quantity', oi.quantity::numeric,
            'uom', oi.uom,
            'unit_price', oi.unit_price::numeric
          ))
          FROM public.order_items oi
          JOIN public.products pr ON pr.id = oi.product_id
          WHERE oi.order_id = o.id
        ) AS items
      FROM public.orders o
      LEFT JOIN public.partners p ON p.id = o.partner_id
      WHERE o.branch_id = $1::uuid AND o.order_type = 'PURCHASE'
      ORDER BY o.created_at DESC
      LIMIT 50;
    `, [branchId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Inbound Receipts Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'RECEIPTS_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inbound/purchase
 * Lập phiếu nhập kho từ nhà cung cấp (ACID Transaction)
 */
router.post('/purchase', async (req, res) => {
  const client = await pool.connect();
  try {
    const branchId = req.ctx.branchId;
    const { supplier_id, items, paid_amount = 0, payment_method = 'CASH', note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ITEMS', message: 'Danh sách sản phẩm nhập kho không được để trống' }
      });
    }

    await client.query('BEGIN');

    // 1. Tính toán tổng tiền hàng nhập
    let totalAmount = 0;
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const price = Number(it.unit_price || 0);
      if (qty <= 0 || price < 0) {
        throw new Error(`Sản phẩm ${it.product_id} có số lượng hoặc đơn giá không hợp lệ`);
      }
      totalAmount += qty * price;
    }

    const paidNum = Math.min(Number(paid_amount) || 0, totalAmount);
    const debtNum = totalAmount - paidNum;

    // 2. Lấy ca bán hàng hiện tại nếu có
    const shiftRes = await client.query(
      "SELECT id FROM public.shifts WHERE branch_id = $1::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;",
      [branchId]
    );
    const shiftId = shiftRes.rows[0]?.id || null;

    // 3. Sinh mã phiếu nhập và insert đơn hàng (order_type = 'PURCHASE')
    const orderCode = 'PN-' + Date.now().toString().slice(-8) + '-' + Math.floor(1000 + Math.random() * 9000);
    const orderInsert = await client.query(`
      INSERT INTO public.orders (
        order_code, branch_id, partner_id, shift_id, order_type, status,
        total_amount, paid_amount, debt_amount, note, created_by
      ) VALUES (
        $1, $2::uuid, $3, $4, 'PURCHASE', 'COMPLETED',
        $5, $6, $7, $8, $9
      ) RETURNING id, order_code, created_at;
    `, [
      orderCode,
      branchId,
      supplier_id ? supplier_id : null,
      shiftId,
      totalAmount,
      paidNum,
      debtNum,
      note || 'Nhập hàng từ nhà cung cấp',
      req.ctx.userId || 'NHAN_VIEN_KHO'
    ]);

    const newOrderId = orderInsert.rows[0].id;

    // 4. Duyệt từng mặt hàng nhập: ghi order_items, cộng tồn kho và ghi thẻ kho bất biến
    for (const it of items) {
      const convRate = Number(it.conversion_rate) || 1;
      const qty = Number(it.quantity);
      const baseQty = qty * convRate;
      const unitPrice = Number(it.unit_price);
      const costPerBase = unitPrice / convRate;

      // Lưu dòng chi tiết
      await client.query(`
        INSERT INTO public.order_items (
          order_id, product_id, uom, conversion_rate, quantity, base_quantity,
          unit_price, cost_price, note
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9
        );
      `, [
        newOrderId,
        it.product_id,
        it.uom || 'Đơn vị',
        convRate,
        qty,
        baseQty,
        unitPrice,
        costPerBase,
        it.note || null
      ]);

      // Cập nhật tồn kho (Upsert inventory)
      const invUpsert = await client.query(`
        INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price, updated_at)
        VALUES ($1::uuid, $2::uuid, $3, $4, clock_timestamp())
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET
          on_hand = inventory.on_hand + EXCLUDED.on_hand,
          cost_price = EXCLUDED.cost_price,
          updated_at = clock_timestamp()
        RETURNING on_hand;
      `, [branchId, it.product_id, baseQty, costPerBase]);

      const newOnHand = invUpsert.rows[0].on_hand;

      // Ghi thẻ kho bất biến INV-10
      await client.query(`
        INSERT INTO public.inventory_logs (
          branch_id, product_id, type, qty_change, balance_after,
          unit_cost, reference_id, note, created_by
        ) VALUES (
          $1::uuid, $2::uuid, 'PURCHASE', $3, $4,
          $5, $6::uuid, $7, $8
        );
      `, [
        branchId,
        it.product_id,
        baseQty,
        newOnHand,
        unitPrice,
        newOrderId,
        `Nhập kho theo phiếu ${orderCode}`,
        req.ctx.userId || 'NHAN_VIEN_KHO'
      ]);
    }

    // 5. Nếu có thanh toán tiền mặt/chuyển khoản -> Ghi nhận phiếu chi tiền quỹ
    if (paidNum > 0) {
      const flowCode = 'PC-' + Date.now().toString().slice(-8) + '-' + Math.floor(1000 + Math.random() * 9000);
      await client.query(`
        INSERT INTO public.cash_flows (
          flow_code, branch_id, shift_id, partner_id, order_id,
          type, category, payment_method, amount, note, created_by
        ) VALUES (
          $1, $2::uuid, $3, $4, $5,
          'OUT', 'SUPPLIER_PAYMENT', $6, $7, $8, $9
        );
      `, [
        flowCode,
        branchId,
        shiftId,
        supplier_id || null,
        newOrderId,
        payment_method,
        paidNum,
        `Chi tiền thanh toán phiếu nhập ${orderCode}`,
        req.ctx.userId || 'THU_NGAN'
      ]);
    }

    // 6. Nếu có nhà cung cấp và có công nợ -> Ghi nhận nợ NCC
    if (supplier_id && debtNum > 0) {
      await client.query(`
        UPDATE public.partners
        SET current_debt = current_debt + $1, updated_at = clock_timestamp()
        WHERE id = $2::uuid;
      `, [debtNum, supplier_id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Nhập kho thành công',
      data: {
        order_id: newOrderId,
        order_code: orderCode,
        total_amount: totalAmount,
        paid_amount: paidNum,
        debt_amount: debtNum,
        items_count: items.length
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('🔥 [Purchase Inbound Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'PURCHASE_FAILED', message: err.message }
    });
  } finally {
    client.release();
  }
});

module.exports = router;
