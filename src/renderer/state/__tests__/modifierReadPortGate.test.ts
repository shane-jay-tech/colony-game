/**
 * c924-09（inbox `20260924-0045-pd09`，案 B）：colony 修饰符「上架即校验有读取口」门禁。
 *
 * 背景：台账 #82（`docs/insights/drain-20260923-pending-human.md`）＋普查档
 *   `docs/insights/colony-modifier-zeroconsumer-census-20260923.md` 第四节实测——
 *   运行时读修饰符的入口只有 4 个函数（`state/modifierAggregator.ts`），非测试调用点已穷举
 *   且排除动态拼键 ⇒ 注册表 27 键里只有 15 键有真读取口，12 键无（其中 7 键数据面很肥）。
 *
 * 本文件只做**案 B**：防继续扩大。
 *   - 零生产码改动（不接线、不改任何经济平衡数值／修饰符数值／注册表键）。
 *   - 案 A（把那 12 键接进运行时）踩经济平衡红线、需人工先定数值语义 ⇒ 本轮不开单，
 *     下方 `NO_READER_WHITELIST` 即"存量例外登记表"，**注明待人工定数值语义后接线**。
 *
 * 判据口径（照抄实现、不新造抽象）：
 *   - 「读取口」＝ 4 个入口函数在**非测试**源文件里的调用点，其 target 实参为
 *     ①∈注册表的字符串字面量，或 ②由同文件的 target 生产位（`return '<key>'` / `key: '<key>'`）
 *     解析出的字面量（`productionSystem.ts` 的 `outputTargetFor`/`consumptionTargetFor` 形态）。
 *   - 入口函数名与 target 形参位置都从 `../modifierAggregator.ts` 的**源码签名**现读，
 *     名字表与本文件各自双向钉桩 ⇒ 有人加第 5 个入口／改签名，本门禁先红。
 *
 * 与在册邻居的分工（勿重复计账）：
 *   - `data/__tests__/storyEffectsTargets.test.ts:256-274` 钉的是**数据表消费面**（四表并集 22 键／
 *     未消费 5 键）；本文件钉的是**运行时读取面**（15 有／12 无）。两面口径不同、集合也不同。
 *   - 本目录（`state/__tests__/`）不受 data 层字面门禁约束（那条判据只扫 `src/renderer/data/__tests__/`）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as aggregator from '../modifierAggregator';
import { MODIFIER_TARGETS } from '../../data/resourceRegistry';

const SRC_ROOT = resolve(__dirname, '../..'); // src/renderer
const AGGREGATOR_FILE = join(SRC_ROOT, 'state', 'modifierAggregator.ts');

/** 4 个入口函数名：照抄 `state/modifierAggregator.ts` 实现，不新造抽象。 */
const READER_FNS = ['aggregateModifiers', 'applyModifiers', 'getAddDelta', 'getMulFactor'] as const;

/**
 * 存量无读取口键的显式白名单（7 枚，实测口径见普查档 4.2 表；c1001-02 摘牌 5 枚退役）。
 * ⚠ 语义＝**待人工定数值语义后接线**（案 A 未授权；本文件不接线、不改任何数值）。
 * 任一键真被接上读取口，③ 号用例即红 ⇒ 同笔把该键从本表删掉（防登记表腐烂）。
 */
const NO_READER_WHITELIST: readonly string[] = [
  'building_output_area', // J-3 v0.8 后加键，未接运行时
  'country_diplomacy_weight', // 数据肥（四表 36 行）＝已上架效果静默失效，待人工定数值语义
  'country_research_speed', // 数据肥（16 行），同上
  'event_positive_probability', // 数据 5 行＝静默失效，待人工定数值语义
  'population_class_growth_nong', // 数据 3 行
  'population_class_growth_shi', // 数据 4 行
  'population_happiness', // 数据 3 行
];

/** 只扫真实源文件：排除 __tests__ / __fixtures__（测试里出现键名**不算**读取口）。 */
function collectTs(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === '__fixtures__' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) collectTs(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** 顶层逗号切分（跳过引号内与嵌套括号内），用于参数表／实参表。 */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const ch of s) {
    if (quote !== null) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** 从 `(` 下标走到配对 `)`，返回实参表原文（不配对返回 null）。 */
function argsTextOf(src: string, openIdx: number): string | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i] as string;
    if (quote !== null) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

