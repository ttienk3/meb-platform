/**
 * ============================================================================
 * OFFLINE POS SYNC SERVICE (IndexedDB Native)
 * ============================================================================
 * Quản lý lưu trữ đơn hàng ngoại tuyến khi mất Internet và tự động đồng bộ ngầm
 * khi kết nối mạng phục hồi.
 */

const DB_NAME = 'MEB_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_orders';

export interface OfflineOrderRecord {
  id: string;
  order_code: string;
  payload: any;
  created_at: string;
  sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
  error_message?: string;
}

class OfflineSyncService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private onlineListeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    this.onlineListeners.forEach(listener => listener(isOnline));
  }

  public subscribeNetworkStatus(callback: (isOnline: boolean) => void): () => void {
    this.onlineListeners.push(callback);
    return () => {
      this.onlineListeners = this.onlineListeners.filter(l => l !== callback);
    };
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB không được hỗ trợ trên môi trường này'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('sync_status', 'sync_status', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result as IDBDatabase);
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Lưu đơn hàng vào IndexedDB khi không có mạng
   */
  public async saveOfflineOrder(payload: any): Promise<OfflineOrderRecord> {
    const db = await this.getDB();
    const id = `OFF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderRecord: OfflineOrderRecord = {
      id,
      order_code: payload.order?.order_code || id,
      payload,
      created_at: new Date().toISOString(),
      sync_status: 'PENDING'
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(orderRecord);

      req.onsuccess = () => resolve(orderRecord);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Lấy danh sách các đơn hàng đang chờ đồng bộ
   */
  public async getPendingOrders(): Promise<OfflineOrderRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const orders = (req.result as OfflineOrderRecord[]) || [];
        resolve(orders.filter(o => o.sync_status === 'PENDING'));
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Đánh dấu đơn hàng đã đồng bộ thành công hoặc xóa khỏi hàng đợi
   */
  public async removeOrder(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Tự động đồng bộ các đơn chờ lên server khi có mạng lại
   */
  public async syncPendingOrders(
    checkoutFn: (payload: any) => Promise<any>
  ): Promise<{ syncedCount: number; errors: any[] }> {
    const pendingOrders = await this.getPendingOrders();
    let syncedCount = 0;
    const errors: any[] = [];

    for (const record of pendingOrders) {
      try {
        await checkoutFn(record.payload);
        await this.removeOrder(record.id);
        syncedCount++;
      } catch (err: any) {
        console.error(`🔥 Lỗi đồng bộ đơn offline ${record.id}:`, err);
        errors.push({ id: record.id, error: err.message || 'Lỗi đồng bộ' });
      }
    }

    return { syncedCount, errors };
  }
}

export const offlineSync = new OfflineSyncService();
