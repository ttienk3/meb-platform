require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const requestContext = require('./middleware/requestContext');
const { invalidateBranchConfig } = require('./services/configService');

const app = express();

app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// 1. PUBLIC ROUTES (Không yêu cầu Header x-branch-id)
// -----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'meb-api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Gắn router xác thực tài khoản nhân viên & phân quyền chi nhánh (A3)
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// -----------------------------------------------------------------------------
// 2. CONTEXTUAL ROUTES (Bắt buộc Header x-branch-id qua requestContext)
// -----------------------------------------------------------------------------
// Lấy cấu hình runtime thời gian thực của chi nhánh
app.get('/api/context/runtime', requestContext, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.ctx.userId,
      branch: req.ctx.branch,
      features: req.ctx.features,
      featureMeta: req.ctx.featureMeta
    }
  });
});

// Xóa cache cấu hình chi nhánh (được gọi khi admin thay đổi toggle)
app.post('/api/context/invalidate', requestContext, (req, res) => {
  invalidateBranchConfig(req.ctx.branchId);
  res.json({
    success: true,
    message: `Đã làm mới cache cho chi nhánh ${req.ctx.branch?.code}`
  });
});

// Gắn router nghiệp vụ POS (/api/pos/products, /api/pos/partners, /api/pos/checkout)
const posRoutes = require('./routes/posRoutes');
app.use('/api/pos', posRoutes);

// Gắn router quản trị No-Code Studio (/api/admin/features/*, /api/admin/branches, /api/admin/audit-logs)
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Gắn router điều chuyển liên chi nhánh 2 pha (/api/transfers)
const transferRoutes = require('./routes/transferRoutes');
app.use('/api/transfers', requestContext, transferRoutes);

// Gắn router nhập hàng từ NCC (/api/inbound/suppliers, /api/inbound/purchase, /api/inbound/receipts)
const inboundRoutes = require('./routes/inboundRoutes');
app.use('/api/inbound', inboundRoutes);

// Gắn router kiểm kê kho định kỳ (/api/inventory/audit-products, /api/inventory/audit, /api/inventory/audit-history)
const auditRoutes = require('./routes/auditRoutes');
app.use('/api/inventory', auditRoutes);

// Gắn router điều hành HQ Multi-Branch (/api/hq/overview, /api/hq/branches-matrix)
const hqRoutes = require('./routes/hqRoutes');
app.use('/api/hq', hqRoutes);

// Gắn router quản lý CSDL Động & Schema Builder (/api/schema/tables, /api/schema/fields, /api/schema/actions)
const dynamicSchemaRoutes = require('./routes/dynamicSchemaRoutes');
app.use('/api/schema', dynamicSchemaRoutes);

// Gắn router Dữ liệu Động & Thực thi Nút bấm (/api/dynamic/:tableCode, /api/dynamic/:tableCode/:id/action/:actionKey)
const dynamicDataRoutes = require('./routes/dynamicDataRoutes');
app.use('/api/dynamic', dynamicDataRoutes);

// Gắn router Quy tắc Tự động hóa & Workflow Engine (/api/workflows)
const workflowRoutes = require('./routes/workflowRoutes');
app.use('/api/workflows', requestContext, workflowRoutes);

// Gắn router Loyalty Tích Điểm (/api/loyalty)
const loyaltyRoutes = require('./routes/loyaltyRoutes');
app.use('/api/loyalty', requestContext, loyaltyRoutes);

// Gắn router RMA Đổi Trả Hàng (/api/rma)
const rmaRoutes = require('./routes/rmaRoutes');
app.use('/api/rma', requestContext, rmaRoutes);

// Gắn router Công Nợ Nhà Cung Cấp AP (/api/suppliers)
const supplierDebtRoutes = require('./routes/supplierDebtRoutes');
app.use('/api/suppliers', requestContext, supplierDebtRoutes);

// Gắn router Hàng Combo & Đóng Gói BOM (/api/combos)
const comboRoutes = require('./routes/comboRoutes');
app.use('/api/combos', requestContext, comboRoutes);

// Gắn router Trung Tâm Cảnh Báo Bất Thường (/api/anomalies)
const anomalyRoutes = require('./routes/anomalyRoutes');
app.use('/api/anomalies', requestContext, anomalyRoutes);

// -----------------------------------------------------------------------------
// 3. PHỤC VỤ GIAO DIỆN WEB (STATIC ASSETS & SPA FALLBACK)
// -----------------------------------------------------------------------------
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// -----------------------------------------------------------------------------
// KHỞI ĐỘNG MÁY CHỦ NẾU CHẠY TRỰC TIẾP
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 [MEB API Gateway]: Đang lắng nghe tại cổng http://localhost:${PORT}`);
  });
}

module.exports = app;
