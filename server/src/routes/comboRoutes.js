/**
 * ============================================================================
 * COMBO & ASSEMBLY BOM ROUTER (Trụ cột 14 - Hàng Combo & Phiếu Đóng Gói BOM)
 * ============================================================================
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. LẤY ĐỊNH MỨC THÀNH PHẦN CỦA COMBO
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await db.query(
      `SELECT pc.*, p.name as component_name, p.code as component_code
       FROM public.product_combos pc
       JOIN public.products p ON pc.component_product_id = p.id
       WHERE pc.combo_product_id = $1`,
      [productId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      components: result.rows
    });
  } catch (error) {
    console.error('🔥 [Get Combo Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải thông tin Combo' });
  }
});

// 2. CẤU HÌNH ĐỊNH MỨC THÀNH PHẦN COMBO
router.post('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { combo_product_id, components } = req.body;
    if (!combo_product_id || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ success: false, message: 'Dữ liệu combo không hợp lệ' });
    }

    await client.query('BEGIN;');
    // Xóa định mức cũ
    await client.query(`DELETE FROM public.product_combos WHERE combo_product_id = $1`, [combo_product_id]);

    // Thêm các thành phần mới
    for (const comp of components) {
      await client.query(
        `INSERT INTO public.product_combos (combo_product_id, component_product_id, quantity, uom)
         VALUES ($1, $2, $3, $4)`,
        [combo_product_id, comp.component_product_id, comp.quantity, comp.uom || 'Cái']
      );
    }

    await client.query('COMMIT;');
    res.json({
      success: true,
      message: 'Cập nhật định mức BOM Combo thành công'
    });
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('🔥 [Save Combo Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi lưu định mức Combo' });
  } finally {
    client.release();
  }
});

// 3. THỰC HIỆN PHIẾU ĐÓNG GÓI SẢN PHẨM (ASSEMBLY)
router.post('/assemble', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const branchId = req.ctx?.branchId;
    const userId = req.ctx?.userId;
    const { target_product_id, target_quantity, note } = req.body;

    const qty = Number(target_quantity);
    if (!target_product_id || !qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Số lượng đóng gói phải lớn hơn 0' });
    }

    await client.query('BEGIN;');

    // Lấy định mức combo
    const bomRes = await client.query(
      `SELECT * FROM public.product_combos WHERE combo_product_id = $1`,
      [target_product_id]
    );

    if (bomRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      return res.status(400).json({ success: false, message: 'Sản phẩm này chưa được cấu hình định mức BOM' });
    }

    const orderCode = `ASM-${Date.now().toString().slice(-6)}`;

    // Tạo phiếu assembly_orders
    const orderRes = await client.query(
      `INSERT INTO public.assembly_orders (
        order_code, branch_id, assembly_type, target_product_id, target_quantity, status, note, created_by
      ) VALUES ($1, $2, 'ASSEMBLY', $3, $4, 'COMPLETED', $5, $6)
      RETURNING id`,
      [orderCode, branchId, target_product_id, qty, note || 'Đóng gói thành phẩm combo', userId || 'STAFF']
    );

    const assemblyOrderId = orderRes.rows[0].id;

    // Trừ tồn kho các món nguyên liệu và ghi thẻ kho
    for (const comp of bomRes.rows) {
      const neededQty = Number(comp.quantity) * qty;

      await client.query(
        `INSERT INTO public.assembly_items (assembly_order_id, component_product_id, consumed_quantity, uom)
         VALUES ($1, $2, $3, $4)`,
        [assemblyOrderId, comp.component_product_id, neededQty, comp.uom]
      );

      // Trừ kho nguyên liệu
      const compRes = await client.query(
        `UPDATE public.inventory 
         SET on_hand = on_hand - $1,
             updated_at = clock_timestamp()
         WHERE branch_id = $2 AND product_id = $3
         RETURNING on_hand`,
        [neededQty, branchId, comp.component_product_id]
      );
      const compBalance = compRes.rows[0]?.on_hand || 0;

      await client.query(
        `INSERT INTO public.inventory_logs (branch_id, product_id, type, qty_change, balance_after, reference_id, note)
         VALUES ($1, $2, 'ASSEMBLY_OUT', $3, $4, $5, $6)`,
        [branchId, comp.component_product_id, -neededQty, compBalance, assemblyOrderId, `Xuất nguyên liệu đóng gói ${orderCode}`]
      );
    }

    // Tăng tồn kho sản phẩm thành phẩm
    const targetRes = await client.query(
      `INSERT INTO public.inventory (branch_id, product_id, on_hand, reserved)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (branch_id, product_id)
       DO UPDATE SET on_hand = public.inventory.on_hand + $3,
                     updated_at = clock_timestamp()
       RETURNING on_hand`,
      [branchId, target_product_id, qty]
    );
    const targetBalance = targetRes.rows[0]?.on_hand || qty;

    await client.query(
      `INSERT INTO public.inventory_logs (branch_id, product_id, type, qty_change, balance_after, reference_id, note)
       VALUES ($1, $2, 'ASSEMBLY_IN', $3, $4, $5, $6)`,
      [branchId, target_product_id, qty, targetBalance, assemblyOrderId, `Nhập thành phẩm đóng gói ${orderCode}`]
    );

    await client.query('COMMIT;');
    res.json({
      success: true,
      message: `Đóng gói thành công ${qty} sản phẩm (Mã phiếu: ${orderCode})`,
      order_code: orderCode
    });
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('🔥 [Assembly Error]:', error);
    res.status(500).json({ success: false, message: 'Lỗi thực thi phiếu đóng gói BOM' });
  } finally {
    client.release();
  }
});

module.exports = router;
