-- ============================================================================
-- MULTI-TENANT & MULTI-STORE SAAS SCHEMA FOR SUPABASE / POSTGRESQL
-- Generated from DATABASE.md
-- ============================================================================

-- Kích hoạt extension hỗ trợ UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TENANTS (Doanh nghiệp sở hữu nền tảng / khách hàng SaaS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, TRIAL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ============================================================================
-- 2. STORES (Cửa hàng / Chuỗi thuộc Tenant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stores_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stores_tenant_id ON stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores(domain);

-- ============================================================================
-- 3. BRANCHES (Chi nhánh của từng Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branches_store_code UNIQUE (store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_branches_scope ON branches(tenant_id, store_id);

-- ============================================================================
-- 4. WAREHOUSES (Kho hàng thuộc Chi nhánh / Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_scope ON warehouses(tenant_id, store_id, branch_id);

-- ============================================================================
-- 5. USERS (Người dùng, Phân quyền RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, TENANT_ADMIN, STORE_MANAGER, BRANCH_STAFF, CASHIER
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_scope ON users(tenant_id, store_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- 6. PRODUCTS (Danh mục sản phẩm của Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    base_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_store_sku UNIQUE (store_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_scope ON products(tenant_id, store_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, store_id, sku);

-- ============================================================================
-- 7. INVENTORY (Tồn kho theo Kho và Sản phẩm)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
    min_alert NUMERIC(15, 3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_warehouse_product UNIQUE (warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_scope ON inventory(tenant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(tenant_id, product_id);

-- ============================================================================
-- 8. ORDERS (Đơn hàng bán tại Store / Branch)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_orders_store_number UNIQUE (store_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_scope ON orders(tenant_id, store_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(tenant_id, store_id, created_at DESC);

-- ============================================================================
-- 9. ORDER_ITEMS (Chi tiết dòng sản phẩm trong Đơn hàng)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 3) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_scope ON order_items(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(tenant_id, product_id);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS CHUẨN SUPABASE)
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policy mẫu: Cách ly dữ liệu theo app_metadata -> tenant_id trong Supabase Auth JWT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'tenant_isolation_policy_products'
    ) THEN
        CREATE POLICY tenant_isolation_policy_products ON products
            FOR ALL
            USING ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id)
            WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'tenant_isolation_policy_orders'
    ) THEN
        CREATE POLICY tenant_isolation_policy_orders ON orders
            FOR ALL
            USING ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id)
            WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id);
    END IF;
END $$;
