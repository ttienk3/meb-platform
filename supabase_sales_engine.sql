-- ==============================================================================
-- MEB SALES ENGINE - 8 TABLES REVOLUTION (SUPABASE / POSTGRESQL 17)
-- ==============================================================================
-- Architecture:
-- 1. branches (Feature Toggles, Manager PIN, Period Lock, Bank Accounts)
-- 2. products (UoM Conversions, Multi-Barcodes, Decimal, Combos, Gifts)
-- 3. inventory (Branch Stock, Cost Price, Branch Selling Prices)
-- 4. inventory_logs (Audit Ledger: In/Out/Transfer/Adjust/Landed Cost)
-- 5. partners (2-Way Debt: Customers, Suppliers, Shippers, Price Groups)
-- 6. shifts (Cash Drawer Shifts, Opening/Closing Discrepancy)
-- 7. orders & order_items (Sales, Returns, Preorders, Cost Freeze, Parent Ref)
-- 8. cash_flows (Multi-Account, Shifts, Split Payments, COD Reconciliation)
-- ==============================================================================

-- 0. NATIVE HIGH-PERFORMANCE UUIDv7 GENERATOR
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
DECLARE
  v_time timestamp with time zone := clock_timestamp();
  v_epoch_ms bigint := (extract(epoch from v_time) * 1000)::bigint;
  v_bytes bytea := gen_random_bytes(16);
BEGIN
  v_bytes := set_byte(v_bytes, 0, ((v_epoch_ms >> 40) & 255)::int);
  v_bytes := set_byte(v_bytes, 1, ((v_epoch_ms >> 32) & 255)::int);
  v_bytes := set_byte(v_bytes, 2, ((v_epoch_ms >> 24) & 255)::int);
  v_bytes := set_byte(v_bytes, 3, ((v_epoch_ms >> 16) & 255)::int);
  v_bytes := set_byte(v_bytes, 4, ((v_epoch_ms >> 8) & 255)::int);
  v_bytes := set_byte(v_bytes, 5, (v_epoch_ms & 255)::int);
  v_bytes := set_byte(v_bytes, 6, (get_byte(v_bytes, 6) & 15) | 112);
  v_bytes := set_byte(v_bytes, 8, (get_byte(v_bytes, 8) & 63) | 128);
  RETURN encode(v_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ==============================================================================
-- 1. BẢNG CHI NHÁNH (branches)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    toggles JSONB NOT NULL DEFAULT '{
        "has_uom": true,
        "has_debt": true,
        "has_barcode": true,
        "allow_negative_stock": false,
        "has_shifts": true,
        "has_e_invoice": false
    }'::jsonb,
    bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    manager_pin VARCHAR(20) NOT NULL DEFAULT '1234',
    locked_until_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ==============================================================================
-- 2. BẢNG HÀNG HÓA & DỊCH VỤ (products)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Chung',
    base_uom VARCHAR(50) NOT NULL DEFAULT 'Cái',
    allow_decimal BOOLEAN NOT NULL DEFAULT FALSE,
    barcodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_combo BOOLEAN NOT NULL DEFAULT FALSE,
    combo_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    has_serial BOOLEAN NOT NULL DEFAULT FALSE,
    has_expiry BOOLEAN NOT NULL DEFAULT FALSE,
    vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    default_cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    default_selling_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ==============================================================================
-- 3. BẢNG TỒN KHO THEO CHI NHÁNH (inventory)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    on_hand NUMERIC(15,3) NOT NULL DEFAULT 0,
    reserved NUMERIC(15,3) NOT NULL DEFAULT 0,
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    branch_selling_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
    min_stock NUMERIC(15,3) NOT NULL DEFAULT 0,
    max_stock NUMERIC(15,3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_branch_product UNIQUE (branch_id, product_id)
);

