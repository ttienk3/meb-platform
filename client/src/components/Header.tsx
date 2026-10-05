import React from 'react';
import type { ActiveTab } from '../types';
import { 
  Layers, 
  Database,
  Building2,
  Grid,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeBranchName: string;
  engineConnected: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  activeBranchName,
  engineConnected,
  onRefresh
}) => {
  return (
    <header className="header-container">
      <div className="header-top">
        <div className="logo-group">
          <div className="logo-icon">
            <Layers size={22} className="text-primary" />
          </div>
          <div>
            <div className="brand-name">
              MEB SAAS <span className="brand-badge">Multi-Branch Engine</span>
            </div>
            <div className="cloud-status">
              <span className={`dot-pulse ${engineConnected ? 'bg-success' : 'bg-danger'}`}></span>
              <Database size={11} style={{ marginRight: 3 }} />
              PocketBase Core Engine (Port 8090) • {engineConnected ? 'Kết Nối Trực Tiếp' : 'Chưa Kết Nối'}
            </div>
          </div>
        </div>

        {/* NÚT CHUYỂN ĐỔI CHÍNH: NO-CODE STUDIO <-> BENTO GRID CHI NHÁNH <-> POS */}
        <div className="portal-toggle-group">
          <button 
            className={`btn ${activeTab === 'STUDIO' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectTab('STUDIO')}
            style={{ fontWeight: 700 }}
          >
            <Building2 size={16} /> 👑 NO-CODE STUDIO
          </button>

          <button 
            className={`btn ${activeTab === 'BENTO_GRID' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectTab('BENTO_GRID')}
          >
            <Grid size={16} /> 🏢 Ô CHỨC NĂNG
          </button>

          <button 
            className={`btn ${activeTab === 'POS' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectTab('POS')}
            style={{ fontWeight: 700, background: activeTab === 'POS' ? 'linear-gradient(135deg, #2563eb, #10b981)' : undefined }}
          >
            🛒 POS BÁN HÀNG ({activeBranchName})
          </button>
        </div>

        {/* CÁC THAO TÁC TIỆN ÍCH */}
        <div className="header-actions">
          <button 
            className="icon-btn" 
            onClick={onRefresh} 
            title="Đồng bộ lại dữ liệu từ PocketBase"
          >
            <RefreshCw size={17} />
          </button>

          <button 
            className="icon-btn" 
            onClick={onToggleTheme} 
            title="Đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};
