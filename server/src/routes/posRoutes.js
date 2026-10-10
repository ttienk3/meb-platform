const express = require('express');
const db = require('../db');
const requestContext = require('../middleware/requestContext');
const { withEntityLock } = require('../utils/entityMutex');

const router = express.Router();

// Tất cả các route trong /api/pos đều phải đi qua requestContext
router.use(requestContext);

/**
 * GET /api/pos/products
 * Lấy danh mục sản phẩm kèm tồn kho thời gian thực của chi nhánh hiện tại
 */
router.get('/products', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { category, search } = req.query;

    let queryText = `
      SELECT 
        p.id, p.code, p.name, p.category, p.base_uom, p.barcodes,
        p.is_combo, p.combo_items, p.default_cost_price, p.default_selling_price,
        p.has_expiry, COALESCE(p.track_expiry, p.has_expiry) AS track_expiry, p.image_url,
        COALESCE(i.on_hand, 0)::numeric AS on_hand,
        COALESCE(i.reserved, 0)::numeric AS reserved,
        (COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0))::numeric AS available_qty,
        COALESCE(i.cost_price, p.default_cost_price)::numeric AS cost_price
      FROM public.products p
      LEFT JOIN public.inventory i ON i.product_id = p.id AND i.branch_id = $1::uuid
      WHERE p.is_active = TRUE AND p.is_deleted = FALSE
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

    const result = await db.query(queryText, params);

    res.json({
      success: true,
      branchId,
      branchCode: req.ctx.branch.code,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [POS Products Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'PRODUCTS_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/pos/partners
 * Tra cứu danh sách khách hàng, đại lý, nhóm giá và hạn mức công nợ
 */
router.get('/partners', async (req, res) => {
  try {
    const { q, group } = req.query;

    let queryText = `
      SELECT 
        p.id, p.code, p.name, p.phone, p.address, p.tax_code,
        p.is_customer, p.is_supplier, p.is_shipper, p.price_group,
        p.debt_limit::numeric AS debt_limit,
        p.current_debt::numeric AS current_debt,
        (p.debt_limit - p.current_debt)::numeric AS remaining_credit,
        p.customer_group_id,
        cg.name AS customer_group_name,
        COALESCE(cg.discount_rate_pct, 0)::numeric AS discount_rate_pct
      FROM public.partners p
      LEFT JOIN public.customer_groups cg ON p.customer_group_id = cg.id
      WHERE p.is_active = TRUE AND p.is_deleted = FALSE
    `;
    const params = [];

    if (group) {
      params.push(group);
      queryText += ` AND p.price_group = $${params.length}`;
    }

    if (q) {
      params.push(q);
      queryText += ` AND (p.name ILIKE '%' || $${params.length} || '%' OR p.phone ILIKE '%' || $${params.length} || '%' OR p.code ILIKE '%' || $${params.length} || '%')`;
    }

    queryText += ' ORDER BY p.name ASC;';

    const result = await db.query(queryText, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [POS Partners Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'PARTNERS_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/pos/checkout
 * Thanh toán đơn hàng nguyên tử qua RPC public.checkout_order
 */
router.post('/checkout', async (req, res) => {
  try {
    const { order, items, payments } = req.body;
    if (!order || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu thông tin order và danh sách items hợp lệ' }
      });
    }

    // Trụ cột 20: Kiểm tra Idempotency Key chống bấm đúp tạo đơn trùng (INV-10)
    if (order.idempotency_key) {
      const existing = await db.query(
        `SELECT id, order_code, total_amount, paid_amount, status 
         FROM public.orders 
         WHERE idempotency_key = $1`,
        [order.idempotency_key]
      );
      if (existing.rows.length > 0) {
        return res.json({
          success: true,
          message: 'Đơn hàng đã được thanh toán trước đó (Idempotency Safe)',
          data: {
            order_id: existing.rows[0].id,
            order_code: existing.rows[0].order_code,
            is_idempotent_duplicate: true
          }
        });
      }
    }

    // Cưỡng chế gắn branch_id theo Header x-branch-id đã xác thực
    // Tự sinh mã đơn an toàn nếu client không truyền
    const autoCode = 'HD-' + Date.now().toString().slice(-8) + '-' + Math.floor(1000 + Math.random() * 9000);
    const finalOrder = {
      ...order,
      branch_id: req.ctx.branchId,
      order_code: order.order_code || autoCode
    };

    const productIds = items.map(it => it.product_id).filter(Boolean);

    // Bọc trong withEntityLock để bảo vệ INV-04 chống Race Condition bán lẻ / rã thùng đồng thời
    const result = await withEntityLock(req.ctx.branchId, productIds, async () => {
      const sqlRes = await db.query(
        'SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb) AS result;',
        [
          JSON.stringify(finalOrder),
          JSON.stringify(items),
          JSON.stringify(payments || [])
        ]
      );
      return sqlRes.rows[0]?.result;
    });

    // Cập nhật Idempotency Key nếu có
    if (order.idempotency_key && result?.order_id) {
      await db.query(`UPDATE public.orders SET idempotency_key = $1 WHERE id = $2`, [order.idempotency_key, result.order_id]);
    }

    // Trụ cột 5: Tự động tích điểm Loyalty nếu có khách hàng
    if (order.partner_id && result?.order_id) {
      try {
        const lConfig = await db.query(
          `SELECT earn_rate_pct FROM public.loyalty_configs 
           WHERE (branch_id = $1 OR branch_id IS NULL) AND is_active = true 
           ORDER BY branch_id NULLS LAST LIMIT 1`,
          [req.ctx.branchId]
        );
        const earnRate = lConfig.rows.length > 0 ? Number(lConfig.rows[0].earn_rate_pct || 1.0) : 1.0;
        const pts = Math.floor((Number(order.total_amount || 0) * earnRate) / 100000);
        if (pts > 0) {
          await db.query(
            `UPDATE public.partners SET loyalty_points = loyalty_points + $1 WHERE id = $2`,
            [pts, order.partner_id]
          );
          await db.query(
            `INSERT INTO public.loyalty_ledger (partner_id, order_id, points_change, balance_after, reason)
             VALUES ($1, $2, $3, (SELECT loyalty_points FROM public.partners WHERE id = $1), $4)`,
            [order.partner_id, result.order_id, pts, `Tích điểm đơn hàng ${result.order_code || autoCode}`]
          );
        }
      } catch (lErr) {
        console.error('Lỗi tích điểm ngầm:', lErr.message);
      }
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('🔥 [POS Checkout Error]:', err.message);
    res.status(400).json({
      success: false,
      error: {
        code: 'CHECKOUT_FAILED',
        message: err.message
      }
    });
  }
});

// =============================================================================
// QUẢN LÝ CA BÁN HÀNG (SHIFTS & CASH DRAWER RECONCILIATION)
// =============================================================================

/**
 * GET /api/pos/shifts/current
 * Lấy ca bán hàng đang mở hiện tại của chi nhánh
 */
router.get('/shifts/current', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const result = await db.query(`
      SELECT id, branch_id, staff_name, initial_amount::numeric, opened_at, status
      FROM public.shifts
      WHERE branch_id = $1::uuid AND status = 'OPEN'
      ORDER BY opened_at DESC LIMIT 1;
    `, [branchId]);

    res.json({
      success: true,
      data: result.rows[0] || null
    });
  } catch (err) {
    console.error('🔥 [POS Current Shift Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'SHIFT_QUERY_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/pos/shifts/open
 * Mở ca bán hàng mới với tiền két ban đầu
 */
router.post('/shifts/open', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { staff_name, initial_amount } = req.body;

    if (!staff_name || initial_amount === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu staff_name và initial_amount' }
      });
    }

    // Kiểm tra xem đã có ca nào đang mở chưa
    const existing = await db.query(`
      SELECT id, staff_name FROM public.shifts 
      WHERE branch_id = $1::uuid AND status = 'OPEN' LIMIT 1;
    `, [branchId]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SHIFT_ALREADY_OPEN',
          message: `Chi nhánh đang có ca mở của ${existing.rows[0].staff_name}. Vui lòng chốt ca cũ trước khi mở ca mới!`
        }
      });
    }

    const insertRes = await db.query(`
      INSERT INTO public.shifts (branch_id, staff_name, initial_amount, status)
      VALUES ($1::uuid, $2, $3::numeric, 'OPEN')
      RETURNING id, branch_id, staff_name, initial_amount::numeric, opened_at, status;
    `, [branchId, staff_name, initial_amount]);

    res.json({
      success: true,
      message: 'Mở ca bán hàng thành công',
      data: insertRes.rows[0]
    });
  } catch (err) {
    console.error('🔥 [POS Open Shift Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'SHIFT_OPEN_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/pos/shifts/:id/summary
 * Xem tóm tắt đối soát ca két tiền (F8 Cash Discrepancy Preview)
 */
router.get('/shifts/:id/summary', async (req, res) => {
  try {
    const shiftId = req.params.id;
    const result = await db.query(
      'SELECT public.get_shift_summary($1::uuid) AS summary;',
      [shiftId]
    );

    const summaryData = result.rows[0]?.summary || {};
    const mapped = {
      ...summaryData,
      total_cash_sales: summaryData.cash_in || 0,
      total_debt_collected_cash: summaryData.debt_collected || 0
    };

    res.json({
      success: true,
      data: mapped
    });
  } catch (err) {
    console.error('🔥 [POS Shift Summary Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'SHIFT_SUMMARY_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/pos/shifts/:id/close
 * Chốt ca và lưu độ lệch két tiền (F8 Close Shift)
 */
router.post('/shifts/:id/close', async (req, res) => {
  try {
    const shiftId = req.params.id;
    const { actual_amount, note } = req.body;

    if (actual_amount === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu nhập actual_amount (tiền thực đếm)' }
      });
    }

    const result = await db.query(
      'SELECT public.close_shift($1::uuid, $2::numeric, $3) AS result;',
      [shiftId, actual_amount, note || '']
    );

    res.json({
      success: true,
      message: 'Đã đóng ca bán hàng thành công',
      data: result.rows[0]?.result
    });
  } catch (err) {
    console.error('🔥 [POS Close Shift Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'SHIFT_CLOSE_FAILED', message: err.message }
    });
  }
});

// =============================================================================
// THU NỢ KHÁCH HÀNG & LỊCH SỬ ĐƠN HÀNG (DEBT COLLECTION & RECENT ORDERS)
// =============================================================================

/**
 * POST /api/pos/debt-collection
 * Thu nợ khách hàng (F3 Collect Debt) và tự động cấn trừ sổ nợ
 */
router.post('/debt-collection', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { partner_id, shift_id, amount, payment_method, payment_account, note, created_by } = req.body;

    if (!partner_id || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu partner_id và amount hợp lệ (> 0)' }
      });
    }

    const result = await db.query(
      `SELECT public.collect_debt(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::numeric,
        $5,
        $6,
        $7,
        $8
      ) AS result;`,
      [
        branchId,
        shift_id || null,
        partner_id,
        amount,
        payment_method || 'CASH',
        payment_account || 'KET_TIEN',
        note || 'Thu nợ khách hàng tại quầy',
        created_by || 'Thu Ngân'
      ]
    );

    res.json({
      success: true,
      message: 'Thu nợ thành công và đã cập nhật sổ nợ khách hàng',
      data: result.rows[0]?.result
    });
  } catch (err) {
    console.error('🔥 [POS Collect Debt Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'DEBT_COLLECTION_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/pos/orders/recent
 * Lấy danh sách 20 hóa đơn gần nhất của chi nhánh (cho mục đích in lại bill & đối soát)
 */
router.get('/orders/recent', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { shift_id, limit } = req.query;
    const maxLimit = parseInt(limit, 10) || 20;

    let queryText = `
      SELECT 
        o.id,
        o.order_code,
        o.total_amount::numeric,
        o.paid_amount::numeric,
        o.debt_amount::numeric,
        o.status,
        o.order_type,
        o.note,
        o.created_by,
        o.created_at,
        p.name AS partner_name,
        p.code AS partner_code,
        p.phone AS partner_phone
      FROM public.orders o
      LEFT JOIN public.partners p ON o.partner_id = p.id
      WHERE o.branch_id = $1::uuid
    `;
    const params = [branchId];

    if (shift_id) {
      params.push(shift_id);
      queryText += ` AND o.shift_id = $${params.length}::uuid`;
    }

    queryText += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1};`;
    params.push(maxLimit);

    const result = await db.query(queryText, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [POS Recent Orders Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'RECENT_ORDERS_QUERY_FAILED', message: err.message }
    });
  }
});

