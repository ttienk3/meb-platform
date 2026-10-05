# 📘 BẢN ĐẶC TẢ CHI TIẾT TÍNH NĂNG, RÀNG BUỘC NGHIỆP VỤ & LỘ TRÌNH CHIA NHỎ
> **Dự án:** Nền tảng Quản trị Đa Chi Nhánh & Sinh Vật Thể Động MEB  
> **Hạ tầng CSDL & Logic Engine:** PocketBase Core Engine (`http://127.0.0.1:8090`, CLI: `meb-engine`)  
> **Nguyên tắc cốt lõi:** Bán hàng thực chiến (Nhập thùng bán bì, chuyển kho 2 pha, công nợ gối đầu, vật thể động không dùng code). Tuyệt đối không làm giao diện giả lập chắp vá!

---

## PHẦN 1: BẢN ĐỒ TOÀN BỘ 8 MODULE TÍNH NĂNG & RÀNG BUỘC BẤT BIẾN

### 🏢 MODULE 1: CÔ LẬP CHI NHÁNH & PHÂN QUYỀN VAI TRÒ (BRANCH SCOPING & RBAC)
* **Ý nghĩa:** Một hệ thống duy nhất phục vụ nhiều chi nhánh (Kho tổng, Chi nhánh 1, Chi nhánh 2...).
* **Phân quyền vai trò:**
  1. `SUPER_ADMIN (Chủ hệ thống)`: Xem toàn cảnh mọi chi nhánh, doanh số tổng hợp, tạo/xóa chi nhánh, bật/tắt các ô chức năng, thiết lập cấu hình vật thể.
  2. `BRANCH_MANAGER (Quản lý chi nhánh)`: Quản lý xuất/nhập/tồn tại chi nhánh được giao, duyệt đơn nợ trong hạn mức, lập phiếu chuyển hàng.
  3. `CASHIER_SALES (Thu ngân / Bán hàng)`: Thao tác trên ô Bán hàng (POS), xem giá bán sỉ/lẻ, không thấy giá vốn/lợi nhuận gộp.
  4. `WAREHOUSE_KEEPER (Thủ kho)`: Thao tác trên ô Nhập hàng, Kiểm kho, Xác nhận nhận hàng chuyển từ chi nhánh khác, ghi nhận rách bao/hao hụt.
* **Ràng buộc bất biến (Invariants):**
  - **INV-01 (Cô lập dữ liệu):** Mọi câu truy vấn dữ liệu từ nhân viên chi nhánh A bắt buộc phải lọc ngầm `branch_code = 'CN_A'`. Nhân viên tuyệt đối không thể đọc hay sửa dữ liệu của chi nhánh khác kể cả khi đoán được ID.

---

### 📦 MODULE 2: ĐỘNG CƠ "TỰ TẠO VẬT THỂ" KHÔNG CẦN CODE (DYNAMIC ENTITY BUILDER)
* **Ý nghĩa:** Khi chủ muốn quản lý một mặt hàng hoặc quy cách mới (Ví dụ: Thùng sơn 20L, Bao xi măng 50kg, Cuộn màng PE, Xe bồn dầu), chủ chỉ cần bấm nút cấu hình trên màn hình Admin mà không phải nhờ thợ code lại database.
* **Cấu trúc vật thể:**
  - `Tên vật thể` & `Mã định danh duy nhất`.
  - `Ngành hàng / Phân loại` (Sơn, VLXD, Hóa chất, Tạp hóa, Phụ tùng...).
  - `Đơn vị gốc (Base UoM)`: Thùng, Bao, Can, Cuộn, Chiếc, Tấn...
  - `Thuộc tính mở rộng (Dynamic Attributes JSON)`: Tự thêm các trường (Hạn dùng, Nhiệt độ bảo quản, Khối lượng riêng, Số lô) bằng giao diện kéo thả/chọn loại.
* **Ràng buộc bất biến:**
  - **INV-02:** Mã vật thể là duy nhất trên toàn hệ thống.
  - **INV-03:** Không cho phép xóa vật thể nếu vật thể đó đã có lịch sử phát sinh giao dịch nhập/xuất/tồn kho.

---

