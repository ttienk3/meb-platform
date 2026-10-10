const { query, pool } = require('../server/src/db');

async function patchCollectDebt() {
  console.log('🔧 Đang nâng cấp hàm public.collect_debt với mã flow_code chống xung đột duy nhất...');

  const sql = `
  CREATE OR REPLACE FUNCTION public.collect_debt(
      p_branch_id UUID,
      p_shift_id UUID,
      p_partner_id UUID,
      p_amount NUMERIC(15,2),
      p_payment_method VARCHAR(20) DEFAULT 'CASH',
      p_payment_account VARCHAR(50) DEFAULT 'KET_TIEN',
      p_note TEXT DEFAULT NULL,
      p_created_by VARCHAR(100) DEFAULT 'Thu Ngân'
  )
  RETURNS JSONB AS $$
  DECLARE
      v_flow_code VARCHAR(50);
      v_new_debt NUMERIC(15,2);
  BEGIN
      IF p_amount <= 0 THEN
          RAISE EXCEPTION 'Số tiền thu nợ phải lớn hơn 0!';
      END IF;

      -- Sinh mã phiếu thu duy nhất với microseconds và 4 số ngẫu nhiên (chống duplicate key)
      v_flow_code := 'PT-NO-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS-') || lpad((floor(random() * 9000) + 1000)::text, 4, '0');

      -- Ghi nhận phiếu thu vào sổ quỹ (Trigger tg_sync_cashflow_debt sẽ tự động trừ partners.current_debt)
      INSERT INTO public.cash_flows (
          flow_code, branch_id, shift_id, partner_id,
          type, category, payment_method, payment_account,
          amount, note, created_by
      ) VALUES (
          v_flow_code, p_branch_id, p_shift_id, p_partner_id,
          'IN', 'DEBT_COLLECTION', p_payment_method, p_payment_account,
          p_amount, COALESCE(p_note, 'Thu nợ khách hàng'), p_created_by
      );

      -- Lấy dư nợ mới nhất sau khi trigger đã xử lý
      SELECT current_debt INTO v_new_debt
      FROM public.partners
      WHERE id = p_partner_id;

      RETURN jsonb_build_object(
          'success', TRUE,
          'flow_code', v_flow_code,
          'amount_collected', p_amount,
          'remaining_debt', v_new_debt
      );
  END;
  $$ LANGUAGE plpgsql;
  `;

  await query(sql);
  console.log('✅ Đã cập nhật thành công public.collect_debt với flow_code duy nhất!');
  await pool.end();
}

patchCollectDebt().catch(err => {
  console.error('❌ Lỗi vá hàm collect_debt:', err);
  process.exit(1);
});
