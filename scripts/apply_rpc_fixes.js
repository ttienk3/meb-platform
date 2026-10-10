const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyFixes() {
  await client.connect();
  console.log('--- 1. CẬP NHẬT RPC checkout_order (VÁ 2 HẠT SẠN LOGIC) ---');

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
    v_paid_amount := COALESCE((p_order->>'paid_amount')::numeric, 0);
    v_debt_amount := v_total_amount - v_paid_amount;
    v_order_status := COALESCE(p_order->>'status', 'COMPLETED');
    v_order_type := COALESCE(p_order->>'order_type', 'SALE');
    
    -- [VÁ HẠT SẠN 1]: BẮT BUỘC CHỌN KHÁCH HÀNG KHI PHÁT SINH NỢ
    IF v_debt_amount > 0 AND v_partner_id IS NULL THEN
        RAISE EXCEPTION 'BÁN NỢ BẤT KHẢ THI: Bắt buộc phải chọn hồ sơ Khách hàng khi phát sinh công nợ!';
    END IF;

    -- Kiểm tra cấu hình bán âm của chi nhánh
    SELECT (toggles->>'allow_negative_stock')::boolean INTO v_allow_negative
    FROM public.branches
    WHERE id = v_branch_id;
    
    -- Kiểm tra hạn mức công nợ nếu có nợ
    IF v_debt_amount > 0 AND v_partner_id IS NOT NULL THEN
        DECLARE
            v_limit NUMERIC(15,2);
            v_curr_debt NUMERIC(15,2);
        BEGIN
            SELECT debt_limit, current_debt INTO v_limit, v_curr_debt
            FROM public.partners
            WHERE id = v_partner_id;
            
            IF v_limit > 0 AND (v_curr_debt + v_debt_amount) > v_limit THEN
                RAISE EXCEPTION 'VƯỢT HẠN MỨC TÍN DỤNG: Khách nợ hiện tại: %, Đơn nợ: %, Hạn mức tối đa: %',
                    v_curr_debt, v_debt_amount, v_limit;
            END IF;
        END;
    END IF;

    -- 2. Tạo Đơn hàng chính
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

    -- 3. Duyệt qua từng sản phẩm và thực thi TRỪ/CỘNG KHO NGUYÊN TỬ
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        uom VARCHAR,
        conversion_rate NUMERIC,
        quantity NUMERIC,
        unit_price NUMERIC,
        discount NUMERIC,
        is_gift BOOLEAN,
        note TEXT
    ) LOOP
        v_base_qty := v_item.quantity * COALESCE(v_item.conversion_rate, 1);
        SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id;
        
        -- A. XỬ LÝ HÀNG COMBO
        IF v_prod.is_combo AND jsonb_array_length(v_prod.combo_items) > 0 THEN
            v_cost_price := 0;
            FOR v_combo_child IN SELECT * FROM jsonb_to_recordset(v_prod.combo_items) AS c(product_id UUID, qty NUMERIC) LOOP
                DECLARE
                    v_child_inv RECORD;
                    v_child_needed NUMERIC := v_combo_child.qty * v_item.quantity;
                BEGIN
                    SELECT * INTO v_child_inv FROM public.inventory
                    WHERE branch_id = v_branch_id AND product_id = v_combo_child.product_id FOR UPDATE;
                    
                    IF NOT FOUND THEN
                        INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
                        VALUES (v_branch_id, v_combo_child.product_id, 0, 0)
                        RETURNING * INTO v_child_inv;
                    END IF;
                    
                    -- [VÁ HẠT SẠN 2]: Kiểm tra tồn kho chỉ khi BÁN HÀNG (SALE)
                    IF v_order_type = 'SALE' AND NOT v_allow_negative AND (v_child_inv.on_hand - v_child_inv.reserved < v_child_needed) THEN
                        RAISE EXCEPTION 'HẾT HÀNG COMBO: Món thành phần % không đủ tồn kho để đóng gói!', v_combo_child.product_id;
                    END IF;
                    
                    v_cost_price := v_cost_price + (v_child_inv.cost_price * v_combo_child.qty);
                    
                    -- [VÁ HẠT SẠN 2]: Đảo chiều cộng/trừ theo order_type
                    IF v_order_status = 'COMPLETED' THEN
                        IF v_order_type = 'RETURN' THEN
                            -- Khách trả hàng combo: HOÀN LẠI TỒN KHO (+)
                            UPDATE public.inventory
                            SET on_hand = on_hand + v_child_needed, updated_at = clock_timestamp()
                            WHERE id = v_child_inv.id;
                            
                            INSERT INTO public.inventory_logs (
                                branch_id, product_id, type, qty_change, balance_after,
                                unit_cost, reference_id, note, created_by
                            ) VALUES (
                                v_branch_id, v_combo_child.product_id, 'RETURN', v_child_needed,
                                v_child_inv.on_hand + v_child_needed, v_child_inv.cost_price,
                                v_order_id, 'Nhập trả lại combo: ' || v_prod.name || ' (Đơn: ' || v_order_code || ')',
                                COALESCE(p_order->>'created_by', 'Thu Ngân')
                            );
                        ELSE
                            -- Bán combo: TRỪ TỒN KHO (-)
                            UPDATE public.inventory
                            SET on_hand = on_hand - v_child_needed, updated_at = clock_timestamp()
                            WHERE id = v_child_inv.id;
                            
                            INSERT INTO public.inventory_logs (
                                branch_id, product_id, type, qty_change, balance_after,
                                unit_cost, reference_id, note, created_by
                            ) VALUES (
                                v_branch_id, v_combo_child.product_id, 'OUT', - v_child_needed,
                                v_child_inv.on_hand - v_child_needed, v_child_inv.cost_price,
                                v_order_id, 'Xuất theo combo: ' || v_prod.name || ' (Đơn: ' || v_order_code || ')',
                                COALESCE(p_order->>'created_by', 'Thu Ngân')
                            );
                        END IF;
                    ELSIF v_order_status = 'DRAFT' THEN -- PREORDER
                        UPDATE public.inventory
                        SET reserved = reserved + v_child_needed, updated_at = clock_timestamp()
                        WHERE id = v_child_inv.id;
                    END IF;
                END;
            END LOOP;
        ELSE
            -- B. MẶT HÀNG THÔNG THƯỜNG
            SELECT * INTO v_inv FROM public.inventory
            WHERE branch_id = v_branch_id AND product_id = v_item.product_id FOR UPDATE;
            
            IF NOT FOUND THEN
                INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
                VALUES (v_branch_id, v_item.product_id, 0, 0)
                RETURNING * INTO v_inv;
            END IF;
            
            -- [VÁ HẠT SẠN 2]: Kiểm tra tồn kho chỉ khi BÁN HÀNG (SALE)
            IF v_order_type = 'SALE' AND NOT v_allow_negative AND (v_inv.on_hand - v_inv.reserved < v_base_qty) THEN
                RAISE EXCEPTION 'HẾT HÀNG TRONG KHO: Món % chỉ còn khả dụng %, yêu cầu xuất %',
                    v_item.product_id, (v_inv.on_hand - v_inv.reserved), v_base_qty;
            END IF;
            
            v_cost_price := v_inv.cost_price;
            
            -- [VÁ HẠT SẠN 2]: Đảo chiều cộng/trừ theo order_type
            IF v_order_status = 'COMPLETED' THEN
                IF v_order_type = 'RETURN' THEN
                    -- Khách trả hàng: TỒN KHO TĂNG LÊN (+)
                    UPDATE public.inventory
                    SET on_hand = on_hand + v_base_qty, updated_at = clock_timestamp()
                    WHERE id = v_inv.id;
                    
                    INSERT INTO public.inventory_logs (
                        branch_id, product_id, type, qty_change, balance_after,
                        unit_cost, reference_id, note, created_by
                    ) VALUES (
                        v_branch_id, v_item.product_id, 'RETURN', v_base_qty,
                        v_inv.on_hand + v_base_qty, v_cost_price,
                        v_order_id, 'Khách trả hàng (Đơn: ' || v_order_code || ')',
                        COALESCE(p_order->>'created_by', 'Thu Ngân')
                    );
                ELSE
                    -- Xuất bán: TỒN KHO GIẢM ĐI (-)
                    UPDATE public.inventory
                    SET on_hand = on_hand - v_base_qty, updated_at = clock_timestamp()
                    WHERE id = v_inv.id;
                    
                    INSERT INTO public.inventory_logs (
                        branch_id, product_id, type, qty_change, balance_after,
                        unit_cost, reference_id, note, created_by
                    ) VALUES (
                        v_branch_id, v_item.product_id, 'OUT', - v_base_qty,
                        v_inv.on_hand - v_base_qty, v_cost_price,
                        v_order_id, 'Xuất bán đơn: ' || v_order_code,
                        COALESCE(p_order->>'created_by', 'Thu Ngân')
                    );
                END IF;
            ELSIF v_order_status = 'DRAFT' THEN -- PREORDER ĐẶT CỌC: TĂNG TỒN GIỮ CHỖ
                UPDATE public.inventory
                SET reserved = reserved + v_base_qty, updated_at = clock_timestamp()
                WHERE id = v_inv.id;
            END IF;
        END IF;

        -- Lưu chi tiết đơn (ĐÓNG BĂNG GIÁ VỐN)
        INSERT INTO public.order_items (
            order_id, product_id, uom, conversion_rate,
            quantity, base_quantity, unit_price, discount,
            cost_price, is_gift, note
        ) VALUES (
            v_order_id, v_item.product_id, v_item.uom, COALESCE(v_item.conversion_rate, 1),
            v_item.quantity, v_base_qty, v_item.unit_price, COALESCE(v_item.discount, 0),
            v_cost_price, COALESCE(v_item.is_gift, FALSE), v_item.note
        );
    END LOOP;

    -- 4. Xử lý ghi nhận DÒNG TIỀN (Split Payments)
    -- Nếu là RETURN: Chi tiền thối lại (OUT / ORDER_REFUND)
    -- Nếu là SALE: Thu tiền khách trả (IN / ORDER_PAYMENT)
    IF v_paid_amount > 0 THEN
        IF v_order_type = 'RETURN' THEN
            v_flow_type := 'OUT';
            v_flow_category := 'ORDER_REFUND';
        ELSE
            v_flow_type := 'IN';
            v_flow_category := 'ORDER_PAYMENT';
        END IF;
        
        IF jsonb_array_length(p_payments) > 0 THEN
            FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS p(
                payment_method VARCHAR,
                payment_account VARCHAR,
                amount NUMERIC,
                note TEXT
            ) LOOP
                v_flow_code := CASE WHEN v_flow_type = 'IN' THEN 'PT-' ELSE 'PC-' END || to_char(clock_timestamp(), 'YYMMDD-HH24MISS-') || floor(random()*1000)::text;
                INSERT INTO public.cash_flows (
                    flow_code, branch_id, shift_id, partner_id, order_id,
                    type, category, payment_method, payment_account,
                    amount, note, created_by
                ) VALUES (
                    v_flow_code, v_branch_id,
                    CASE WHEN p_order->>'shift_id' IS NOT NULL THEN (p_order->>'shift_id')::uuid ELSE NULL END,
                    v_partner_id, v_order_id,
                    v_flow_type, v_flow_category,
                    COALESCE(v_payment.payment_method, 'CASH'),
                    COALESCE(v_payment.payment_account, 'KET_TIEN'),
                    v_payment.amount,
                    COALESCE(v_payment.note, (CASE WHEN v_flow_type = 'IN' THEN 'Thu tiền đơn: ' ELSE 'Thối tiền trả hàng đơn: ' END) || v_order_code),
                    COALESCE(p_order->>'created_by', 'Thu Ngân')
                );
            END LOOP;
        ELSE
            v_flow_code := CASE WHEN v_flow_type = 'IN' THEN 'PT-' ELSE 'PC-' END || to_char(clock_timestamp(), 'YYMMDD-HH24MISS');
            INSERT INTO public.cash_flows (
                flow_code, branch_id, shift_id, partner_id, order_id,
                type, category, payment_method, payment_account,
                amount, note, created_by
            ) VALUES (
                v_flow_code, v_branch_id,
                CASE WHEN p_order->>'shift_id' IS NOT NULL THEN (p_order->>'shift_id')::uuid ELSE NULL END,
                v_partner_id, v_order_id,
                v_flow_type, v_flow_category, 'CASH', 'KET_TIEN',
                v_paid_amount, (CASE WHEN v_flow_type = 'IN' THEN 'Thu tiền mặt đơn: ' ELSE 'Chi tiền mặt trả hàng đơn: ' END) || v_order_code,
                COALESCE(p_order->>'created_by', 'Thu Ngân')
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', v_order_id,
        'order_code', v_order_code,
        'order_type', v_order_type,
        'total_amount', v_total_amount,
        'paid_amount', v_paid_amount,
        'debt_amount', v_debt_amount
    );