### 🔄 MODULE 3: ĐA ĐƠN VỊ TÍNH & QUY ĐỔI ĐÓNG GÓI (MULTI-UOM: NHẬP THÙNG - BÁN BÌ)
* **Ý nghĩa:** Hàng hóa mua về đóng trong kiện/thùng lớn để tiết kiệm chi phí vận chuyển, nhưng khi bán ra có khách mua cả thùng, có khách chỉ mua vài bao bì nhỏ.
* **Cơ chế hoạt động:**
  - Thiết lập tỷ lệ: $1 \text{ Đơn vị cha (Thùng)} = N \text{ Đơn vị con (Bì/Gói/Lon/Kg)}$.
* **Ràng buộc bất biến:**
  - **INV-04 (Cơ chế Tự Động Rã Thùng):** Khi tạo đơn bán theo Bì:
    * *Trường hợp A:* Tồn kho Bì lẻ $\ge$ Số lượng bán $\rightarrow$ Trừ trực tiếp vào tồn kho Bì lẻ.
    * *Trường hợp B:* Tồn kho Bì lẻ < Số lượng bán:
      1. Hệ thống kiểm tra tồn kho Thùng. Nếu tồn kho Thùng $\ge 1 \rightarrow$ Tự động sinh giao dịch ngầm `RÃ 1 THÙNG` thành $N$ Bì lẻ.
      2. Tồn kho Thùng giảm 1; tồn kho Bì lẻ tăng $N$; sau đó thực hiện trừ số Bì bán cho khách.
    * *Trường hợp C:* Cả Thùng và Bì lẻ cộng lại không đủ $\rightarrow$ **CHẶN XUẤT ĐƠN**, báo lỗi thiếu hàng ngay lập tức.
  - **INV-05 (Bảo lưu vỏ / Bao bì thu hồi):** Ghi nhận số lượng vỏ thùng/vỏ bình cần thu hồi từ khách (nếu có quy định cọc vỏ).

---

### 🚚 MODULE 4: ĐIỀU CHUYỂN LIÊN CHI NHÁNH HAI PHA (TWO-PHASE INTER-BRANCH TRANSFER)
* **Ý nghĩa:** Chuyển hàng từ Kho Tổng về Chi nhánh hoặc chuyển hỗ trợ giữa 2 cửa hàng. Hàng không thể "biến mất ở kho A và lập tức xuất hiện ở kho B trong 1 giây".
* **Quy trình 2 Pha chặt chẽ:**
  - **Pha 1: Xuất kho chuyển đi (Dispatch):**
    * Kho A lập phiếu xuất chuyển đi (Số lượng, Đơn vị Thùng/Bì, Người lái xe, Biển số xe).
    * **Ràng buộc INV-06:** Kho A bị trừ tồn kho ngay lập tức. Số hàng này chuyển sang trạng thái trung chuyển ảo `DANG_DI_DUONG`. Kho B **CHƯA ĐƯỢC CỘNG TỒN KHO**.
  - **Pha 2: Kiểm đếm & Nghiệm thu nhận hàng (Receive & Reconciliation):**
    * Khi xe tới Kho B, thủ kho B mở ô "Hàng Đang Về" kiểm đếm thực tế:
      * *Tình huống 1 (Đủ 100%):* Bấm `[ĐÃ NHẬN ĐỦ]` $\rightarrow$ Tồn kho B được cộng, phiếu chuyển chuyển trạng thái `HOAN_TAT`.
      * *Tình huống 2 (Thiếu / Vỡ / Rách bao):* Bấm `[NHẬN CÓ HAO HỤT]`. Thủ kho B nhập số thực nhận (cộng vào kho B), số thiếu/hỏng tự động hạch toán vào tài khoản `Hao hụt vận chuyển / Chờ tài xế bồi hoàn`.

---

### 🛒 MODULE 5: BÁN HÀNG & ĐỔI TRẢ (SALES POS & RMA RETURNS)
* **Ý nghĩa:** Xử lý bán lẻ, bán sỉ và nhận lại hàng khách trả.
* **Cơ chế hoạt động:**
  - Cho phép chọn bán nguyên Thùng (áp giá sỉ) hoặc bán Bì lẻ (áp giá lẻ).
  - Khách thanh toán: Tiền mặt, Chuyển khoản hoặc Ghi nợ (kích hoạt Module 6).
