// 生成 resources/icon.ico —— 纯 Node、零 devDep。
// 把 256/128/64/48/32/16 六分辨率 RGBA bitmap 打进 ICO 容器（BMP 子格式）。
//
// 设计：奶纸圆底（PAPER #F5ECD7）→ 双层金边（GOLD #C9A84C / GOLD_DIM #8A6E3E）→
// 中央朱印方块（CINNABAR #B71C1C）压"邦"字。"邦"字用程序化笔画（不依赖外部字体），
// 因为 Node 没有 canvas，画文字麻烦。这里用一个抽象篆体方印图形：
// 中央正方形章 + 内部 9 字格 + 中点圆。古风器物纹饰感。
//
// 输出 icon.ico，写到 resources/icon.ico。
//
// 用法：node scripts/gen-icon.mjs

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'resources', 'icon.ico');
mkdirSync(dirname(OUT), { recursive: true });

const COLORS = {
  PAPER: [0xf5, 0xec, 0xd7, 0xff],
  PAPER_DIM: [0xe6, 0xdc, 0xc3, 0xff],
  GOLD: [0xc9, 0xa8, 0x4c, 0xff],
  GOLD_DIM: [0x8a, 0x6e, 0x3e, 0xff],
  CINNABAR: [0xb7, 0x1c, 0x1c, 0xff],
  INK: [0x2b, 0x21, 0x18, 0xff],
  TRANSPARENT: [0, 0, 0, 0],
};

function rgbaAt(buf, x, y, w, color) {
  const i = (y * w + x) * 4;
  buf[i + 0] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
  buf[i + 3] = color[3];
}

function distSq(x, y, cx, cy) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy;
}

/** 渲染单一分辨率 RGBA buffer（top-down）。 */
function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  // 默认全透明
  for (let i = 0; i < buf.length; i += 4) buf[i + 3] = 0;

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.48;       // 圆形外径
  const rGold = size * 0.46;        // 内金边
  const rPaper = size * 0.42;       // 纸面
  const sealHalf = size * 0.22;     // 朱印半边长
  const sealInsetHalf = size * 0.18; // 内 9 格半边长
  const dotR = size * 0.025;        // 中点

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt(distSq(x + 0.5, y + 0.5, cx, cy));
      let color = null;

      if (d <= rPaper) {
        color = COLORS.PAPER;
      } else if (d <= rGold) {
        color = COLORS.GOLD;
      } else if (d <= rOuter) {
        color = COLORS.GOLD_DIM;
      }
      if (color) rgbaAt(buf, x, y, size, color);
    }
  }

  // 朱印方块（实心 CINNABAR）—— 居中正方形
  const sx0 = Math.round(cx - sealHalf);
  const sx1 = Math.round(cx + sealHalf);
  const sy0 = Math.round(cy - sealHalf);
  const sy1 = Math.round(cy + sealHalf);
  for (let y = sy0; y < sy1; y++) {
    for (let x = sx0; x < sx1; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) rgbaAt(buf, x, y, size, COLORS.CINNABAR);
    }
  }

  // 朱印内部纸色 9 字格（PAPER 线宽 size*0.012）
  const lw = Math.max(1, Math.round(size * 0.012));
  const ix0 = Math.round(cx - sealInsetHalf);
  const ix1 = Math.round(cx + sealInsetHalf);
  const iy0 = Math.round(cy - sealInsetHalf);
  const iy1 = Math.round(cy + sealInsetHalf);
  // 外框
  for (let t = 0; t < lw; t++) {
    for (let x = ix0; x < ix1; x++) {
      rgbaAt(buf, x, iy0 + t, size, COLORS.PAPER);
      rgbaAt(buf, x, iy1 - 1 - t, size, COLORS.PAPER);
    }
    for (let y = iy0; y < iy1; y++) {
      rgbaAt(buf, ix0 + t, y, size, COLORS.PAPER);
      rgbaAt(buf, ix1 - 1 - t, y, size, COLORS.PAPER);
    }
  }
  // 横竖中线
  const midX = Math.round((ix0 + ix1) / 2);
  const midY = Math.round((iy0 + iy1) / 2);
  for (let t = -Math.floor(lw / 2); t < Math.ceil(lw / 2); t++) {
    for (let x = ix0; x < ix1; x++) rgbaAt(buf, x, midY + t, size, COLORS.PAPER);
    for (let y = iy0; y < iy1; y++) rgbaAt(buf, midX + t, y, size, COLORS.PAPER);
  }
  // 中点圆（PAPER）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (distSq(x + 0.5, y + 0.5, cx, cy) <= dotR * dotR) {
        rgbaAt(buf, x, y, size, COLORS.PAPER);
      }
    }
  }

  return buf;
}

