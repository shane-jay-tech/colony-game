/**
 * A4 双字面量对账（c930-26 遗留承继；设计稿=docs/insights/colony-migration-deserialize-dualwrite-design-20260924.md §A4）
 *
 * 不变量：serialize() 的 state 字面量键集 ＝ deserialize() 的 gameState 字面量键集 − 豁免清单。
 * 目的：任何 GameState 非运行时键进存档面（serialize）却漏兜底面（deserialize）⇒ 旧档 undefined
 * 事故形态（设计稿 §A4 原话），当场红。
 *
 * 豁免清单（**禁止静默扩容**，新豁免必须注来历）：
 *   paused / lastTickTimestamp —— deserialize 侧的运行时初值、不在 serialize 的 state 面
 *   （c927-22 设计稿 §二 census 原判：「paused／lastTickTimestamp 是 deserialize 侧的运行时初值、
 *    不在 serialize 的 state 面」；两键由 GameScene 每帧写、不落盘）。
 *
 * 计数漂移注：设计稿 §A4 记「现值 49/51」（9/24 快照：deserialize 非运行时 49 / serialize 51）；
 * 本班现取 serialize=51、deserialize=53（−2 豁免＝51 非运行时）⇒ 两面非运行时键集**相等**，
 * 较设计稿时代 deserialize 侧 +2（9/24 后新字段两侧同步进、无破口），对账不变量成立。
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SAVELOAD_PATH = resolve(__dirname, '../../src/renderer/state/saveLoad.ts');

/** 豁免清单（运行时键；来历见文件头注，扩容须注来历）。 */
const EXEMPT_RUNTIME_KEYS = ['paused', 'lastTickTimestamp'] as const;

/** 设计稿时代计数（9/24 快照，漂移说明用；现值断言在用例内）。 */
const DESIGN_SNAPSHOT = { serialize: 51, deserializeNonRuntime: 49 } as const;

/** 从源码里抠出某锚点之后第一个 `{...}` 块的顶层键集（括号深度匹配，剥注释行）。 */
function extractTopLevelKeys(src: string, fnAnchor: string, blockAnchor: string): string[] {
  const fnIdx = src.indexOf(fnAnchor);
  expect(fnIdx, `锚点 ${fnAnchor} 应在盘`).toBeGreaterThan(-1);
  const blockIdx = src.indexOf(blockAnchor, fnIdx);
  expect(blockIdx, `块锚点 ${blockAnchor} 应在 ${fnAnchor} 之后`).toBeGreaterThan(-1);
  const open = src.indexOf('{', blockIdx);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) {
        const body = src
          .slice(open + 1, j)
          .split('\n')
          .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
          .join('\n');
        const keys: string[] = [];
        let d = 0;
        let cur = '';
        for (const ch of body) {
          if (ch === '{' || ch === '[' || ch === '(') d++;
          if (ch === '}' || ch === ']' || ch === ')') d--;
          if (ch === ',' && d === 0) {
            keys.push(cur);
            cur = '';
          } else cur += ch;
        }
        if (cur.trim()) keys.push(cur);
        return keys
          .map((k) => k.trim().split(/[:?]/)[0]!.trim().replace(/["']/g, ''))
          .filter((k) => /^[A-Za-z_]\w*$/.test(k));
      }
    }
  }
  throw new Error(`块 ${blockAnchor} 未闭合`);
}

function loadLiterals(src: string) {
  return {
    serializeKeys: extractTopLevelKeys(src, 'export function serialize', 'state: {'),
    deserializeKeys: extractTopLevelKeys(src, 'export function deserialize', 'const gameState: GameState = {'),
  };
}

describe('A4 双字面量对账（serialize state ↔ deserialize gameState）', () => {
  const src = readFileSync(SAVELOAD_PATH, 'utf8');
  const { serializeKeys, deserializeKeys } = loadLiterals(src);

  it('serialize state 字面量 51 键、deserialize gameState 53 键（现值；漂移注见文件头）', () => {
    expect(serializeKeys).toHaveLength(51);
    expect(deserializeKeys).toHaveLength(53);
    expect(DESIGN_SNAPSHOT.serialize).toBe(51); // 设计稿 serialize 侧与现值同值
  });

  it('A4 核心不变量：deserialize − 豁免清单 ＝ serialize 键集（集合相等）', () => {
    const nonRuntime = new Set(deserializeKeys.filter((k) => !EXEMPT_RUNTIME_KEYS.includes(k as never)));
    const serSet = new Set(serializeKeys);
    const onlyInSerialize = [...serSet].filter((k) => !nonRuntime.has(k));
    const onlyInDeserialize = [...nonRuntime].filter((k) => !serSet.has(k));
    expect({ onlyInSerialize, onlyInDeserialize }).toEqual({ onlyInSerialize: [], onlyInDeserialize: [] });
  });

  it('豁免清单键确在 deserialize 侧（运行时初值面）且不在 serialize 面（豁免语义自证）', () => {
    for (const k of EXEMPT_RUNTIME_KEYS) {
      expect(deserializeKeys, k).toContain(k);
      expect(serializeKeys, k).not.toContain(k);
    }
  });

  it('两字面量键名零重复（同键写两次会让对账失真）', () => {
    const dup = (arr: string[]) => arr.filter((k, i) => arr.indexOf(k) !== i);
    expect(dup(serializeKeys)).toEqual([]);
    expect(dup(deserializeKeys)).toEqual([]);
  });

  it('变异自证：serialize 键名改写 ⇒ 不变量当场红（内存副本，零触盘）', () => {
    const mutated = src.replace('resources: state.resources,', 'resourcesX: state.resources,');
    expect(mutated).not.toBe(src); // 变异确实生效
    const m = loadLiterals(mutated);
    const nonRuntime = new Set(m.deserializeKeys.filter((k) => !EXEMPT_RUNTIME_KEYS.includes(k as never)));
    const serSet = new Set(m.serializeKeys);
    expect([...serSet].filter((k) => !nonRuntime.has(k))).toEqual(['resourcesX']); // 改名后原键在 serialize 侧失踪=红名现场
  });
});