/** 从实现源码签名里穷举「带 `target: ModifierTargetKey` 形参的导出函数」＋该形参的位置。 */
function readerSignatures(src: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of src.matchAll(/export function (\w+)\s*\(([^)]*)\)/g)) {
    const name = m[1] as string;
    const params = splitTopLevel(m[2] ?? '').map((p) => p.trim());
    const idx = params.findIndex((p) => /^target\??\s*:/.test(p));
    if (idx >= 0 && /target\??\s*:\s*ModifierTargetKey/.test(params[idx] as string)) out.set(name, idx);
  }
  return out;
}

const AGG_SRC = readFileSync(AGGREGATOR_FILE, 'utf8');
const SIGNATURES = readerSignatures(AGG_SRC);
const ALL_FILES = collectTs(SRC_ROOT);
const REGISTRY: readonly string[] = MODIFIER_TARGETS;
const isKey = (s: string): boolean => REGISTRY.includes(s);
const rel = (p: string): string => relative(SRC_ROOT, p).replace(/\\/g, '/');

interface CallSite {
  readonly file: string;
  readonly fn: string;
  readonly arg: string;
  readonly line: number;
}

/** 全仓非测试的入口函数调用点（定义方 modifierAggregator.ts 自身除外的委托不算消费）。 */
function collectCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  const callRe = new RegExp(`(?<![\\w$.])(${READER_FNS.join('|')})\\s*\\(`, 'g');
  for (const file of ALL_FILES) {
    if (file === AGGREGATOR_FILE) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(callRe)) {
      const fn = m[1] as string;
      const openIdx = (m.index ?? 0) + m[0].length - 1;
      const inner = argsTextOf(src, openIdx);
      if (inner === null) continue;
      const idx = SIGNATURES.get(fn);
      if (idx === undefined) continue;
      const arg = (splitTopLevel(inner)[idx] ?? '').trim();
      if (arg === '') continue;
      sites.push({ file, fn, arg, line: src.slice(0, m.index ?? 0).split('\n').length });
    }
  }
  return sites;
}

const CALL_SITES = collectCallSites();
const LINE_OF = (src: string, needleIdx: number): number => src.slice(0, needleIdx).split('\n').length;

/** ①字面量实参 ⇒ 直接命中；②非字面量 ⇒ 记下该文件走 target 生产位解析。 */
const LITERAL_KEYS = new Set<string>();
const INDIRECT_FILES = new Set<string>();
const DYNAMIC_TEMPLATE_SITES: string[] = [];
const UNPARSED_SITES: string[] = [];

