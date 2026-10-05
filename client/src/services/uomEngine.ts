/**
 * MEB UOM LEDGER ENGINE (ĐỘNG CƠ RÃ THÙNG TỰ ĐỘNG - INV-04 & INV-10)
 * Đóng vai trò là "Nhân viên kho ảo" hoạt động ngầm:
 * 1. Tự động kiểm tra tồn kho đa tầng
 * 2. Tự động kích hoạt rã N thùng sang đơn vị lẻ khi thiếu
 * 3. Chốt chặn kho âm (Fail-safe Invariant)
 * 4. Ghi nhận nhật ký kiểm toán bất biến (Stock Audit Log)
 * 5. Khóa tương tranh đồng thời (Race Condition Mutex Lock)
 */

import { pbApi } from './pocketbase';
import type { StockAuditLogRecord } from '../types';

export interface SaleExecutionResult {
  success: boolean;
  message: string;
  entityCode: string;
  branchCode: string;
  unpackedBoxes: number;
  baseStockAfter: number;
  subStockAfter: number;
  auditLog?: StockAuditLogRecord;
}

// MUTEX LOCK ĐỒNG THỜI THEO CHI NHÁNH & MÃ VẬT THỂ (CHỐNG RACE CONDITION)
const entityLocks: Map<string, Promise<void>> = new Map();

async function acquireLock(lockKey: string): Promise<() => void> {
  while (entityLocks.has(lockKey)) {
    try {
      await entityLocks.get(lockKey);
    } catch {
      // Ignore errors from previous holder
    }
  }

  let releaseLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  entityLocks.set(lockKey, lockPromise);

  return () => {
    entityLocks.delete(lockKey);
    releaseLock();
  };
}

