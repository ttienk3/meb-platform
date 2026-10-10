const { spawn } = require('child_process');
const http = require('http');

async function run() {
  const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--remote-debugging-port=9233', '--no-sandbox', '--disable-gpu', 'about:blank']);
  await new Promise(r => setTimeout(r, 1000));
  
  const page = await new Promise((res) => {
    const req = http.request('http://127.0.0.1:9233/json/new?http://localhost:5173', { method: 'PUT' }, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    });
    req.end();
  });
  
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  
  let id = 1;
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = id++;
    const handler = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === i) {
        ws.removeEventListener('message', handler);
        if (m.error) rej(m.error);
        else res(m.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 2000));

  // 1. Thêm sản phẩm vào giỏ
  await send('Runtime.evaluate', { 
    expression: "document.querySelector('.product-card').dispatchEvent(new MouseEvent('click', { bubbles: true }))" 
  });
  await new Promise(r => setTimeout(r, 500));

  // 2. Chọn khách hàng
  const selectResult = await send('Runtime.evaluate', { 
    expression: `
      (() => {
        const select = Array.from(document.querySelectorAll('select')).find(s => s.options.length > 2);
        if (select) {
          const val = select.options[1].value;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
          setter.call(select, val);
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return select.options[1].text;
        }
        return 'Not found';
      })()
    `,
    returnByValue: true
  });
  console.log('1. Đã chọn khách hàng:', selectResult.result?.value);
  await new Promise(r => setTimeout(r, 500));

  // 3. Nhấp Thanh Toán F9
  await send('Runtime.evaluate', { 
    expression: "Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Thanh Toán F9')).dispatchEvent(new MouseEvent('click', { bubbles: true }))" 
  });
  await new Promise(r => setTimeout(r, 2000));

  const cartText = await send('Runtime.evaluate', {
    expression: "document.querySelector('.cart-panel')?.innerText",
    returnByValue: true
  });
  console.log('NỘI DUNG CART PANEL SAU THANH TOÁN:\n', cartText.result?.value);

  // 4. Kiểm tra Modal Hóa Đơn K80
  const receipt = await send('Runtime.evaluate', { 
    expression: "document.querySelector('#meb-printable-receipt')?.innerText",
    returnByValue: true
  });
  console.log('\n2. NỘI DUNG HÓA ĐƠN K80 HIỂN THỊ:\n====================================');
  console.log(receipt.result?.value);
  console.log('====================================\n');

  chrome.kill();
}

run();
