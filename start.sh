#!/usr/bin/env bash
# =============================================================================
# KHỞI ĐỘNG HỆ THỐNG MEB PLATFORM (BACKEND API + FRONTEND CLIENT)
# =============================================================================

echo "🚀 [MEB SYSTEM]: Đang khởi động Backend API Gateway (Port 4000)..."
node server/src/index.js &
BACKEND_PID=$!

sleep 1

echo "🎨 [MEB SYSTEM]: Đang khởi động Frontend Web Interface (Port 5173)..."
npm run dev --prefix client &
FRONTEND_PID=$!

trap "echo '🛑 Đang dừng hệ thống...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

echo ""
echo "============================================================================="
echo "✅ HỆ THỐNG ĐÃ SẴN SÀNG:"
echo "👉 Truy cập trên máy này: http://localhost:5173"
echo "👉 Truy cập qua mạng LAN: http://$(hostname -I | awk '{print $1}'):5173"
echo "============================================================================="
echo "Nhấn Ctrl+C để dừng toàn bộ hệ thống."
echo ""

wait
