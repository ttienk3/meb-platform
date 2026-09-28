# SYSTEM SPECIFICATION: MULTI-TENANT & MULTI-STORE SAAS PLATFORM

## 1. TỔNG QUAN HỆ THỐNG
Nền tảng Web App SaaS phục vụ quản lý kinh doanh đa cửa hàng, đa ngành nghề (Bán lẻ, Tạp hóa, VLXD, Gạch men, F&B, Kho vận, v.v.) dựa trên kiến trúc **One Codebase - One Database - Multiple Tenants/Stores**.

### Sơ đồ phân cấp thực thể (Entity Hierarchy)
```text
                    ┌────────────────────────┐
                    │      SUPER ADMIN       │
                    │   (Platform Operator)  │
                    └───────────┬────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ↓                             ↓
          TENANT 01 (Doanh nghiệp A)     TENANT 02 (Doanh nghiệp B)
                 │                             │
          ┌──────┴──────┐                      │
          ↓             ↓                      ↓
       STORE 01      STORE 02               STORE 03
    (VLXD & Gạch)  (Điện tử)              (F&B Cafe)
          │             │                      │
     ┌────┴────┐        │                 ┌────┴────┐
     ↓         ↓        ↓                 ↓         ↓
  BRANCH 1  BRANCH 2 BRANCH 1          BRANCH 1  BRANCH 2
  (Showroom)  (Kho)  (Cửa hàng)         (Quận 1) (Quận 3)
     │         │        │                 │         │
    POS       KHO      POS               POS       BẾP
```

---

## 2. PHÂN TẦNG VAI TRÒ & PHÂN QUYỀN (RBAC & CONTEXT SCOPING)

1. **SUPER ADMIN (Hệ thống / Global Scope):**
   - Quản lý toàn bộ danh sách Tenant và Store.
   - Bật / tắt, khóa tài khoản Tenant/Store.
   - Giám sát tình trạng hệ thống, license, cấu hình toàn cục.
   - Xem Dashboard tổng hợp toàn bộ hệ thống hoặc lọc theo từng Tenant / Store / Branch.

2. **TENANT / STORE ADMIN (Phạm vi Cửa hàng / Store Scope):**
   - Quản trị toàn bộ dữ liệu nội bộ của Store: Nhân viên, Chi nhánh, Kho bãi, Sản phẩm, Bán hàng, Khách hàng, Nhà cung cấp, Báo cáo tài chính.
   - Cấu hình thông tin Store: Loại hình kinh doanh (business_type), giao diện (theme, logo), thuế, tiền tệ, bật/tắt module tính năng.
   - Tuyệt đối **không** đọc hoặc ghi dữ liệu của Store khác.

3. **BRANCH MANAGER / STAFF (Phạm vi Chi nhánh / Branch Scope):**
   - Quản lý ca làm việc, kho chi nhánh, tạo đơn hàng POS tại chi nhánh được phân công.
   - Chỉ xem và thao tác dữ liệu trong phạm vi chi nhánh được ủy quyền.

---

## 3. CƠ CHẾ CÔ LẬP DỮ LIỆU (DATA ISOLATION ENGINE)

Mọi bảng nghiệp vụ trong Database đều tuân thủ nguyên tắc khóa ngoại ngữ cảnh:
```sql
-- Ví dụ cấu trúc chuẩn
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    store_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    category_id VARCHAR(36),
    unit VARCHAR(50), -- cái, hộp, m2, tấn, viên...
    cost_price DECIMAL(15, 2) DEFAULT 0,
    selling_price DECIMAL(15, 2) DEFAULT 0,
    attributes JSON,  -- Chứa thuộc tính đặc thù ngành (màu sắc, kích thước, bề mặt, quy cách thùng/m2...)
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Context Resolution Flow (Quy trình xác định ngữ cảnh request):
```text
HTTP Request (Header / Cookie / Host Domain / Subdomain)
  │
  ▼
[Domain / Subdomain / Store Identifier Resolver]
  │  --> Xác định Store ID dự kiến
  ▼
[Authentication Middleware]
  │  --> Giải mã Token / Session -> Xác thực User ID
  ▼
[Multi-Tenant Authorization Guard]
  │  --> Kiểm tra User có thuộc Tenant này không?
  │  --> User có quyền truy cập Store ID và Branch ID này không?
  │  --> Nếu KHÔNG -> 403 Forbidden ngay lập tức (Không query dữ liệu)
  ▼
[Scoped Query Builder / ORM Interceptor]
  │  --> Tự động inject { tenant_id, store_id, [branch_id] } vào WHERE clause
  ▼
[Database Execution & Data Response]
```

---

## 4. HỆ THỐNG MODULE & ĐIỀU HƯỚNG BẰNG CẤU HÌNH (CONFIGURATION-DRIVEN)

Mỗi Store sở hữu một record cấu hình gồm:
- **`business_type`**: `RETAIL` | `BUILDING_MATERIALS` (VLXD/Gạch) | `FNB` | `GROCERY` | `WAREHOUSE`.
- **`modules_enabled`**:
  - `inventory_advanced` (Kho theo lô/hạn dùng, vị trí kho, quy đổi đơn vị đo lường m2 ↔ thùng ↔ viên).
  - `pos_quick_checkout` (Giao diện POS bán buôn / bán lẻ siêu tốc).
  - `debt_management` (Quản lý công nợ khách hàng, nhà cung cấp).
  - `multi_branch_transfer` (Điều chuyển hàng hóa liên chi nhánh/kho).
  - `pricing_tiers` (Bảng giá theo đối tượng: thợ/nhà thầu, đại lý, khách lẻ).
- **`theme_config`**: màu sắc chủ đạo, font chữ, logo, mẫu in hóa đơn.

---

## 5. BÁO CÁO & DASHBOARD ĐA CẤP (MULTI-LEVEL REPORTING)
- **Cấp 1 (Global):** Tổng quan doanh số toàn hệ thống, số lượng Tenant active, tốc độ tăng trưởng.
- **Cấp 2 (Store):** Doanh thu, chi phí, lợi nhuận gộp, công nợ, giá trị tồn kho của riêng Store.
- **Cấp 3 (Branch):** Doanh số từng ca, lượng xuất nhập tồn của chi nhánh, năng suất bán hàng của từng nhân viên.