* **Ràng buộc bất biến:**
  - **INV-07 (Trả hàng cấn trừ):** Khi khách trả lại hàng (do mua thừa hoặc hàng lỗi):
    * Lập Phiếu trả hàng: Nhập số lượng Thùng/Bì trả lại.
    * Phân loại: Hàng nguyên vẹn $\rightarrow$ Nhập lại kho bán; Hàng lỗi NSX $\rightarrow$ Chuyển vào kho chờ đổi nhà máy.
    * Giá trị tiền trả hàng: Tự động **cấn trừ trực tiếp vào sổ nợ của khách** (nếu khách đang nợ), hoặc hoàn tiền mặt nếu khách đã thanh toán hết.

---

### 💳 MODULE 6: QUẢN TRỊ CÔNG NỢ 2 CHIỀU & HẠN MỨC TÍN DỤNG (CREDIT TERMS & LIMITS)
* **Ý nghĩa:** Quản lý nợ gối đầu của khách hàng và nợ tiền hàng nhà cung cấp.
* **Công thức số dư nợ:**
  $$\text{Dư nợ hiện tại} = \text{Nợ cũ} + \text{Đơn mua mới} - \text{Đã thanh toán} - \text{Hàng trả lại cấn trừ}$$
* **Ràng buộc bất biến:**
  - **INV-08 (Khóa nợ vượt trần - Credit Limit Invariant):** Mỗi khách hàng có một `credit_limit` (Ví dụ: 50.000.000đ). Nếu đơn hàng mới làm tổng nợ $> 50.000.000đ \rightarrow$ Nút [Xuất Đơn Bán Nợ] bị **KHÓA ĐỎ**. Chỉ Quản lý chi nhánh hoặc Chủ có mật mã duyệt ngoại lệ mới được xuất.
  - **INV-09 (Khóa nợ quá hạn - Aging Debt Invariant):** Nếu khách có khoản nợ quá hạn $N$ ngày (ví dụ 30 ngày) chưa thanh toán $\rightarrow$ Chuyển trạng thái khách thành `CANH_BAO` hoặc `KHOA_XUAT_DON`.

---

### 🛡️ MODULE 7: THẺ KHO, BẢO QUẢN & KIỂM KÊ (STOCK AUDIT & LEDGER)
* **Ý nghĩa:** Minh bạch mọi dòng chảy của hàng hóa, không bao giờ để thất thoát không rõ lý do.
* **Ràng buộc bất biến:**
  - **INV-10 (Thẻ kho bất biến):** Không bao giờ được phép sửa đè số tồn kho trực tiếp! Mọi thay đổi tồn kho bắt buộc phải sinh ra một dòng nhật ký (Log): Ai làm, ngày giờ nào, từ nghiệp vụ gì (Nhập hàng, Bán hàng, Rã thùng, Chuyển kho, Kiểm kê điều chỉnh).

---

### 📱 MODULE 8: GIAO DIỆN PHÂN MẢNH THEO "CÁC Ô CHỨC NĂNG" (MODULAR BENTO GRID TILES)
* **Ý nghĩa:** Giao diện cho nhân viên chi nhánh tối giản, trực quan, không dùng menu đa cấp rườm rà.
* **Các ô chức năng chuẩn trên màn hình App Chi Nhánh:**
  - `[Ô 1: Bán Hàng & POS]` (Tìm kiếm nhanh, chọn thùng/bì, in hóa đơn/phiếu xuất)
  - `[Ô 2: Nhập Hàng Mới]` (Nhập từ nhà cung cấp, kiểm tra đơn giá và số lượng)
  - `[Ô 3: Hàng Đang Về Chờ Nhận]` (Danh sách xe đang chở hàng từ kho khác đến)
  - `[Ô 4: Chuyển Hàng Đi Chi Nhánh Khác]` (Lập phiếu xuất chuyển kho)
  - `[Ô 5: Khách Hàng & Sổ Nợ]` (Xem dư nợ, hạn mức, thu tiền nợ)
  - `[Ô 6: Kiểm Kê & Báo Cáo Ca]` (Chốt tiền mặt cuối ngày, kiểm đếm tồn thực tế)
* **Khả năng Desktop App:** Hỗ trợ cài đặt thành App chạy độc lập trên màn hình máy tính chỉ bằng 1 cú click (PWA Install).

