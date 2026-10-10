const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.eigxzplbupjmnzqwzsur:Thuthuy64%40%40@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  await client.connect();
  console.log('🚀 Đang bắt đầu triển khai Bộ đôi Bảng & RPC Điều chuyển 2 pha (Two-Phase Transfer)...');

  // 1. Tạo Bảng stock_transfers
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.stock_transfers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        transfer_code VARCHAR(50) UNIQUE NOT NULL,
        from_branch_id UUID NOT NULL REFERENCES public.branches(id),
        to_branch_id UUID NOT NULL REFERENCES public.branches(id),
        shipper_id UUID REFERENCES public.partners(id),
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        dispatched_at TIMESTAMPTZ,
        received_at TIMESTAMPTZ,
        total_loss_amount NUMERIC(15,2) DEFAULT 0,
        loss_responsibility VARCHAR(30),
        note TEXT,
        created_by VARCHAR(100) NOT NULL,
        received_by VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
        CONSTRAINT chk_different_branches CHECK (from_branch_id != to_branch_id)
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_branches ON public.stock_transfers(from_branch_id, to_branch_id, status);
    CREATE INDEX IF NOT EXISTS idx_transfers_shipper ON public.stock_transfers(shipper_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_created ON public.stock_transfers(created_at DESC);
  `);
  console.log('  ✅ Bảng public.stock_transfers & Indexes đã sẵn sàng.');

  // 2. Tạo Bảng stock_transfer_items
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES public.products(id),
        uom VARCHAR(50) NOT NULL,
        conversion_rate NUMERIC(15,3) NOT NULL DEFAULT 1,
        
        send_quantity NUMERIC(15,3) NOT NULL,
        send_base_qty NUMERIC(15,3) NOT NULL,
        
        received_quantity NUMERIC(15,3) DEFAULT 0,
        received_base_qty NUMERIC(15,3) DEFAULT 0,
        
        loss_quantity NUMERIC(15,3) DEFAULT 0,
        loss_base_qty NUMERIC(15,3) DEFAULT 0,
        
        unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
        loss_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
    CREATE INDEX IF NOT EXISTS idx_transfer_items_product ON public.stock_transfer_items(product_id);
  `);
  console.log('  ✅ Bảng public.stock_transfer_items & Indexes đã sẵn sàng.');

  // 3. RPC Tạo phiếu chuyển DRAFT (create_stock_transfer)
  await client.query(`
    CREATE OR REPLACE FUNCTION public.create_stock_transfer(
        p_transfer JSONB,
        p_items JSONB
    )
    RETURNS JSONB AS $$
    DECLARE
        v_transfer_id UUID;
        v_transfer_code VARCHAR(50);
        v_item RECORD;
    BEGIN
        v_transfer_code := COALESCE(p_transfer->>'transfer_code', 'DC-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS'));
        
        INSERT INTO public.stock_transfers (
            id, transfer_code, from_branch_id, to_branch_id, shipper_id,
            status, note, created_by
        ) VALUES (
            uuid_generate_v7(),
            v_transfer_code,
            (p_transfer->>'from_branch_id')::uuid,
            (p_transfer->>'to_branch_id')::uuid,
            CASE WHEN p_transfer->>'shipper_id' IS NOT NULL THEN (p_transfer->>'shipper_id')::uuid ELSE NULL END,
            'DRAFT',
            p_transfer->>'note',
            COALESCE(p_transfer->>'created_by', 'Thủ Kho')
        ) RETURNING id INTO v_transfer_id;

        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
            product_id UUID,
            uom VARCHAR(50),
            conversion_rate NUMERIC,
            send_quantity NUMERIC
        ) LOOP
            INSERT INTO public.stock_transfer_items (
                transfer_id, product_id, uom, conversion_rate,
                send_quantity, send_base_qty, unit_cost
            ) VALUES (
                v_transfer_id,
                v_item.product_id,
                v_item.uom,
                COALESCE(v_item.conversion_rate, 1),
                v_item.send_quantity,
                v_item.send_quantity * COALESCE(v_item.conversion_rate, 1),
                0
            );
        END LOOP;

        RETURN jsonb_build_object(
            'success', TRUE,
            'transfer_id', v_transfer_id,
            'transfer_code', v_transfer_code,
            'status', 'DRAFT'
        );
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✅ RPC public.create_stock_transfer đã được cài đặt.');

  // 4. RPC Pha 1: dispatch_transfer
  await client.query(`
    CREATE OR REPLACE FUNCTION public.dispatch_transfer(
        p_transfer_id UUID,
        p_dispatched_by VARCHAR(100)
    )
    RETURNS JSONB AS $$
    DECLARE
        v_tr RECORD;
        v_item RECORD;
        v_inv RECORD;
    BEGIN
        SELECT * INTO v_tr FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Phiếu chuyển không tồn tại: %', p_transfer_id;
        END IF;

        IF v_tr.status != 'DRAFT' THEN
            RAISE EXCEPTION 'Phiếu chuyển không ở trạng thái DRAFT (Trạng thái hiện tại: %), không thể xuất kho!', v_tr.status;
        END IF;

        -- Duyệt qua từng sản phẩm để khóa dòng và trừ kho gửi
        FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id FOR UPDATE LOOP
            SELECT * INTO v_inv FROM public.inventory 
            WHERE branch_id = v_tr.from_branch_id AND product_id = v_item.product_id FOR UPDATE;
            
            IF NOT FOUND OR ((v_inv.on_hand - v_inv.reserved) < v_item.send_base_qty) THEN
                RAISE EXCEPTION 'Kho gửi không đủ tồn khả dụng cho sản phẩm: % (Khả dụng: %, Yêu cầu chuyển: %)', 
                    v_item.product_id, COALESCE(v_inv.on_hand - v_inv.reserved, 0), v_item.send_base_qty;
            END IF;

            -- 1. Trừ tồn kho gửi
            UPDATE public.inventory
            SET on_hand = on_hand - v_item.send_base_qty,
                updated_at = clock_timestamp()
            WHERE id = v_inv.id;

            -- 2. Đóng băng giá vốn vào phiếu chuyển
            UPDATE public.stock_transfer_items
            SET unit_cost = v_inv.cost_price
            WHERE id = v_item.id;

            -- 3. Ghi thẻ kho xuất chuyển đi
            INSERT INTO public.inventory_logs (
                branch_id, product_id, type, qty_change, balance_after,
                unit_cost, reference_id, note, created_by
            ) VALUES (
                v_tr.from_branch_id, v_item.product_id, 'TRANSFER_OUT', - v_item.send_base_qty,
                v_inv.on_hand - v_item.send_base_qty, v_inv.cost_price,
                v_tr.id, 'Xuất chuyển kho sang chi nhánh đích: ' || v_tr.to_branch_id, p_dispatched_by
            );
        END LOOP;

        -- Đổi trạng thái sang ĐANG_DI_DUONG
        UPDATE public.stock_transfers
        SET status = 'DANG_DI_DUONG',
            dispatched_at = clock_timestamp()
        WHERE id = p_transfer_id;

        RETURN jsonb_build_object(
            'success', TRUE, 
            'status', 'DANG_DI_DUONG',
            'transfer_id', p_transfer_id,
            'dispatched_at', clock_timestamp()
        );
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✅ RPC public.dispatch_transfer (Pha 1) đã được cài đặt.');

  // 5. RPC Pha 2: receive_transfer
  await client.query(`
    CREATE OR REPLACE FUNCTION public.receive_transfer(
        p_transfer_id UUID,
        p_received_items JSONB, -- mảng: [{ item_id, received_qty, loss_qty, loss_reason }]
        p_loss_responsibility VARCHAR(30), -- 'COMPANY_EXPENSE' hoặc 'SHIPPER_DEBT'
        p_received_by VARCHAR(100)
    )
    RETURNS JSONB AS $$
    DECLARE
        v_tr RECORD;
        v_rec RECORD;
        v_item RECORD;
        v_inv_dest RECORD;
        v_total_loss_val NUMERIC(15,2) := 0;
        v_loss_cost NUMERIC(15,2) := 0;
        v_new_balance NUMERIC(15,3) := 0;
        v_final_status VARCHAR(30);
    BEGIN
        SELECT * INTO v_tr FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Phiếu chuyển không tồn tại: %', p_transfer_id;
        END IF;

        IF v_tr.status != 'DANG_DI_DUONG' THEN
            RAISE EXCEPTION 'Phiếu chuyển không ở trạng thái DANG_DI_DUONG (Trạng thái hiện tại: %), không thể xác nhận nhận hàng!', v_tr.status;
        END IF;

        FOR v_rec IN SELECT * FROM jsonb_to_recordset(p_received_items) AS x(
            item_id UUID,
            received_qty NUMERIC,
            loss_qty NUMERIC,
            loss_reason TEXT
        ) LOOP
            SELECT * INTO v_item FROM public.stock_transfer_items WHERE id = v_rec.item_id FOR UPDATE;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Chi tiết phiếu chuyển không tồn tại: %', v_rec.item_id;
            END IF;

            -- Kiểm tra khớp số lượng (Nhận + Hỏng phải đúng bằng số Gửi)
            IF (COALESCE(v_rec.received_qty, 0) + COALESCE(v_rec.loss_qty, 0)) != v_item.send_quantity THEN
                RAISE EXCEPTION 'Số lượng kiểm đếm (Nhận: % + Hỏng: %) không khớp với số lượng gửi (%) của mặt hàng: %',
                    COALESCE(v_rec.received_qty, 0), COALESCE(v_rec.loss_qty, 0), v_item.send_quantity, v_item.product_id;
            END IF;

            -- 1. Cập nhật số liệu thực tế trên dòng phiếu chuyển
            UPDATE public.stock_transfer_items
            SET received_quantity = v_rec.received_qty,
                received_base_qty = v_rec.received_qty * v_item.conversion_rate,
                loss_quantity = v_rec.loss_qty,
                loss_base_qty = v_rec.loss_qty * v_item.conversion_rate,
                loss_reason = v_rec.loss_reason
            WHERE id = v_item.id;

            -- Tìm hoặc tạo bản ghi inventory tại kho nhận
            SELECT * INTO v_inv_dest FROM public.inventory
            WHERE branch_id = v_tr.to_branch_id AND product_id = v_item.product_id FOR UPDATE;

            -- 2. Cộng tồn kho tại chi nhánh đích (chỉ cộng hàng nguyên vẹn)
            IF v_rec.received_qty > 0 THEN
                IF NOT FOUND THEN
                    INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
                    VALUES (v_tr.to_branch_id, v_item.product_id, v_rec.received_qty * v_item.conversion_rate, v_item.unit_cost)
                    RETURNING * INTO v_inv_dest;
                    v_new_balance := v_rec.received_qty * v_item.conversion_rate;
                ELSE
                    v_new_balance := v_inv_dest.on_hand + (v_rec.received_qty * v_item.conversion_rate);
                    UPDATE public.inventory
                    SET on_hand = v_new_balance,
                        updated_at = clock_timestamp()
                    WHERE id = v_inv_dest.id;
                END IF;

                -- Ghi thẻ kho nhập chuyển đến
                INSERT INTO public.inventory_logs (
                    branch_id, product_id, type, qty_change, balance_after,
                    unit_cost, reference_id, note, created_by
                ) VALUES (
                    v_tr.to_branch_id, v_item.product_id, 'TRANSFER_IN', v_rec.received_qty * v_item.conversion_rate,
                    v_new_balance, v_item.unit_cost,
                    v_tr.id, 'Nhận chuyển kho từ: ' || v_tr.from_branch_id, p_received_by
                );
            ELSE
                v_new_balance := COALESCE(v_inv_dest.on_hand, 0);
            END IF;

            -- 3. Xử lý ghi nhận biên bản hao hụt nếu có
            IF v_rec.loss_qty > 0 THEN
                v_loss_cost := (v_rec.loss_qty * v_item.conversion_rate) * v_item.unit_cost;
                v_total_loss_val := v_total_loss_val + v_loss_cost;

                -- Thẻ kho hao hụt tại điểm đến (ghi nhận biên bản kiểm đếm)
                INSERT INTO public.inventory_logs (
                    branch_id, product_id, type, qty_change, balance_after,
                    unit_cost, reference_id, note, created_by
                ) VALUES (
                    v_tr.to_branch_id, v_item.product_id, 'TRANSFER_LOSS', 0,
                    v_new_balance, v_item.unit_cost,
                    v_tr.id, 'Biên bản bể vỡ/hư hao: ' || COALESCE(v_rec.loss_reason, 'Hư hao trên đường') || 
                             ' (Hỏng: ' || v_rec.loss_qty || ' ' || v_item.uom || ', Trị giá vốn: ' || v_loss_cost || 'đ)', 
                    p_received_by
                );
            END IF;
        END LOOP;

        -- 4. Nếu quy trách nhiệm cho Tài xế: Ghi nợ vào hồ sơ Shipper
        IF v_total_loss_val > 0 AND p_loss_responsibility = 'SHIPPER_DEBT' AND v_tr.shipper_id IS NOT NULL THEN
            UPDATE public.partners
            SET current_debt = current_debt + v_total_loss_val,
                updated_at = clock_timestamp()
            WHERE id = v_tr.shipper_id;
        END IF;

        -- 5. Xác định trạng thái cuối
        IF v_total_loss_val > 0 THEN
            v_final_status := 'COMPLETED_WITH_LOSS';
        ELSE
            v_final_status := 'COMPLETED';
        END IF;

        -- Hoàn tất phiếu chuyển
        UPDATE public.stock_transfers
        SET status = v_final_status,
            received_at = clock_timestamp(),
            received_by = p_received_by,
            total_loss_amount = v_total_loss_val,
            loss_responsibility = p_loss_responsibility
        WHERE id = p_transfer_id;

        RETURN jsonb_build_object(
            'success', TRUE,
            'status', v_final_status,
            'transfer_id', p_transfer_id,
            'total_loss_amount', v_total_loss_val,
            'loss_responsibility', p_loss_responsibility
        );
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✅ RPC public.receive_transfer (Pha 2) đã được cài đặt.');

  await client.end();
  console.log('\n🎉 TRIỂN KHAI HOÀN TẤT 100%!');
}

migrate().catch(err => {
  console.error('❌ Lỗi di chuyển:', err);
  process.exit(1);
});
