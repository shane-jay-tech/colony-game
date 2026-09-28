#!/usr/bin/env node
// audit-dead-exports.mjs（d914-84）：零引用值导出盘点（只读，不写任何 src 文件）。
// 规则：
//   扫描 src/**/*.ts（跳过 __tests__）；只收值导出 export const|function|class|let <Name>
//   （interface/type 不收——类型面删除会连带炸编译）。
//   对每个名字统计：其它非测试文件词边界命中数、测试文件命中数、本文件内出现次数。
//   分桶：dead（非测试0+测试0）｜tests-only（非测试0+测试>0）｜
//         internal-only（文件外0但本文件内≥2次→不算死，单列备查）。
// 凡静态扫描可能漏掉的动态接线，人工复核阶段改记 wired-dynamically（见报告）。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!p.includes('__tests__') && e.name !== 'node_modules') walk(p);
    } else if (p.endsWith('.ts') && !p.includes('__tests__')) {
      files.push(p);
    }
  }
})(ROOT);

const testFiles = [];
// B-151 修复（917 案卷二节定谳）：walkTests 曾把 src 下全部 .ts 当测试文件，
// hitsInTests＝测试命中＋本文件全部出现（含声明行），自计污染令 22/108 条 tests-only 无真实测试引用。
// 与 files 采集口径对齐：只收 __tests__。
(function walkTests(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') collectTests(p);
      else walkTests(p);
    }
  }
  function collectTests(tdir) {
    for (const e of fs.readdirSync(tdir, { withFileTypes: true })) {
      const p = path.join(tdir, e.name);
      if (e.isDirectory()) collectTests(p);
      else if (p.endsWith('.ts') || p.endsWith('.mts')) testFiles.push(p);
    }
  }
})('src');

// B-151 自检：testFiles 一旦混入非 __tests__ 文件，hitsInTests 自计污染即复发——直接失败退出。
if (testFiles.some((p) => !p.includes('__tests__'))) {
  process.stderr.write('[B-151] walkTests 混入非 __tests__ 文件，自计污染复发\n');
  process.exit(1);
}

const EXPORT_RE = /^export\s+(?:const|function|class|let)\s+([A-Za-z_$][\w$]*)/gm;
const entries = [];

// c927-64 案 B（诊断见 docs/insights/colony-de-slowtail-diagnosis-20260924.md §4）：文件内容记忆化。
// 热点是无缓存重复读盘——同一文件被重读约「值导出数」遍（readFileSync 占单轮 96.9%）。
// 只加一层 path→内容 缓存，读法与编码（utf8）不变 ⇒ 判定逻辑与计数口径零改动。
const contentCache = new Map();
function readCached(p) {
  let txt = contentCache.get(p);
  if (txt === undefined) {
    txt = fs.readFileSync(p, 'utf8');
    contentCache.set(p, txt);
  }
  return txt;
}

for (const file of files) {
  const src = readCached(file);
  EXPORT_RE.lastIndex = 0;
  let m;
  while ((m = EXPORT_RE.exec(src)) !== null) {
    const name = m[1];
    const lineNo = src.slice(0, m.index).split('\n').length;
    const wordRe = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g');
    let nonTestHits = 0;
    let testHits = 0;
    for (const other of files) {
      if (other === file) continue;
      nonTestHits += (readCached(other).match(wordRe) || []).length;
    }
    for (const t of testFiles) {
      const txt = readCached(t);
      testHits += (txt.match(wordRe) || []).length;
    }
    const ownOccurrences = (src.match(wordRe) || []).length;
    let bucket;
    if (nonTestHits === 0 && testHits === 0) {
      bucket = ownOccurrences >= 2 ? 'internal-only' : 'dead';
    } else if (nonTestHits === 0) {
      bucket = 'tests-only';
    } else {
      continue; // 有生产引用 → 不是候选，不进清单
    }
    entries.push({ file, line: lineNo, name, bucket, hitsInTests: testHits });
  }
}

entries.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const summary = {
  dead: entries.filter((e) => e.bucket === 'dead').length,
  testsOnly: entries.filter((e) => e.bucket === 'tests-only').length,
  internalOnly: entries.filter((e) => e.bucket === 'internal-only').length,
};

// n916f-04（演进 n916d-25）：默认只读——无参数仅打印结果，零写盘副作用；
// --out <path> 写指定路径；--write 才写回默认 JSON（批量刷新用）。
// 任何写盘若目标已存在先写 .bak 再覆盖。判定逻辑与计数口径零改动。
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const explicitOut = outIdx >= 0 ? argv[outIdx + 1] : undefined;
const writeDefault = argv.includes('--write');
const DEFAULT_JSON = 'docs/insights/colony-dead-exports-20260914.json';
const payload = JSON.stringify(
  {
    generatedAt: new Date().toISOString(),
    rule: 'value-exports-only; word-boundary; buckets dead|tests-only|internal-only|wired-dynamically',
    summary,
    entries,
  },
  null,
  1,
);
if (explicitOut !== undefined) {
  fs.mkdirSync('docs/insights', { recursive: true });
  if (fs.existsSync(explicitOut)) {
    fs.copyFileSync(explicitOut, `${explicitOut}.bak`);
  }
  fs.writeFileSync(explicitOut, payload);
  process.stdout.write(`[out] 已写入 ${explicitOut}\n`);
} else if (writeDefault) {
  fs.mkdirSync('docs/insights', { recursive: true });
  if (fs.existsSync(DEFAULT_JSON)) {
    fs.copyFileSync(DEFAULT_JSON, `${DEFAULT_JSON}.bak`);
  }
  fs.writeFileSync(DEFAULT_JSON, payload);
  process.stdout.write(`[write] 已刷新 ${DEFAULT_JSON}（改前快照 ${DEFAULT_JSON}.bak）\n`);
} else {
  process.stdout.write('[read-only] 未指定 --out/--write：仅打印，不写任何 JSON\n');
}
process.stdout.write(
  `scanned files=${files.length} entries=${entries.length} summary=${JSON.stringify(summary)}\n`,
);
