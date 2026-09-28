-- ============================================================================
-- SEED DATA: MULTI-TENANT & MULTI-STORE TEST DATASET
-- 1 Common Tenant -> 2 Distinct Stores (VLXD and Cafe/F&B)
-- ============================================================================

-- Dọn dẹp dữ liệu cũ (nếu có) theo thứ tự khóa ngoại
DELETE FROM order_items WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM orders WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM inventory WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM products WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM users WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM warehouses WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM branches WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM stores WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM tenants WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 1. TẠO TENANT CHUNG
INSERT INTO tenants (id, name, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'CTY TNHH CONG NGHE & THUONG MAI', 'ACTIVE');

-- ============================================================================
-- STORE 1: NGÀNH HÀNG VLXD & GẠCH MEN
-- ============================================================================
-- Store record
INSERT INTO stores (id, tenant_id, name, code, domain, theme_config)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'VLXD & Gạch Men Hoàng Gia',
    'STORE_VLXD',
    'vlxd.hoanggia.vn',
    '{
        "primary_color": "#795548",
        "secondary_color": "#9E9E9E",
        "business_type": "BUILDING_MATERIALS",
        "unit_types": ["m2", "thùng", "viên", "tấn", "bao"],
        "price_tiers_enabled": true
    }'::jsonb
);

-- Branch: Kho Q12
INSERT INTO branches (id, tenant_id, store_id, name, code, address, phone, is_active)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Chi nhánh Kho Q12',
    'BRANCH_Q12',
    'QL1A, P. Tân Thới Hiệp, Quận 12, TP.HCM',
    '0901234567',
    true
);

-- Warehouse: Tổng Kho Gạch Q12
INSERT INTO warehouses (id, tenant_id, store_id, branch_id, name)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'Tổng Kho Gạch & VLXD Q12'
);

-- Store Manager User
INSERT INTO users (id, tenant_id, store_id, branch_id, email, role, is_active)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'admin.vlxd@hoanggia.vn',
    'STORE_MANAGER',
    true
);

-- Products VLXD (Quy cách m2, thùng, bao)
INSERT INTO products (id, tenant_id, store_id, sku, name, attributes, base_price, is_active)
VALUES 
(
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'GACH-60x60-VANG',
    'Gạch Men Vân Đá Vàng 60x60',
    '{"unit": "m2", "size": "60x60", "box_spec": {"pcs_per_box": 4, "m2_per_box": 1.44}, "surface": "Bóng kiếng"}'::jsonb,
    220000,
    true
),
(
    'f0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'XM-HA-TIEN-PCB40',
    'Xi Măng Hà Tiên Đa Dụng PCB40',
    '{"unit": "bao", "weight_kg": 50, "brand": "Hà Tiên"}'::jsonb,
    92000,
    true
);

-- Inventory VLXD
INSERT INTO inventory (id, tenant_id, warehouse_id, product_id, quantity, min_alert)
VALUES
(
    '11000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    500.000, -- 500 m2
    50.000
),
(
    '11000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    1000.000, -- 1000 bao
    100.000
);

-- Order VLXD: 50m2 gạch + 40 bao xi măng = 11,000,000 + 3,680,000 = 14,680,000
INSERT INTO orders (id, tenant_id, store_id, branch_id, order_number, total_amount, status, payment_status)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'ORD-VLXD-0001',
    14680000,
    'COMPLETED',
    'PAID'
);

INSERT INTO order_items (id, tenant_id, order_id, product_id, quantity, unit_price, subtotal)
VALUES
(
    '30000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    50.000,
    220000,
    11000000
),
(
    '30000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    40.000,
    92000,
    3680000
);

-- ============================================================================
-- STORE 2: NGÀNH HÀNG CAFE / F&B
-- ============================================================================
-- Store record
INSERT INTO stores (id, tenant_id, name, code, domain, theme_config)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'The Morning Cafe & Bakery',
    'STORE_CAFE',
    'cafe.morning.vn',
    '{
        "primary_color": "#FF9800",
        "secondary_color": "#5D4037",
        "business_type": "FNB",
        "features": ["table_service", "topping_options", "takeaway"],
        "kitchen_display_enabled": true
    }'::jsonb
);

-- Branch: Chi nhánh Quận 1
INSERT INTO branches (id, tenant_id, store_id, name, code, address, phone, is_active)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'Chi nhánh Flagship Quận 1',
    'BRANCH_Q1',
    'Lê Lợi, P. Bến Nghé, Quận 1, TP.HCM',
    '0909988776',
    true
);

-- Warehouse: Kho Nguyên Liệu Q1
INSERT INTO warehouses (id, tenant_id, store_id, branch_id, name)
VALUES (
    'd0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'Kho Nguyên Liệu & Pha Chế Q1'
);

-- Store Manager User
INSERT INTO users (id, tenant_id, store_id, branch_id, email, role, is_active)
VALUES (
    'e0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'manager.q1@morningcafe.vn',
    'STORE_MANAGER',
    true
);

-- Products Cafe (Toppings, Sizes, Đơn vị ly)
INSERT INTO products (id, tenant_id, store_id, sku, name, attributes, base_price, is_active)
VALUES 
(
    'f0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'CF-SUA-DA',
    'Cà Phê Sữa Đá Sài Gòn',
    '{"unit": "ly", "sizes": [{"name": "M", "extra": 0}, {"name": "L", "extra": 10000}], "toppings": ["Trân châu trắng", "Thạch cafe", "Kem cheese"]}'::jsonb,
    35000,
    true
),
(
    'f0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'TRA-DAO-CAM-SA',
    'Trà Đào Cam Sả Đặc Biệt',
    '{"unit": "ly", "sizes": [{"name": "M", "extra": 0}, {"name": "L", "extra": 10000}], "toppings": ["Đào giòn", "Hạt chia"]}'::jsonb,
    45000,
    true
);

-- Inventory Cafe
INSERT INTO inventory (id, tenant_id, warehouse_id, product_id, quantity, min_alert)
VALUES
(
    '11000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000003',
    200.000, -- 200 suất
    20.000
),
(
    '11000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000004',
    150.000, -- 150 suất
    15.000
);

-- Order Cafe: 2 x Cà phê sữa (70,000) + 1 x Trà đào (45,000) = 115,000
INSERT INTO orders (id, tenant_id, store_id, branch_id, order_number, total_amount, status, payment_status)
VALUES (
    '20000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'ORD-CAFE-0001',
    115000,
    'COMPLETED',
    'PAID'
);

INSERT INTO order_items (id, tenant_id, order_id, product_id, quantity, unit_price, subtotal)
VALUES
(
    '30000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000003',
    2.000,
    35000,
    70000
),
(
    '30000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000004',
    1.000,
    45000,
    45000
);
