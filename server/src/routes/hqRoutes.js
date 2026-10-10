const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * ============================================================================
 * MEB HQ COMMAND CENTER - ROUTER ĐIỀU HÀNH TỔNG BỘ CHUỖI ĐA CHI NHÁNH
 * ============================================================================
 */

// 1. TỔNG QUAN CHỈ SỐ TOÀN CHUỖI REALTIME
router.get('/overview', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // a. Tổng số chi nhánh & chi nhánh đang hoạt động
    const branchStats = await db.query(`
      SELECT 
        COUNT(*)::int as total_branches,
        COUNT(*) FILTER (WHERE is_active = true)::int as active_branches
      FROM branches
    `);

    // b. Tổng doanh thu & số đơn hàng hoàn thành hôm nay toàn chuỗi
    const todayOrders = await db.query(`
      SELECT 
        COUNT(*)::int as orders_count,
        COALESCE(SUM(total_amount), 0)::numeric as total_revenue,
        COALESCE(SUM(debt_amount), 0)::numeric as total_debt_created
      FROM orders
      WHERE status = 'COMPLETED'
        AND created_at >= $1::date
    `, [today]);

    // c. Tổng số ca đang mở & tiền mặt trong két toàn chuỗi
    const shiftStats = await db.query(`
      SELECT 
        COUNT(*)::int as open_shifts_count,
        COALESCE(SUM(initial_amount + system_amount), 0)::numeric as total_cash_in_drawers
      FROM shifts
      WHERE status = 'OPEN'
    `);

    // d. Tổng công nợ khách hàng toàn hệ thống
    const debtStats = await db.query(`
      SELECT 
        COALESCE(SUM(current_debt), 0)::numeric as total_customer_debt,
        COUNT(*) FILTER (WHERE current_debt > 0)::int as indebted_customers_count
      FROM partners
      WHERE is_customer = true AND is_active = true
    `);

    // e. Tổng giá trị tồn kho toàn hệ thống
    const inventoryStats = await db.query(`
      SELECT 
        COALESCE(SUM(on_hand * cost_price), 0)::numeric as total_inventory_valuation,
        COUNT(*) FILTER (WHERE on_hand <= min_stock AND min_stock > 0)::int as low_stock_alerts
      FROM inventory
    `);

    return res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        branches: branchStats.rows[0],
        today_sales: todayOrders.rows[0],
        live_shifts: shiftStats.rows[0],
        customer_debt: debtStats.rows[0],
        inventory: inventoryStats.rows[0]
      }
    });
  } catch (err) {
    console.error('🔥 [HQ Overview Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'HQ_OVERVIEW_ERROR', message: err.message }
    });
  }
});

// 2. MA TRẬN CHI TIẾT TỪNG CHI NHÁNH (HQ BRANCH MATRIX)
router.get('/branches-matrix', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Lấy toàn bộ chi nhánh kèm thông tin tổ chức
    const branchesRes = await db.query(`
      SELECT 
        b.id, b.code, b.name, b.organization_id, b.phone, b.address, 
        b.toggles, b.is_active, b.created_at,
        o.name as organization_name
      FROM branches b
      LEFT JOIN organizations o ON b.organization_id = o.id
      ORDER BY b.code ASC
    `);

    const branches = branchesRes.rows;

    // Duyệt và lấy số liệu chi tiết cho từng chi nhánh
    const matrix = await Promise.all(branches.map(async (branch) => {
      // 1. Ca bán hàng hiện tại đang mở (nếu có)
      const shiftRes = await db.query(`
        SELECT id, staff_name, status, opened_at, initial_amount, system_amount
        FROM shifts
        WHERE branch_id = $1 AND status = 'OPEN'
        ORDER BY opened_at DESC
        LIMIT 1
      `, [branch.id]);

      const currentShift = shiftRes.rows[0] || null;

      // 2. Doanh số hôm nay của chi nhánh
      const salesRes = await db.query(`
        SELECT 
          COUNT(*)::int as today_orders,
          COALESCE(SUM(total_amount), 0)::numeric as today_revenue,
          COALESCE(SUM(paid_amount), 0)::numeric as today_collected,
          COALESCE(SUM(debt_amount), 0)::numeric as today_debt
        FROM orders
        WHERE branch_id = $1 AND status = 'COMPLETED' AND created_at >= $2::date
      `, [branch.id, today]);

      // 3. Tồn kho và cảnh báo thiếu hàng của chi nhánh
      const invRes = await db.query(`
        SELECT 
          COUNT(*)::int as total_sku,
          COALESCE(SUM(on_hand), 0)::numeric as total_qty,
          COALESCE(SUM(on_hand * cost_price), 0)::numeric as inventory_value,
          COUNT(*) FILTER (WHERE on_hand <= min_stock AND min_stock > 0)::int as low_stock_count
        FROM inventory
        WHERE branch_id = $1
      `, [branch.id]);

      // 4. Lấy số lượng phiếu điều chuyển đang đi đường tới chi nhánh này
      const incomingTransfersRes = await db.query(`
        SELECT COUNT(*)::int as incoming_count
        FROM stock_transfers
        WHERE to_branch_id = $1 AND status = 'IN_TRANSIT'
      `, [branch.id]);

      return {
        ...branch,
        current_shift: currentShift,
        sales_summary: salesRes.rows[0],
        inventory_summary: invRes.rows[0],
        incoming_transfers: incomingTransfersRes.rows[0]?.incoming_count || 0
      };
    }));

    return res.json({
      success: true,
      count: matrix.length,
      data: matrix
    });
  } catch (err) {
    console.error('🔥 [HQ Branches Performance Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'HQ_BRANCH_MATRIX_ERROR', message: err.message }
    });
  }
});

// 3. BẬT / TẮT TRẠNG THÁI HOẠT ĐỘNG CỦA CHI NHÁNH TỪ XA
router.post('/branches/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const branchRes = await db.query('SELECT id, code, name, is_active FROM branches WHERE id = $1', [id]);
    if (branchRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Không tìm thấy chi nhánh' } });
    }

    const currentStatus = branchRes.rows[0].is_active;
    const newStatus = !currentStatus;

    await db.query('UPDATE branches SET is_active = $1, updated_at = clock_timestamp() WHERE id = $2', [newStatus, id]);

    return res.json({
      success: true,
      message: `Đã ${newStatus ? 'kích hoạt' : 'tạm dừng'} chi nhánh ${branchRes.rows[0].code}`,
      data: { id, is_active: newStatus }
    });
  } catch (err) {
    console.error('🔥 [HQ Branch Toggle Error]:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'HQ_BRANCH_TOGGLE_ERROR', message: err.message }
    });
  }
});

module.exports = router;
