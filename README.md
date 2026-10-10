# 🏬 MEB Multi-Branch Platform & No-Code Dynamic Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-Render_Cloud-success?style=for-the-badge&logo=render)](https://meb-saas-platform.onrender.com)
[![Database](https://img.shields.io/badge/Database-Supabase_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Frontend](https://img.shields.io/badge/Frontend-React_19_PWA-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Backend](https://img.shields.io/badge/Backend-Express_5_Node-339933?style=for-the-badge&logo=node.js)](https://expressjs.com)

**MEB Platform** là nền tảng **Quản trị Bán hàng Đa Chi Nhánh & Sinh Nghiệp Vụ Tự Động (No-Code Dynamic Platform)** được thiết kế chuẩn cấp thương mại (Commercial Grade A+). Hệ thống giải quyết trọn vẹn bài toán vận hành chuỗi bán lẻ, bán buôn, kho vận đa đơn vị và công nợ hai chiều.

---

## 🌐 Trực Tuyến Toàn Cầu
- **Ứng dụng Web chính thức (Live 24/7):** 👉 **[https://meb-saas-platform.onrender.com](https://meb-saas-platform.onrender.com)**
- **Toàn bộ link kiểm thử & API:** Xem chi tiết tại [DEPLOYMENT_LINKS.md](./DEPLOYMENT_LINKS.md).

---

## ✨ Điểm Nhấn Kiến Trúc & Tính Năng

1. **Giao Diện Bento Grid Đa Nhiệm & PWA Desktop:**
   - 6 ô chức năng độc lập: Bán hàng POS, Sổ Quỹ Tiền Mặt, Sổ Nợ Khách Hàng, Nhập Hàng NCC, Điều Chuyển Kho 2 Pha, Kiểm Kê Định Kỳ.
   - Hỗ trợ Progressive Web App (PWA): Cài đặt trực tiếp thành Desktop App hoặc App điện thoại chạy không cần thanh URL.

2. **10 Ràng Buộc Nghiệp Vụ Bất Biến (INV-01 đến INV-10):**
   - **INV-04 (Tự động rã đơn vị):** Nhập thùng bán bì, tự động quy đổi và trừ thẻ kho theo tỉ lệ.
   - **INV-06 (Điều chuyển 2 pha):** Trạng thái trung chuyển (In-Transit) kèm biên bản phân định trách nhiệm hao hụt.
   - **INV-07 (Đổi trả hàng & cấn trừ):** Trả hàng tự động hoàn tiền hoặc cấn trừ trực tiếp vào sổ nợ.
   - **INV-08 (Khóa nợ hạn mức):** Tự động chặn xuất đơn khi khách hàng vượt trần tín dụng.
   - **INV-10 (Thẻ kho bất biến):** Mọi xuất nhập đều qua bút toán bất biến, cân bằng tự động qua phiếu kiểm kê.

3. **No-Code Dynamic Studio:**
   - Chủ doanh nghiệp có thể tự tạo thêm bảng dữ liệu động, thêm trường tùy biến và quy tắc workflow tự động mà không cần can thiệp mã nguồn.

---

## 🛠️ Hướng Dẫn Chạy Cục Bộ

### 1. Cài đặt thư viện:
```bash
npm install
npm --prefix client install
```

### 2. Khởi chạy phát triển:
```bash
./start.sh
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

### 3. Kiểm thử tự động:
```bash
npm test
```
*(Chạy trọn vẹn 21 bộ test kiểm thử liên hoàn từ tầng CSDL, API Gateway đến giao diện Client).*

---

## 📄 Bản Quyền & Giấy Phép
Dự án được xây dựng và phát triển bởi **MEB Core Architecture Team**.
