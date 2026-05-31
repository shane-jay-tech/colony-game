#!/usr/bin/env node
/**
 * postprocess-ai-png.mjs
 *
 * AI 出图（Stable Diffusion / Midjourney）经常会跑色——明明 prompt 写了"6 色"，
 * 出来的 PNG 肉眼看着对，hex 一查发现混进去几十个相近灰度。
 *
 * 这个脚本用 sharp 把 resources/ai-out/ 下所有 PNG 强制 quantize 成
 * palette.ts 里那 6 色（+辅色），覆盖回 resources/sprites/ 给 pack-sprites.mjs 用。
 *
 * 关键决策（Kimi 反审 #7d）：
 *   - 用 sharp 而非 ImageMagick：纯 npm 包，不要求用户全局装 IM
 *   - palette 锁 10 色（6 主 + 4 辅）：足够覆盖建筑/UI/事件图，不让 AI 加灰
 *   - 输出 PNG-8 indexed：减少包体，且 free-tex-packer 接 PNG-8 没问题
 *
 * 使用：
 *   把 AI 出图丢到 resources/ai-out/，npm run postprocess-png。
 *   之后 npm run pack-sprites 打 atlas。
 *
 * 注意：没装 sharp（devDependencies 没列）会 fail，按需 npm i -D sharp。
 *      默认不强制安装，避免 Windows 上 sharp 编译失败拖累首次跑通。
 */

import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const INPUT_DIR = join(ROOT, 'resources', 'ai-out');
const OUTPUT_DIR = join(ROOT, 'resources', 'sprites');

// palette.ts 6 主色 + 4 辅色 + 墨底（保持和 src/renderer/ui/palette.ts 同步）
const PALETTE_HEX = [
  '#1A1410', // BG_INK
  '#C9A84C', // GOLD
  '#7A4A2B', // EARTH
  '#3F5F4A', // BAMBOO
  '#A33A2A', // CINNABAR
  '#D4C8B0', // RICE_PAPER
  '#2B3A4A', // NIGHT_SKY
  '#8A6F3F', // EARTH_LIGHT
  '#5A8068', // BAMBOO_LIGHT
  '#4A3520', // INK_SMALL
];

async function tryLoadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch {
    console.error('[postprocess-png] sharp 没装。先跑：npm i -D sharp');
    console.error('[postprocess-png] 跳过本次（不阻塞首次构建）');
    return null;
  }
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function nearestPaletteColor(r, g, b, paletteRgb) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < paletteRgb.length; i++) {
    const p = paletteRgb[i];
    const dr = r - p.r;
    const dg = g - p.g;
    const db = b - p.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return paletteRgb[bestIdx];
}

async function processFile(sharp, paletteRgb, inputPath, outputPath) {
  const img = sharp(inputPath).ensureAlpha();
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const buf = Buffer.from(data);

  for (let i = 0; i < buf.length; i += channels) {
    const a = channels === 4 ? buf[i + 3] : 255;
    if (a < 8) continue; // 透明像素不动
    const c = nearestPaletteColor(buf[i], buf[i + 1], buf[i + 2], paletteRgb);
    buf[i] = c.r;
    buf[i + 1] = c.g;
    buf[i + 2] = c.b;
  }

  await sharp(buf, {
    raw: { width: info.width, height: info.height, channels },
  })
    .png({ palette: true, compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`[postprocess-png] ${basename(inputPath)} → ${outputPath} (${meta.width}x${meta.height})`);
}

async function main() {
  if (!existsSync(INPUT_DIR)) {
    console.warn(`[postprocess-png] input dir not found: ${INPUT_DIR}`);
    console.warn('[postprocess-png] 把 AI 出的 PNG 丢这里再跑');
    mkdirSync(INPUT_DIR, { recursive: true });
    return;
  }

  const sharp = await tryLoadSharp();
  if (!sharp) return;

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const paletteRgb = PALETTE_HEX.map(hexToRgb);

  const files = readdirSync(INPUT_DIR).filter((f) => extname(f).toLowerCase() === '.png');
  if (files.length === 0) {
    console.warn('[postprocess-png] no PNG in', INPUT_DIR);
    return;
  }

  console.log(`[postprocess-png] quantizing ${files.length} files to ${PALETTE_HEX.length}-color palette…`);

  for (const file of files) {
    const inputPath = join(INPUT_DIR, file);
    const outputPath = join(OUTPUT_DIR, file);
    try {
      await processFile(sharp, paletteRgb, inputPath, outputPath);
    } catch (err) {
      console.error(`[postprocess-png] FAILED on ${file}:`, err.message);
    }
  }

  console.log('[postprocess-png] done');
}

main().catch((err) => {
  console.error('[postprocess-png] FAILED:', err);
  process.exit(1);
});
