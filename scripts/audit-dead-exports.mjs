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
(function walkTests(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTests(p);
    else if (p.endsWith('.ts') || p.endsWith('.mts')) testFiles.push(p);
  }
})('src');

const EXPORT_RE = /^export\s+(?:const|function|class|let)\s+([A-Za-z_$][\w$]*)/gm;
const entries = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
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
      nonTestHits += (fs.readFileSync(other, 'utf8').match(wordRe) || []).length;
    }
    for (const t of testFiles) {
      const txt = fs.readFileSync(t, 'utf8');
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

// n916d-25：输出参数化——默认仍写原 JSON（兼容）；--out <path> 指定输出路径；
// --write 未给且目标已存在时先写 .bak 再覆盖（消除「只读复核即覆盖」副作用，
// n916c-17 披露清偿）。判定逻辑与计数口径零改动。
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const outPath = outIdx >= 0 ? argv[outIdx + 1] : 'docs/insights/colony-dead-exports-20260914.json';
const allowOverwrite = argv.includes('--write');
fs.mkdirSync('docs/insights', { recursive: true });
if (!allowOverwrite && fs.existsSync(outPath)) {
  fs.copyFileSync(outPath, `${outPath}.bak`);
}
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      rule: 'value-exports-only; word-boundary; buckets dead|tests-only|internal-only|wired-dynamically',
      summary,
      entries,
    },
    null,
    1,
  ),
);
process.stdout.write(
  `scanned files=${files.length} entries=${entries.length} summary=${JSON.stringify(summary)}\n`,
);
