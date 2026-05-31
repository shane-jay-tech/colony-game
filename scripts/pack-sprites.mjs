#!/usr/bin/env node
/**
 * pack-sprites.mjs
 *
 * 把 resources/sprites/ 下所有 PNG 打包成单张 atlas（PNG + JSON），输出到 public/atlas/。
 * Phaser 用 this.load.atlas('main', '/atlas/main.png', '/atlas/main.json') 加载。
 *
 * 关键决策（DeepSeek 蓝图 §脚本 + Kimi 反审 #7c）：
 *   - 用 free-tex-packer-core（pure JS，不依赖 ImageMagick / TexturePacker GUI）
 *   - 输出 JSON 格式锁 'JsonHash'（Phaser 3 默认认这个）
 *   - allowRotation/allowTrim 都关掉（Phaser 旋转 trim 后坐标对不齐美工 SVG）
 *   - 路径全走 D 盘相对路径，不污染 C
 *
 * 使用：
 *   把 SVG 美工先用 sharp 或 Inkscape 转成 PNG 放到 resources/sprites/，
 *   再 npm run pack-sprites。
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import texturePacker from 'free-tex-packer-core';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const INPUT_DIR = join(ROOT, 'resources', 'sprites');
const OUTPUT_DIR = join(ROOT, 'public', 'atlas');
const ATLAS_NAME = 'main';

function collectImages(dir) {
  if (!existsSync(dir)) {
    console.warn(`[pack-sprites] input dir not found, creating empty: ${dir}`);
    mkdirSync(dir, { recursive: true });
    return [];
  }
  const files = readdirSync(dir);
  const images = [];
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.png') continue;
    const fullPath = join(dir, file);
    images.push({
      path: basename(file, ext),
      contents: readFileSync(fullPath),
    });
  }
  return images;
}

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function pack() {
  console.log('[pack-sprites] scanning', INPUT_DIR);
  const images = collectImages(INPUT_DIR);

  if (images.length === 0) {
    console.warn('[pack-sprites] no PNG inputs; writing empty placeholder atlas');
    ensureOutputDir();
    writeFileSync(
      join(OUTPUT_DIR, `${ATLAS_NAME}.json`),
      JSON.stringify(
        {
          frames: {},
          meta: {
            app: 'pack-sprites.mjs',
            version: '1.0',
            image: `${ATLAS_NAME}.png`,
            format: 'RGBA8888',
            size: { w: 1, h: 1 },
            scale: '1',
          },
        },
        null,
        2,
      ),
    );
    console.log('[pack-sprites] done (empty)');
    return;
  }

  console.log(`[pack-sprites] packing ${images.length} sprites…`);

  const options = {
    textureName: ATLAS_NAME,
    width: 2048,
    height: 2048,
    fixedSize: false,
    powerOfTwo: true,
    padding: 2,
    extrude: 1,
    allowRotation: false,
    allowTrim: false,
    detectIdentical: true,
    exporter: 'JsonHash', // Phaser 3 atlas 默认格式
    removeFileExtension: true,
    prependFolderName: false,
  };

  const result = await new Promise((resolvePromise, rejectPromise) => {
    texturePacker(images, options, (files, error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise(files);
    });
  });

  ensureOutputDir();
  for (const file of result) {
    const outPath = join(OUTPUT_DIR, file.name);
    writeFileSync(outPath, file.buffer);
    console.log(`[pack-sprites] wrote ${outPath} (${file.buffer.length} bytes)`);
  }

  console.log('[pack-sprites] done');
}

pack().catch((err) => {
  console.error('[pack-sprites] FAILED:', err);
  process.exit(1);
});