-- ==============================================================================
-- 4. BẢNG THẺ KHO ĐA NĂNG (inventory_logs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    qty_change NUMERIC(15,3) NOT NULL,
    balance_after NUMERIC(15,3) NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    landed_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    reference_id UUID,
    note TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ==============================================================================
-- 5. BẢNG ĐỐI TÁC 2 CHIỀU (partners)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    tax_code VARCHAR(50),
    is_customer BOOLEAN NOT NULL DEFAULT TRUE,
    is_supplier BOOLEAN NOT NULL DEFAULT FALSE,
    is_shipper BOOLEAN NOT NULL DEFAULT FALSE,
    price_group VARCHAR(50) NOT NULL DEFAULT 'RETAIL',
    debt_limit NUMERIC(15,2) NOT NULL DEFAULT 0,
    current_debt NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ==============================================================================
-- 6. BẢNG CA BÁN HÀNG (shifts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    staff_name VARCHAR(100) NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    closed_at TIMESTAMPTZ,
    initial_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    system_amount NUMERIC(15,2) DEFAULT 0,
    actual_amount NUMERIC(15,2),
    discrepancy NUMERIC(15,2),
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
);

-- ==============================================================================
-- 7. BẢNG ĐƠN HÀNG & CHI TIẾT (orders & order_items)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    order_code VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES public.partners(id),
    shipper_id UUID REFERENCES public.partners(id),
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'SALE',
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    parent_order_id UUID REFERENCES public.orders(id),
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    shipping_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    debt_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    note TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    uom VARCHAR(50) NOT NULL,
    conversion_rate NUMERIC(10,3) NOT NULL DEFAULT 1,
    quantity NUMERIC(15,3) NOT NULL,
    base_quantity NUMERIC(15,3) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount NUMERIC(15,2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(15,2) NOT NULL,
    is_gift BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT
);

-- ==============================================================================
-- 8. BẢNG SỔ QUỸ DÒNG TIỀN (cash_flows)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cash_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    flow_code VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.partners(id),
    order_id UUID REFERENCES public.orders(id),
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
    payment_account VARCHAR(100) NOT NULL DEFAULT 'KET_TIEN',
    amount NUMERIC(15,2) NOT NULL,
    note TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ==============================================================================
-- INDEXES FOR B-TREE OPTIMIZATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON public.inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_ref ON public.inventory_logs(branch_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_branch_created ON public.orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON public.orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_branch ON public.cash_flows(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flows_shift ON public.cash_flows(shift_id);
CREATE INDEX IF NOT EXISTS idx_partners_phone ON public.partners(phone);
CREATE INDEX IF NOT EXISTS idx_shifts_branch ON public.shifts(branch_id, status);

-- ==============================================================================
-- TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_locked_period()
RETURNS TRIGGER AS $$
DECLARE
    v_locked_date DATE;
    v_target_branch_id UUID;
BEGIN
    v_target_branch_id := OLD.branch_id;
    
    SELECT locked_until_date INTO v_locked_date
    FROM public.branches
    WHERE id = v_target_branch_id;
    
    IF v_locked_date IS NOT NULL AND OLD.created_at::date <= v_locked_date THEN
        RAISE EXCEPTION 'KHÓA SỔ KẾ TOÁN: Dữ liệu ngày % đã bị khóa (Khóa sổ đến hết ngày %). Không thể sửa hoặc xóa!',
            OLD.created_at::date, v_locked_date;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_lock_orders ON public.orders;
CREATE TRIGGER tg_lock_orders
BEFORE UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_check_locked_period();

DROP TRIGGER IF EXISTS tg_lock_cash_flows ON public.cash_flows;
CREATE TRIGGER tg_lock_cash_flows
BEFORE UPDATE OR DELETE ON public.cash_flows
FOR EACH ROW EXECUTE FUNCTION public.fn_check_locked_period();

DROP TRIGGER IF EXISTS tg_lock_inventory_logs ON public.inventory_logs;
CREATE TRIGGER tg_lock_inventory_logs
BEFORE UPDATE OR DELETE ON public.inventory_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_check_locked_period();

-- Trigger cập nhật công nợ đơn hàng
CREATE OR REPLACE FUNCTION public.fn_sync_partner_debt_from_order()
RETURNS TRIGGER AS $$
DECLARE
    v_delta NUMERIC(15,2) := 0;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.partner_id IS NOT NULL AND NEW.debt_amount > 0 AND NEW.status != 'CANCELLED' THEN
            IF NEW.order_type = 'RETURN' THEN
                v_delta := - NEW.debt_amount;
            ELSE
                v_delta := NEW.debt_amount;
            END IF;
            
            UPDATE public.partners
            SET current_debt = current_debt + v_delta,
                updated_at = clock_timestamp()
            WHERE id = NEW.partner_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.partner_id IS NOT NULL THEN
            DECLARE
                v_old_debt NUMERIC(15,2) := CASE WHEN OLD.status = 'CANCELLED' THEN 0 ELSE OLD.debt_amount END;
                v_new_debt NUMERIC(15,2) := CASE WHEN NEW.status = 'CANCELLED' THEN 0 ELSE NEW.debt_amount END;
            BEGIN
                IF OLD.order_type = 'RETURN' THEN
                    v_old_debt := - v_old_debt;
                    v_new_debt := - v_new_debt;
                END IF;
                
                v_delta := v_new_debt - v_old_debt;
                IF v_delta != 0 THEN
                    UPDATE public.partners
                    SET current_debt = current_debt + v_delta,
                        updated_at = clock_timestamp()
                    WHERE id = NEW.partner_id;
                END IF;
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_sync_order_debt ON public.orders;
CREATE TRIGGER tg_sync_order_debt
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_partner_debt_from_order();

-- Trigger cập nhật công nợ sổ quỹ
CREATE OR REPLACE FUNCTION public.fn_sync_partner_debt_from_cashflow()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.partner_id IS NOT NULL THEN
        IF NEW.category = 'DEBT_COLLECTION' AND NEW.type = 'IN' THEN
            UPDATE public.partners
            SET current_debt = current_debt - NEW.amount,
                updated_at = clock_timestamp()
            WHERE id = NEW.partner_id;
        ELSIF NEW.category = 'DEBT_PAYMENT_SUPPLIER' AND NEW.type = 'OUT' THEN
            UPDATE public.partners
            SET current_debt = current_debt + NEW.amount,
                updated_at = clock_timestamp()
            WHERE id = NEW.partner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_sync_cashflow_debt ON public.cash_flows;
CREATE TRIGGER tg_sync_cashflow_debt
AFTER INSERT ON public.cash_flows
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_partner_debt_from_cashflow();

-- ==============================================================================
-- RPC 1: GET POS PRODUCTS WITH REAL-TIME STOCK (get_pos_products)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_pos_products(p_branch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'code', p.code,
            'name', p.name,
            'category', p.category,
            'base_uom', p.base_uom,
            'allow_decimal', p.allow_decimal,
            'is_combo', p.is_combo,
            'combo_items', p.combo_items,
            'barcodes', p.barcodes,
            'vat_rate', p.vat_rate,
            'image_url', p.image_url,
            'on_hand', COALESCE(i.on_hand, 0),
            'reserved', COALESCE(i.reserved, 0),
            'available', COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0),
            'cost_price', COALESCE(i.cost_price, p.default_cost_price),
            'branch_selling_prices', COALESCE(i.branch_selling_prices, '{}'::jsonb)
        ) ORDER BY p.name ASC
    ) INTO v_result
    FROM public.products p
    LEFT JOIN public.inventory i ON i.product_id = p.id AND i.branch_id = p_branch_id
    WHERE p.is_active = TRUE;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- RPC 2: ATOMIC ORDER CHECKOUT (checkout_order)
-- ==============================================================================
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
    v_branch_id := (p_order->>'branch_id')::uuid;
    v_partner_id := CASE WHEN p_order->>'partner_id' IS NOT NULL THEN (p_order->>'partner_id')::uuid ELSE NULL END;
    v_order_code := COALESCE(p_order->>'order_code', 'HD-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS'));
    v_total_amount := (p_order->>'total_amount')::numeric;
    v_paid_amount := COALESCE((p_order->>'paid_amount')::numeric, 0);
    v_debt_amount := v_total_amount - v_paid_amount;
    v_order_status := COALESCE(p_order->>'status', 'COMPLETED');
    v_order_type := COALESCE(p_order->>'order_type', 'SALE');
    
    -- Đọc cấu hình thừa kế thời gian thực qua get_effective_branch_config (INTEG-01)
    SELECT COALESCE(effective_value::boolean, FALSE) INTO v_allow_negative
    FROM public.get_effective_branch_config(v_branch_id)
    WHERE feature_key = 'allow_negative_stock';

    SELECT COALESCE(effective_value::boolean, FALSE) INTO v_allow_debt
    FROM public.get_effective_branch_config(v_branch_id)
    WHERE feature_key = 'allow_debt';

    -- Chặn nợ & đặt cọc bất khả thi theo cấu hình thừa kế
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

        -- Kiểm tra hạn mức tín dụng (chỉ áp dụng khi xuất bán thực tế SALE)
        IF v_order_type = 'SALE' THEN
            PERFORM 1 FROM public.partners 
            WHERE id = v_partner_id 
              AND debt_limit > 0 
              AND (current_debt + v_debt_amount) > debt_limit;
            IF FOUND THEN
                DECLARE
                    v_limit NUMERIC(15,2);
                    v_curr_debt NUMERIC(15,2);
                BEGIN
                    SELECT debt_limit, current_debt INTO v_limit, v_curr_debt
                    FROM public.partners WHERE id = v_partner_id;
                    RAISE EXCEPTION 'VƯỢT HẠN MỨC TÍN DỤNG: Khách nợ hiện tại: %, Đơn nợ: %, Hạn mức tối đa: %',
                        v_curr_debt, v_debt_amount, v_limit;
                END;
            END IF;
        END IF;
    END IF;

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
        
        IF v_prod.is_combo AND jsonb_array_length(v_prod.combo_items) > 0 THEN
            v_cost_price := 0;
            FOR v_combo_child IN SELECT 
                (c->>'product_id')::uuid AS product_id,
                COALESCE((c->>'quantity')::numeric, (c->>'qty')::numeric, 1) AS qty
            FROM jsonb_array_elements(v_prod.combo_items) AS c LOOP
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
                    
                    IF v_order_type = 'SALE' AND NOT v_allow_negative AND (v_child_inv.on_hand - v_child_inv.reserved < v_child_needed) THEN
                        RAISE EXCEPTION 'HẾT HÀNG COMBO: Món thành phần % không đủ tồn kho để đóng gói!', v_combo_child.product_id;
                    END IF;
                    
                    v_cost_price := v_cost_price + (v_child_inv.cost_price * v_combo_child.qty);
                    
                    IF v_order_status = 'COMPLETED' THEN
                        IF v_order_type = 'RETURN' THEN
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
                    ELSIF v_order_status = 'DRAFT' THEN
                        UPDATE public.inventory
                        SET reserved = reserved + v_child_needed, updated_at = clock_timestamp()
                        WHERE id = v_child_inv.id;
                    END IF;
                END;
            END LOOP;
        ELSE
            SELECT * INTO v_inv FROM public.inventory
            WHERE branch_id = v_branch_id AND product_id = v_item.product_id FOR UPDATE;
            
            IF NOT FOUND THEN
                INSERT INTO public.inventory (branch_id, product_id, on_hand, cost_price)
                VALUES (v_branch_id, v_item.product_id, 0, 0)
                RETURNING * INTO v_inv;
            END IF;
            
            IF v_order_type = 'SALE' AND NOT v_allow_negative AND (v_inv.on_hand - v_inv.reserved < v_base_qty) THEN
                RAISE EXCEPTION 'HẾT HÀNG TRONG KHO: Món % chỉ còn khả dụng %, yêu cầu xuất %',
                    v_item.product_id, (v_inv.on_hand - v_inv.reserved), v_base_qty;
            END IF;
            
            v_cost_price := v_inv.cost_price;
            
            IF v_order_status = 'COMPLETED' THEN
                IF v_order_type = 'RETURN' THEN
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
            ELSIF v_order_status = 'DRAFT' THEN
                UPDATE public.inventory
                SET reserved = reserved + v_base_qty, updated_at = clock_timestamp()
                WHERE id = v_inv.id;
            END IF;
        END IF;

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
                method VARCHAR,
                payment_account VARCHAR,
                account VARCHAR,
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
                    COALESCE(v_payment.payment_method, v_payment.method, 'CASH'),
                    COALESCE(v_payment.payment_account, v_payment.account, 'KET_TIEN'),
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

