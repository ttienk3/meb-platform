# 🌐 DANH BẠ ĐƯỜNG LINK TRIỂN KHAI & HƯỚNG DẪN KIỂM THỬ HỆ THỐNG MEB PLATFORM
> **Hệ thống Quản trị Đa Chi Nhánh & Sinh Nghiệp Vụ Tự Động (No-Code Dynamic Multi-Branch POS Platform)**  
> **Cập nhật lần cuối:** 2026-10-10  
> **Trạng thái:** Toàn bộ dịch vụ đang hoạt động trực tuyến (100% LIVE & HEALTHY)

---

## 🚀 1. ĐƯỜNG LINK ỨNG DỤNG SẢN XUẤT (PRODUCTION 24/7 CLOUD)

Hệ thống Fullstack (React 19 PWA + Express 5 Node.js) chạy 24/7 trên hạ tầng Render Cloud (Cụm máy chủ Singapore, bảo mật SSL):

| Mục đích | Đường dẫn (URL) | Ghi chú |
| :--- | :--- | :--- |
| **Giao diện Web App chính thức** | 👉 **https://meb-saas-platform.onrender.com** | Sử dụng trên trình duyệt máy tính, tablet, điện thoại (PWA) |
| **API Kiểm tra sức khỏe (Health)** | `https://meb-saas-platform.onrender.com/health` | Trả về JSON trạng thái gateway và timestamp |
| **API Cấu hình Runtime Chi nhánh** | `https://meb-saas-platform.onrender.com/api/context/runtime` | Bắt buộc kèm Header `x-branch-id` |
| **API Danh mục Sản phẩm & Tồn kho** | `https://meb-saas-platform.onrender.com/api/pos/products` | Danh mục hàng hóa, đa đơn vị (UoM), tồn kho thực |
| **API Đối tác Khách hàng & Công nợ** | `https://meb-saas-platform.onrender.com/api/pos/partners` | Danh sách khách nợ, hạn mức tín dụng |
| **API Tổng bộ Chuỗi (HQ Command Center)** | `https://meb-saas-platform.onrender.com/api/hq/overview` | Báo cáo doanh thu, tồn kho toàn bộ các chi nhánh |
| **API Schema Builder Động** | `https://meb-saas-platform.onrender.com/api/schema/tables` | Quản trị bảng dữ liệu và trường tùy biến No-Code |

---

## 🗄️ 2. KHO MÃ NGUỒN & QUẢN TRỊ DỊCH VỤ

