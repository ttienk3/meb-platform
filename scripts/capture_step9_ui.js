/**
 * CHỤP ẢNH MÀN HÌNH KIỂM CHỨNG BƯỚC 9: TỔNG BỘ CHUỖI & NO-CODE STUDIO DYNAMIC PLATFORM
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, '../artifacts_ui');
const BRAIN_DIR = '/home/ttien82/.gemini/antigravity-ide/brain/7612692c-2839-4278-811d-15f642cb6df6';

if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function startChrome() {
  console.log('🌐 Đang khởi động Google Chrome Headless (CDP Port 9222)...');
  const chromeProcess = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1600,1000',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json/version', (r) => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      if (res && res.webSocketDebuggerUrl) {
        return { chromeProcess, browserWs: res.webSocketDebuggerUrl };
      }
    } catch {
      // Tiếp tục đợi
    }
  }
  throw new Error('Chrome không thể khởi động trên cổng 9222');
}

async function createNewPage() {
  return new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:9222/json/new?http://localhost:5173', { method: 'PUT' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

function connectCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const callbacks = new Map();

    ws.onopen = () => {
      resolve({
        ws,
        send: (method, params = {}) => {
          return new Promise((res, rej) => {
            const reqId = id++;
            callbacks.set(reqId, { res, rej });
            ws.send(JSON.stringify({ id: reqId, method, params }));
          });
        }
      });
    };
    ws.onerror = reject;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        console.log('   🖥️ [CONSOLE]:', text);
      }
      if (msg.id && callbacks.has(msg.id)) {
        const { res, rej } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    };
  });
}

async function takeScreenshot(cdp, filename) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
  console.log(`📸 Chụp ảnh lưu tại: ${outPath}`);

  // Copy vào brain artifacts dir
  if (fs.existsSync(BRAIN_DIR)) {
    const brainPath = path.join(BRAIN_DIR, filename);
    fs.writeFileSync(brainPath, Buffer.from(res.data, 'base64'));
    console.log(`🖼️ Copy vào brain artifacts: ${brainPath}`);
  }
  return outPath;
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || 'Lỗi Runtime JS');
  }
  return res.result?.value;
}

async function run() {
  const { chromeProcess } = await startChrome();
  try {
    const page = await createNewPage();
    const cdp = await connectCDP(page.webSocketDebuggerUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log('⏳ Đang đợi trang web http://localhost:5173 tải xong...');
    await new Promise(r => setTimeout(r, 2000));

    // 1. Chụp HQ Dashboard
    console.log('🔍 [1/3] Mở Tab Tổng Bộ Chuỗi (HQ Dashboard)...');
    await evaluate(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Tổng Bộ Chuỗi'));
      if (btn) btn.click();
    })()`);

    // Chờ cho đến khi bảng ma trận tải xong (không còn chữ Đang tải)
    for (let i = 0; i < 20; i++) {
      const stillLoading = await evaluate(cdp, `document.body.innerText.includes('Đang tải ma trận dữ liệu')`);
      if (!stillLoading) {
        console.log('   ✅ Ma trận dữ liệu HQ đã tải xong!');
        break;
      }
      await new Promise(r => setTimeout(r, 300));
    }
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot(cdp, 'screenshot_step9_hq_dashboard.png');

    // 2. Chuyển sang No-Code Studio -> Trình tạo CSDL
    console.log('🔍 [2/3] Mở Tab No-Code Studio -> Trình tạo CSDL & Bảng Động...');
    await evaluate(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('No-Code Studio'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1000));

    await evaluate(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Trình Tạo CSDL'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1500));
    await takeScreenshot(cdp, 'screenshot_step9_nocode_schema_builder.png');

    // 3. Chuyển sang No-Code Studio -> Dữ Liệu & Nút Hành Động
    console.log('🔍 [3/3] Mở Tab No-Code Studio -> Dữ Liệu & Nút Hành Động...');
    await evaluate(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Dữ Liệu & Nút Hành Động'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1500));
    await takeScreenshot(cdp, 'screenshot_step9_dynamic_workspace.png');

    console.log('🎉 ĐÃ CHỤP THÀNH CÔNG TẤT CẢ GIAO DIỆN!');
  } finally {
    chromeProcess.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