export const uomEngine = {
  /**
   * Xử lý xuất bán 1 mặt hàng kèm tự động rã thùng nếu cần
   * @param branchCode Mã chi nhánh (VD: CN_Q1)
   * @param entityCode Mã sản phẩm (VD: SON_CT_01)
   * @param unitType Loại đơn vị bán: 'BASE' (nguyên thùng) | 'SUB' (bì/lon lẻ)
   * @param quantity Số lượng bán ra
   * @param staffName Tên nhân viên thu ngân
   * @param orderRef Mã đơn hàng đối soát
   */
  async executeSaleDeduction(
    branchCode: string,
    entityCode: string,
    unitType: 'BASE' | 'SUB',
    quantity: number,
    staffName: string = 'Thu Ngân POS',
    orderRef: string = `HD-${Date.now().toString().slice(-6)}`
  ): Promise<SaleExecutionResult> {
    if (quantity <= 0) {
      throw new Error('Số lượng bán phải lớn hơn 0');
    }

    const lockKey = `${branchCode}:${entityCode}`;
    const releaseLock = await acquireLock(lockKey);

    try {
      // 1. TẢI DỮ LIỆU ĐỐI TƯỢNG VÀ QUY ĐỔI TỪ POCKETBASE
      const [entities, conversions, inventoryList] = await Promise.all([
        pbApi.getCustomEntities(),
        pbApi.getUomConversions(entityCode),
        pbApi.getInventory(branchCode)
      ]);

      const entity = entities.find(e => e.code === entityCode);
      if (!entity) {
        throw new Error(`Không tìm thấy vật thể hàng hóa với mã [${entityCode}]`);
      }

      const conversion = conversions.find(c => c.entity_code === entityCode);
      const baseUom = entity.base_uom; // VD: Thùng
      const subUom = conversion ? conversion.to_uom : 'Bì'; // VD: Bì
      const multiplier = conversion ? conversion.multiplier : 1; // VD: 24

      // 2. TÌM BẢN GHI TỒN KHO HIỆN TẠI (BASE & SUB)
      let baseInv = inventoryList.find(i => i.entity_code === entityCode && i.uom === baseUom);
      let subInv = inventoryList.find(i => i.entity_code === entityCode && i.uom === subUom);

      let currentBaseQty = baseInv ? baseInv.quantity : 0;
      let currentSubQty = subInv ? subInv.quantity : 0;

      // =====================================================================
      // TRƯỜNG HỢP 1: KHÁCH MUA NGUYÊN THÙNG (BASE UNIT)
      // =====================================================================
      if (unitType === 'BASE') {
        if (currentBaseQty < quantity) {
          throw new Error(
            `KHO KHÔNG ĐỦ HÀNG: Cần xuất ${quantity} ${baseUom} nhưng kho [${branchCode}] chỉ còn ${currentBaseQty} ${baseUom}!`
          );
        }

        const newBaseQty = currentBaseQty - quantity;

        // Cập nhật PocketBase
        if (baseInv) {
          await pbApi.updateInventoryItem(baseInv.id, newBaseQty);
        } else {
          baseInv = await pbApi.createInventoryItem({
            branch_code: branchCode,
            entity_code: entityCode,
            uom: baseUom,
            quantity: newBaseQty
          });
        }

        // Ghi Audit Log
        const log = await pbApi.createAuditLog({
          branch_code: branchCode,
          entity_code: entityCode,
          action_type: 'XUAT_BAN_SI',
          change_summary: `Xuất bán nguyên kiện: -${quantity} ${baseUom}. Tồn kho còn ${newBaseQty} ${baseUom}.`,
          qty_base_change: -quantity,
          qty_sub_change: 0,
          balance_base_after: newBaseQty,
          balance_sub_after: currentSubQty,
          order_ref: orderRef,
          staff_name: staffName
        });

        return {
          success: true,
          message: `Xuất bán ${quantity} ${baseUom} thành công.`,
          entityCode,
          branchCode,
          unpackedBoxes: 0,
          baseStockAfter: newBaseQty,
          subStockAfter: currentSubQty,
          auditLog: log
        };
      }

      // =====================================================================
      // TRƯỜNG HỢP 2: KHÁCH MUA ĐƠN VỊ LẺ (SUB UNIT - BÌ / LON / KG)
      // =====================================================================
      // Tình huống 2A: Tồn lẻ đủ phục vụ đơn hàng (Không cần rã thùng)
      if (currentSubQty >= quantity) {
        const newSubQty = currentSubQty - quantity;

        if (subInv) {
          await pbApi.updateInventoryItem(subInv.id, newSubQty);
        } else {
          subInv = await pbApi.createInventoryItem({
            branch_code: branchCode,
            entity_code: entityCode,
            uom: subUom,
            quantity: newSubQty
          });
        }

        const log = await pbApi.createAuditLog({
          branch_code: branchCode,
          entity_code: entityCode,
          action_type: 'XUAT_BAN_LE',
          change_summary: `Xuất bán lẻ: -${quantity} ${subUom}. Tồn lẻ còn ${newSubQty} ${subUom}.`,
          qty_base_change: 0,
          qty_sub_change: -quantity,
          balance_base_after: currentBaseQty,
          balance_sub_after: newSubQty,
          order_ref: orderRef,
          staff_name: staffName
        });

        return {
          success: true,
          message: `Xuất bán ${quantity} ${subUom} thành công (không cần rã thùng).`,
          entityCode,
          branchCode,
          unpackedBoxes: 0,
          baseStockAfter: currentBaseQty,
          subStockAfter: newSubQty,
          auditLog: log
        };
      }

      // Tình huống 2B: Tồn lẻ thiếu -> KÍCH HOẠT ĐỘNG CƠ TỰ ĐỘNG RÃ THÙNG (INV-04)
      const shortage = quantity - currentSubQty;
      const boxesNeeded = Math.ceil(shortage / multiplier);
      const totalAvailableSub = currentSubQty + (currentBaseQty * multiplier);

      // CHỐT CHẶN AN TOÀN (FAIL-SAFE): Kiểm tra tổng tồn kho
      if (totalAvailableSub < quantity || currentBaseQty < boxesNeeded) {
        throw new Error(
          `CHẶN ĐƠN HÀNG THIẾU KHO: Cần xuất ${quantity} ${subUom} (thiếu ${shortage} ${subUom}, cần rã ${boxesNeeded} ${baseUom}). ` +
          `Kho hiện chỉ còn ${currentBaseQty} ${baseUom} và ${currentSubQty} ${subUom} (tổng tồn chỉ có ${totalAvailableSub} ${subUom}). Giao dịch bị hủy!`
        );
      }

      // THỰC HIỆN RÃ THÙNG TOÁN HỌC:
      // 1. Trừ số thùng cần rã
      const newBaseQty = currentBaseQty - boxesNeeded;
      // 2. Lượng lẻ mới = Tồn lẻ cũ + (Số thùng rã * Tỷ lệ quy đổi) - Lượng bán
      const unpackedSubUnits = boxesNeeded * multiplier;
      const newSubQty = currentSubQty + unpackedSubUnits - quantity;

      // CẬP NHẬT TỒN KHO THÙNG TRÊN POCKETBASE
      if (baseInv) {
        await pbApi.updateInventoryItem(baseInv.id, newBaseQty);
      } else {
        baseInv = await pbApi.createInventoryItem({
          branch_code: branchCode,
          entity_code: entityCode,
          uom: baseUom,
          quantity: newBaseQty
        });
      }

      // CẬP NHẬT TỒN KHO LẺ TRÊN POCKETBASE
      if (subInv) {
        await pbApi.updateInventoryItem(subInv.id, newSubQty);
      } else {
        subInv = await pbApi.createInventoryItem({
          branch_code: branchCode,
          entity_code: entityCode,
          uom: subUom,
          quantity: newSubQty
        });
      }

      // 3. GHI AUDIT LOG BẤT BIẾN (INV-10) LƯU VẾT THAO TÁC RÃ THÙNG
      const log = await pbApi.createAuditLog({
        branch_code: branchCode,
        entity_code: entityCode,
        action_type: 'RA_THUNG_TU_DONG',
        change_summary: `[INV-04 AUTO-UNPACK] Tự động rã ${boxesNeeded} ${baseUom} (+${unpackedSubUnits} ${subUom}) để phục vụ xuất bán ${quantity} ${subUom}. Tồn kho sau rã & xuất: ${newBaseQty} ${baseUom}, ${newSubQty} ${subUom}.`,
        qty_base_change: -boxesNeeded,
        qty_sub_change: unpackedSubUnits - quantity,
        balance_base_after: newBaseQty,
        balance_sub_after: newSubQty,
        order_ref: orderRef,
        staff_name: staffName
      });

      return {
        success: true,
        message: `Đã tự động rã ${boxesNeeded} ${baseUom} thành ${unpackedSubUnits} ${subUom} và xuất bán thành công ${quantity} ${subUom}.`,
        entityCode,
        branchCode,
        unpackedBoxes: boxesNeeded,
        baseStockAfter: newBaseQty,
        subStockAfter: newSubQty,
        auditLog: log
      };
    } finally {
      releaseLock();
    }
  }
};
