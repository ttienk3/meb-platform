# DATABASE SPECIFICATION: POSTGRESQL / SUPABASE MULTI-TENANT SCHEMA

## 1. NGUYÊN TẮC THIẾT KẾ CƠ SỞ DỮ LIỆU

1. **Shared Database - Logical Isolation:**
   - Tất cả các Tenant và Store sử dụng chung một database PostgreSQL duy nhất.
   - Phân lập logic nghiêm ngặt bằng cặp định danh phạm vi `(tenant_id, store_id, branch_id)`.
2. **Khóa ngoại bắt buộc (Foreign Key Constraints):**
   - Mọi bảng nghiệp vụ đều phải có ràng buộc khóa ngoại trỏ về `tenants(id)` và các bảng cha tương ứng (`stores(id)`, `branches(id)`).
   - Ràng buộc toàn vẹn xóa/cập nhật: Không cho phép dữ liệu mồ côi (orphan records).
3. **Chiến lược Chỉ mục (Indexing Strategy):**
   - Mọi bảng đều có B-Tree index trên các cột phạm vi `(tenant_id)`, `(tenant_id, store_id)` và `(tenant_id, store_id, branch_id)`.
   - Index trên các cột tra cứu nghiệp vụ thường xuyên: `(tenant_id, store_id, sku)`, `(tenant_id, store_id, order_number)`.
4. **Hỗ trợ Supabase Row Level Security (RLS):**
   - Mọi bảng đều sẵn sàng bật RLS để cô lập dữ liệu từ tầng database engine.

---

## 2. DIAGRAM QUAN HỆ THỰC THỂ (ERD)

```text
tenants
  ├── stores
  │     ├── branches
  │     │     └── warehouses
  │     │           └── inventory ◄── products
  │     │
  │     ├── users
  │     ├── products
  │     └── orders
  │           └── order_items ◄── products
```

---

## 3. DATA SCHEMA CHI TIẾT (DDL POSTGRESQL / SUPABASE)

```sql
-- Kích hoạt extension hỗ trợ UUID nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TENANTS (Doanh nghiệp sở hữu nền tảng / khách hàng SaaS)
-- ============================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, TRIAL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_status ON tenants(status);

-- ============================================================================
-- 2. STORES (Cửa hàng / Chuỗi thuộc Tenant)
-- ============================================================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    theme_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Màu sắc, logo, loại hình kinh doanh (VLXD, F&B, Retail)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stores_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_stores_tenant_id ON stores(tenant_id);
CREATE INDEX idx_stores_domain ON stores(domain);

-- ============================================================================
-- 3. BRANCHES (Chi nhánh của từng Store)
-- ============================================================================
CREATE TABLE branches (
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

CREATE INDEX idx_branches_scope ON branches(tenant_id, store_id);

-- ============================================================================
-- 4. WAREHOUSES (Kho hàng thuộc Chi nhánh / Store)
-- ============================================================================
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warehouses_scope ON warehouses(tenant_id, store_id, branch_id);

-- ============================================================================
-- 5. USERS (Người dùng, Phân quyền RBAC)
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL đối với Super Admin hệ thống
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,  -- NULL nếu là Tenant Admin quản lý all stores
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL, -- NULL nếu là Store Manager quản lý all branches
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, TENANT_ADMIN, STORE_MANAGER, BRANCH_STAFF, CASHIER
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_scope ON users(tenant_id, store_id, branch_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- 6. PRODUCTS (Danh mục sản phẩm của Store)
-- ============================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- Thuộc tính riêng: đơn vị (m2, thùng, tấn), thông số kỹ thuật...
    base_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_store_sku UNIQUE (store_id, sku)
);

CREATE INDEX idx_products_scope ON products(tenant_id, store_id);
CREATE INDEX idx_products_sku ON products(tenant_id, store_id, sku);

-- ============================================================================
-- 7. INVENTORY (Tồn kho theo Kho và Sản phẩm)
-- ============================================================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
    min_alert NUMERIC(15, 3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_warehouse_product UNIQUE (warehouse_id, product_id)
);

CREATE INDEX idx_inventory_scope ON inventory(tenant_id, warehouse_id);
CREATE INDEX idx_inventory_product ON inventory(tenant_id, product_id);

-- ============================================================================
-- 8. ORDERS (Đơn hàng bán tại Store / Branch)
-- ============================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- PENDING, COMPLETED, CANCELLED
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID', -- UNPAID, PARTIAL, PAID
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_orders_store_number UNIQUE (store_id, order_number)
);

CREATE INDEX idx_orders_scope ON orders(tenant_id, store_id, branch_id);
CREATE INDEX idx_orders_created_at ON orders(tenant_id, store_id, created_at DESC);

-- ============================================================================
-- 9. ORDER_ITEMS (Chi tiết dòng sản phẩm trong Đơn hàng)
-- ============================================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 3) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_scope ON order_items(tenant_id, order_id);
CREATE INDEX idx_order_items_product ON order_items(tenant_id, product_id);
```

---

## 4. BẢO MẬT ROW LEVEL SECURITY (RLS CHUẨN SUPABASE)

```sql
-- Kích hoạt RLS cho tất cả các bảng
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Ví dụ Policy cô lập theo JWT Tenant ID (app_metadata -> tenant_id)
CREATE POLICY tenant_isolation_policy_products ON products
    FOR ALL
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
    );

CREATE POLICY tenant_isolation_policy_orders ON orders
    FOR ALL
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
    );
```
