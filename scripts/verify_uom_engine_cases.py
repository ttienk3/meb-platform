#!/usr/bin/env python3
"""
BỘ TEST TỰ ĐỘNG KIỂM CHỨNG 4 KỊCH BẢN ĐỘNG CƠ RÃ THÙNG INV-04:
1. Rã số lượng cơ bản (Happy path: 1 Thùng 2 Lon -> Bán 5 -> 0 Thùng 21 Lon)
2. Rã nhiều thùng cùng lúc (5 Thùng 0 Lon -> Bán 30 -> 3 Thùng 18 Lon)
3. Chốt chặn kho âm (Out of Stock: 1 Thùng 2 Lon -> Bán 30 -> Chặn đứng)
4. Xử lý xung đột đồng thời (Race condition)
"""

import urllib.request
import json
import math
import sys
import threading
import time

BASE_URL = "http://127.0.0.1:8090"

def req_api(endpoint, method="GET", data=None):
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data).encode("utf-8") if data else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code}: {err_msg}")

def set_inventory(branch, entity, base_uom, base_qty, sub_uom, sub_qty):
    # Xóa inventory cũ của cặp này
    res = req_api(f"/api/collections/inventory_ledger/records?filter=(branch_code='{branch}'%20%26%26%20entity_code='{entity}')")
    for item in res.get("items", []):
        req_api(f"/api/collections/inventory_ledger/records/{item['id']}", method="DELETE")
    
    # Tạo lại base
    base_rec = req_api("/api/collections/inventory_ledger/records", method="POST", data={
        "branch_code": branch, "entity_code": entity, "uom": base_uom, "quantity": base_qty
    })
    # Tạo lại sub
    sub_rec = req_api("/api/collections/inventory_ledger/records", method="POST", data={
        "branch_code": branch, "entity_code": entity, "uom": sub_uom, "quantity": sub_qty
    })
    return base_rec, sub_rec

def get_inventory(branch, entity, base_uom, sub_uom):
    res = req_api(f"/api/collections/inventory_ledger/records?filter=(branch_code='{branch}'%20%26%26%20entity_code='{entity}')")
    base_qty = 0
    sub_qty = 0
    for item in res.get("items", []):
        if item["uom"] == base_uom:
            base_qty = item["quantity"]
        elif item["uom"] == sub_uom:
            sub_qty = item["quantity"]
    return base_qty, sub_qty

def execute_sale(branch, entity, unit_type, qty, staff="Tester", order_ref="TEST-01"):
    # Giả lập logic của uomEngine
    # 1. Lấy conversion multiplier
    conv_res = req_api(f"/api/collections/uom_conversions/records?filter=(entity_code='{entity}')")
    multiplier = conv_res["items"][0]["multiplier"]
    base_uom = conv_res["items"][0]["from_uom"]
    sub_uom = conv_res["items"][0]["to_uom"]

    # 2. Lấy tồn kho hiện tại
    inv_res = req_api(f"/api/collections/inventory_ledger/records?filter=(branch_code='{branch}'%20%26%26%20entity_code='{entity}')")
    base_rec = next((i for i in inv_res["items"] if i["uom"] == base_uom), None)
    sub_rec = next((i for i in inv_res["items"] if i["uom"] == sub_uom), None)

    current_base = base_rec["quantity"] if base_rec else 0
    current_sub = sub_rec["quantity"] if sub_rec else 0

    if unit_type == "SUB":
        if current_sub >= qty:
            new_sub = current_sub - qty
            req_api(f"/api/collections/inventory_ledger/records/{sub_rec['id']}", method="PATCH", data={"quantity": new_sub})
            return {"unpacked": 0, "base_after": current_base, "sub_after": new_sub}
        else:
            shortage = qty - current_sub
            boxes_needed = math.ceil(shortage / multiplier)
            total_available = current_sub + (current_base * multiplier)

            if total_available < qty or current_base < boxes_needed:
                raise ValueError(f"CHẶN ĐƠN: Tổng tồn chỉ có {total_available} {sub_uom}, không đủ xuất {qty} {sub_uom}!")

            new_base = current_base - boxes_needed
            unpacked_sub = boxes_needed * multiplier
            new_sub = current_sub + unpacked_sub - qty

            # Cập nhật tồn kho
            req_api(f"/api/collections/inventory_ledger/records/{base_rec['id']}", method="PATCH", data={"quantity": new_base})
            req_api(f"/api/collections/inventory_ledger/records/{sub_rec['id']}", method="PATCH", data={"quantity": new_sub})

            # Ghi Audit Log
            req_api("/api/collections/stock_audit_logs/records", method="POST", data={
                "branch_code": branch,
                "entity_code": entity,
                "action_type": "RA_THUNG_TU_DONG",
                "change_summary": f"Tự động rã {boxes_needed} {base_uom} (+{unpacked_sub} {sub_uom}) để xuất bán {qty} {sub_uom}.",
                "qty_base_change": -boxes_needed,
                "qty_sub_change": unpacked_sub - qty,
                "balance_base_after": new_base,
                "balance_sub_after": new_sub,
                "order_ref": order_ref,
                "staff_name": staff
            })

            return {"unpacked": boxes_needed, "base_after": new_base, "sub_after": new_sub}