-- ==============================================================================
-- RPC 3: FULFILL PREORDER (fulfill_preorder)
-- ==============================================================================
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
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ĐƠN HÀNG KHÔNG TỒN TẠI: %', p_order_id;
    END IF;
    
    IF v_order.status != 'DRAFT' THEN
        RAISE EXCEPTION 'TRẠNG THÁI KHÔNG HỢP LỆ: Đơn hàng % đang ở trạng thái %, không thể giao cọc!',
            v_order.order_code, v_order.status;
    END IF;

    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
        SELECT * INTO v_inv FROM public.inventory 
        WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id FOR UPDATE;
        
        UPDATE public.inventory
        SET on_hand = on_hand - v_item.base_quantity,
            reserved = reserved - v_item.base_quantity,
            updated_at = clock_timestamp()
        WHERE id = v_inv.id;
        
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

-- ==============================================================================
-- RPC 4: F3 COLLECT DEBT (collect_debt)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.collect_debt(
    p_branch_id UUID,
    p_shift_id UUID,
    p_partner_id UUID,
    p_amount NUMERIC,
    p_payment_method VARCHAR DEFAULT 'CASH',
    p_payment_account VARCHAR DEFAULT 'KET_TIEN',
    p_note TEXT DEFAULT NULL,
    p_created_by VARCHAR DEFAULT 'Thu Ngân'
)
RETURNS JSONB AS $$
DECLARE
    v_flow_code VARCHAR(50);
    v_new_debt NUMERIC(15,2);
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Số tiền thu nợ phải lớn hơn 0!';
    END IF;

    v_flow_code := 'PT-NO-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS');

    INSERT INTO public.cash_flows (
        flow_code, branch_id, shift_id, partner_id,
        type, category, payment_method, payment_account,
        amount, note, created_by
    ) VALUES (
        v_flow_code, p_branch_id, p_shift_id, p_partner_id,
        'IN', 'DEBT_COLLECTION', p_payment_method, p_payment_account,
        p_amount, COALESCE(p_note, 'Thu nợ khách hàng'), p_created_by
    );

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

