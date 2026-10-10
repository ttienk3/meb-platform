/**
 * MEB PLATFORM - BRANCH CONTEXT & RUNTIME STORE (BƯỚC 7.1.1)
 * Quản lý trạng thái chi nhánh đang chọn, cấu hình thừa kế thời gian thực
 * và thông báo cho toàn bộ giao diện khi người dùng chuyển chi nhánh.
 */

import { api, type Branch, type RuntimeConfig } from './api';

export type BranchChangeListener = (config: RuntimeConfig, branch: Branch) => void;

class BranchContextStore {
  private currentBranch: Branch | null = null;
  private currentConfig: RuntimeConfig | null = null;
  private branches: Branch[] = [];
  private listeners: Set<BranchChangeListener> = new Set();
  private isInitializing: boolean = false;

  /**
   * Đăng ký hàm lắng nghe khi chi nhánh hoặc cấu hình thay đổi
   */
  public subscribe(listener: BranchChangeListener): () => void {
    this.listeners.add(listener);
    // Nếu đã có cấu hình thì phát ngay cho subscriber mới
    if (this.currentConfig && this.currentBranch) {
      listener(this.currentConfig, this.currentBranch);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Khởi tạo store: Tải danh mục chi nhánh và chọn chi nhánh đầu tiên
   */
  public async initialize(): Promise<{ branch: Branch; config: RuntimeConfig }> {
    if (this.currentBranch && this.currentConfig) {
      return { branch: this.currentBranch, config: this.currentConfig };
    }

    if (this.isInitializing) {
      // Đợi đến khi hoàn thành nếu đang có tiến trình khởi tạo
      while (this.isInitializing) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (this.currentBranch && this.currentConfig) {
        return { branch: this.currentBranch, config: this.currentConfig };
      }
    }

    this.isInitializing = true;
    try {
      const branchesRes = await api.getBranches();
      this.branches = branchesRes.data || [];

      if (this.branches.length === 0) {
        throw new Error('Hệ thống chưa có chi nhánh nào được kích hoạt.');
      }

      const savedBranchId = typeof window !== 'undefined' ? localStorage.getItem('meb_active_branch_id') : null;
      const matchedSaved = savedBranchId ? this.branches.find(b => b.id === savedBranchId) : null;
      const defaultBranch = matchedSaved || this.branches.find(b => b.code === 'CN-Q1') || this.branches[0];

      const result = await this.switchBranch(defaultBranch.id);
      return result;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Chuyển đổi chi nhánh làm việc (Dynamic Branch Switching)
   * 1. Cập nhật branchId cho ApiClient
   * 2. Tải RuntimeConfig của chi nhánh từ backend
   * 3. Phát thông báo tới toàn bộ các component đang đăng ký
   */
  public async switchBranch(branchId: string): Promise<{ branch: Branch; config: RuntimeConfig }> {
    const branch = this.branches.find(b => b.id === branchId);
    if (!branch) {
      // Nếu chưa có trong danh sách bộ nhớ tạm, tải lại danh mục
      const branchesRes = await api.getBranches();
      this.branches = branchesRes.data || [];
      const found = this.branches.find(b => b.id === branchId);
      if (!found) {
        throw new Error(`Chi nhánh có ID "${branchId}" không tồn tại.`);
      }
      return this.switchBranch(branchId);
    }

    // Thiết lập header x-branch-id
    api.setBranchId(branchId);

    // Lấy cấu hình kế thừa động thời gian thực từ CSDL/Cache
    const configRes = await api.getRuntimeConfig();
    this.currentBranch = branch;
    this.currentConfig = configRes.data;

    // Phát tín hiệu đến toàn bộ các thành phần giao diện
    this.notify();

    return {
      branch: this.currentBranch,
      config: this.currentConfig
    };
  }

  /**
   * Tải lại cấu hình hiện tại (sau khi Admin vừa override hoặc reset cờ tính năng)
   */
  public async reloadConfig(): Promise<RuntimeConfig> {
    if (!this.currentBranch) {
      throw new Error('Chưa có chi nhánh nào đang được kích hoạt.');
    }
    const configRes = await api.getRuntimeConfig();
    this.currentConfig = configRes.data;
    this.notify();
    return this.currentConfig;
  }

  public getActiveBranch(): Branch | null {
    return this.currentBranch;
  }

  public getCurrentBranch(): Branch | null {
    return this.currentBranch;
  }

  public getActiveConfig(): RuntimeConfig | null {
    return this.currentConfig;
  }

  public getBranchesList(): Branch[] {
    return this.branches;
  }

  public async refreshBranches(): Promise<Branch[]> {
    const branchesRes = await api.getBranches();
    this.branches = branchesRes.data || [];
    return this.branches;
  }

  public async addBranchAndSwitch(branchId: string): Promise<{ branch: Branch; config: RuntimeConfig }> {
    await this.refreshBranches();
    return this.switchBranch(branchId);
  }

  private notify() {
    if (this.currentConfig && this.currentBranch) {
      for (const listener of this.listeners) {
        try {
          listener(this.currentConfig, this.currentBranch);
        } catch (err) {
          console.error('🔥 [BranchContext Listener Error]:', err);
        }
      }
    }
  }
}

export const branchStore = new BranchContextStore();
