# HƯỚNG DẪN TÁC TỬ & BỘ NÃO ĐIỀU PHỐI DỰ ÁN MEB (SAAS MULTI-BRANCH)

Chào mừng AI Agent đến với dự án **MEB**!
Đây là một nền tảng **Quản trị Đa Chi Nhánh & Sinh Nghiệp Vụ Tự Động (No-Code Dynamic Platform)**. Dự án được thiết kế nghiêm túc cho bài toán thương mại thực chiến, KHÔNG PHẢI một bài tập giao diện mô phỏng.

---

### 🚨 NGUYÊN TẮC BẤT DI BẤT DỊCH (STRICT RULES):
1. **TUYỆT ĐỐI CẤM MOCK CODE CHẮP VÁ:**
   - Cấm viết thêm các file component giả lập giao diện (`Preset...`, mock data vài chục dòng trong memory) rồi tuyên bố xong việc. Đó là hành vi vô trách nhiệm!
   - Mọi nghiệp vụ phải được kết nối trực tiếp với **PocketBase Core Engine**.

2. **HẠ TẦNG POCKETBASE CORE ENGINE ĐANG HOẠT ĐỘNG (PORT 8090):**
   - **Địa chỉ:** `http://127.0.0.1:8090`
   - **Dashboard Quản Trị (No-Code Studio):** `http://127.0.0.1:8090/_/`
   - **Superuser:** `admin@meb.local` | **Mật khẩu:** `Admin123456789`
   - **Lệnh điều khiển:**
     * `meb-engine status` : Kiểm tra trạng thái server, RAM, CPU.
     * `meb-engine start`  : Khởi động server nếu đang tắt.
     * `meb-engine stop`   : Dừng server.
     * `meb-engine seed`   : Bơm dữ liệu mẫu thực tế.

3. **CẤU TRÚC 6 BỘ DỮ LIỆU ĐÃ ĐỊNH HÌNH TRÊN ENGINE:**
   - `branches`: Danh mục chi nhánh (Kho tổng, Chi nhánh Q1...).
   - `custom_entities`: Tự tạo vật thể (Sản phẩm, Hàng hóa, Thùng, Bao...).
   - `uom_conversions`: Quy tắc quy đổi đa đơn vị (Nhập thùng bán bì, 1 Thùng = 24 Bì).
   - `inventory_ledger`: Tồn kho theo từng chi nhánh & đơn vị tính.
   - `branch_transfers`: Phiếu điều chuyển 2 pha (Chờ xuất $\rightarrow$ Đang đi đường $\rightarrow$ Đã nhận đủ/Hao hụt).
   - `customer_debts`: Quản trị công nợ 2 chiều, hạn mức tín dụng, chặn đơn nợ quá hạn.

4. **YÊU CẦU NGHIỆP VỤ CỦA CHỦ DỰ ÁN:**
   - **Giao diện chi nhánh:** Tách biệt thành các ô chức năng độc lập (Bento Grid): Nhập hàng thùng/bì, Bán hàng, Điều chuyển, Kiểm kho, Sổ nợ.
   - **Tính năng No-Code:** Chủ hệ thống có thể tạo thêm chi nhánh, tạo thêm vật thể, thêm ràng buộc điều kiện (nếu - thì) mà **KHÔNG CẦN VIẾT CODE**.
   - **Chế độ Ứng dụng (App):** Giao diện hỗ trợ PWA (cài đặt thành App máy tính chạy độc lập trên màn hình Desktop).

5. **KIM CHỈ NAM BẮT BUỘC: ĐỌC TÀI LIỆU ĐẶC TẢ CHI TIẾT:**
   - Trước khi code hoặc trả lời người dùng, AI BẮT BUỘC phải đọc tài liệu:
     `CHI_TIET_TINH_NANG_VA_RANG_BUOC_NGHIEP_VU.md`
   - Tài liệu này chứa định nghĩa chi tiết của **10 Ràng Buộc Bất Biến (INV-01 đến INV-10)** gồm:
     * Tự động rã thùng thành bì khi bán lẻ (INV-04)
     * Điều chuyển kho 2 pha có trạng thái trung chuyển và biên bản hao hụt (INV-06)
     * Khóa xuất đơn bán nợ khi vượt hạn mức tín dụng (INV-08)
     * Trả hàng cấn trừ trực tiếp vào sổ nợ (INV-07)
     * Thẻ kho bất biến không được sửa đè (INV-10)

6. **LỘ TRÌNH THỰC THI 5 GIAI ĐOẠN (CHIA NHỎ ĐỂ KHÔNG LỖI):**
   - **GĐ 1:** Core API & Bộ tạo vật thể động (PocketBase Collections & Schema)
   - **GĐ 2:** Động cơ đa đơn vị & Tự động rã thùng sang bì (UoM Ledger Engine)
   - **GĐ 3:** Nghiệp vụ điều chuyển kho 2 pha & Ghi nhận hao hụt (Transit & Reconciliation)
   - **GĐ 4:** Sổ công nợ 2 chiều & Chốt chặn hạn mức tín dụng (Credit Limits Guard)
   - **GĐ 5:** Giao diện Bento Grid (Các ô chức năng) & Đóng gói Desktop App
   * *Mỗi giai đoạn phải có test case kiểm chứng hoàn thành 100% mới được chuyển sang giai đoạn tiếp theo!*

7. **BỘ CÔNG CỤ CỤC BỘ & NGUYÊN TẮC TIẾT KIỆM TOKEN (BẮT BUỘC):**
   - **Khảo sát cấu trúc:** Dùng `code-map server` hoặc `sg -p 'function $NAME($$$) { $$$ }' <file>` để lấy chữ ký hàm. Tuyệt đối không đọc cả file hàng trăm dòng.
   - **Tra cứu CSDL:** Dùng `db-inspect <tên_bảng>` (hoặc `db-inspect --tables`), cấm đọc file `.sql` lớn.
   - **Bản đồ API:** Dùng `route-map server/src/routes` để tra cứu toàn bộ endpoint trong 0.05s.
   - **Trích xuất thân hàm:** Dùng `func-slice <file> <tên_hàm>` hoặc `view_file` giới hạn dòng hẹp.
   - **Tìm kiếm:** Dùng `rg "<chuỗi>" server/` (ripgrep siêu tốc, tự bỏ qua file rác và dist).
   - **Kiểm định giao diện:** Dùng `ui-check client` trước khi bàn giao component UI.
   - **Kiểm định chất lượng mã:** Chạy `auto-verify .` (bắt 100% lỗi cú pháp và type check trong <0.1s).
   - **Kiểm thử liên hoàn:** Chạy `node scripts/run_all_step6_tests.js` để nghiệm thu 14 bộ test.