-- ==============================================================================
-- RPC 5: F8 GET SHIFT SUMMARY & CLOSE SHIFT (get_shift_summary & close_shift)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_shift_summary(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_shift RECORD;
    v_cash_in NUMERIC(15,2) := 0;
    v_cash_out NUMERIC(15,2) := 0;
    v_bank_in NUMERIC(15,2) := 0;
    v_order_count INT := 0;
    v_debt_collected NUMERIC(15,2) := 0;
    v_system_amount NUMERIC(15,2) := 0;
BEGIN
    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy ca bán hàng!';
    END IF;

    SELECT 
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0)
    INTO v_cash_in, v_cash_out
    FROM public.cash_flows
    WHERE shift_id = p_shift_id AND payment_method = 'CASH';

    SELECT COALESCE(SUM(amount), 0) INTO v_bank_in
    FROM public.cash_flows
    WHERE shift_id = p_shift_id AND payment_method = 'BANK_TRANSFER' AND type = 'IN';

    SELECT COUNT(*) INTO v_order_count
    FROM public.orders
    WHERE shift_id = p_shift_id AND status = 'COMPLETED';

    SELECT COALESCE(SUM(amount), 0) INTO v_debt_collected
    FROM public.cash_flows
    WHERE shift_id = p_shift_id AND category = 'DEBT_COLLECTION';

    v_system_amount := v_shift.initial_amount + v_cash_in - v_cash_out;

    RETURN jsonb_build_object(
        'shift_id', p_shift_id,
        'staff_name', v_shift.staff_name,
        'opened_at', v_shift.opened_at,
        'status', v_shift.status,
        'initial_amount', v_shift.initial_amount,
        'cash_in', v_cash_in,
        'cash_out', v_cash_out,
        'bank_in', v_bank_in,
        'system_cash_amount', v_system_amount,
        'order_count', v_order_count,
        'debt_collected', v_debt_collected
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.close_shift(
    p_shift_id UUID,
    p_actual_amount NUMERIC,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_shift RECORD;
    v_cash_in NUMERIC(15,2) := 0;
    v_cash_out NUMERIC(15,2) := 0;
    v_system_amount NUMERIC(15,2) := 0;
    v_discrepancy NUMERIC(15,2) := 0;
BEGIN
    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy ca bán hàng!';
    END IF;
    
    IF v_shift.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Ca bán hàng này đã được chốt sổ trước đó!';
    END IF;

    SELECT 
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0)
    INTO v_cash_in, v_cash_out
    FROM public.cash_flows
    WHERE shift_id = p_shift_id AND payment_method = 'CASH';

    v_system_amount := v_shift.initial_amount + v_cash_in - v_cash_out;
    v_discrepancy := p_actual_amount - v_system_amount;

    UPDATE public.shifts
    SET closed_at = clock_timestamp(),
        system_amount = v_system_amount,
        actual_amount = p_actual_amount,
        discrepancy = v_discrepancy,
        note = p_note,
        status = 'CLOSED'
    WHERE id = p_shift_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'shift_id', p_shift_id,
        'initial_amount', v_shift.initial_amount,
        'cash_in', v_cash_in,
        'cash_out', v_cash_out,
        'system_amount', v_system_amount,
        'actual_amount', p_actual_amount,
        'discrepancy', v_discrepancy
    );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 9. ĐIỀU CHUYỂN LIÊN CHI NHÁNH 2 PHA (TWO-PHASE STOCK TRANSFERS)
