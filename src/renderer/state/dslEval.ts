/**
 * 微型 DSL 评估器 — 用于 CourtEvent.triggers / RoyalDecree.unlockCondition / BadgeRule.condition
 * 之类的字符串谓词。设计目标是"够用但不要变成完整脚本引擎"：
 *
 *   - 'random'                          → 概率性触发（trigger.value 是概率，单独路径处理）
 *   - 'season == summer'                → 字面量字符串比较
 *   - 'country_grain < 50'              → 数值比较（lhs 来自 CountryMetrics）
 *   - 'year >= 5'                       → 数值比较
 *   - 'country_population'              → bare identifier，做 truthy 检查（>0）
 *
 * 不支持：括号 / && / || / 函数调用 / 字符串拼接。这些在 v0.7 数据里用不上；如果 Slice G
 * 后内容扩张需要复杂条件，组合多个 trigger（语义上是 AND）通常已经够用。
 */

import type { ResourceId } from '../data/resourceRegistry';
import { isValidResourceId } from '../data/resourceRegistry';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_NAMES_DSL: readonly SeasonName[] = ['spring', 'summer', 'autumn', 'winter'];

/**
 * DSL 求值时 caller 提供的状态快照。所有"国家级"指标在调用前由 ModifierAggregator
 * 算好；DSL 自身不感知 modifier 体系，这样测试时可以直接喂数字。
 */
export interface CountryMetrics {
  /** 资源现值（grain/wood/etc）；DSL 通过 country_<resource> 查询 */
  resources: Readonly<Partial<Record<ResourceId, number>>>;
  /** 通过 modifier 聚合后的"现行" people 总量 */
  population: number;
  /** 通过 modifier 聚合后的"现行"民心（默认 base 50） */
  morale: number;
  /** A1：现行怨愤（0..100，明文状态 + country_wrath modifier 叠加） */
  wrath: number;
  /** 通过 modifier 聚合后的"现行"军力（默认 base 0） */
  militaryPower: number;
  /** 当前年（0-indexed） */
  year: number;
  /** 当前季（0=spring, 1=summer, 2=autumn, 3=winter） */
  season: 0 | 1 | 2 | 3;
  /** 当前年度内第几日（0-indexed） */
  dayOfYear: number;
  /** 0..1 均匀分布的随机源；测试时可注入确定性 RNG */
  rng: () => number;
  /** 国格等级（0-5） */
  grade?: number;
  /** Phase3 故事维度（沙盒模式缺省：chapter=-1 / 双轴=0），供事件 trigger 与 context 按章/按轴门控 */
  storyChapter?: number;
  storyPowerAxis?: number;
  storyResourceAxis?: number;
}

export class DslSyntaxError extends Error {
  constructor(public readonly expr: string, message: string) {
    super(`[DSL] "${expr}": ${message}`);
  }
}

const COMPARE_OPS = ['==', '!=', '<=', '>=', '<', '>'] as const;
type CompareOp = typeof COMPARE_OPS[number];

interface Comparison {
  lhs: string;
  op: CompareOp;
  rhs: string;
}

function parseComparison(expr: string): Comparison | null {
  const trimmed = expr.trim();
  // Try operators in order — '<=' / '>=' / '==' / '!=' before '<' / '>'
  for (const op of COMPARE_OPS) {
    const idx = trimmed.indexOf(op);
    if (idx > 0) {
      const lhs = trimmed.slice(0, idx).trim();
      const rhs = trimmed.slice(idx + op.length).trim();
      if (lhs.length === 0 || rhs.length === 0) {
        throw new DslSyntaxError(expr, `operator "${op}" needs both sides`);
      }
      return { lhs, op, rhs };
    }
  }
  return null;
}

