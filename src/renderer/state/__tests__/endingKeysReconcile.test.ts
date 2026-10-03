/**
 * c1002-12（c923-29 遗留）：跨源同集合断言——`ENDING_NARRATION` 键集（data/storyChapters.ts，
 * Record<'gong'|'jia'|'huo', string[]>）≡ `state/storyDriver.checkEnding` 返回值域。
 *
 * 为什么落在本目录：c923-29 已裁——data/__tests__/ 的 dataLayerBoundary 头注把 `../state/`
 * 字面判零命中 ⇒ 跨 state 侧 import 的断言只能落 state/__tests__/（本件）。
 *
 * 钉法：checkEnding 三分支（'devolve'+'public'→gong / 'centralize'→jia / 兜底→huo）
 * 逐一触发收集返回值集合，与 Object.keys(ENDING_NARRATION) 集合相等。任一侧手写枚举
 * 漂移（加结局不配词／配词不加枚举）即红。
 * GameScene.ts:133 消费点（`if (!ending || !ENDING_NARRATION[ending]) return`，c923-29 记 :132
 * 已漂 1 行）依赖两集合一致——不一致时该守卫静默吞结局，本断言就是它的上游保险。
 */
import { describe, it, expect } from 'vitest';
import { checkEnding } from '../storyDriver';
import { ENDING_NARRATION } from '../../data/storyChapters';

describe('c1002-12 ENDING_NARRATION 键集 ≡ checkEnding 返回值域（跨源同集合）', () => {
  it('checkEnding 三分支实跑收集的返回值集合 === Object.keys(ENDING_NARRATION)', () => {
    // 枚举 powerBand/resourceBand 的组合空间（非有限枚举 → 粗扫有代表性网格，覆盖三分支）
    const got = new Set<string>();
    for (let p = -100; p <= 100; p += 10) {
      for (let r = -100; r <= 100; r += 10) {
        got.add(checkEnding(p, r));
      }
    }
    const narrationKeys = Object.keys(ENDING_NARRATION);
    expect(narrationKeys.sort()).toEqual([...got].sort());
    // 三分支各自可达（集合相等≠三分支都活着：全返 'huo' 的退化实现也能凑出单元素集合）
    expect(got.has('gong')).toBe(true);
    expect(got.has('jia')).toBe(true);
    expect(got.has('huo')).toBe(true);
  });

  it('词表每键非空数组（ENDING_NARRATION[ending] 真值守卫的另一半：空词=同型静默吞）', () => {
    for (const [key, lines] of Object.entries(ENDING_NARRATION)) {
      expect(Array.isArray(lines) && lines.length > 0, `ENDING_NARRATION.${key} 应为非空词组`).toBe(true);
    }
  });
});
