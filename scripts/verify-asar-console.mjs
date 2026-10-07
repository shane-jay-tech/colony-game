#!/usr/bin/env node
/**
 * c1007-26：打包产物级 console 剥除验证（c1006-06 遗留——asar grep）。
 *
 * 背景：c1006-06 在 electron.vite.config.ts 三段（main/preload/renderer）落
 * `esbuild: { drop: ['log', 'debug'] }`——本脚本在 electron-builder 打包后对
 * dist-out 下各 resources 目录内的 app.asar 复核剥除真的生效：
 *   - console.debug / console.log 计数 = 0（剥除目标）；
 *   - console.warn / console.error 存在 > 0（安全网在位反证——D 盘 fallback 与崩溃族告警必须存活）。
 *
 * 原理：bundle JS 以明文内嵌在 asar 归档体中（asar 无加密），直接对归档二进制做
 * 文本计数——零额外依赖（asar CLI 不在依赖链，npx 拉取属联网禁域）。
 * 计数=0 的判定是可靠的（明文里真有调用则计数必>0）；计数>0 时含字符串字面量
 * 假阳可能，此时按 FAIL 处理人工复核（宁可红不可漏）。
 *
 * 用法（真打包属主班窗，本脚本只在其后跑）：
 *   npm run electron:build:win
 *   node scripts/verify-asar-console.mjs            # 自动找 dist-out 下最新 app.asar
 *   node scripts/verify-asar-console.mjs <asar路径>  # 显式指定
 *
 * 判据：debug=0 且 log=0 且 (warn+error)>0 → exit 0；否则 exit 1。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function findAsar() {
  const explicit = process.argv[2];
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`指定 asar 不存在: ${explicit}`);
    return explicit;
  }
  const outDir = join(process.cwd(), 'dist-out');
  if (!existsSync(outDir)) throw new Error('dist-out 不存在——先 npm run electron:build:win');
  const candidates = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p, depth + 1);
      else if (name === 'app.asar') candidates.push({ p, mtime: st.mtimeMs });
    }
  };
  walk(outDir, 0);
  if (candidates.length === 0) throw new Error('dist-out 下未找到 app.asar');
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].p;
}

function countLiteral(buffer, needle) {
  let count = 0;
  let idx = 0;
  const pat = Buffer.from(needle, 'utf8');
  while ((idx = buffer.indexOf(pat, idx)) !== -1) {
    count += 1;
    idx += pat.length;
  }
  return count;
}

const asar = findAsar();
console.log(`[verify-asar] 目标: ${asar}`);
const buf = readFileSync(asar);
const counts = {
  debug: countLiteral(buf, 'console.debug'),
  log: countLiteral(buf, 'console.log'),
  warn: countLiteral(buf, 'console.warn'),
  error: countLiteral(buf, 'console.error'),
};
console.log('[verify-asar] 计数:', JSON.stringify(counts));
const pass = counts.debug === 0 && counts.log === 0 && counts.warn + counts.error > 0;
console.log(`[verify-asar] 判定: ${pass ? 'PASS（debug/log 剥除生效，warn/error 安全网在位）' : 'FAIL（剥除失效或安全网丢失；计数>0 含字面量假阳可能，人工复核 bundle）'}`);
process.exit(pass ? 0 : 1);