-- ==============================================================================
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

-- RPC TẠO PHIẾU DRAFT
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

-- RPC PHA 1: dispatch_transfer
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

    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id FOR UPDATE LOOP
        SELECT * INTO v_inv FROM public.inventory 
        WHERE branch_id = v_tr.from_branch_id AND product_id = v_item.product_id FOR UPDATE;
        
        IF NOT FOUND OR ((v_inv.on_hand - v_inv.reserved) < v_item.send_base_qty) THEN
            RAISE EXCEPTION 'Kho gửi không đủ tồn khả dụng cho sản phẩm: % (Khả dụng: %, Yêu cầu chuyển: %)', 
                v_item.product_id, COALESCE(v_inv.on_hand - v_inv.reserved, 0), v_item.send_base_qty;
        END IF;

        UPDATE public.inventory
        SET on_hand = on_hand - v_item.send_base_qty,
            updated_at = clock_timestamp()
        WHERE id = v_inv.id;

        UPDATE public.stock_transfer_items
        SET unit_cost = v_inv.cost_price
        WHERE id = v_item.id;

        INSERT INTO public.inventory_logs (
            branch_id, product_id, type, qty_change, balance_after,
            unit_cost, reference_id, note, created_by
        ) VALUES (
            v_tr.from_branch_id, v_item.product_id, 'TRANSFER_OUT', - v_item.send_base_qty,
            v_inv.on_hand - v_item.send_base_qty, v_inv.cost_price,
            v_tr.id, 'Xuất chuyển kho sang chi nhánh đích: ' || v_tr.to_branch_id, p_dispatched_by
        );
    END LOOP;

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

