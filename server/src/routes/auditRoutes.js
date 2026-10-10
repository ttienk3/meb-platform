const express = require('express');
const { pool } = require('../db');
const requestContext = require('../middleware/requestContext');

const router = express.Router();
router.use(requestContext);

/**
 * GET /api/inventory/audit-products
 * Lấy danh sách sản phẩm cùng tồn kho sổ sách hiện tại để phục vụ kiểm đếm
 */
router.get('/audit-products', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { category, search } = req.query;

    let queryText = `
      SELECT 
        p.id, 
        p.code, 
        p.name, 
        p.category, 
        p.base_uom, 
        p.barcodes,
        COALESCE(i.on_hand, 0)::numeric AS system_qty,
        COALESCE(i.cost_price, p.default_cost_price)::numeric AS cost_price
      FROM public.products p
      LEFT JOIN public.inventory i ON i.product_id = p.id AND i.branch_id = $1::uuid
      WHERE p.is_active = TRUE
    `;
    const params = [branchId];

    if (category) {
      params.push(category);
      queryText += ` AND p.category = $${params.length}`;
    }

    if (search) {
      params.push(search);
      queryText += ` AND (p.name ILIKE '%' || $${params.length} || '%' OR p.code ILIKE '%' || $${params.length} || '%')`;
    }

    queryText += ' ORDER BY p.name ASC;';

    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      branchId,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Audit Products Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'AUDIT_PRODUCTS_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inventory/audit
 * Chốt biên bản kiểm kê và cân bằng tồn kho (INV-10 Thẻ kho bất biến)
 */
router.post('/audit', async (req, res) => {
  const client = await pool.connect();
  try {
    const branchId = req.ctx.branchId;
    const { items, note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ITEMS', message: 'Danh sách mặt hàng kiểm đếm không được rỗng' }
      });
    }

    await client.query('BEGIN');

    // 1. Khảo sát tồn kho sổ sách thực tế trong DB
    const pIds = items.map(it => it.product_id);
    const invRes = await client.query(`
      SELECT p.id AS product_id, COALESCE(i.on_hand, 0)::numeric AS system_qty, COALESCE(i.cost_price, p.default_cost_price)::numeric AS cost_price
      FROM public.products p
      LEFT JOIN public.inventory i ON i.product_id = p.id AND i.branch_id = $1::uuid
      WHERE p.id = ANY($2::uuid[]);
    `, [branchId, pIds]);

    const systemMap = new Map();
    invRes.rows.forEach(r => systemMap.set(r.product_id, { system_qty: Number(r.system_qty), cost_price: Number(r.cost_price) }));

    let matchedCount = 0;
    let overCount = 0;
    let shortCount = 0;
    let totalVarianceQty = 0;

    const auditCode = 'KK-' + Date.now().toString().slice(-8) + '-' + Math.floor(1000 + Math.random() * 9000);

    // Tính toán số liệu thống kê
    for (const it of items) {
      const actualQty = Number(it.actual_qty);
      const cur = systemMap.get(it.product_id) || { system_qty: 0, cost_price: 0 };
      const systemQty = cur.system_qty;
      const variance = actualQty - systemQty;

      if (variance === 0) matchedCount++;
      else if (variance > 0) overCount++;
      else shortCount++;

      totalVarianceQty += variance;
    }

    // 2. Tạo biên bản kiểm kê tổng quan
    const auditInsert = await client.query(`
      INSERT INTO public.stocktake_audits (
        audit_code, branch_id, matched_items_count, over_items_count, short_items_count,
        total_variance_qty, note, created_by
      ) VALUES (
        $1, $2::uuid, $3, $4, $5, $6, $7, $8
      ) RETURNING id, audit_code, created_at;
    `, [
      auditCode,
      branchId,
      matchedCount,
      overCount,
      shortCount,
      totalVarianceQty,
      note || 'Kiểm kê định kỳ chi nhánh',
      req.ctx.userId || 'THU_KHO'
    ]);

    const auditId = auditInsert.rows[0].id;

    // 3. Xử lý từng dòng: ghi chi tiết & cân bằng tồn kho nếu có lệch
    for (const it of items) {
      const actualQty = Number(it.actual_qty);
      const cur = systemMap.get(it.product_id) || { system_qty: 0, cost_price: 0 };
      const systemQty = cur.system_qty;
      const variance = actualQty - systemQty;
      const costPrice = cur.cost_price;
      const varianceAmount = variance * costPrice;

      // Ghi item kiểm kê
      await client.query(`
        INSERT INTO public.stocktake_audit_items (
          audit_id, product_id, system_qty, actual_qty, variance_qty,
          unit_cost, variance_amount, reason
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8
        );
      `, [
        auditId,
        it.product_id,
        systemQty,
        actualQty,
        variance,
        costPrice,
        varianceAmount,
        it.reason || null
      ]);

      // Nếu có lệch, cập nhật tồn kho và ghi thẻ kho bất biến
      if (variance !== 0) {
        // Cập nhật tồn kho
        await client.query(`
          INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price, updated_at)
          VALUES ($1::uuid, $2::uuid, $3, $4, clock_timestamp())
          ON CONFLICT (branch_id, product_id)
          DO UPDATE SET
            on_hand = $3,
            updated_at = clock_timestamp();
        `, [branchId, it.product_id, actualQty, costPrice]);

        // Ghi thẻ kho bất biến INV-10
        await client.query(`
          INSERT INTO public.inventory_logs (
            branch_id, product_id, type, qty_change, balance_after,
            unit_cost, reference_id, note, created_by
          ) VALUES (
            $1::uuid, $2::uuid, 'STOCKTAKE_AUDIT', $3, $4,
            $5, $6::uuid, $7, $8
          );
        `, [
          branchId,
          it.product_id,
          variance,
          actualQty,
          costPrice,
          auditId,
          `Cân bằng kho theo biên bản kiểm kê ${auditCode}${it.reason ? ' (' + it.reason + ')' : ''}`,
          req.ctx.userId || 'THU_KHO'
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Cân bằng tồn kho thành công',
      data: {
        audit_id: auditId,
        audit_code: auditCode,
        matched_items_count: matchedCount,
        over_items_count: overCount,
        short_items_count: shortCount,
        total_variance_qty: totalVarianceQty
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('🔥 [Stocktake Audit Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'AUDIT_FAILED', message: err.message }
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/inventory/audit-history
 * Lịch sử các đợt kiểm kê gần đây của chi nhánh
 */
router.get('/audit-history', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const result = await pool.query(`
      SELECT 
        a.id, 
        a.audit_code, 
        a.matched_items_count, 
        a.over_items_count, 
        a.short_items_count,
        a.total_variance_qty::numeric, 
        a.note, 
        a.created_by, 
        a.created_at,
        (
          SELECT json_agg(json_build_object(
            'product_name', p.name,
            'product_code', p.code,
            'system_qty', ai.system_qty::numeric,
            'actual_qty', ai.actual_qty::numeric,
            'variance_qty', ai.variance_qty::numeric,
            'reason', ai.reason
          ))
          FROM public.stocktake_audit_items ai
          JOIN public.products p ON p.id = ai.product_id
          WHERE ai.audit_id = a.id
        ) AS items
      FROM public.stocktake_audits a
      WHERE a.branch_id = $1::uuid
      ORDER BY a.created_at DESC
      LIMIT 30;
    `, [branchId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Audit History Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'AUDIT_HISTORY_FAILED', message: err.message }
    });
  }
});

module.exports = router;