/**
 * RGBA top-down → ICO 需要的 BMP 子格式：
 * BITMAPINFOHEADER + 像素（BGRA bottom-up）+ AND 掩码（每行 4 字节对齐的 1 bit-per-pixel）。
 * 32-bit 模式下 AND 掩码可以全 0（透明由 alpha 处理），但行长度必须 4 字节对齐。
 */
function buildIcoEntry(rgbaTopDown, size) {
  const headerSize = 40;
  const pixelBytes = size * size * 4;
  // AND mask: 1 bpp, rows aligned to 4 bytes
  const maskRowBytes = Math.ceil(size / 8 / 4) * 4;
  const maskBytes = maskRowBytes * size;
  const total = headerSize + pixelBytes + maskBytes;

  const out = Buffer.alloc(total);
  let p = 0;

  // BITMAPINFOHEADER
  out.writeUInt32LE(40, p); p += 4;                 // biSize
  out.writeInt32LE(size, p); p += 4;                // biWidth
  out.writeInt32LE(size * 2, p); p += 4;            // biHeight (image + mask doubled)
  out.writeUInt16LE(1, p); p += 2;                  // biPlanes
  out.writeUInt16LE(32, p); p += 2;                 // biBitCount
  out.writeUInt32LE(0, p); p += 4;                  // biCompression
  out.writeUInt32LE(pixelBytes + maskBytes, p); p += 4; // biSizeImage
  out.writeInt32LE(0, p); p += 4;                   // biXPelsPerMeter
  out.writeInt32LE(0, p); p += 4;                   // biYPelsPerMeter
  out.writeUInt32LE(0, p); p += 4;                  // biClrUsed
  out.writeUInt32LE(0, p); p += 4;                  // biClrImportant

  // 像素：bottom-up，BGRA
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      out[p + 0] = rgbaTopDown[src + 2]; // B
      out[p + 1] = rgbaTopDown[src + 1]; // G
      out[p + 2] = rgbaTopDown[src + 0]; // R
      out[p + 3] = rgbaTopDown[src + 3]; // A
      p += 4;
    }
  }

  // AND mask：全 0（透明由 alpha 决定），仅占位
  // out 默认就是 0，跳过 size 个 maskRowBytes 行
  p += maskBytes;

  return out;
}

function buildIco(entries) {
  // ICONDIR (6 bytes)
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);         // reserved
  dir.writeUInt16LE(1, 2);         // type = ICO
  dir.writeUInt16LE(entries.length, 4);

  // ICONDIRENTRY × N (16 bytes each)
  const dirEntriesLen = entries.length * 16;
  const dirEntries = Buffer.alloc(dirEntriesLen);
  let dataOffset = 6 + dirEntriesLen;
  let p = 0;
  for (const e of entries) {
    dirEntries[p + 0] = e.size === 256 ? 0 : e.size; // width
    dirEntries[p + 1] = e.size === 256 ? 0 : e.size; // height
    dirEntries[p + 2] = 0;                            // color count
    dirEntries[p + 3] = 0;                            // reserved
    dirEntries.writeUInt16LE(1, p + 4);               // planes
    dirEntries.writeUInt16LE(32, p + 6);              // bpp
    dirEntries.writeUInt32LE(e.data.length, p + 8);   // bytesInRes
    dirEntries.writeUInt32LE(dataOffset, p + 12);     // imageOffset
    dataOffset += e.data.length;
    p += 16;
  }

  return Buffer.concat([dir, dirEntries, ...entries.map(e => e.data)]);
}

const SIZES = [256, 128, 64, 48, 32, 16];
const entries = SIZES.map(size => ({ size, data: buildIcoEntry(render(size), size) }));
const ico = buildIco(entries);
writeFileSync(OUT, ico);
console.log(`[gen-icon] wrote ${OUT} (${ico.length} bytes, ${SIZES.length} resolutions)`);