-- RPC PHA 2: receive_transfer
CREATE OR REPLACE FUNCTION public.receive_transfer(
    p_transfer_id UUID,
    p_received_items JSONB,
    p_loss_responsibility VARCHAR(30),
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

        IF (COALESCE(v_rec.received_qty, 0) + COALESCE(v_rec.loss_qty, 0)) != v_item.send_quantity THEN
            RAISE EXCEPTION 'Số lượng kiểm đếm (Nhận: % + Hỏng: %) không khớp với số lượng gửi (%) của mặt hàng: %',
                COALESCE(v_rec.received_qty, 0), COALESCE(v_rec.loss_qty, 0), v_item.send_quantity, v_item.product_id;
        END IF;

        UPDATE public.stock_transfer_items
        SET received_quantity = v_rec.received_qty,
            received_base_qty = v_rec.received_qty * v_item.conversion_rate,
            loss_quantity = v_rec.loss_qty,
            loss_base_qty = v_rec.loss_qty * v_item.conversion_rate,
            loss_reason = v_rec.loss_reason
        WHERE id = v_item.id;

        SELECT * INTO v_inv_dest FROM public.inventory
        WHERE branch_id = v_tr.to_branch_id AND product_id = v_item.product_id FOR UPDATE;

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

        IF v_rec.loss_qty > 0 THEN
            v_loss_cost := (v_rec.loss_qty * v_item.conversion_rate) * v_item.unit_cost;
            v_total_loss_val := v_total_loss_val + v_loss_cost;

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

    IF v_total_loss_val > 0 AND p_loss_responsibility = 'SHIPPER_DEBT' AND v_tr.shipper_id IS NOT NULL THEN
        UPDATE public.partners
        SET current_debt = current_debt + v_total_loss_val,
            updated_at = clock_timestamp()
        WHERE id = v_tr.shipper_id;
    END IF;

    IF v_total_loss_val > 0 THEN
        v_final_status := 'COMPLETED_WITH_LOSS';
    ELSE
        v_final_status := 'COMPLETED';
    END IF;

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

-- ==============================================================================
-- 10. HỆ THỐNG CẤU HÌNH THỪA KẾ & PHÂN QUYỀN ĐA CHI NHÁNH (DYNAMIC BRANCH ENGINE)
-- ==============================================================================

-- 10.1 BẢNG TỔ CHỨC / DOANH NGHIỆP MẸ (organizations)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50),
    phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_organizations_code ON public.organizations(code);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(is_active);

-- Bổ sung organization_id vào branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_branches_organization ON public.branches(organization_id);

