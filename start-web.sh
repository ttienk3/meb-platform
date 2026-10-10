#!/usr/bin/env bash
# =============================================================================
# MEB PLATFORM - ONE-CLICK PUBLIC WEB DEPLOYMENT SCRIPT
# Tự động khởi động Fullstack Engine + Cloudflare HTTPS Tunnel toàn cầu
# =============================================================================

PORT=${PORT:-4000}
LOG_DIR="/tmp/meb-web-logs"
mkdir -p "$LOG_DIR"

echo "============================================================================="
echo "🌐 [MEB PLATFORM]: Đang chuẩn bị triển khai lên Mạng Internet..."
echo "============================================================================="

# 1. Kiểm tra build client
if [ ! -d "client/dist" ]; then
  echo "📦 [1/3] Đang đóng gói Client Web Interface (Production Build)..."
  npm run build --prefix client
else
  echo "✅ [1/3] Đã có bản đóng gói Client Web Interface (client/dist)."
fi

# 2. Khởi động Fullstack Node.js Engine
echo "🚀 [2/3] Đang khởi động Fullstack Engine tại cổng $PORT..."
PORT=$PORT node server/src/index.js > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!

sleep 2

# Kiểm tra server đã chạy thành công chưa
if ! curl -s "http://127.0.0.1:$PORT/health" > /dev/null; then
  echo "❌ Máy chủ API không khởi động được. Xem chi tiết tại $LOG_DIR/server.log"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo "✅ Máy chủ Fullstack đang chạy tại http://127.0.0.1:$PORT"

# 3. Khởi động Cloudflare Tunnel toàn cầu
echo "⚡ [3/3] Đang tạo đường truyền bảo mật HTTPS Cloudflare toàn cầu..."
TUNNEL_LOG="$LOG_DIR/tunnel.log"
cloudflared tunnel --url "http://127.0.0.1:$PORT" > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

trap "echo ''; echo '🛑 Đang dừng hệ thống Web...'; kill $SERVER_PID $TUNNEL_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# Đợi lấy public URL từ log của Cloudflare
PUBLIC_URL=""
for i in {1..30}; do
  if grep -o "https://[a-zA-Z0-9-]*\.trycloudflare\.com" "$TUNNEL_LOG" > /tmp/meb_url.txt; then
    PUBLIC_URL=$(head -n 1 /tmp/meb_url.txt)
    break
  fi
  sleep 1
done

echo ""
echo "============================================================================="
if [ -n "$PUBLIC_URL" ]; then
  echo "🎉 HỆ THỐNG MEB ĐÃ CHÍNH THỨC TRỰC TUYẾN TOÀN CẦU!"
  echo "🔗 LINK TRUY CẬP TRỰC TIẾP (BẤT KỲ THIẾT BỊ NÀO CŨNG VÀO ĐƯỢC):"
  echo "👉 $PUBLIC_URL"
  echo "-----------------------------------------------------------------------------"
  echo "📱 Dùng được trên điện thoại, máy tính bảng, máy tính từ xa qua 4G/Wifi."
  echo "🔐 Kết nối HTTPS bảo mật cấp doanh nghiệp bởi Cloudflare Edge Network."
  echo "💾 Dữ liệu kết nối trực tiếp Supabase Cloud PostgreSQL thời gian thực."
  echo "============================================================================="
else
  echo "⚠️ Đang tạo kết nối Tunnel, vui lòng kiểm tra tại: $TUNNEL_LOG"
fi
echo "Nhấn Ctrl+C để dừng phát sóng Web."
echo ""

wait