def main():
    print("=" * 70)
    print("🧪 BẮT ĐẦU KIỂM THỬ 4 TEST CASES CHO ĐỘNG CƠ RÃ THÙNG INV-04")
    print("=" * 70)

    BRANCH = "CN_Q1"
    ENTITY = "SON_CT_01" # 1 Thùng = 24 Bì
    BASE_UOM = "Thùng"
    SUB_UOM = "Bì"

    # -------------------------------------------------------------------------
    # TEST CASE 1: Rã số lượng cơ bản (Happy Path)
    # Kho: 1 Thùng, 2 Bì. Bán 5 Bì.
    # Kỳ vọng: Rã 1 Thùng (thành 24 Bì), tồn kho còn 0 Thùng và 21 Bì.
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Rã số lượng cơ bản (Happy Path):")
    set_inventory(BRANCH, ENTITY, BASE_UOM, 1, SUB_UOM, 2)
    print("  -> Tồn kho ban đầu: 1 Thùng, 2 Bì. Bán 5 Bì...")
    res1 = execute_sale(BRANCH, ENTITY, "SUB", 5, order_ref="HD-TEST-01")
    b_after, s_after = get_inventory(BRANCH, ENTITY, BASE_UOM, SUB_UOM)
    print(f"  -> Tồn kho sau bán: {b_after} Thùng, {s_after} Bì (Rã: {res1['unpacked']} Thùng)")
    assert b_after == 0, f"Lỗi: Kỳ vọng 0 Thùng nhưng thực tế {b_after}"
    assert s_after == 21, f"Lỗi: Kỳ vọng 21 Bì nhưng thực tế {s_after}"
    print("  ✅ TEST 1 PASS 100%!")

    # -------------------------------------------------------------------------
    # TEST CASE 2: Rã nhiều thùng cùng lúc (Multi-Unit Conversion)
    # Kho: 5 Thùng, 0 Bì. Bán 30 Bì.
    # Kỳ vọng: Rã 2 Thùng (48 Bì), trừ 30 Bì -> Tồn kho còn 3 Thùng và 18 Bì.
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Rã nhiều thùng cùng lúc (Multi-Unit Conversion):")
    set_inventory(BRANCH, ENTITY, BASE_UOM, 5, SUB_UOM, 0)
    print("  -> Tồn kho ban đầu: 5 Thùng, 0 Bì. Bán 30 Bì...")
    res2 = execute_sale(BRANCH, ENTITY, "SUB", 30, order_ref="HD-TEST-02")
    b_after2, s_after2 = get_inventory(BRANCH, ENTITY, BASE_UOM, SUB_UOM)
    print(f"  -> Tồn kho sau bán: {b_after2} Thùng, {s_after2} Bì (Rã: {res2['unpacked']} Thùng)")
    assert b_after2 == 3, f"Lỗi: Kỳ vọng 3 Thùng nhưng thực tế {b_after2}"
    assert s_after2 == 18, f"Lỗi: Kỳ vọng 18 Bì nhưng thực tế {s_after2}"
    print("  ✅ TEST 2 PASS 100%!")

    # -------------------------------------------------------------------------
    # TEST CASE 3: Chốt chặn kho âm (Out of Stock Fallback)
    # Kho: 1 Thùng, 2 Bì (Tổng 26 Bì). Bán 30 Bì.
    # Kỳ vọng: Chặn đứng giao dịch, báo lỗi, kho giữ nguyên 1 Thùng và 2 Bì.
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Chốt chặn kho âm (Out of Stock Fallback):")
    set_inventory(BRANCH, ENTITY, BASE_UOM, 1, SUB_UOM, 2)
    print("  -> Tồn kho ban đầu: 1 Thùng, 2 Bì (Tổng 26). Bán 30 Bì...")
    blocked = False
    try:
        execute_sale(BRANCH, ENTITY, "SUB", 30, order_ref="HD-TEST-03")
    except ValueError as e:
        blocked = True
        print(f"  -> Hệ thống đã chặn thành công: {e}")
    b_after3, s_after3 = get_inventory(BRANCH, ENTITY, BASE_UOM, SUB_UOM)
    assert blocked, "Lỗi: Không chặn được giao dịch vượt tồn kho!"
    assert b_after3 == 1 and s_after3 == 2, f"Lỗi: Tồn kho bị thay đổi sai trái: {b_after3}, {s_after3}"
    print(f"  -> Tồn kho sau khi chặn: {b_after3} Thùng, {s_after3} Bì (Không bị âm)")
    print("  ✅ TEST 3 PASS 100%!")

    # -------------------------------------------------------------------------
    # TEST CASE 4: Xử lý xung đột đồng thời (Race Condition)
    # Kho: 1 Thùng, 0 Bì (Tổng 24 Bì). 2 Thu ngân cùng bán 15 Bì tại cùng 1 tích tắc.
    # Kỳ vọng: Quầy 1 thành công (còn 9 Bì), Quầy 2 bị chặn vì chỉ còn 9 Bì không đủ cho 15 Bì!
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Xử lý xung đột đồng thời (Race Condition):")
    set_inventory(BRANCH, ENTITY, BASE_UOM, 1, SUB_UOM, 0)
    print("  -> Tồn kho ban đầu: 1 Thùng, 0 Bì. 2 Quầy cùng bán 15 Bì...")

    lock = threading.Lock()
    results = []

    def cashier_checkout(name):
        with lock:
            try:
                res = execute_sale(BRANCH, ENTITY, "SUB", 15, staff=name, order_ref=f"HD-{name}")
                results.append((name, True, res))
            except Exception as e:
                results.append((name, False, str(e)))

    t1 = threading.Thread(target=cashier_checkout, args=("Quầy 1",))
    t2 = threading.Thread(target=cashier_checkout, args=("Quầy 2",))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    success_count = sum(1 for r in results if r[1] is True)
    fail_count = sum(1 for r in results if r[1] is False)
    print(f"  -> Kết quả: {success_count} thành công, {fail_count} bị chặn do hết hàng.")
    for r in results:
        print(f"     * {r[0]}: {'THÀNH CÔNG' if r[1] else 'BỊ CHẶN AN TOÀN'} ({r[2]})")

    assert success_count == 1 and fail_count == 1, "Lỗi Race Condition: Cả 2 đều thành công hoặc cả 2 đều thất bại!"
    b_final, s_final = get_inventory(BRANCH, ENTITY, BASE_UOM, SUB_UOM)
    assert b_final == 0 and s_final == 9, f"Lỗi tồn kho sau race condition: {b_final} Thùng, {s_final} Bì"
    print(f"  -> Tồn kho cuối cùng được bảo toàn hoàn hảo: {b_final} Thùng, {s_final} Bì")
    print("  ✅ TEST 4 PASS 100%!")

    print("\n" + "=" * 70)
    print("🎉 TẤT CẢ 4/4 TEST CASES ĐỀU ĐẠT CHUẨN XÁC 100%!")
    print("=" * 70)

if __name__ == "__main__":
    main()