-- 10.2 BẢNG TỪ ĐIỂN TÍNH NĂNG (feature_registry)
CREATE TABLE IF NOT EXISTS public.feature_registry (
    key VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    data_type VARCHAR(20) NOT NULL,
    default_value JSONB NOT NULL,
    options JSONB DEFAULT '[]'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    allow_branch_override BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_feature_registry_group ON public.feature_registry(group_name);
CREATE INDEX IF NOT EXISTS idx_feature_registry_active ON public.feature_registry(is_active);

-- 10.3 BẢNG CẤU HÌNH MẶC ĐỊNH DOANH NGHIỆP (organization_feature_defaults)
CREATE TABLE IF NOT EXISTS public.organization_feature_defaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feature_key VARCHAR(50) NOT NULL REFERENCES public.feature_registry(key) ON DELETE CASCADE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_feature UNIQUE (organization_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_org_defaults_lookup ON public.organization_feature_defaults(organization_id, feature_key);

-- 10.4 BẢNG TÙY BIẾN RIÊNG TẠI CHI NHÁNH (branch_feature_overrides) - SPARSE STORAGE
CREATE TABLE IF NOT EXISTS public.branch_feature_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    feature_key VARCHAR(50) NOT NULL REFERENCES public.feature_registry(key) ON DELETE CASCADE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_by VARCHAR(100),
    CONSTRAINT uq_branch_feature UNIQUE (branch_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_branch_overrides_lookup ON public.branch_feature_overrides(branch_id, feature_key);

-- 10.5 BẢNG PHÂN QUYỀN TRUY CẬP ĐA CHI NHÁNH (user_branch_access)
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_all_branches BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_branch_or_all CHECK (is_all_branches = TRUE OR branch_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_lookup ON public.user_branch_access(user_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_all_branches ON public.user_branch_access(user_id, is_all_branches, is_active);

-- 10.6 RPC GIẢI QUYẾT CẤU HÌNH THỪA KẾ HỮU HIỆU (get_effective_branch_config)
CREATE OR REPLACE FUNCTION public.get_effective_branch_config(p_branch_id UUID)
RETURNS TABLE (
    feature_key VARCHAR(50),
    group_name VARCHAR(50),
    label VARCHAR(255),
    data_type VARCHAR(20),
    effective_value JSONB,
    is_overridden BOOLEAN,
    source VARCHAR(30),
    is_locked BOOLEAN,
    options JSONB,
    dependencies JSONB
) AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id FROM public.branches WHERE id = p_branch_id;
    
    RETURN QUERY
    SELECT 
        fr.key AS feature_key,
        fr.group_name,
        fr.label,
        fr.data_type,
        COALESCE(bfo.value, ofd.value, fr.default_value) AS effective_value,
        (bfo.value IS NOT NULL) AS is_overridden,
        CASE 
            WHEN bfo.value IS NOT NULL THEN 'BRANCH_OVERRIDE'::varchar(30)
            WHEN ofd.value IS NOT NULL THEN 'ORGANIZATION_DEFAULT'::varchar(30)
            ELSE 'SYSTEM_DEFAULT'::varchar(30)
        END AS source,
        fr.is_locked,
        fr.options,
        fr.dependencies
    FROM public.feature_registry fr
    LEFT JOIN public.organization_feature_defaults ofd 
        ON ofd.feature_key = fr.key AND ofd.organization_id = v_org_id
    LEFT JOIN public.branch_feature_overrides bfo 
        ON bfo.feature_key = fr.key AND bfo.branch_id = p_branch_id
    WHERE fr.is_active = TRUE
    ORDER BY fr.group_name, fr.key;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10.7 RPC KIỂM SOÁT QUYỀN TRUY CẬP CHI NHÁNH (has_branch_access)
CREATE OR REPLACE FUNCTION public.has_branch_access(
    p_user_id UUID,
    p_branch_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_target_org_id UUID;
    v_has_access BOOLEAN := FALSE;
BEGIN
    SELECT organization_id INTO v_target_org_id 
    FROM public.branches 
    WHERE id = p_branch_id;

    IF v_target_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1 
        FROM public.user_branch_access
        WHERE user_id = p_user_id 
          AND is_active = TRUE
          AND (
              branch_id = p_branch_id
              OR (is_all_branches = TRUE AND organization_id = v_target_org_id)
          )
    ) INTO v_has_access;

    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- 10.8 BẢNG VÀ TRIGGER KIỂM TOÁN CẤU HÌNH TỰ ĐỘNG (config_audit_logs)
-- ==============================================================================
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

CREATE OR REPLACE FUNCTION public.fn_audit_org_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF OLD.value IS DISTINCT FROM NEW.value THEN
            INSERT INTO public.config_audit_logs (
                organization_id, branch_id, feature_key, action,
                old_value, new_value, changed_by
            ) VALUES (
                NEW.organization_id, NULL, NEW.feature_key, 'SET_DEFAULT',
                OLD.value, NEW.value, COALESCE(current_setting('app.current_user', true), 'Admin Hệ Thống')
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.config_audit_logs (
            organization_id, branch_id, feature_key, action,
            old_value, new_value, changed_by
        ) VALUES (
            NEW.organization_id, NULL, NEW.feature_key, 'SET_DEFAULT',
            NULL, NEW.value, COALESCE(current_setting('app.current_user', true), 'Admin Hệ Thống')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_audit_org_defaults ON public.organization_feature_defaults;
CREATE TRIGGER tg_audit_org_defaults
AFTER INSERT OR UPDATE ON public.organization_feature_defaults
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_org_defaults();

CREATE OR REPLACE FUNCTION public.fn_audit_branch_overrides()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        SELECT organization_id INTO v_org_id FROM public.branches WHERE id = OLD.branch_id;
        INSERT INTO public.config_audit_logs (
            organization_id, branch_id, feature_key, action,
            old_value, new_value, changed_by
        ) VALUES (
            v_org_id, OLD.branch_id, OLD.feature_key, 'RESET_OVERRIDE',
            OLD.value, NULL, COALESCE(current_setting('app.current_user', true), 'Admin Chi Nhánh')
        );
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        SELECT organization_id INTO v_org_id FROM public.branches WHERE id = NEW.branch_id;
        IF OLD.value IS DISTINCT FROM NEW.value THEN
            INSERT INTO public.config_audit_logs (
                organization_id, branch_id, feature_key, action,
                old_value, new_value, changed_by
            ) VALUES (
                v_org_id, NEW.branch_id, NEW.feature_key, 'SET_OVERRIDE',
                OLD.value, NEW.value, COALESCE(current_setting('app.current_user', true), 'Admin Chi Nhánh')
            );
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        SELECT organization_id INTO v_org_id FROM public.branches WHERE id = NEW.branch_id;
        INSERT INTO public.config_audit_logs (
            organization_id, branch_id, feature_key, action,
            old_value, new_value, changed_by
        ) VALUES (
            v_org_id, NEW.branch_id, NEW.feature_key, 'SET_OVERRIDE',
            NULL, NEW.value, COALESCE(current_setting('app.current_user', true), 'Admin Chi Nhánh')
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_audit_branch_overrides ON public.branch_feature_overrides;
CREATE TRIGGER tg_audit_branch_overrides
AFTER INSERT OR UPDATE OR DELETE ON public.branch_feature_overrides
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_branch_overrides();

-- ==============================================================================
-- 10.9 BẢO MẬT & RÀNG BUỘC PHỤ THUỘC (SECURITY GUARDS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_guard_branch_override()
RETURNS TRIGGER AS $$
DECLARE
    v_locked BOOLEAN;
    v_label VARCHAR;
    v_dep_key TEXT;
    v_eff_val JSONB;
BEGIN
    SELECT is_locked, label INTO v_locked, v_label
    FROM public.feature_registry
    WHERE key = NEW.feature_key;

    IF v_locked = TRUE THEN
        RAISE EXCEPTION 'VƯỢT QUYỀN KHÓA ADMIN: Tính năng "%" đã bị Admin khóa cứng toàn hệ thống, chi nhánh không được phép tùy biến riêng!', v_label;
    END IF;

    IF NEW.feature_key = 'allow_debt' AND (NEW.value)::boolean = TRUE THEN
        SELECT effective_value INTO v_eff_val
        FROM public.get_effective_branch_config(NEW.branch_id)
        WHERE feature_key = 'customer_required';

        IF (v_eff_val)::boolean = FALSE THEN
            RAISE EXCEPTION 'VI PHẠM RÀNG BUỘC PHỤ THUỘC: Không thể bật Bán nợ (allow_debt) nếu chưa bật Bắt buộc thông tin khách hàng (customer_required)!';
        END IF;
    END IF;

    IF NEW.feature_key = 'customer_required' AND (NEW.value)::boolean = FALSE THEN
        SELECT effective_value INTO v_eff_val
        FROM public.get_effective_branch_config(NEW.branch_id)
        WHERE feature_key = 'allow_debt';

        IF (v_eff_val)::boolean = TRUE THEN
            RAISE EXCEPTION 'VI PHẠM RÀNG BUỘC PHỤ THUỘC: Không thể tắt tính năng "customer_required" vì có tính năng khác đang phụ thuộc vào nó!';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_guard_branch_override ON public.branch_feature_overrides;
CREATE TRIGGER tg_guard_branch_override
BEFORE INSERT OR UPDATE ON public.branch_feature_overrides
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_branch_override();

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

-- ==============================================================================
-- PERMISSIONS FOR SUPABASE API (ANON & AUTHENTICATED)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
