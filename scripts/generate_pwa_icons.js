const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Hàm tính CRC32 chuẩn PNG
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcVal]);
}

function createPng(size) {
  const width = size;
  const height = size;
  
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Vẽ icon nền tối bo tròn viền cyan thương hiệu MEB
      if (dist <= radius) {
        // Trong hình tròn
        if (dist > radius - 6) {
          // Viền cyan
          rawData[offset++] = 56;  // R (#38bdf8)
          rawData[offset++] = 189; // G
          rawData[offset++] = 248; // B
          rawData[offset++] = 255; // A
        } else if (dist <= radius * 0.5) {
          // Tâm logo biểu tượng MEB Neon Purple / Sky
          rawData[offset++] = 134; // R (#863bff)
          rawData[offset++] = 59;  // G
          rawData[offset++] = 255; // B
          rawData[offset++] = 255; // A
        } else {
          // Nền xanh đen Dark mode (#0a0e17)
          rawData[offset++] = 10;
          rawData[offset++] = 14;
          rawData[offset++] = 23;
          rawData[offset++] = 255;
        }
      } else {
        // Trong suốt ngoài bo tròn
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Thư mục đích
const iconsDir = path.join(__dirname, '../client/public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPng(512));
console.log('✅ Đã tạo thành công icon-192.png và icon-512.png chuẩn PNG W3C!');
