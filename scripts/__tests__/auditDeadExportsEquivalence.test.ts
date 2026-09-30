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
  for (const e of entries) {
    const re = new RegExp(`\\b${e.name.replace(/\$/g, '\\$')}\\b`, 'g');
    let hits = 0;
    for (const txt of corpus) hits += (txt.match(re) || []).length;
    expect(hits, e.name).toBe(e.hitsInTests);
  }
});
