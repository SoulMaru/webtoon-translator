// PNG / JPEG / WebP 의 가로·세로를 헤더만 읽어서 알아냅니다.
// 이미지 라이브러리를 붙이지 않으려고 직접 파싱합니다.
import { openSync, readSync, closeSync } from 'node:fs';

function head(file, bytes = 65536) {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

function png(b) {
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  if (b.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    // SOF0..SOF15 중 DHT(0xc4)·JPG(0xc8)·DAC(0xcc) 는 크기 정보가 아닙니다.
    const isSof = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function webp(b) {
  if (b.length < 30) return null;
  if (b.subarray(0, 4).toString('latin1') !== 'RIFF') return null;
  if (b.subarray(8, 12).toString('latin1') !== 'WEBP') return null;
  const kind = b.subarray(12, 16).toString('latin1');
  if (kind === 'VP8X') {
    return {
      width: 1 + b.readUIntLE(24, 3),
      height: 1 + b.readUIntLE(27, 3),
    };
  }
  if (kind === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function imageSize(file) {
  const b = head(file);
  const size = png(b) ?? jpeg(b) ?? webp(b);
  if (!size || !size.width || !size.height) return { width: 0, height: 0, orientation: 'landscape' };
  const orientation =
    size.width > size.height ? 'landscape' : size.width < size.height ? 'portrait' : 'square';
  return { ...size, orientation };
}
