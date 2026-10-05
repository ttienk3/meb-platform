#!/usr/bin/env python3
"""
Khởi tạo cấu trúc CSDL Đa Chi Nhánh & Vật Thể Động trên PocketBase Engine.
Chạy hoàn toàn trên máy cục bộ, không tốn tài nguyên, tương thích 100% với kiến trúc của meb.
"""
import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8090"
SUPERUSER_EMAIL = "admin@meb.local"
SUPERUSER_PASS = "Admin123456789"

def post_json(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            **({"Authorization": token} if token else {})
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"[-] Lỗi {e.code} tại {endpoint}: {error_body}")
        return None

def main():
    print("[*] Đang đăng nhập Superuser vào PocketBase...")
    auth_res = post_json("/api/collections/_superusers/auth-with-password", {
        "identity": SUPERUSER_EMAIL,
        "password": SUPERUSER_PASS
    })
    if not auth_res or "token" not in auth_res:
        print("[!] Không thể đăng nhập. Kiểm tra PocketBase server!")
        sys.exit(1)
    
    token = auth_res["token"]
    print("[+] Đăng nhập thành công! Bắt đầu khởi tạo các Collection nghiệp vụ...\n")

    # Danh sách các Collections cần tạo
    collections = [
        {
            "name": "branches",
            "type": "base",
            "fields": [
                {"name": "code", "type": "text", "required": True},
                {"name": "name", "type": "text", "required": True},
                {"name": "address", "type": "text"},
                {"name": "phone", "type": "text"},
                {"name": "is_active", "type": "bool"}
            ]
        },
        {
            "name": "custom_entities",
            "type": "base",
            "fields": [
                {"name": "name", "type": "text", "required": True},
                {"name": "code", "type": "text", "required": True},
                {"name": "category", "type": "text"},
                {"name": "base_uom", "type": "text", "required": True}, # Đơn vị gốc (VD: Thùng)
                {"name": "description", "type": "text"},
                {"name": "dynamic_attributes", "type": "json"} # Tự thêm thuộc tính không cần code
            ]
        },
        {
            "name": "uom_conversions",
            "type": "base",
            "fields": [
                {"name": "entity_code", "type": "text", "required": True},
                {"name": "from_uom", "type": "text", "required": True}, # Ví dụ: Thùng
                {"name": "to_uom", "type": "text", "required": True},   # Ví dụ: Bì
                {"name": "multiplier", "type": "number", "required": True}, # 1 Thùng = 24 Bì
                {"name": "notes", "type": "text"}
            ]
        },
        {
            "name": "inventory_ledger",
            "type": "base",
            "fields": [
                {"name": "branch_code", "type": "text", "required": True},
                {"name": "entity_code", "type": "text", "required": True},
                {"name": "uom", "type": "text", "required": True},
                {"name": "quantity", "type": "number", "required": True},
                {"name": "warning_threshold", "type": "number"}
            ]
        },
        {
            "name": "branch_transfers",
            "type": "base",
            "fields": [
                {"name": "from_branch", "type": "text", "required": True},
                {"name": "to_branch", "type": "text", "required": True},
                {"name": "entity_code", "type": "text", "required": True},
                {"name": "quantity", "type": "number", "required": True},
                {"name": "uom", "type": "text", "required": True},
                {"name": "status", "type": "select", "values": ["CHO_XUAT", "DANG_DI_DUONG", "DA_NHAN_DU", "HAO_HUT_LECH"]},
                {"name": "driver_name", "type": "text"},
                {"name": "notes", "type": "text"}
            ]
        },
        {
            "name": "customer_debts",
            "type": "base",
            "fields": [
                {"name": "branch_code", "type": "text", "required": True},
                {"name": "customer_name", "type": "text", "required": True},
                {"name": "phone", "type": "text"},
                {"name": "debt_balance", "type": "number", "required": True}, # Số nợ hiện tại
                {"name": "credit_limit", "type": "number", "required": True}, # Hạn mức nợ tối đa
                {"name": "debt_status", "type": "select", "values": ["AN_TOAN", "CANH_BAO", "KHOA_XUAT_DON"]}
            ]
        }
    ]

    for col in collections:
        res = post_json("/api/collections", col, token=token)
        if res and "id" in res:
            print(f" [✔] Đã tạo thành công Collection: {col['name']}")
        else:
            print(f" [~] Collection {col['name']} đã tồn tại hoặc bỏ qua.")

    print("\n[*] Hoàn tất cấu trúc Core Engine trên PocketBase!")
    print(f"[*] Dashboard quản trị trực quan: {BASE_URL}/_/")
    print(f"[*] Tài khoản: {SUPERUSER_EMAIL} | Mật khẩu: {SUPERUSER_PASS}")

if __name__ == "__main__":
    main()
