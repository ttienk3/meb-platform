const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/transfers
 * Lấy danh sách phiếu điều chuyển của chi nhánh hiện tại (chi nhánh gửi hoặc nhận)
 */
router.get('/', async (req, res) => {
  try {
    const branchId = req.ctx.branchId;
    const { status, type } = req.query;

    let queryText = `
      SELECT 
        t.id,
        t.transfer_code,
        t.from_branch_id,
        b_from.name AS from_branch_name,
        b_from.code AS from_branch_code,
        t.to_branch_id,
        b_to.name AS to_branch_name,
        b_to.code AS to_branch_code,
        t.status,
        t.total_loss_amount::numeric,
        t.loss_responsibility,
        t.note,
        t.created_by,
        t.received_by,
        t.dispatched_at,
        t.received_at,
        t.created_at,
        (SELECT COUNT(*) FROM public.stock_transfer_items WHERE transfer_id = t.id) AS total_items
      FROM public.stock_transfers t
      JOIN public.branches b_from ON t.from_branch_id = b_from.id
      JOIN public.branches b_to ON t.to_branch_id = b_to.id
      WHERE (t.from_branch_id = $1::uuid OR t.to_branch_id = $1::uuid)
    `;
    const params = [branchId];

    if (type === 'OUT') {
      queryText = queryText.replace('(t.from_branch_id = $1::uuid OR t.to_branch_id = $1::uuid)', 't.from_branch_id = $1::uuid');
    } else if (type === 'IN') {
      queryText = queryText.replace('(t.from_branch_id = $1::uuid OR t.to_branch_id = $1::uuid)', 't.to_branch_id = $1::uuid');
    }

    if (status) {
      params.push(status);
      queryText += ` AND t.status = $${params.length}`;
    }

    queryText += ' ORDER BY t.created_at DESC LIMIT 50;';

    const result = await db.query(queryText, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('🔥 [Transfer List Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'TRANSFERS_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/transfers/:id
 * Lấy chi tiết phiếu điều chuyển và danh sách mặt hàng
 */
router.get('/:id', async (req, res) => {
  try {
    const transferId = req.params.id;

    const transferRes = await db.query(`
      SELECT 
        t.id,
        t.transfer_code,
        t.from_branch_id,
        b_from.name AS from_branch_name,
        t.to_branch_id,
        b_to.name AS to_branch_name,
        t.status,
        t.total_loss_amount::numeric,
        t.loss_responsibility,
        t.note,
        t.created_by,
        t.received_by,
        t.dispatched_at,
        t.received_at,
        t.created_at
      FROM public.stock_transfers t
      JOIN public.branches b_from ON t.from_branch_id = b_from.id
      JOIN public.branches b_to ON t.to_branch_id = b_to.id
      WHERE t.id = $1::uuid;
    `, [transferId]);

    if (transferRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'TRANSFER_NOT_FOUND', message: 'Không tìm thấy phiếu điều chuyển' }
      });
    }

    const itemsRes = await db.query(`
      SELECT 
        ti.id,
        ti.product_id,
        p.code AS product_code,
        p.name AS product_name,
        ti.uom,
        ti.conversion_rate::numeric,
        ti.send_quantity::numeric AS send_qty,
        ti.send_base_qty::numeric,
        ti.received_quantity::numeric AS received_qty,
        ti.received_base_qty::numeric,
        ti.loss_quantity::numeric AS loss_qty,
        ti.loss_base_qty::numeric,
        ti.unit_cost::numeric,
        ti.loss_reason
      FROM public.stock_transfer_items ti
      JOIN public.products p ON ti.product_id = p.id
      WHERE ti.transfer_id = $1::uuid;
    `, [transferId]);

    res.json({
      success: true,
      data: {
        ...transferRes.rows[0],
        items: itemsRes.rows
      }
    });
  } catch (err) {
    console.error('🔥 [Transfer Detail Error]:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'TRANSFER_DETAIL_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/transfers
 * Lập phiếu điều chuyển mới (Trạng thái DRAFT)
 */
router.post('/', async (req, res) => {
  try {
    const { to_branch_id, shipper_id, note, created_by, items, transfer_code } = req.body;
    const from_branch_id = req.ctx.branchId;

    if (!to_branch_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu to_branch_id và danh sách items' }
      });
    }

    if (from_branch_id === to_branch_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_BRANCH', message: 'Chi nhánh xuất và chi nhánh nhận không được trùng nhau' }
      });
    }

    // Chuẩn hóa trường send_quantity cho từng item
    const formattedItems = items.map(it => ({
      product_id: it.product_id,
      uom: it.uom,
      conversion_rate: it.conversion_rate || 1,
      send_quantity: it.send_quantity !== undefined ? it.send_quantity : it.send_qty
    }));

    const transferPayload = {
      from_branch_id,
      to_branch_id,
      shipper_id: shipper_id || null,
      transfer_code: transfer_code || undefined,
      note: note || '',
      created_by: created_by || 'Thủ Kho'
    };

    const sqlRes = await db.query(
      'SELECT public.create_stock_transfer($1::jsonb, $2::jsonb) AS result;',
      [JSON.stringify(transferPayload), JSON.stringify(formattedItems)]
    );

    const resultData = sqlRes.rows[0]?.result;
    res.json({
      success: true,
      message: 'Đã lập phiếu điều chuyển thành công (Trạng thái DRAFT)',
      data: {
        ...resultData,
        id: resultData?.transfer_id || resultData?.id
      }
    });
  } catch (err) {
    console.error('🔥 [Transfer Create Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_TRANSFER_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/transfers/:id/dispatch
 * PHA 1: Xuất kho chuyển đi -> Trạng thái đổi sang DANG_DI_DUONG, trừ tồn kho xuất
 */
router.post('/:id/dispatch', async (req, res) => {
  try {
    const transferId = req.params.id;
    const { dispatched_by } = req.body;

    const sqlRes = await db.query(
      'SELECT public.dispatch_transfer($1::uuid, $2) AS result;',
      [transferId, dispatched_by || 'Thủ Kho Xuất']
    );

    res.json({
      success: true,
      message: 'Xuất kho chuyển hàng thành công. Hàng đang đi đường (DANG_DI_DUONG)',
      data: sqlRes.rows[0]?.result
    });
  } catch (err) {
    console.error('🔥 [Transfer Dispatch Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'DISPATCH_TRANSFER_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/transfers/:id/receive
 * PHA 2: Nhập kho nhận hàng -> Cộng tồn kho nhận, ghi nhận hao hụt/đối soát
 */
router.post('/:id/receive', async (req, res) => {
  try {
    const transferId = req.params.id;
    const { received_items, loss_responsibility, received_by } = req.body;

    if (!received_items || !Array.isArray(received_items) || received_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Yêu cầu danh sách received_items đối soát' }
      });
    }

    // Tra cứu danh sách items hiện có của phiếu điều chuyển để ánh xạ linh hoạt
    const dbItems = (await db.query(
      'SELECT id, product_id, send_quantity FROM public.stock_transfer_items WHERE transfer_id = $1::uuid;',
      [transferId]
    )).rows;

    const formattedReceivedItems = received_items.map(it => {
      let matchedItem = null;
      if (it.item_id) {
        matchedItem = dbItems.find(d => d.id === it.item_id);
      } else if (it.product_id) {
        matchedItem = dbItems.find(d => d.product_id === it.product_id);
      }
      const itemId = matchedItem ? matchedItem.id : it.item_id;
      const sendQty = matchedItem ? Number(matchedItem.send_quantity) : 0;
      const receivedQty = it.received_qty !== undefined ? Number(it.received_qty) : Number(it.received_quantity || 0);
      const lossQty = it.loss_qty !== undefined ? Number(it.loss_qty) : (it.loss_quantity !== undefined ? Number(it.loss_quantity) : Math.max(0, sendQty - receivedQty));

      return {
        item_id: itemId,
        received_qty: receivedQty,
        loss_qty: lossQty,
        loss_reason: it.loss_reason || (lossQty > 0 ? 'Hao hụt kiểm đếm' : '')
      };
    });

    const sqlRes = await db.query(
      'SELECT public.receive_transfer($1::uuid, $2::jsonb, $3, $4) AS result;',
      [
        transferId,
        JSON.stringify(formattedReceivedItems),
        loss_responsibility || 'SHIPPER',
        received_by || 'Thủ Kho Nhận'
      ]
    );

    const transferResult = sqlRes.rows[0]?.result;
    const lossAmount = Number(transferResult?.total_loss_amount || 0);

    // Q7: Nếu quy trách nhiệm trừ nợ tài xế và có hao hụt, ghi nhận vào shipper_debts
    if (lossAmount > 0 && loss_responsibility === 'SHIPPER_DEBT') {
      try {
        const trInfo = await db.query('SELECT shipper_id, transfer_code FROM public.stock_transfers WHERE id = $1::uuid;', [transferId]);
        const shipperId = trInfo.rows[0]?.shipper_id;
        let shipperName = 'Tài xế giao hàng';
        if (shipperId) {
          const sRes = await db.query('SELECT name FROM public.partners WHERE id = $1::uuid;', [shipperId]);
          if (sRes.rows.length > 0) shipperName = sRes.rows[0].name;
        }
        await db.query(`
          INSERT INTO public.shipper_debts (transfer_id, shipper_id, shipper_name, amount, status, note)
          VALUES ($1, $2, $3, $4, 'PENDING', $5);
        `, [transferId, shipperId || null, shipperName, lossAmount, `Khấu trừ bồi thường hao hụt phiếu chuyển ${trInfo.rows[0]?.transfer_code || transferId}`]);
      } catch (debtErr) {
        console.warn('⚠️ [Shipper Debt Record Warning]:', debtErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Nhập kho điều chuyển và đối soát hao hụt thành công',
      data: transferResult
    });
  } catch (err) {
    console.error('🔥 [Transfer Receive Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'RECEIVE_TRANSFER_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/transfers/shipper-debts
 * Tra cứu danh sách công nợ bồi thường hao hụt của tài xế / shipper (Q7)
 */
router.get('/shipper-debts', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sd.id, sd.transfer_id, sd.shipper_id, sd.shipper_name, sd.amount::numeric, sd.status, sd.note, sd.created_at,
             st.transfer_code
      FROM public.shipper_debts sd
      LEFT JOIN public.stock_transfers st ON sd.transfer_id = st.id
      ORDER BY sd.created_at DESC;
    `);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/transfers/:id/cancel
 * HỦY ĐIỀU CHUYỂN & BỒI HOÀN KHO (INV-06 SAGA COMPENSATING TRANSACTION)
 * - Nếu đang ở DRAFT: Hủy phiếu bình thường.
 * - Nếu đang ở DANG_DI_DUONG: Hoàn trả lại tồn kho cho Kho Xuất, ghi nhận Ledger TRANSFER_RETURN (INV-10).
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const transferId = req.params.id;
    const { cancelled_by, reason } = req.body;

    const sqlRes = await db.query(
      'SELECT public.cancel_transfer($1::uuid, $2, $3) AS result;',
      [
        transferId,
        cancelled_by || 'Quản Lý Điều Chuyển',
        reason || 'Hủy chuyến chuyển kho'
      ]
    );

    res.json({
      success: true,
      message: 'Hủy phiếu chuyển kho và xử lý bồi hoàn tồn kho thành công',
      data: sqlRes.rows[0]?.result
    });
  } catch (err) {
    console.error('🔥 [Transfer Cancel Error]:', err.message);
    res.status(400).json({
      success: false,
      error: { code: 'CANCEL_TRANSFER_FAILED', message: err.message }
    });
  }
});

module.exports = router;
