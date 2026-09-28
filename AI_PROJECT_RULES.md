# AI PROJECT RULES (BẤT BIẾN)

Bộ quy tắc bất biến dành cho mọi AI Agent và Kỹ sư tham gia phát triển hệ thống SaaS Multi-Tenant / Multi-Store này.

---

## 1. NGUYÊN TẮC KIẾN TRÚC & DỮ LIỆU CỐT LÕI

* **RULE 001: MỘT CODEBASE DUY NHẤT**
  Tuyệt đối KHÔNG BAO GIỜ tạo repository mới, project mới, thư mục source code riêng, hay copy source code khi tạo Store/Branch mới. Một Store mới chỉ là một record cấu hình trong Database.

* **RULE 002: MỘT DATABASE DUY NHẤT (SHARED DATABASE, LOGICAL ISOLATION)**
  Tuyệt đối KHÔNG BAO GIỜ tạo database riêng, schema riêng theo store, hoặc table/collection riêng cho từng store (ví dụ: `products_store_a`, `orders_store_b`). Toàn bộ thực thể nghiệp vụ dùng chung bảng và được phân vùng logic bởi `tenant_id`, `store_id`, `branch_id`.

* **RULE 003: CÔ LẬP DỮ LIỆU ĐA TẦNG (DATA ISOLATION & SCOPING)**
  Mọi bảng dữ liệu nghiệp vụ (User, Product, Category, Warehouse, Inventory, Order, Customer, Supplier, Payment, Expense, Report,...) BẮT BUỘC phải gắn liền với phạm vi sở hữu (`tenant_id`, `store_id`, `branch_id`). Không bao giờ thực thi truy vấn nghiệp vụ thiếu điều kiện tenant/store context.

* **RULE 004: ZERO TRUST CLIENT AUTHORIZATION (BẢO MẬT PHÍA SERVER)**
  Không bao giờ tin tưởng `tenant_id`, `store_id` hoặc `branch_id` do client tự gửi lên mà không xác minh quyền từ session/JWT/token của user ở server. Phải kiểm tra quan hệ quyền lực:
  `Who (User) -> Belongs to (Tenant) -> Assigned to (Store/Branch) -> Has Permission (Role/Permission) -> Execute`.

* **RULE 005: CONFIGURATION-DRIVEN SYSTEM (HỆ THỐNG ĐIỀU HƯỚNG BỞI CẤU HÌNH)**
  Không hard-code logic theo tên hay ID của Store (không viết `if (store == 'A') ...`). Mọi khác biệt về giao diện, logo, tiền tệ, thuế, phân hệ nghiệp vụ (VLXD, Gạch men, Tạp hóa, F&B, Bán lẻ), tính năng bật/tắt (feature flags) phải được đọc từ cấu hình (Database Configuration).

---

## 2. NGUYÊN TẮC KIỂM THỬ & CHỨNG MINH KỸ THUẬT

* **RULE 006: CHỨNG MINH BẰNG RUNTIME & TEST**
  Không bao giờ kết luận hoặc báo cáo "ĐÃ HOÀN THÀNH" nếu chưa chạy build, test và kiểm chứng qua log/runtime thực tế. Nếu chưa kiểm thử được, bắt buộc phải báo "CHƯA XÁC MINH ĐƯỢC".

* **RULE 007: KIỂM THỬ BẮT BUỘC CHO MULTI-TENANT ISOLATION**
  Mọi module nghiệp vụ mới hoặc chỉnh sửa API phải có test case kiểm chứng:
  - User Store A **không thể đọc** hoặc **ghi** dữ liệu của Store B (kể cả khi biết ID).
  - User Branch A01 **không thể truy cập** tài nguyên Branch A02 nếu không có quyền.
  - Store Admin **không thể truy cập** các API thuộc Super Admin.
  - Báo cáo và Dashboard tổng phải gom đúng dữ liệu; bộ lọc Store phải trả đúng phạm vi.

* **RULE 008: AN TOÀN DỮ LIỆU & MÔI TRƯỜNG**
  Không bao giờ sửa đổi, xóa dữ liệu production, force push lên nhánh chính, hoặc xóa bỏ secret trong quá trình test/dev.

---

## 3. NGUYÊN TẮC PHÁT TRIỂN & BẢO VỆ CODE

* **RULE 009: ƯU TIÊN THAY ĐỔI GỌN GÀNG, BẢO TỒN CODE HIỆN CÓ**
  Không tự ý rewrite toàn bộ dự án nếu không có chỉ định. Tận dụng kiến trúc đã kiểm chứng, mở rộng theo module, và bảo vệ các tính năng đang hoạt động.

* **RULE 010: MINH BẠCH VỀ LỖI VÀ QUYẾT ĐỊNH NGHIỆP VỤ**
  Khi phát hiện lỗi hoặc sai lệch giữa tài liệu và code, phải báo cáo rõ: Lỗi gì - Ở đâu - Nguyên nhân - Đã thử giải pháp gì - Kết quả. Khi gặp quyết định nghiệp vụ mơ hồ hoặc có rủi ro lớn, bắt buộc phải xin ý kiến định hướng.
