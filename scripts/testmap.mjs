#!/usr/bin/env node
// testmap.mjs（c1002-22：tmp/c922-13/analyze.mjs 扶正）——测试面分布图生成器。
// 背景（c922-13 遗留原话）：分析件住 gitignored 的 tmp/，「若分布图要长期化，应收进 scripts/
//   并像 c922-07 的 domain-counts.mts 那样提供 --check」。本件即该收编：参数化输入、零写 tmp。
// 用法：
//   1) npx vitest run --reporter=json --outputFile=tmp/<班名>/vitest.json
//   2) node scripts/testmap.mjs --from tmp/<班名>/vitest.json [--check tmp/<班名>/baseline.json]
// 输出：stdout 打分布图（totals/byDir/top 榜/零直接测试模块清单）；
//       --check 对照基线 json 的 totals 键，任何键不等退出码 1（防测试面静默塌方）。
// 只读：唯一副作用是 stdout（原件写 summary.json 的行为不随迁——落盘交调用方重定向）。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, dirname, extname } from 'node:path';

const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
if (fromIdx < 0 || !args[fromIdx + 1]) {
  console.error('用法：node scripts/testmap.mjs --from <vitest.json> [--check <baseline.json>]');
  process.exit(2);
}
const ROOT = process.cwd();
const rep = JSON.parse(readFileSync(args[fromIdx + 1], 'utf8'));
const results = rep.testResults || rep.suite?.testResults || [];

const perFile = [];
for (const r of results) {
  const rel = relative(ROOT, r.name || r.file).replace(/\\/g, '/');
  const st = r.assertionResults || r.assertions || [];
  perFile.push({
    file: rel,
    tests: st.length,
    failed: st.filter(a => a.status === 'failed').length,
    pending: st.filter(a => a.status === 'pending' || a.status === 'skipped').length,
    durationMs: Math.round((r.endTime - r.startTime) ?? 0),
  });
}
perFile.sort((a, b) => b.tests - a.tests);

function bucket(f) {
  const m = f.match(/^src\/renderer\/(state|data|ui|render|scenes|systems)\//);
  if (m) return m[1];
  if (f.startsWith('src/shared/')) return 'shared';
  if (f.startsWith('src/main/') || f.startsWith('src/preload/')) return 'electron';
  if (f.startsWith('scripts/')) return 'scripts';
  return 'other:' + dirname(f);
}
const byDir = {};
for (const f of perFile) {
  const b = bucket(f.file);
  byDir[b] = byDir[b] || { files: 0, tests: 0, failed: 0, durationMs: 0 };
  byDir[b].files++; byDir[b].tests += f.tests; byDir[b].failed += f.failed; byDir[b].durationMs += f.durationMs;
}

// ---- 零直接测试的生产模块：判据＝该模块 basename 是否被任一 .test.ts 的 import specifier 命中 ----
function walk(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === 'dist') continue; walk(p, acc); }
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const allTs = walk(join(ROOT, 'src'), []).concat(walk(join(ROOT, 'scripts'), []));
const testFiles = allTs.filter(p => /\.test\.tsx?$/.test(p));
const prodFiles = allTs.filter(p => !/\.test\.tsx?$/.test(p) && !p.includes('__tests__'));
const testTexts = testFiles.map(p => readFileSync(p, 'utf8'));
const importersOf = new Map();
for (const p of prodFiles) {
  const name = basename(p, extname(p));
  const re = new RegExp(`from\\s+['"][^'"]*/${name}['"]|from\\s+['"]\\./${name}['"]`);
  let n = 0;
  for (const t of testTexts) if (re.test(t)) n++;
  importersOf.set(relative(ROOT, p).replace(/\\/g, '/'), n);
}
const zeroTest = [...importersOf.entries()].filter(([, n]) => n === 0).map(([f]) => f);

const out = {
  totals: {
    testFiles: perFile.length,
    tests: perFile.reduce((s, f) => s + f.tests, 0),
    failed: perFile.reduce((s, f) => s + f.failed, 0),
    pending: perFile.reduce((s, f) => s + f.pending, 0),
    sumFileWallMs: perFile.reduce((s, f) => s + f.durationMs, 0),
    prodModules: prodFiles.length,
    zeroDirectTestModules: zeroTest.length,
  },
  byDir,
  topByTests: perFile.slice(0, 12).map(f => [f.file, f.tests, f.durationMs]),
  topByDuration: [...perFile].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10).map(f => [f.file, f.durationMs, f.tests]),
  smallest: perFile.filter(f => f.tests <= 2).length,
  zeroTestList: zeroTest,
};
console.log(JSON.stringify({ totals: out.totals, byDir, topByTests: out.topByTests, topByDuration: out.topByDuration, smallest: out.smallest }, null, 1));
console.log('zeroDirectTestModules:', out.totals.zeroDirectTestModules);
if (process.argv.includes('--list-zero')) console.log(out.zeroTestList.join('\n'));

// --check：对照基线 json 的 totals 键（任何键不等退出码 1）
const checkIdx = args.indexOf('--check');
if (checkIdx >= 0 && args[checkIdx + 1]) {
  const baseline = JSON.parse(readFileSync(args[checkIdx + 1], 'utf8'));
  const ref = baseline.totals ?? baseline;
  const drifts = Object.entries(ref).filter(([k, v]) => out.totals[k] !== v);
  if (drifts.length > 0) {
    for (const [k, v] of drifts) console.error(`[drift] ${k}: baseline=${v} current=${out.totals[k]}`);
    process.exit(1);
  }
  console.log('[check] 基线全等');
}
