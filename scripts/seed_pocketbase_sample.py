#!/usr/bin/env python3
"""
Bơm dữ liệu mẫu thực tế vào PocketBase:
- 2 Chi nhánh (Kho Tổng & Chi nhánh Quận 1)
- 1 Vật thể tự định nghĩa: Thùng Sơn Chống Thấm (Đơn vị gốc: Thùng)
- 1 Quy tắc quy đổi: 1 Thùng = 24 Bì
- Tồn kho thực tế
- 1 Phiếu điều chuyển liên chi nhánh đang đi đường
- 1 Hồ sơ công nợ khách hàng
"""
import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8090"
SUPERUSER_EMAIL = "admin@meb.local"
SUPERUSER_PASS = "Admin123456789"

def post_json(endpoint, data, token):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": token
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"[-] Lỗi {e.code} tại {endpoint}: {e.read().decode('utf-8')}")
        return None

def main():
    login_req = urllib.request.Request(
        f"{BASE_URL}/api/collections/_superusers/auth-with-password",
        data=json.dumps({"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASS}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(login_req) as resp:
        token = json.loads(resp.read().decode("utf-8"))["token"]

    print("[+] Đang bơm dữ liệu chi nhánh...")
    post_json("/api/collections/branches/records", {
        "code": "KHO_TONG",
        "name": "Kho Tổng Trung Tâm",
        "address": "Kho A1 KCN Sóng Thần, Bình Dương",
        "phone": "0901234567",
        "is_active": True
    }, token)
    post_json("/api/collections/branches/records", {
        "code": "CN_Q1",
        "name": "Chi Nhánh Showroom Quận 1",
        "address": "123 Nguyễn Thị Minh Khai, Q1, TP.HCM",
        "phone": "0907654321",
        "is_active": True
    }, token)

    print("[+] Đang bơm vật thể tự tạo (Thùng sơn - Bán bì)...")
    post_json("/api/collections/custom_entities/records", {
        "name": "Sơn Chống Thấm Cao Cấp",
        "code": "SON_CT_01",
        "category": "Sơn & Chống thấm",
        "base_uom": "Thùng",
        "description": "Nhập theo thùng carton lớn, bán lẻ theo từng bì nhỏ",
        "dynamic_attributes": {
            "trọng_lượng_kg": 20,
            "màu_sắc": "Xám xi măng",
            "tiêu_chuẩn_bảo_quản": "Tránh ẩm ướt"
        }
    }, token)

    print("[+] Đang bơm quy tắc quy đổi (1 Thùng = 24 Bì)...")
    post_json("/api/collections/uom_conversions/records", {
        "entity_code": "SON_CT_01",
        "from_uom": "Thùng",
        "to_uom": "Bì",
        "multiplier": 24,
        "notes": "1 Thùng rã được đúng 24 Bì nhỏ"
    }, token)

    print("[+] Đang bơm tồn kho theo từng chi nhánh...")
    post_json("/api/collections/inventory_ledger/records", {
        "branch_code": "KHO_TONG",
        "entity_code": "SON_CT_01",
        "uom": "Thùng",
        "quantity": 100,
        "warning_threshold": 10
    }, token)
    post_json("/api/collections/inventory_ledger/records", {
        "branch_code": "CN_Q1",
        "entity_code": "SON_CT_01",
        "uom": "Bì",
        "quantity": 48, # Tương đương 2 Thùng đã rã lẻ
        "warning_threshold": 24
    }, token)

    print("[+] Đang bơm phiếu điều chuyển liên chi nhánh...")
    post_json("/api/collections/branch_transfers/records", {
        "from_branch": "KHO_TONG",
        "to_branch": "CN_Q1",
        "entity_code": "SON_CT_01",
        "quantity": 10,
        "uom": "Thùng",
        "status": "DANG_DI_DUONG",
        "driver_name": "Tài xế Nguyễn Văn A (Xe 59C-123.45)",
        "notes": "Xuất 10 Thùng sáng 05/10, dự kiến chiều đến chi nhánh Q1"
    }, token)

    print("[+] Đang bơm sổ công nợ khách hàng...")
    post_json("/api/collections/customer_debts/records", {
        "branch_code": "CN_Q1",
        "customer_name": "Đại lý Xây Dựng Tuấn Phát",
        "phone": "0988112233",
        "debt_balance": 18500000,
        "credit_limit": 50000000,
        "debt_status": "AN_TOAN"
    }, token)

    print("\n[✔] ĐÃ BƠM TOÀN BỘ DỮ LIỆU NGHIỆP VỤ THỰC TẾ VÀO POCKETBASE ENGINE THÀNH CÔNG!")

if __name__ == "__main__":
    main()