END;
$$ LANGUAGE plpgsql;
  `);
  console.log('✅ Đã sửa xong 2 hạt sạn logic trong checkout_order!');

  console.log('--- 2. TẠO MẮT XÍCH 3: RPC fulfill_preorder (GIAO HÀNG ĐƠN CỌC) ---');
  await client.query(`
CREATE OR REPLACE FUNCTION public.fulfill_preorder(
    p_order_id UUID,
    p_payments JSONB DEFAULT '[]'::jsonb,
    p_created_by VARCHAR DEFAULT 'Thu Ngân'
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_inv RECORD;
    v_payment RECORD;
    v_add_paid NUMERIC(15,2) := 0;
    v_flow_code VARCHAR(50);
BEGIN
    -- 1. Tìm đơn cọc và khóa dòng
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ĐƠN HÀNG KHÔNG TỒN TẠI: %', p_order_id;
    END IF;
    
    IF v_order.status != 'DRAFT' THEN
        RAISE EXCEPTION 'TRẠNG THÁI KHÔNG HỢP LỆ: Đơn hàng % đang ở trạng thái %, không thể giao cọc!',
            v_order.order_code, v_order.status;
    END IF;

    -- 2. Duyệt qua từng item: Trừ reserved và trừ on_hand thực tế
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
        SELECT * INTO v_inv FROM public.inventory 
        WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id FOR UPDATE;
        
        -- Trừ hàng thực xuất và giải phóng hàng giữ chỗ
        UPDATE public.inventory
        SET on_hand = on_hand - v_item.base_quantity,
            reserved = reserved - v_item.base_quantity,
            updated_at = clock_timestamp()
        WHERE id = v_inv.id;
        
        -- Ghi thẻ kho OUT chính thức
        INSERT INTO public.inventory_logs (
            branch_id, product_id, type, qty_change, balance_after,
            unit_cost, reference_id, note, created_by
        ) VALUES (
            v_order.branch_id, v_item.product_id, 'OUT', - v_item.base_quantity,
            v_inv.on_hand - v_item.base_quantity, v_item.cost_price,
            v_order.id, 'Giao hàng đơn đặt cọc: ' || v_order.order_code,
            p_created_by
        );
    END LOOP;

    -- 3. Xử lý thanh toán số tiền còn thiếu (nếu có nạp p_payments)
    IF jsonb_array_length(p_payments) > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS p(
            payment_method VARCHAR,
            payment_account VARCHAR,
            amount NUMERIC,
            note TEXT
        ) LOOP
            v_add_paid := v_add_paid + v_payment.amount;
            v_flow_code := 'PT-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS-') || floor(random()*1000)::text;
            
            INSERT INTO public.cash_flows (
                flow_code, branch_id, shift_id, partner_id, order_id,
                type, category, payment_method, payment_account,
                amount, note, created_by
            ) VALUES (
                v_flow_code, v_order.branch_id, v_order.shift_id,
                v_order.partner_id, v_order.id,
                'IN', 'ORDER_PAYMENT',
                COALESCE(v_payment.payment_method, 'CASH'),
                COALESCE(v_payment.payment_account, 'KET_TIEN'),
                v_payment.amount,
                COALESCE(v_payment.note, 'Thanh toán đợt cuối đơn cọc: ' || v_order.order_code),
                p_created_by
            );
        END LOOP;
    END IF;

    -- 4. Cập nhật trạng thái đơn thành COMPLETED và số tiền nợ còn lại (nếu có)
    UPDATE public.orders
    SET status = 'COMPLETED',
        paid_amount = paid_amount + v_add_paid,
        debt_amount = total_amount - (paid_amount + v_add_paid),
        updated_at = clock_timestamp()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'order_code', v_order.order_code,
        'status', 'COMPLETED',
        'additional_paid', v_add_paid,
        'total_paid', v_order.paid_amount + v_add_paid,
        'remaining_debt', v_order.total_amount - (v_order.paid_amount + v_add_paid)
    );
END;
$$ LANGUAGE plpgsql;
  `);
  console.log('✅ Đã tạo thành công RPC fulfill_preorder!');

  await client.end();
}

applyFixes().catch(console.error);