function resolveLhs(key: string, ctx: CountryMetrics): { kind: 'number' | 'string'; value: number | string } {
  if (key === 'year') return { kind: 'number', value: ctx.year };
  if (key === 'season') return { kind: 'string', value: SEASON_NAMES_DSL[ctx.season] ?? 'spring' };
  if (key === 'day_of_year') return { kind: 'number', value: ctx.dayOfYear };
  if (key === 'grade') return { kind: 'number', value: ctx.grade ?? 0 };
  if (key === 'country_population') return { kind: 'number', value: ctx.population };
  if (key === 'country_morale') return { kind: 'number', value: ctx.morale };
  if (key === 'country_wrath') return { kind: 'number', value: ctx.wrath };
  if (key === 'country_military_power') return { kind: 'number', value: ctx.militaryPower };
  // Phase3 故事维度（沙盒缺省：chapter=-1，双轴=0）
  if (key === 'story_chapter') return { kind: 'number', value: ctx.storyChapter ?? -1 };
  if (key === 'story_power_axis') return { kind: 'number', value: ctx.storyPowerAxis ?? 0 };
  if (key === 'story_resource_axis') return { kind: 'number', value: ctx.storyResourceAxis ?? 0 };

  // country_<resourceId>
  if (key.startsWith('country_')) {
    const resId = key.slice('country_'.length);
    if (isValidResourceId(resId)) {
      return { kind: 'number', value: ctx.resources[resId as ResourceId] ?? 0 };
    }
  }

  throw new DslSyntaxError(key, `unknown identifier (legal: grade, country_<resource>, country_population, country_morale, country_wrath, country_military_power, year, season, day_of_year, story_chapter, story_power_axis, story_resource_axis)`);
}

function parseRhs(token: string, expectedKind: 'number' | 'string'): number | string {
  if (expectedKind === 'number') {
    const n = Number(token);
    if (Number.isFinite(n)) return n;
    throw new DslSyntaxError(token, `expected number, got "${token}"`);
  }
  // strip optional surrounding quotes
  const stripped = token.replace(/^["']|["']$/g, '');
  return stripped;
}

function compare(lhs: number | string, op: CompareOp, rhs: number | string): boolean {
  if (typeof lhs === 'string' || typeof rhs === 'string') {
    // mixed-type comparison: only == / != allowed (string equality)
    const ls = String(lhs);
    const rs = String(rhs);
    if (op === '==') return ls === rs;
    if (op === '!=') return ls !== rs;
    return false; // <, >, <=, >= on strings → always false (defensive; shouldn't happen with sane DSL)
  }
  switch (op) {
    case '==': return lhs === rhs;
    case '!=': return lhs !== rhs;
    case '<':  return lhs < rhs;
    case '<=': return lhs <= rhs;
    case '>':  return lhs > rhs;
    case '>=': return lhs >= rhs;
  }
}

/**
 * 评估一个 DSL 谓词。
 *   - 'random' 不在这里处理（trigger 层根据 trigger.condition === 'random' 单独消费 trigger.value）
 *   - 比较表达式：按 parseComparison 解析后求值
 *   - bare identifier：解析为数值，做 > 0 检查（"truthy"）
 *
 * 抛 DslSyntaxError 当表达式无法识别 — 让静态数据校验在启动时就发现，比上线后静默失败强。
 */
export function evalPredicate(expr: string, ctx: CountryMetrics): boolean {
  if (expr === 'random') {
    throw new DslSyntaxError(expr, "'random' must be handled by trigger sampler with trigger.value, not evalPredicate");
  }

  const comp = parseComparison(expr);
  if (comp) {
    const resolved = resolveLhs(comp.lhs, ctx);
    const rhs = parseRhs(comp.rhs, resolved.kind);
    return compare(resolved.value, comp.op, rhs);
  }

  // bare identifier → truthy check
  const bare = resolveLhs(expr.trim(), ctx);
  if (bare.kind === 'number') return (bare.value as number) > 0;
  return (bare.value as string).length > 0;
}

/**
 * 静态数据校验入口：在启动期对每条已知 DSL 表达式 dry-run 解析（不求值），
 * 抓出拼写错（unknown identifier）/ 缺操作数 / 不支持的运算符。
 */
export function validateDslExpr(expr: string): void {
  if (expr === 'random') return;
  const comp = parseComparison(expr);
  // resolveLhs uses a "dummy" ctx — we only care about IDENTIFIER validity
  const dummyCtx: CountryMetrics = {
    resources: {},
    population: 0,
    morale: 0,
    wrath: 0,
    militaryPower: 0,
    year: 0,
    season: 0,
    dayOfYear: 0,
    rng: () => 0,
  };
  if (comp) {
    const resolved = resolveLhs(comp.lhs, dummyCtx);
    parseRhs(comp.rhs, resolved.kind);
  } else {
    resolveLhs(expr.trim(), dummyCtx);
  }
}