---

## PHẦN 2: LỘ TRÌNH CHIA NHỎ THÀNH 5 GIAI ĐOẠN ĐỘC LẬP (STEP-BY-STEP DECOMPOSITION)

Để bất kỳ AI hay kỹ sư nào cũng có thể lập trình chuẩn xác mà **không bị quá tải, không bị lỗi dây chuyền và kiểm thử được 100% từng bước**:

```text
[GIAI ĐOẠN 1] ──► [GIAI ĐOẠN 2] ──► [GIAI ĐOẠN 3] ──► [GIAI ĐOẠN 4] ──► [GIAI ĐOẠN 5]
  (Core API &      (Đa đơn vị &      (Chuyển kho       (Sổ công nợ       (Màn hình Ô Bento
   Entity Studio)    Rã thùng/bì)      2 pha & Hao hụt)  & Hạn mức)        & Desktop App)
```

### 🔹 GIAI ĐOẠN 1: Hoàn thiện Core API & Bộ Tạo Vật Thể Động (Engine Foundation)
* **Mục tiêu:** Kiểm tra và hoàn thiện toàn bộ API của PocketBase Engine cho các bảng `branches`, `custom_entities`, `uom_conversions`.
* **Tiêu chí nghiệm thu:**
  - Bấm nút tạo chi nhánh mới $\rightarrow$ API phản hồi 200, dữ liệu lưu chuẩn.
  - Bấm nút tạo vật thể mới (thêm trường động JSON) $\rightarrow$ Tự lưu schema mà không cần sửa code.

### 🔹 GIAI ĐOẠN 2: Logic Tự Động Rã Thùng & Xuất/Nhập Tồn Kho (UoM Ledger Engine)
* **Mục tiêu:** Viết hàm nghiệp vụ kiểm tra tồn kho và kích hoạt rã thùng tự động khi bán bì lẻ.
* **Tiêu chí nghiệm thu:**
  - Tạo test case: Kho có 1 Thùng (24 Bì), bán 5 Bì $\rightarrow$ Tồn kho còn 0 Thùng và 19 Bì lẻ.
  - Test case: Bán vượt quá tồn kho $\rightarrow$ Báo lỗi chặn đơn ngay lập tức.

### 🔹 GIAI ĐOẠN 3: Nghiệp Vụ Điều Chuyển Kho 2 Pha (Transit & Reconciliation)
* **Mục tiêu:** Xử lý luồng chuyển kho: Kho gửi xuất hàng $\rightarrow$ Hàng đi đường $\rightarrow$ Kho nhận kiểm đếm và xác nhận.
* **Tiêu chí nghiệm thu:**
  - Khi kho A bấm gửi: Kho A trừ ngay, Kho B chưa cộng.
  - Khi kho B bấm xác nhận có hao hụt: Kho B cộng đúng số thực nhận, số hao hụt được ghi nhận vào bảng riêng.

### 🔹 GIAI ĐOẠN 4: Kiểm Soát Công Nợ 2 Chiều & Ràng Buộc Hạn Mức (Credit Guard)
* **Mục tiêu:** Xây dựng logic chặn bán nợ khi vượt hạn mức hoặc quá hạn thanh toán.
* **Tiêu chí nghiệm thu:**
  - Khách có hạn mức 50tr, nợ hiện tại 45tr, đơn mới 10tr $\rightarrow$ Hệ thống khóa nút thanh toán nợ, hiển thị cảnh báo đỏ vượt hạn mức.
  - Khách trả hàng 5tr $\rightarrow$ Sổ nợ tự động giảm xuống 40tr.

### 🔹 GIAI ĐOẠN 5: Đóng Gói Giao Diện Ô Chức Năng (Bento Grid) & Desktop App
* **Mục tiêu:** Dựng giao diện Web responsive chia thành 6 Ô chức năng lớn, kết nối trực tiếp với PocketBase API, đóng gói thành Desktop App có icon màn hình.
* **Tiêu chí nghiệm thu:**
  - Cài đặt App lên màn hình Desktop máy tính, mở lên toàn màn hình không vướng trình duyệt.
  - Thao tác nhanh: Chọn ô Bán hàng $\rightarrow$ Chọn sản phẩm $\rightarrow$ In phiếu trong 3 giây.
