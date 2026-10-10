/**
 * Migration & Patch: Nghiệp vụ bảo vệ INV-06 (Cancel Transfer Reversal) & INV-10 (Hard Immutability & Index)
 */
const db = require('../server/src/db');

async function migrate() {
  console.log('🚀 [Migration]: Bắt đầu cài đặt các bộ bảo vệ CSDL INV-06 & INV-10...');
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Tạo Composite Covering Index tối ưu truy vấn $O(1)$ cho Thẻ kho (INV-10)
    console.log('📌 [1/3] Tạo Composite Index idx_inventory_logs_fast_lookup...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_logs_fast_lookup 
      ON public.inventory_logs (branch_id, product_id, created_at DESC, id DESC);
    `);

    // 2. Cài đặt CSDL Trigger bảo vệ Thẻ kho Bất biến tuyệt đối WORM (INV-10)
    console.log('📌 [2/3] Cài đặt Trigger fn_prevent_inventory_logs_tampering...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.fn_prevent_inventory_logs_tampering()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'INV-10 VIOLATION: Thẻ kho (inventory_logs) là bất biến (Append-Only/WORM). Nghiêm cấm mọi thao tác UPDATE hoặc DELETE!';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS tg_guard_inventory_logs_immutability ON public.inventory_logs;
      CREATE TRIGGER tg_guard_inventory_logs_immutability
      BEFORE UPDATE OR DELETE ON public.inventory_logs
      FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_inventory_logs_tampering();
    `);

    // 3. Cài đặt RPC cancel_transfer (INV-06: Compensating Reversal khi hủy xe đang đi đường)
    console.log('📌 [3/3] Cài đặt RPC public.cancel_transfer...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.cancel_transfer(
          p_transfer_id UUID,
          p_cancelled_by VARCHAR(100),
          p_reason TEXT DEFAULT 'Hủy chuyến điều chuyển'
      )
      RETURNS JSONB AS $$
      DECLARE
          v_tr RECORD;
          v_item RECORD;
          v_inv RECORD;
          v_cancelled_status VARCHAR(30);
      BEGIN
          SELECT * INTO v_tr FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
          
          IF NOT FOUND THEN
              RAISE EXCEPTION 'Phiếu chuyển không tồn tại: %', p_transfer_id;
          END IF;

          IF v_tr.status IN ('COMPLETED', 'RECEIVED') THEN
              RAISE EXCEPTION 'Phiếu chuyển đã hoàn thành nhận hàng (%), không thể hủy chuyến!', v_tr.status;
          END IF;

          IF v_tr.status = 'CANCELLED' THEN
              RAISE EXCEPTION 'Phiếu chuyển đã ở trạng thái CANCELLED trước đó!';
          END IF;

          -- Trường hợp 1: Đang ở DRAFT -> Chưa trừ kho, chỉ cần hủy phiếu
          IF v_tr.status = 'DRAFT' THEN
              UPDATE public.stock_transfers
              SET status = 'CANCELLED',
                  note = COALESCE(note, '') || ' [HỦY KHI DRAFT: ' || p_reason || ' by ' || p_cancelled_by || ']'
              WHERE id = p_transfer_id;

              RETURN jsonb_build_object(
                  'success', TRUE,
                  'status', 'CANCELLED',
                  'transfer_id', p_transfer_id,
                  'inventory_refunded', FALSE,
                  'message', 'Đã hủy phiếu chuyển nháp thành công'
              );
          END IF;

          -- Trường hợp 2: Đang ở DANG_DI_DUONG -> Xe hàng gặp sự cố quay đầu -> Hoàn trả tồn kho cho Kho Xuất (INV-06 SAGA)
          IF v_tr.status = 'DANG_DI_DUONG' THEN
              FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id FOR UPDATE LOOP
                  SELECT * INTO v_inv FROM public.inventory
                  WHERE branch_id = v_tr.from_branch_id AND product_id = v_item.product_id FOR UPDATE;

                  IF NOT FOUND THEN
                      INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
                      VALUES (v_tr.from_branch_id, v_item.product_id, v_item.send_base_qty, COALESCE(v_item.unit_cost, 0))
                      RETURNING * INTO v_inv;
                  ELSE
                      UPDATE public.inventory
                      SET on_hand = on_hand + v_item.send_base_qty,
                          updated_at = clock_timestamp()
                      WHERE id = v_inv.id;
                  END IF;

                  -- Ghi nhận dòng Ledger hoàn trả bất biến vào thẻ kho (INV-10)
                  INSERT INTO public.inventory_logs (
                      branch_id, product_id, type, qty_change, balance_after,
                      unit_cost, reference_id, note, created_by
                  ) VALUES (
                      v_tr.from_branch_id, v_item.product_id, 'TRANSFER_RETURN', v_item.send_base_qty,
                      v_inv.on_hand + v_item.send_base_qty, COALESCE(v_item.unit_cost, 0),
                      v_tr.id, 'Hủy chuyển đang đi đường: Hoàn trả tồn kho về Kho xuất (' || p_reason || ')',
                      p_cancelled_by
                  );
              END LOOP;

              UPDATE public.stock_transfers
              SET status = 'CANCELLED',
                  note = COALESCE(note, '') || ' [HỦY KHI ĐANG ĐI ĐƯỜNG: ' || p_reason || ' by ' || p_cancelled_by || ']'
              WHERE id = p_transfer_id;

              RETURN jsonb_build_object(
                  'success', TRUE,
                  'status', 'CANCELLED',
                  'transfer_id', p_transfer_id,
                  'inventory_refunded', TRUE,
                  'message', 'Đã hủy chuyến đang đi đường và hoàn trả toàn bộ tồn kho về Kho xuất'
              );
          END IF;

          RAISE EXCEPTION 'Trạng thái phiếu chuyển không hợp lệ để hủy: %', v_tr.status;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query('COMMIT;');
    console.log('✅ [Migration]: Cài đặt thành công 100% các bộ bảo vệ CSDL!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('🔥 [Migration Failed]:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