// =============================================================================
// NGHIỆP VỤ ĐỔI TRẢ HÀNG & CẤN TRỪ NỢ (INV-07 RMA RETURNS)
// =============================================================================

/**
 * POST /api/pos/returns
 * Lập phiếu trả hàng, hoàn nhập kho và cấn trừ công nợ (hoặc hoàn tiền mặt)
 */
router.post('/returns', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { partner_id, items, refund_mode = 'DEBT_OFFSET', parent_order_id, note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Danh sách sản phẩm trả lại không được rỗng' }
      });
    }

    if (refund_mode === 'DEBT_OFFSET' && !partner_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'PARTNER_REQUIRED', message: 'Cấn trừ nợ (INV-07) bắt buộc phải chọn hồ sơ khách hàng' }
      });
    }

    // Tính tổng tiền trả
    let totalReturnAmount = 0;
    const formattedItems = items.map(it => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.unit_price || 0);
      const convRate = Number(it.conversion_rate || 1);
      totalReturnAmount += qty * price;
      return {
        product_id: it.product_id,
        uom: it.uom || 'Đơn vị',
        conversion_rate: convRate,
        quantity: qty,
        unit_price: price,
        note: it.reason || 'Khách trả hàng'
      };
    });

    const isDebtOffset = (refund_mode === 'DEBT_OFFSET');
    const paidAmount = isDebtOffset ? 0 : totalReturnAmount;
    const debtAmount = isDebtOffset ? totalReturnAmount : 0;

    const returnCode = 'TH-' + Date.now().toString().slice(-8) + '-' + Math.floor(1000 + Math.random() * 9000);

    const payments = [];
    if (!isDebtOffset && paidAmount > 0) {
      payments.push({
        payment_method: 'CASH',
        method: 'CASH',
        amount: paidAmount,
        note: `Hoàn tiền mặt trả hàng ${returnCode}`
      });
    }

    const orderPayload = {
      branch_id: branchId,
      partner_id: partner_id || null,
      parent_order_id: parent_order_id || null,
      order_code: returnCode,
      order_type: 'RETURN',
      status: 'COMPLETED',
      total_amount: totalReturnAmount,
      paid_amount: paidAmount,
      debt_amount: debtAmount,
      note: note || (isDebtOffset ? 'Khách trả hàng cấn trừ nợ (INV-07)' : 'Khách trả hàng hoàn tiền mặt'),
      created_by: req.ctx.userId || 'THU_NGAN'
    };

    const sqlRes = await db.query(
      'SELECT public.checkout_order($1::jsonb, $2::jsonb, $3::jsonb) AS result;',
      [
        JSON.stringify(orderPayload),
        JSON.stringify(formattedItems),
        JSON.stringify(payments)
      ]
    );

    res.json({
      success: true,
      message: isDebtOffset ? 'Đã lập phiếu trả hàng và cấn trừ trực tiếp vào sổ nợ của khách' : 'Đã lập phiếu trả hàng và hoàn tiền quỹ',
      data: sqlRes.rows[0]?.result
    });
  } catch (err) {
    console.error('🔥 [POS Returns Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'RETURN_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/pos/returns/recent
 * Tra cứu các phiếu trả hàng gần đây
 */
router.get('/returns/recent', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const result = await db.query(`
      SELECT 
        o.id,
        o.order_code,
        o.total_amount::numeric,
        o.paid_amount::numeric,
        o.debt_amount::numeric,
        o.status,
        o.note,
        o.created_at,
        p.id AS partner_id,
        p.name AS partner_name,
        p.code AS partner_code,
        (
          SELECT json_agg(json_build_object(
            'product_name', pr.name,
            'quantity', oi.quantity::numeric,
            'uom', oi.uom,
            'unit_price', oi.unit_price::numeric,
            'reason', oi.note
          ))
          FROM public.order_items oi
          JOIN public.products pr ON pr.id = oi.product_id
          WHERE oi.order_id = o.id
        ) AS items
      FROM public.orders o
      LEFT JOIN public.partners p ON o.partner_id = p.id
      WHERE o.branch_id = $1::uuid AND o.order_type = 'RETURN'
      ORDER BY o.created_at DESC
      LIMIT 20;
    `, [branchId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [POS Recent Returns Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'RECENT_RETURNS_QUERY_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/pos/partners
 * Tạo hồ sơ Khách Hàng mới
 */
router.post('/partners', async (req, res) => {
  try {
    const { name, phone, address, price_group = 'RETAIL', debt_limit = 0 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_NAME', message: 'Tên khách hàng không được để trống.' }
      });
    }

    const partnerCode = req.body.code && req.body.code.trim() 
      ? req.body.code.trim().toUpperCase() 
      : `KH-${Date.now().toString().slice(-6)}`;

    const result = await db.query(`
      INSERT INTO public.partners (
        code, name, phone, address, is_customer, is_supplier, price_group, debt_limit, current_debt, is_active
      ) VALUES ($1, $2, $3, $4, TRUE, FALSE, $5, $6, 0, TRUE)
      RETURNING id, code, name, phone, address, price_group, debt_limit::numeric, current_debt::numeric, is_active;
    `, [partnerCode, name.trim(), phone || null, address || null, price_group, Number(debt_limit) || 0]);

    res.json({
      success: true,
      message: 'Tạo khách hàng mới thành công.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('🔥 [POS Create Partner Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_PARTNER_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/pos/shifts/cash-flow
 * Ghi nhận khoản Thu / Chi tiền mặt ngoài đơn trong ca trực
 */
router.post('/shifts/cash-flow', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { shift_id, type, amount, category = 'OTHER', note } = req.body;

    if (!['IN', 'OUT'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TYPE', message: 'Loại luồng tiền phải là IN (Thu vào) hoặc OUT (Chi ra).' }
      });
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Số tiền thu/chi phải lớn hơn 0.' }
      });
    }

    const flowCode = `CF-${type}-${Date.now().toString().slice(-6)}`;

    const result = await db.query(`
      INSERT INTO public.cash_flows (
        flow_code, branch_id, shift_id, type, category, payment_method, payment_account, amount, note, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'CASH', 'KET_TIEN', $6, $7, $8)
      RETURNING id, flow_code, branch_id, shift_id, type, category, amount::numeric, note, created_at;
    `, [
      flowCode,
      branchId,
      shift_id || null,
      type,
      category,
      numAmount,
      note || (type === 'IN' ? 'Nạp thêm tiền két' : 'Chi quỹ tiền mặt'),
      req.ctx.userId || 'staff'
    ]);

    res.json({
      success: true,
      message: type === 'IN' ? 'Đã ghi nhận Nạp tiền vào két' : 'Đã ghi nhận Chi tiền khỏi két',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('🔥 [POS Cash Flow Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'CASH_FLOW_RECORD_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/pos/cashbook
 * Lấy sổ quỹ dòng tiền chi nhánh (Tổng thu, tổng chi, số dư két tiền, lịch sử luồng tiền)
 */
router.get('/cashbook', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;

    // 1. Tổng hợp dòng tiền
    const summaryRes = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0)::numeric AS total_in,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0)::numeric AS total_out,
        COALESCE(SUM(CASE WHEN type = 'IN' AND payment_method = 'CASH' THEN amount WHEN type = 'OUT' AND payment_method = 'CASH' THEN -amount ELSE 0 END), 0)::numeric AS cash_balance,
        COALESCE(SUM(CASE WHEN type = 'IN' AND payment_method != 'CASH' THEN amount ELSE 0 END), 0)::numeric AS digital_in
      FROM public.cash_flows
      WHERE branch_id = $1::uuid;
    `, [branchId]);

    // 2. Danh sách giao dịch dòng tiền gần nhất
    const flowsRes = await db.query(`
      SELECT cf.id, cf.flow_code, cf.branch_id, cf.shift_id, cf.type, cf.category, 
             cf.payment_method, cf.payment_account, cf.amount::numeric, cf.note, cf.created_by, cf.created_at,
             p.name AS partner_name
      FROM public.cash_flows cf
      LEFT JOIN public.partners p ON cf.partner_id = p.id
      WHERE cf.branch_id = $1::uuid
      ORDER BY cf.created_at DESC
      LIMIT 100;
    `, [branchId]);

    // 3. Thông tin ca hiện tại nếu có
    const shiftRes = await db.query(`
      SELECT id, staff_name, status, initial_amount::numeric AS starting_cash, system_amount::numeric AS current_cash_in_drawer
      FROM public.shifts
      WHERE branch_id = $1::uuid AND status = 'OPEN'
      ORDER BY opened_at DESC LIMIT 1;
    `, [branchId]);

    const summary = summaryRes.rows[0] || { total_in: 0, total_out: 0, cash_balance: 0, digital_in: 0 };
    const netBalance = Number(summary.total_in) - Number(summary.total_out);

    res.json({
      success: true,
      data: {
        summary: {
          total_in: Number(summary.total_in),
          total_out: Number(summary.total_out),
          net_balance: netBalance,
          cash_balance: Number(summary.cash_balance),
          digital_in: Number(summary.digital_in),
          current_shift: shiftRes.rows[0] || null
        },
        flows: flowsRes.rows
      }
    });
  } catch (err) {
    console.error('🔥 [POS Cashbook Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'CASHBOOK_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/pos/customer-groups
 * Danh sách nhóm khách hàng và tỷ lệ chiết khấu mặc định
 */
router.get('/customer-groups', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, code, name, discount_rate_pct::numeric, description FROM public.customer_groups WHERE is_deleted = FALSE ORDER BY name ASC;'
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/pos/customer-groups
 * Thêm mới hoặc cập nhật nhóm khách hàng
 */
router.post('/customer-groups', async (req, res) => {
  try {
    const { code, name, discount_rate_pct = 0, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, error: { message: 'Yêu cầu mã và tên nhóm khách hàng' } });
    }
    const result = await db.query(`
      INSERT INTO public.customer_groups (code, name, discount_rate_pct, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (code) DO UPDATE 
        SET name = EXCLUDED.name, discount_rate_pct = EXCLUDED.discount_rate_pct, description = EXCLUDED.description, is_deleted = FALSE
      RETURNING id, code, name, discount_rate_pct::numeric, description;
    `, [code, name, Number(discount_rate_pct), description || null]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/pos/shifts/cash-drop
 * Rút bớt tiền mặt trong két về két sắt an toàn (Cash Drop)
 */
router.post('/shifts/cash-drop', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { shift_id, amount, reason, receiver_name } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Số tiền rút két phải lớn hơn 0' } });
    }
    if (!receiver_name) {
      return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập tên người nhận tiền bàn giao' } });
    }

    // 1. Lưu bản ghi shift_cash_drops
    const dropRes = await db.query(`
      INSERT INTO public.shift_cash_drops (shift_id, branch_id, amount, reason, receiver_name, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, shift_id, branch_id, amount::numeric, reason, receiver_name, created_at;
    `, [shift_id || null, branchId, numAmount, reason || 'Rút tiền két về két sắt an toàn', receiver_name, req.ctx.userId || 'staff']);

    // 2. Ghi nhận dòng tiền Cash Flow OUT
    const flowCode = `CF-DROP-${Date.now().toString().slice(-6)}`;
    await db.query(`
      INSERT INTO public.cash_flows (flow_code, branch_id, shift_id, type, category, payment_method, payment_account, amount, note, created_by)
      VALUES ($1, $2, $3, 'OUT', 'CASH_DROP', 'CASH', 'KET_TIEN', $4, $5, $6);
    `, [flowCode, branchId, shift_id || null, numAmount, `Rút tiền két nộp về két tổng - Người nhận: ${receiver_name}`, req.ctx.userId || 'staff']);

    // 3. Khấu trừ số dư két tiền chi nhánh & nạp vào két trung ương
    await db.query(`
      UPDATE public.cash_accounts 
      SET current_balance = current_balance - $1 
      WHERE branch_id = $2 AND account_type = 'CASH';
    `, [numAmount, branchId]);

    await db.query(`
      UPDATE public.cash_accounts 
      SET current_balance = current_balance + $1 
      WHERE account_code = 'SAFE-CENTRAL';
    `, [numAmount]);

    res.json({
      success: true,
      message: `Đã rút an toàn ${numAmount.toLocaleString('vi-VN')}đ về két sắt tổng`,
      data: dropRes.rows[0]
    });
  } catch (err) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/pos/expense-categories
 * Danh mục chi phí vận hành
 */
router.get('/expense-categories', async (req, res) => {
  try {
    const result = await db.query('SELECT id, code, name, description FROM public.expense_categories ORDER BY name ASC;');
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/pos/expenses
 * Ghi nhận phiếu chi chi phí vận hành (Mặt bằng, điện, nước, lương...)
 */
router.post('/expenses', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { account_id, category_id, amount, description, receipt_image_url } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Số tiền chi phải lớn hơn 0' } });
    }
    if (!description) {
      return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập lý do/nội dung chi' } });
    }

    // 1. Thêm bản ghi expense_records
    const expRes = await db.query(`
      INSERT INTO public.expense_records (branch_id, account_id, category_id, amount, description, created_by, receipt_image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, branch_id, amount::numeric, description, spent_at, created_at;
    `, [branchId, account_id || null, category_id || null, numAmount, description, req.ctx.userId || 'staff', receipt_image_url || null]);

    // 2. Ghi nhận dòng tiền cash_flows OUT
    const flowCode = `CF-EXP-${Date.now().toString().slice(-6)}`;
    await db.query(`
      INSERT INTO public.cash_flows (flow_code, branch_id, type, category, payment_method, payment_account, amount, note, created_by)
      VALUES ($1, $2, 'OUT', 'EXPENSE', 'CASH', 'KET_TIEN', $3, $4, $5);
    `, [flowCode, branchId, numAmount, `Chi phí vận hành: ${description}`, req.ctx.userId || 'staff']);

    // 3. Khấu trừ số dư tài khoản chi nếu có
    if (account_id) {
      await db.query('UPDATE public.cash_accounts SET current_balance = current_balance - $1 WHERE id = $2;', [numAmount, account_id]);
    }

    res.json({
      success: true,
      message: `Đã ghi nhận phiếu chi ${numAmount.toLocaleString('vi-VN')}đ`,
      data: expRes.rows[0]
    });
  } catch (err) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/pos/cashbook/accounts
 * Số dư chi tiết từng tài khoản dòng tiền (Két quầy, VietQR, Két tổng)
 */
router.get('/cashbook/accounts', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const result = await db.query(`
      SELECT id, branch_id, account_code, account_name, account_type, account_number, bank_name, current_balance::numeric, is_active
      FROM public.cash_accounts
      WHERE branch_id = $1::uuid OR account_type = 'CENTRAL_SAFE'
      ORDER BY account_type ASC;
    `, [branchId]);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/pos/cashbook/pnl
 * Báo cáo Lợi Nhuận Ròng (Net Profit) = Doanh thu - Giá vốn - Chi phí vận hành
 */
router.get('/cashbook/pnl', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;

    const revenueRes = await db.query(`
      SELECT 
        COALESCE(SUM(o.total_amount), 0)::numeric AS total_revenue,
        COALESCE(SUM(oi.quantity * COALESCE(oi.override_cogs, oi.cost_price, 0)), 0)::numeric AS total_cogs
      FROM public.orders o
      JOIN public.order_items oi ON o.id = oi.order_id
      WHERE o.branch_id = $1::uuid AND o.status = 'COMPLETED' AND o.order_type = 'SALE' AND o.is_deleted = FALSE;
    `, [branchId]);

    const expenseRes = await db.query(`
      SELECT 
        COALESCE(SUM(amount), 0)::numeric AS total_opex
      FROM public.expense_records
      WHERE branch_id = $1::uuid;
    `, [branchId]);

    const rev = Number(revenueRes.rows[0]?.total_revenue || 0);
    const cogs = Number(revenueRes.rows[0]?.total_cogs || 0);
    const opex = Number(expenseRes.rows[0]?.total_opex || 0);
    const grossProfit = rev - cogs;
    const netProfit = grossProfit - opex;

    res.json({
      success: true,
      data: {
        revenue: rev,
        cogs: cogs,
        gross_profit: grossProfit,
        opex: opex,
        net_profit: netProfit,
        gross_margin_pct: rev > 0 ? ((grossProfit / rev) * 100).toFixed(1) : '0.0',
        net_margin_pct: rev > 0 ? ((netProfit / rev) * 100).toFixed(1) : '0.0'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

module.exports = router;


