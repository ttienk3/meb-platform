const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function patchAndSeal() {
  await client.connect();
  console.log('=============================================================================');
  console.log('🛡️ TIẾN TRÌNH VÁ TOÀN DIỆN: BỊT KÍN 5 LỖ HỔNG & HOÀN THIỆN ĐỘNG CƠ CSDL');
  console.log('=============================================================================\n');

  try {
    // =========================================================================
    // VÁ 1 & 2: TRIGGER BẢO VỆ OVERRIDE (CHỐNG LÁCH KHÓA ADMIN & CHỐNG PHÁ DEPENDENCIES)
    // =========================================================================
    console.log('1. Đang cài đặt Trigger tg_guard_branch_override...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.fn_guard_branch_override()
      RETURNS TRIGGER AS $$
      DECLARE
          v_reg RECORD;
          v_dep_key TEXT;
          v_dep_val BOOLEAN;
      BEGIN
          -- 1. Tra cứu tính năng trong Registry
          SELECT * INTO v_reg FROM public.feature_registry WHERE key = NEW.feature_key;
          IF NOT FOUND THEN
              RAISE EXCEPTION 'Tính năng không tồn tại trong Registry: %', NEW.feature_key;
          END IF;

          -- 2. Kiểm tra cờ is_locked và allow_branch_override (VÁ SEC-01)
          IF v_reg.is_locked = TRUE OR v_reg.allow_branch_override = FALSE THEN
              RAISE EXCEPTION 'VƯỢT QUYỀN KHÓA ADMIN: Tính năng "%" đã bị Admin khóa cứng toàn hệ thống, chi nhánh không được phép tùy biến riêng!', v_reg.label;
          END IF;

          -- 3. Kiểm tra Dependencies khi bật tính năng (VÁ LOGIC-01)
          -- Nếu tính năng này được bật (value = true), tất cả dependencies của nó cũng phải bật
          IF NEW.value = 'true'::jsonb AND jsonb_array_length(v_reg.dependencies) > 0 THEN
              FOR v_dep_key IN SELECT jsonb_array_elements_text(v_reg.dependencies) LOOP
                  -- Kiểm tra giá trị effective của dependency tại chi nhánh này
                  SELECT (effective_value = 'true'::jsonb) INTO v_dep_val
                  FROM public.get_effective_branch_config(NEW.branch_id)
                  WHERE feature_key = v_dep_key;

                  IF v_dep_val IS DISTINCT FROM TRUE THEN
                      RAISE EXCEPTION 'VI PHẠM RÀNG BUỘC PHỤ THUỘC: Tính năng "%" bắt buộc tính năng "%" phải được kích hoạt trước!',
                          v_reg.label, v_dep_key;
                  END IF;
              END LOOP;
          END IF;

          -- Nếu tính năng bị tắt (value = false), kiểm tra xem có tính năng nào khác đang phụ thuộc vào nó không
          IF NEW.value = 'false'::jsonb THEN
              IF EXISTS (
                  SELECT 1 
                  FROM public.branch_feature_overrides bfo
                  JOIN public.feature_registry fr ON fr.key = bfo.feature_key
                  WHERE bfo.branch_id = NEW.branch_id 
                    AND bfo.value = 'true'::jsonb
                    AND fr.dependencies ? NEW.feature_key
              ) THEN
                  RAISE EXCEPTION 'VI PHẠM RÀNG BUỘC PHỤ THUỘC: Không thể tắt tính năng "%" vì có tính năng khác đang phụ thuộc vào nó!', NEW.feature_key;
              END IF;
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS tg_guard_branch_override ON public.branch_feature_overrides;
      CREATE TRIGGER tg_guard_branch_override
      BEFORE INSERT OR UPDATE ON public.branch_feature_overrides
      FOR EACH ROW EXECUTE FUNCTION public.fn_guard_branch_override();
    `);
    console.log('   ✅ Đã cài đặt Trigger fn_guard_branch_override (Bịt kín SEC-01 và LOGIC-01).');

    // =========================================================================
    // VÁ 3: TRIGGER BẢO VỆ TÍNH NHẤT QUÁN TENANT TRONG USER_BRANCH_ACCESS (VÁ SEC-02)
    // =========================================================================
    console.log('2. Đang cài đặt Trigger tg_check_user_branch_tenant...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.fn_check_user_branch_tenant()
      RETURNS TRIGGER AS $$
      DECLARE
          v_branch_org_id UUID;
      BEGIN
          IF NEW.branch_id IS NOT NULL THEN
              SELECT organization_id INTO v_branch_org_id 
              FROM public.branches 
              WHERE id = NEW.branch_id;

              IF v_branch_org_id IS DISTINCT FROM NEW.organization_id THEN
                  RAISE EXCEPTION 'RÒ RỈ TỔ CHỨC (TENANT MISMATCH): Chi nhánh % thuộc tổ chức %, không khớp với tổ chức % của nhân viên!',
                      NEW.branch_id, v_branch_org_id, NEW.organization_id;
              END IF;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS tg_check_user_branch_tenant ON public.user_branch_access;
      CREATE TRIGGER tg_check_user_branch_tenant
      BEFORE INSERT OR UPDATE ON public.user_branch_access
      FOR EACH ROW EXECUTE FUNCTION public.fn_check_user_branch_tenant();
    `);
    console.log('   ✅ Đã cài đặt Trigger fn_check_user_branch_tenant (Bịt kín SEC-02).');

    // =========================================================================
    // VÁ 4: KẾT NỐI TRỰC TIẾP GET_EFFECTIVE_BRANCH_CONFIG VÀO CHECKOUT_ORDER (VÁ INTEG-01)
    // =========================================================================
    console.log('3. Đang nâng cấp checkout_order kết nối trực tiếp với động cơ thừa kế...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.checkout_order(
          p_order JSONB,
          p_items JSONB,
          p_payments JSONB DEFAULT '[]'::jsonb
      )
      RETURNS JSONB AS $$
      DECLARE
          v_branch_id UUID;
          v_partner_id UUID;
          v_order_id UUID;
          v_order_code VARCHAR(50);
          v_total_amount NUMERIC(15,2);
          v_paid_amount NUMERIC(15,2);
          v_debt_amount NUMERIC(15,2);
          v_order_status VARCHAR(30);
          v_order_type VARCHAR(20);
          v_allow_negative BOOLEAN := FALSE;
          v_allow_debt BOOLEAN := FALSE;
          v_item RECORD;
          v_payment RECORD;
          v_inv RECORD;
          v_prod RECORD;
          v_combo_child RECORD;
          v_base_qty NUMERIC(15,3);
          v_cost_price NUMERIC(15,2);
          v_flow_code VARCHAR(50);
          v_flow_type VARCHAR(20);
          v_flow_category VARCHAR(50);
      BEGIN
          -- 1. Parse order header
          v_branch_id := (p_order->>'branch_id')::uuid;
          v_partner_id := CASE WHEN p_order->>'partner_id' IS NOT NULL THEN (p_order->>'partner_id')::uuid ELSE NULL END;
          v_order_code := COALESCE(p_order->>'order_code', 'HD-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS'));
          v_total_amount := (p_order->>'total_amount')::numeric;
          v_paid_amount := COALESCE((p_order->>'paid_amount')::numeric, v_total_amount);
          v_debt_amount := v_total_amount - v_paid_amount;
          v_order_type := COALESCE(p_order->>'order_type', 'SALE');
          v_order_status := COALESCE(p_order->>'status', 'COMPLETED');

          -- 2. ĐỌC CẤU HÌNH THỪA KẾ THỜI GIAN THỰC QUA GET_EFFECTIVE_BRANCH_CONFIG (VÁ INTEG-01)
          SELECT COALESCE(effective_value::boolean, FALSE) INTO v_allow_negative
          FROM public.get_effective_branch_config(v_branch_id)
          WHERE feature_key = 'allow_negative_stock';

          SELECT COALESCE(effective_value::boolean, FALSE) INTO v_allow_debt
          FROM public.get_effective_branch_config(v_branch_id)
          WHERE feature_key = 'allow_debt';

          -- 3. CHẶN NỢ BẤT KHẢ THI THEO CẤU HÌNH THỪA KẾ
          IF v_order_type = 'PREORDER' AND v_partner_id IS NULL THEN
              RAISE EXCEPTION 'ĐẶT CỌC BẤT KHẢ THI: Đơn đặt cọc giao sau (PREORDER) bắt buộc phải chọn hồ sơ Khách hàng!';
          END IF;

          IF v_debt_amount > 0 THEN
              IF v_order_type = 'SALE' AND v_allow_debt = FALSE THEN
                  RAISE EXCEPTION 'BÁN NỢ BỊ CẤM: Chi nhánh này chưa kích hoạt tính năng Bán nợ (allow_debt = false)!';
              END IF;

              IF v_partner_id IS NULL THEN
                  RAISE EXCEPTION 'BÁN NỢ BẤT KHẢ THI: Bắt buộc phải chọn hồ sơ Khách hàng khi phát sinh công nợ!';
              END IF;

              -- Kiểm tra hạn mức tín dụng (chỉ áp dụng khi xuất hàng thực tế SALE)
              IF v_order_type = 'SALE' THEN
                  PERFORM 1 FROM public.partners 
                  WHERE id = v_partner_id 
                    AND debt_limit > 0 
                    AND (current_debt + v_debt_amount) > debt_limit;
                  IF FOUND THEN
                      DECLARE
                          v_cur_debt NUMERIC;
                          v_limit NUMERIC;
                      BEGIN
                          SELECT current_debt, debt_limit INTO v_cur_debt, v_limit FROM public.partners WHERE id = v_partner_id;
                          RAISE EXCEPTION 'VƯỢT HẠN MỨC TÍN DỤNG: Khách nợ hiện tại: %, Đơn nợ: %, Hạn mức tối đa: %', 
                              v_cur_debt, v_debt_amount, v_limit;
                      END;
                  END IF;
              END IF;
          END IF;

          -- 4. INSERT HÓA ĐƠN
          INSERT INTO public.orders (
              id, order_code, branch_id, partner_id, shipper_id, shift_id,
              order_type, status, parent_order_id,
              subtotal, discount_amount, discount_rate, shipping_fee, vat_amount,
              total_amount, paid_amount, debt_amount, note, created_by
          ) VALUES (
              uuid_generate_v7(),
              v_order_code,
              v_branch_id,
              v_partner_id,
              CASE WHEN p_order->>'shipper_id' IS NOT NULL THEN (p_order->>'shipper_id')::uuid ELSE NULL END,
              CASE WHEN p_order->>'shift_id' IS NOT NULL THEN (p_order->>'shift_id')::uuid ELSE NULL END,
              v_order_type,
              v_order_status,
              CASE WHEN p_order->>'parent_order_id' IS NOT NULL THEN (p_order->>'parent_order_id')::uuid ELSE NULL END,
              COALESCE((p_order->>'subtotal')::numeric, v_total_amount),
              COALESCE((p_order->>'discount_amount')::numeric, 0),
              COALESCE((p_order->>'discount_rate')::numeric, 0),
              COALESCE((p_order->>'shipping_fee')::numeric, 0),
              COALESCE((p_order->>'vat_amount')::numeric, 0),
              v_total_amount,
              v_paid_amount,
              v_debt_amount,
              p_order->>'note',
              COALESCE(p_order->>'created_by', 'Thu Ngân')
          ) RETURNING id INTO v_order_id;

          -- 5. XỬ LÝ ORDER ITEMS & TRỪ KHO
          FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
              product_id UUID,
              uom VARCHAR(50),
              conversion_rate NUMERIC,
              quantity NUMERIC,
              unit_price NUMERIC,
              discount NUMERIC,
              is_gift BOOLEAN,
              note TEXT
          ) LOOP
              v_base_qty := v_item.quantity * COALESCE(v_item.conversion_rate, 1);
              SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id;
              
              SELECT * INTO v_inv FROM public.inventory 
              WHERE branch_id = v_branch_id AND product_id = v_item.product_id FOR UPDATE;
              
              v_cost_price := COALESCE(v_inv.cost_price, v_prod.default_cost_price);

              INSERT INTO public.order_items (
                  order_id, product_id, uom, conversion_rate,
                  quantity, base_quantity, unit_price, discount,
                  cost_price, is_gift, note
              ) VALUES (
                  v_order_id, v_item.product_id, v_item.uom, v_item.conversion_rate,
                  v_item.quantity, v_base_qty, v_item.unit_price, COALESCE(v_item.discount, 0),
                  v_cost_price, COALESCE(v_item.is_gift, FALSE), v_item.note
              );

              IF v_order_type = 'SALE' THEN
                  IF v_prod.is_combo THEN
                      FOR v_combo_child IN SELECT 
                          c.product_id, 
                          COALESCE(c.qty, c.quantity, 1) as quantity
                      FROM jsonb_to_recordset(v_prod.combo_items) AS c(product_id UUID, quantity NUMERIC, qty NUMERIC) LOOP
                          DECLARE
                              v_child_qty NUMERIC := v_combo_child.quantity * v_item.quantity;
                              v_child_inv RECORD;
                          BEGIN
                              SELECT * INTO v_child_inv FROM public.inventory 
                              WHERE branch_id = v_branch_id AND product_id = v_combo_child.product_id FOR UPDATE;
                              
                              IF NOT FOUND OR (v_child_inv.on_hand - v_child_inv.reserved < v_child_qty) THEN
                                  IF NOT v_allow_negative THEN
                                      RAISE EXCEPTION 'HẾT HÀNG COMBO: Món thành phần % không đủ tồn kho!', v_combo_child.product_id;
                                  END IF;
                              END IF;

                              UPDATE public.inventory 
                              SET on_hand = on_hand - v_child_qty, updated_at = clock_timestamp()
                              WHERE id = v_child_inv.id;

                              INSERT INTO public.inventory_logs (
                                  branch_id, product_id, type, qty_change, balance_after,
                                  unit_cost, reference_id, note, created_by
                              ) VALUES (
                                  v_branch_id, v_combo_child.product_id, 'SALE_COMBO', - v_child_qty,
                                  v_child_inv.on_hand - v_child_qty, v_child_inv.cost_price,
                                  v_order_id, 'Xuất bán combo đơn: ' || v_order_code, COALESCE(p_order->>'created_by', 'Thu Ngân')
                              );
                          END;
                      END LOOP;
                  ELSE
                      IF NOT FOUND OR (v_inv.on_hand - v_inv.reserved < v_base_qty) THEN
                          IF NOT v_allow_negative THEN
                              RAISE EXCEPTION 'HẾT HÀNG TRONG KHO: Món % chỉ còn khả dụng %, yêu cầu xuất %',
                                  v_item.product_id, COALESCE(v_inv.on_hand - v_inv.reserved, 0), v_base_qty;
                          END IF;
                      END IF;

                      UPDATE public.inventory 
                      SET on_hand = on_hand - v_base_qty, updated_at = clock_timestamp()
                      WHERE id = v_inv.id;

                      INSERT INTO public.inventory_logs (
                          branch_id, product_id, type, qty_change, balance_after,
                          unit_cost, reference_id, note, created_by
                      ) VALUES (
                          v_branch_id, v_item.product_id, 'SALE', - v_base_qty,
                          v_inv.on_hand - v_base_qty, v_cost_price,
                          v_order_id, 'Bán hàng theo đơn: ' || v_order_code, COALESCE(p_order->>'created_by', 'Thu Ngân')
                      );
                  END IF;

              ELSIF v_order_type = 'PREORDER' THEN
                  IF NOT FOUND OR (v_inv.on_hand - v_inv.reserved < v_base_qty) THEN
                      IF NOT v_allow_negative THEN
                          RAISE EXCEPTION 'HẾT HÀNG ĐẶT CỌC: Món % không đủ khả dụng để giữ chỗ!', v_item.product_id;
                      END IF;
                  END IF;

                  UPDATE public.inventory 
                  SET reserved = reserved + v_base_qty, updated_at = clock_timestamp()
                  WHERE id = v_inv.id;

              ELSIF v_order_type = 'RETURN' THEN
                  UPDATE public.inventory 
                  SET on_hand = on_hand + v_base_qty, updated_at = clock_timestamp()
                  WHERE id = v_inv.id;

                  INSERT INTO public.inventory_logs (
                      branch_id, product_id, type, qty_change, balance_after,
                      unit_cost, reference_id, note, created_by
                  ) VALUES (
                      v_branch_id, v_item.product_id, 'RETURN', v_base_qty,
                      v_inv.on_hand + v_base_qty, v_cost_price,
                      v_order_id, 'Khách trả hàng theo đơn: ' || v_order_code, COALESCE(p_order->>'created_by', 'Thu Ngân')
                  );
              END IF;
          END LOOP;

          -- 6. DÒNG TIỀN (CASH FLOWS)
          IF jsonb_array_length(p_payments) > 0 THEN
              FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS p(
                  payment_method VARCHAR(50),
                  method VARCHAR(50),
                  payment_account VARCHAR(100),
                  account VARCHAR(100),
                  amount NUMERIC,
                  note TEXT
              ) LOOP
                  v_flow_type := CASE WHEN v_order_type = 'RETURN' THEN 'OUT' ELSE 'IN' END;
                  v_flow_category := CASE WHEN v_order_type = 'RETURN' THEN 'ORDER_REFUND' ELSE 'ORDER_PAYMENT' END;
                  v_flow_code := CASE WHEN v_flow_type = 'IN' THEN 'PT-' ELSE 'PC-' END || to_char(clock_timestamp(), 'YYMMDD-HH24MISS-') || floor(random()*1000)::text;

                  INSERT INTO public.cash_flows (
                      flow_code, branch_id, shift_id, partner_id, order_id,
                      type, category, payment_method, payment_account, amount, note, created_by
                  ) VALUES (
                      v_flow_code, v_branch_id,
                      CASE WHEN p_order->>'shift_id' IS NOT NULL THEN (p_order->>'shift_id')::uuid ELSE NULL END,
                      v_partner_id, v_order_id,
                      v_flow_type, v_flow_category,
                      COALESCE(v_payment.payment_method, v_payment.method, 'CASH'),
                      COALESCE(v_payment.payment_account, v_payment.account, 'KET_TIEN'),
                      v_payment.amount,
                      COALESCE(v_payment.note, (CASE WHEN v_flow_type = 'IN' THEN 'Thu tiền đơn: ' ELSE 'Thối tiền trả hàng đơn: ' END) || v_order_code),
                      COALESCE(p_order->>'created_by', 'Thu Ngân')
                  );
              END LOOP;
          ELSIF v_paid_amount > 0 THEN
              v_flow_code := 'PT-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS') || '-' || floor(random()*1000)::text;
              v_flow_type := CASE WHEN v_order_type = 'RETURN' THEN 'OUT' ELSE 'IN' END;
              v_flow_category := CASE WHEN v_order_type = 'RETURN' THEN 'ORDER_REFUND' ELSE 'ORDER_PAYMENT' END;

              INSERT INTO public.cash_flows (
                  flow_code, branch_id, shift_id, partner_id, order_id,
                  type, category, payment_method, payment_account, amount, note, created_by
              ) VALUES (
                  v_flow_code, v_branch_id,
                  CASE WHEN p_order->>'shift_id' IS NOT NULL THEN (p_order->>'shift_id')::uuid ELSE NULL END,
                  v_partner_id, v_order_id,
                  v_flow_type, v_flow_category,
                  'CASH', 'KET_TIEN', v_paid_amount,
                  'Thu tiền đơn: ' || v_order_code,
                  COALESCE(p_order->>'created_by', 'Thu Ngân')
              );
          END IF;

          RETURN jsonb_build_object(
              'success', TRUE,
              'order_id', v_order_id,
              'order_code', v_order_code,
              'total_amount', v_total_amount,
              'paid_amount', v_paid_amount,
              'debt_amount', v_debt_amount
          );
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Đã nâng cấp checkout_order kết nối trực tiếp với get_effective_branch_config (Bịt kín INTEG-01).');

    // =========================================================================
    // VÁ 5: BẢNG VÀ TRIGGER KIỂM TOÁN CẤU HÌNH TỰ ĐỘNG (VÁ AUDIT-01)
    // =========================================================================
    console.log('4. Đang tạo bảng config_audit_logs và Trigger tự động ghi vết...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.config_audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
          organization_id UUID NOT NULL REFERENCES public.organizations(id),
          branch_id UUID REFERENCES public.branches(id),
          feature_key VARCHAR(50) NOT NULL,
          action VARCHAR(30) NOT NULL, -- SET_DEFAULT, SET_OVERRIDE, RESET_OVERRIDE
          old_value JSONB,
          new_value JSONB,
          changed_by VARCHAR(100) NOT NULL DEFAULT 'Hệ thống',
          created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_lookup ON public.config_audit_logs(organization_id, feature_key, created_at DESC);

      -- Trigger tự động ghi vết khi sửa Organization Default
      CREATE OR REPLACE FUNCTION public.fn_audit_org_defaults()
      RETURNS TRIGGER AS $$
      BEGIN
          IF (TG_OP = 'UPDATE') THEN
              IF OLD.value IS DISTINCT FROM NEW.value THEN
                  INSERT INTO public.config_audit_logs (
                      organization_id, branch_id, feature_key, action, old_value, new_value, changed_by
                  ) VALUES (
                      NEW.organization_id, NULL, NEW.feature_key, 'SET_DEFAULT', OLD.value, NEW.value, 'Admin'
                  );
              END IF;
          ELSIF (TG_OP = 'INSERT') THEN
              INSERT INTO public.config_audit_logs (
                  organization_id, branch_id, feature_key, action, old_value, new_value, changed_by
              ) VALUES (
                  NEW.organization_id, NULL, NEW.feature_key, 'SET_DEFAULT', NULL, NEW.value, 'Admin'
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS tg_audit_org_defaults ON public.organization_feature_defaults;
      CREATE TRIGGER tg_audit_org_defaults
      AFTER INSERT OR UPDATE ON public.organization_feature_defaults
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_org_defaults();

      -- Trigger tự động ghi vết khi sửa Branch Override
      CREATE OR REPLACE FUNCTION public.fn_audit_branch_overrides()
      RETURNS TRIGGER AS $$
      DECLARE
          v_org_id UUID;
      BEGIN
          IF (TG_OP = 'DELETE') THEN
              SELECT organization_id INTO v_org_id FROM public.branches WHERE id = OLD.branch_id;
              INSERT INTO public.config_audit_logs (
                  organization_id, branch_id, feature_key, action, old_value, new_value, changed_by
              ) VALUES (
                  v_org_id, OLD.branch_id, OLD.feature_key, 'RESET_OVERRIDE', OLD.value, NULL, COALESCE(OLD.updated_by, 'Admin')
              );
              RETURN OLD;
          ELSIF (TG_OP = 'UPDATE') THEN
              SELECT organization_id INTO v_org_id FROM public.branches WHERE id = NEW.branch_id;
              IF OLD.value IS DISTINCT FROM NEW.value THEN
                  INSERT INTO public.config_audit_logs (
                      organization_id, branch_id, feature_key, action, old_value, new_value, changed_by
                  ) VALUES (
                      v_org_id, NEW.branch_id, NEW.feature_key, 'SET_OVERRIDE', OLD.value, NEW.value, COALESCE(NEW.updated_by, 'Admin')
                  );
              END IF;
          ELSIF (TG_OP = 'INSERT') THEN
              SELECT organization_id INTO v_org_id FROM public.branches WHERE id = NEW.branch_id;
              INSERT INTO public.config_audit_logs (
                  organization_id, branch_id, feature_key, action, old_value, new_value, changed_by
              ) VALUES (
                  v_org_id, NEW.branch_id, NEW.feature_key, 'SET_OVERRIDE', NULL, NEW.value, COALESCE(NEW.updated_by, 'Admin')
              );
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS tg_audit_branch_overrides ON public.branch_feature_overrides;
      CREATE TRIGGER tg_audit_branch_overrides
      AFTER INSERT OR UPDATE OR DELETE ON public.branch_feature_overrides
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_branch_overrides();
    `);
    console.log('   ✅ Đã cài đặt bảng config_audit_logs & Triggers tự động ghi vết (Bịt kín AUDIT-01).');

    console.log('\n=============================================================================');
    console.log('🎉 TOÀN BỘ 5 LỖ HỔNG ĐÃ ĐƯỢC VÁ VÀ BỊT KÍN 100%!');
    console.log('=============================================================================');

  } catch (error) {
    console.error('❌ Lỗi khi vá:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

patchAndSeal();