for (const s of CALL_SITES) {
  const lit = /^(['"])([a-z_]+)\1$/.exec(s.arg);
  if (lit) {
    const key = lit[2] as string;
    if (!isKey(key)) {
      UNPARSED_SITES.push(`${rel(s.file)}:${s.line} ${s.fn}('${key}') 实参不在注册表`);
      continue;
    }
    LITERAL_KEYS.add(key);
    continue;
  }
  if (s.arg.includes('`')) {
    DYNAMIC_TEMPLATE_SITES.push(`${rel(s.file)}:${s.line} ${s.fn}(${s.arg})`);
    continue;
  }
  INDIRECT_FILES.add(s.file);
}

/** target 生产位解析：`return '<key>'` / `key: '<key>'`（productionSystem 的两个映射函数形态）。 */
const PRODUCED_KEYS = new Map<string, string[]>();
const PRODUCED_SITES: string[] = [];
for (const file of INDIRECT_FILES) {
  const src = readFileSync(file, 'utf8');
  const produced: string[] = [];
  for (const m of src.matchAll(/(?:return|:)\s*(['"])([a-z_]+)\1/g)) {
    const key = m[2] as string;
    if (!isKey(key)) continue;
    produced.push(key);
    PRODUCED_SITES.push(`${rel(file)}:${LINE_OF(src, m.index ?? 0)} → ${key}`);
  }
  PRODUCED_KEYS.set(file, [...new Set(produced)].sort());
}

/** 读取口全集（两面并集）＋逐键证据行。 */
const READ_KEYS = new Set<string>(LITERAL_KEYS);
for (const keys of PRODUCED_KEYS.values()) for (const k of keys) READ_KEYS.add(k);
const EVIDENCE: string[] = [
  ...CALL_SITES.map((s) => `${rel(s.file)}:${s.line} ${s.fn}(${s.arg})`),
  ...PRODUCED_SITES,
];

const WHITELIST = [...NO_READER_WHITELIST].sort();
const SORTED_READ = [...READ_KEYS].sort();
const NOT_IN_EITHER = REGISTRY.filter((k) => !READ_KEYS.has(k) && !WHITELIST.includes(k)).sort();
const IN_BOTH = SORTED_READ.filter((k) => WHITELIST.includes(k));

describe('c924-09 修饰符「上架即校验有读取口」门禁（案 B：零生产码，不接线不改数值）', () => {
  it('① 入口函数集合穷举自证：门禁只认实现里那 4 个读取函数', () => {
    // 名字表 ⇄ 实现源码签名 双向等式（加第 5 个入口／改名，本用例即红）
    expect([...SIGNATURES.keys()].sort()).toEqual([...READER_FNS].sort());
    // 运行时同体自证：4 个名字确实是从 modifierAggregator 导出的函数，且 target 都在形参位
    for (const fn of READER_FNS) {
      expect(typeof (aggregator as Record<string, unknown>)[fn], `${fn} 应为函数`).toBe('function');
      expect(SIGNATURES.has(fn), `${fn} 的签名应带 target: ModifierTargetKey 形参`).toBe(true);
    }
    // 覆盖面自证：扫描集非空，否则"零读取口"会假绿
    expect(ALL_FILES.length, '非测试源文件数').toBeGreaterThan(50);
    expect(CALL_SITES.length, '入口函数非测试调用点数').toBeGreaterThan(0);
  });

  it('② 主门禁：注册表每一键至少有一个非测试读取口，或在显式白名单内', () => {
    expect(
      NOT_IN_EITHER,
      `无读取口且未登记的键（＝新静默上架，禁止）：${NOT_IN_EITHER.join(', ')}\n` +
        `现有读取口证据行：\n${EVIDENCE.join('\n')}`,
    ).toEqual([]);
  });

  it('③ 白名单自锁：7 例外键必须确实无读取口，且并集覆盖全表', () => {
    expect(WHITELIST.length, '白名单条数').toBe(7);
    for (const k of WHITELIST) expect(isKey(k), `白名单键 ${k} 应存在于注册表`).toBe(true);
    // 任一例外键被接线 ⇒ 本用例红 ⇒ 同笔把它从白名单删掉（登记表不得腐烂）
    expect(IN_BOTH, '白名单键却已有读取口（应接线后摘牌）').toEqual([]);
    // 无遗漏无重复：读取口 ∪ 白名单 == 注册表
    expect([...new Set([...SORTED_READ, ...WHITELIST])].sort(), '两面并集').toEqual([...REGISTRY].sort());
  });

  it('④ 闭合自证：target 实参零动态拼键，间接读取口只在在册文件里（新增间接文件须复核）', () => {
    expect(DYNAMIC_TEMPLATE_SITES, '模板字面量拼出的 target（穷举会失效，须人工复核）').toEqual([]);
    expect(UNPARSED_SITES, '实参字面量不在注册表的调用点').toEqual([]);
    expect(
      [...INDIRECT_FILES].map(rel).sort(),
      '间接传 target 的文件集（新增即须复核其 target 生产位）',
    ).toEqual(['state/productionSystem.ts']);
    expect([...PRODUCED_KEYS.values()].flat().length, 'target 生产位解析出的键数').toBe(8);
  });

  it('⑤ 计数钉子：注册表 22 键 ＝ 15 有读取口 ＋ 7 白名单例外（c1001-02 五键退役）', () => {
    expect(REGISTRY.length, 'MODIFIER_TARGETS 键数（改动须同笔交代门禁）').toBe(22);
    expect(SORTED_READ.length, '有读取口键数').toBe(15);
    expect(NOT_IN_EITHER.length, '既无读取口又未登记的键数').toBe(0);
  });
});
