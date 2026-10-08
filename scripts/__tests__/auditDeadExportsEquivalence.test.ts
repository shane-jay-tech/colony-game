/**
 * c930-12：slowtail 常驻「结果集等价」守卫（G1 自比对＋G2 结构不变量）。
 * 出处：docs/insights/c927-64-slowtail.md §4（推荐 G1＋G2；G3 金档钉值因「待删导出会自然减少」不采）。
 * - G1 抓「同输入不同输出」的非确定性（缓存/排序回归）——同树两次 --out，去 generatedAt 后 sha 全等。
 * - G2 抓「hitsInTests 算错而门禁不红」（c924-11 遗留 2 点名的缓存错键型；c927-64 §〇.3 已用
 *   basename 变异实证本套断言有牙：entries 106→111、summary dead 0→2、sha 173b566e→32fd1eee）。
 * naive 重扫的 testFiles 集合与脚本 walkTests 同口径（只收 src 下所有 __tests__ 子树的 .ts/.mts，B-151）。
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const SCRIPT = 'scripts/audit-dead-exports.mjs';

function runOnce(outPath: string): void {
  execSync(`node ${SCRIPT} --out ${JSON.stringify(outPath)}`, { cwd: ROOT, stdio: 'ignore' });
}

function normalizedSha(path: string): string {
  const obj = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  delete obj.generatedAt;
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

const OUT_A = join(tmpdir(), `c930-12-equiv-a-${process.pid}.json`);
const OUT_B = join(tmpdir(), `c930-12-equiv-b-${process.pid}.json`);

test('G1 自比对：同树两次运行结果集（去 generatedAt）sha 全等', () => {
  runOnce(OUT_A);
  runOnce(OUT_B);
  expect(normalizedSha(OUT_A)).toBe(normalizedSha(OUT_B));
});

test('G2 结构不变量：bucket↔hitsInTests 自洽＋朴素重扫逐条一致', () => {
  const obj = JSON.parse(readFileSync(OUT_A, 'utf8')) as {
    entries: Array<{ file: string; name: string; bucket: string; hitsInTests: number }>;
    summary: Record<string, number>;
  };
  const entries = obj.entries;
  expect(entries.length).toBeGreaterThan(0);
  for (const e of entries) {
    if (e.bucket === 'tests-only') expect(e.hitsInTests, e.name).toBeGreaterThan(0);
    else expect(e.hitsInTests, `${e.name} (${e.bucket})`).toBe(0);
  }
  expect(obj.summary.testsOnly).toBe(entries.filter((e) => e.bucket === 'tests-only').length);

  // 朴素重扫：词边界计数，与脚本 walkTests 同集合（只收 __tests__ 子树；B-151 自计污染教训——
  // corpus 混入生产码会让 hitsInTests 平白多出非测试命中，本次内联首版即踩，守卫自身咬出来了）
  const corpus: string[] = [];
  function collectFiles(dir: string): void {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) collectFiles(p);
      else if (p.endsWith('.ts') || p.endsWith('.mts')) corpus.push(readFileSync(p, 'utf8'));
    }
  }
  function collectAllTests(dir: string): void {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === '__tests__') collectFiles(p);
        else collectAllTests(p);
      }
    }
  }
  collectAllTests(join(ROOT, 'src'));
  // c1011-02 对齐：hitsInTests 语义改为「真实测试使用」（import/再导出块行不算，与工具同口径）——
  // 朴素重扫仍独立实现计数（非调用工具函数），只是对齐掩蔽语义后继续抓计数错误与桶错分。
  const IMPORT_START = /^\s*import\b/;
  const EXPORT_BLOCK_START = /^\s*export\s*\{/;
  function countRealUsages(txt: string, re: RegExp): number {
    let hits = 0;
    let block: 'import' | 'export' | null = null;
    for (const line of txt.split('\n')) {
      let masked = false;
      if (block === null) {
        if (IMPORT_START.test(line)) {
          block = 'import';
          masked = true;
          if (/from\s*['"]/.test(line)) block = null;
        } else if (EXPORT_BLOCK_START.test(line)) {
          block = 'export';
          masked = true;
          if (/\}/.test(line) && /from\s*['"]|[;]\s*$/.test(line)) block = null;
        }
      } else {
        masked = true;
        const closed = block === 'import' ? /from\s*['"]/.test(line) : /\}/.test(line);
        if (closed) block = null;
      }
      if (!masked) {
        re.lastIndex = 0; // /g 粘性复位（与工具 countHits 同纪律）
        if (re.test(line)) hits += 1; // 按行计（与工具 wordRe.test 同粒度，非出现次）
      }
    }
    return hits;
  }
  for (const e of entries) {
    const re = new RegExp(`\\b${e.name.replace(/\$/g, '\\$')}\\b`, 'g');
    let hits = 0;
    for (const txt of corpus) hits += countRealUsages(txt, re);
    expect(hits, e.name).toBe(e.hitsInTests);
  }
});