| Nền tảng | Đường dẫn | Chức năng |
| :--- | :--- | :--- |
| **GitHub Repository** | 👉 [https://github.com/ttienk3/meb-platform](https://github.com/ttienk3/meb-platform) | Lưu trữ mã nguồn phiên bản mới nhất (Nhánh `main`) |
| **Render Dashboard** | 👉 [https://dashboard.render.com](https://dashboard.render.com) | Quản trị máy chủ, CPU, RAM, nhật ký triển khai (Logs) |
| **Render Web Service Trực tiếp** | [https://dashboard.render.com/web/srv-db4vqao473hc739bh1d0](https://dashboard.render.com/web/srv-db4vqao473hc739bh1d0) | Quản lý biến môi trường, domain, restart service |
| **Render Blueprint Instance** | [https://dashboard.render.com/blueprint/exs-db4vpnd9fdbs73b3g6ng](https://dashboard.render.com/blueprint/exs-db4vpnd9fdbs73b3g6ng) | Quản lý đồng bộ theo mã nguồn `render.yaml` |
| **GitHub SSH Keys Quản trị** | [https://github.com/settings/keys](https://github.com/settings/keys) | Khóa SSH `MEB` đang liên kết với máy trạm này |
| **GitHub Apps Cài đặt Render** | [https://github.com/settings/installations/144132524](https://github.com/settings/installations/144132524) | Phân quyền tự động đồng bộ code giữa GitHub & Render |

---

## 💾 3. CƠ SỞ DỮ LIỆU ĐÁM MÂY (SUPABASE CLOUD POSTGRESQL)

Dữ liệu của toàn bộ chi nhánh được lưu trữ tập trung và an toàn trên Supabase Cloud AWS:

- **Supabase Project URL:** `https://eigxzplbupjmnzqwzsur.supabase.co`
- **Dashboard Quản trị CSDL:** [https://supabase.com/dashboard/project/eigxzplbupjmnzqwzsur](https://supabase.com/dashboard/project/eigxzplbupjmnzqwzsur)
- **Host Kết nối PostgreSQL Pooler (IPv4):** `aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
- **Cấu hình chuỗi kết nối:** Lưu trong file bảo mật `.env` (`DATABASE_URL`).

---

## ⚡ 4. ĐƯỜNG DẪN MÔI TRƯỜNG PHÁT TRIỂN CỤC BỘ (LOCAL ENVIRONMENT)

Khi chạy trực tiếp trên máy trạm nội bộ:

- **Máy chủ Fullstack Gateway (Port 4000):** `http://localhost:4000`
- **Giao diện Client Dev Server (Port 5173):** `http://localhost:5173`
- **Hạ tầng PocketBase Core Engine (Port 8090):** `http://127.0.0.1:8090/_/`
  * *Tài khoản Superuser:* `admin@meb.local` | *Mật khẩu:* `Admin123456789`
- **Lệnh khởi chạy nhanh nội bộ:**
  * `./start.sh` : Khởi chạy cùng lúc Backend Gateway + Frontend Client
  * `npm start`  : Khởi chạy máy chủ Fullstack Production Monolith (Port 4000)
  * `npm run web`: Khởi chạy máy chủ + Tự động mở đường hầm Cloudflare Tunnel toàn cầu

---

## 🧪 5. BỘ LỆNH CURL KIỂM THỬ NHANH HỆ THỐNG TRÊN WEB

Bạn có thể copy và chạy các lệnh sau trong Terminal để kiểm tra ngay lập tức:

### 1. Kiểm tra máy chủ có đang phản hồi không (Health Check):
```bash
curl -i https://meb-saas-platform.onrender.com/health
```

### 2. Lấy cấu hình tính năng của Chi Nhánh 1 (CN-Q1):
```bash
curl -s -H "x-branch-id: 01a10c53-0367-7d6e-9a77-48fa6504cc23" \
  https://meb-saas-platform.onrender.com/api/context/runtime
```

### 3. Lấy danh sách sản phẩm và tồn kho thực tế của Chi Nhánh 1:
```bash
curl -s -H "x-branch-id: 01a10c53-0367-7d6e-9a77-48fa6504cc23" \
  https://meb-saas-platform.onrender.com/api/pos/products | jq .
```

### 4. Lấy sổ công nợ khách hàng của Chi Nhánh 1:
```bash
curl -s -H "x-branch-id: 01a10c53-0367-7d6e-9a77-48fa6504cc23" \
  https://meb-saas-platform.onrender.com/api/pos/partners | jq .
```

### 5. Lấy báo cáo chỉ số tổng bộ chuỗi HQ:
```bash
curl -s -H "x-branch-id: 01a10c53-0367-7d6e-9a77-48fa6504cc23" \
  https://meb-saas-platform.onrender.com/api/hq/overview | jq .
```

---

## 🔑 6. THÔNG TIN ĐĂNG NHẬP MẪU KIỂM THỬ

Hệ thống hỗ trợ cơ chế chuyển đổi chi nhánh và người dùng đa vai trò trực tiếp trên giao diện Header (Dropdown Chi nhánh & Persona):

| Vai trò | Chi nhánh mặc định | Mã chi nhánh | Mã ID Chi nhánh |
| :--- | :--- | :--- | :--- |
| **Super Admin / Tổng Giám Đốc** | Trụ sở HQ | `HQ-CENTRAL` | `01a10c53-0367-7d6e-9a77-48fa6504cc21` |
| **Cửa Hàng Trưởng / Quản Lý** | Chi Nhánh Q1 | `CN-Q1` | `01a10c53-0367-7d6e-9a77-48fa6504cc23` |
| **Thu Ngân / Bán Hàng** | Chi Nhánh Q12 | `CN-Q12` | `01a10c53-0367-7d6e-9a77-48fa6504cc24` |
| **Thủ Kho / Vận Tải** | Tổng Kho Miền Nam | `KHO-TONG` | `01a10c53-0367-7d6e-9a77-48fa6504cc22` |
