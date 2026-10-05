import { useState, useEffect, useCallback } from 'react';
import type { 
  BranchRecord, 
  CustomEntityRecord, 
  UomConversionRecord, 
  StockAuditLogRecord,
  InventoryLedgerRecord,
  ActiveTab 
} from './types';
import { pbApi } from './services/pocketbase';
import { Header } from './components/Header';
import { OwnerNoCodeStudio } from './components/OwnerNoCodeStudio';
import { BranchBentoGrid } from './components/BranchBentoGrid';
import { PosScreen } from './components/PosScreen';
import './App.css';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('STUDIO');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [engineConnected, setEngineConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dữ liệu thời gian thực từ PocketBase Core Engine
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [entities, setEntities] = useState<CustomEntityRecord[]>([]);
  const [conversions, setConversions] = useState<UomConversionRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryLedgerRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<StockAuditLogRecord[]>([]);
  const [activeBranchCode, setActiveBranchCode] = useState<string>('CN_Q1');

  // Load theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Đồng bộ toàn bộ dữ liệu từ PocketBase Core Engine (Port 8090)
  const fetchAllData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [branchList, entityList, convList, logList, invList] = await Promise.all([
        pbApi.getBranches(),
        pbApi.getCustomEntities(),
        pbApi.getUomConversions(),
        pbApi.getAuditLogs(),
        pbApi.getInventory()
      ]);

      setBranches(branchList);
      setEntities(entityList);
      setConversions(convList);
      setAuditLogs(logList);
      setInventory(invList);
      setEngineConnected(true);

      // Nếu activeBranchCode chưa tồn tại, chọn chi nhánh đầu tiên
      if (branchList.length > 0 && !branchList.some(b => b.code === activeBranchCode)) {
        setActiveBranchCode(branchList[0].code);
      }
    } catch (err) {
      console.error('[PocketBase Error]', err);
      setEngineConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchCode]);

  useEffect(() => {
    let ignore = false;
    pbApi.getBranches().then(() => {
      if (!ignore) {
        fetchAllData(false);
      }
    }).catch(() => {
      if (!ignore) setEngineConnected(false);
    });
    return () => { ignore = true; };
  }, [fetchAllData]);

  // Thao tác Chi nhánh
  const handleCreateBranch = async (data: Omit<BranchRecord, 'id' | 'created' | 'updated'>) => {
    await pbApi.createBranch(data);
    await fetchAllData();
  };

  const handleDeleteBranch = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa chi nhánh này?')) {
      await pbApi.deleteBranch(id);
      await fetchAllData();
    }
  };

  // Thao tác Vật thể động
  const handleCreateEntity = async (data: Omit<CustomEntityRecord, 'id' | 'created' | 'updated'>) => {
    await pbApi.createCustomEntity(data);
    await fetchAllData();
  };

  const handleDeleteEntity = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa vật thể này?')) {
      await pbApi.deleteCustomEntity(id);
      await fetchAllData();
    }
  };

  // Thao tác Quy đổi đa đơn vị
  const handleCreateConversion = async (data: Omit<UomConversionRecord, 'id' | 'created' | 'updated'>) => {
    await pbApi.createUomConversion(data);
    await fetchAllData();
  };

  const handleDeleteConversion = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa quy tắc quy đổi này?')) {
      await pbApi.deleteUomConversion(id);
      await fetchAllData();
    }
  };

  const currentActiveBranch = branches.find(b => b.code === activeBranchCode) || branches[0];

  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER ĐIỀU HÀNH */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeBranchName={currentActiveBranch ? currentActiveBranch.name : 'Chưa Chọn'}
        engineConnected={engineConnected}
        onRefresh={fetchAllData}
      />

      {/* NỘI DUNG CHÍNH */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'STUDIO' && (
          <OwnerNoCodeStudio
            branches={branches}
            entities={entities}
            conversions={conversions}
            auditLogs={auditLogs}
            activeBranchCode={activeBranchCode}
            onSelectActiveBranch={(code) => {
              setActiveBranchCode(code);
              setActiveTab('POS'); // Khi chọn chi nhánh, chuyển ngay vào POS để thao tác bán
            }}
            onCreateBranch={handleCreateBranch}
            onDeleteBranch={handleDeleteBranch}
            onCreateEntity={handleCreateEntity}
            onDeleteEntity={handleDeleteEntity}
            onCreateConversion={handleCreateConversion}
            onDeleteConversion={handleDeleteConversion}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'BENTO_GRID' && (
          <BranchBentoGrid
            activeBranch={currentActiveBranch}
            onOpenStudio={() => setActiveTab('STUDIO')}
            onOpenPos={() => setActiveTab('POS')}
          />
        )}

        {activeTab === 'POS' && currentActiveBranch && (
          <PosScreen
            activeBranch={currentActiveBranch}
            entities={entities}
            conversions={conversions}
            inventory={inventory}
            onBackToBento={() => setActiveTab('BENTO_GRID')}
            onRefreshData={fetchAllData}
          />
        )}
      </main>
    </div>
  );
}
export default App;
