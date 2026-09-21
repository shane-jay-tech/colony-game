// c922-10：evt_art 插画键「用量对账」钉桩。
// 磁盘事实（本单开工前实测，2026-09-21）：
//   - artManifest EVENT_ART 10 键（artManifest.ts:71-80），public/art/events/ 10 个 .webp 逐名对应；
//   - 静态引用 5 处（events.ts:27/98/203 + storyEvents.ts:23/197），去重后 4 个键；
//   - 动态引用 1 处（GameScene.ts:138 `evt_art_ending_${ending}`），只覆盖 ending_* 三键；
//   - 故 coronation / feast / unification 三键「零引用」——本文件把这三键的**现状**钉死，
//     不擅自删键、不擅自接线（退役与否属人工判定，见 ⑤）。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_ART } from '../artManifest';
import { EVENTS } from '../events';
import { STORY_EVENTS } from '../storyEvents';
import { ENDING_NARRATION } from '../storyChapters';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const SRC = join(ROOT, 'src');
const EVENTS_DIR = join(ROOT, 'public', 'art', 'events');
const MANIFEST_KEYS = EVENT_ART.map(a => a.key);

/** c922-07 同款纪律：不 grep `id:` 猜数量，先证明 EVENTS 已含全部故事事件（276 行拼接），
 *  这样「扫 EVENTS 一遍」就是静态引用全集，不会漏 STORY_EVENTS。 */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  const manifestFile = join(SRC, 'renderer', 'data', 'artManifest.ts');
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue; // 测试脚手架里的键名不是运行时引用
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(p));
    else if (/\.tsx?$/.test(entry.name) && p !== manifestFile) out.push(p); // 定义面 ≠ 引用面
  }
  return out;
}

/** 去掉 // 行注释与 /* *\/ 块注释：注释里提到 'evt_art_flood' 不构成引用。 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** 整键面：'evt_art_xxx'；动态面：`evt_art_xxx_${`（模板前缀，展开后才是真键）。 */
const PROD_FILES = collectTsFiles(SRC);
const staticKeysFromSource = new Set<string>();
const dynamicPrefixes = new Set<string>();
for (const file of PROD_FILES) {
  const code = stripComments(readFileSync(file, 'utf8'));
  for (const m of code.matchAll(/'evt_art_[a-z][a-z0-9_]*'|`evt_art_[a-z0-9_]*_\$\{/g)) {
    if (m[0].startsWith('`')) dynamicPrefixes.add(m[0].slice(1, -2)); // 去掉反引号与尾部 `${
    else staticKeysFromSource.add(m[0].slice(1, -1));
  }
}

describe('c922-10 evt_art 键用量对账', () => {
  it('① 覆盖面自证：清单 10 键、public/art/events 10 图、EVENTS 含全部故事事件', () => {
    expect(MANIFEST_KEYS).toHaveLength(10);
    expect(new Set(MANIFEST_KEYS).size).toBe(10); // 无重名，否则下面的集合差会失真
    expect(readdirSync(EVENTS_DIR).filter(f => f.endsWith('.webp'))).toHaveLength(10);
    const storyIds = STORY_EVENTS.map(e => e.id);
    expect(EVENTS.length).toBeGreaterThan(STORY_EVENTS.length);
    expect(EVENTS.filter(e => storyIds.includes(e.id))).toHaveLength(STORY_EVENTS.length);
    // 扫到东西才继续（防空转：路径写错时 PROD_FILES 为空、集合恒空即「假绿」）
    expect(PROD_FILES.length).toBeGreaterThan(50);
    expect(staticKeysFromSource.size).toBeGreaterThan(0);
  });

  it('② 静态引用键 ⊆ EVENT_ART 清单（数据面 + 源码面同源）', () => {
    const fromData = EVENTS
      .map(e => e.illustrationKey)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
    expect(fromData).toHaveLength(5);            // 钉死 5 处，防「全量扫」退化成扫空气
    expect(new Set(fromData).size).toBe(4);      // 去重 4 键（flood 被基础事件与故事事件各引一次）
    for (const k of fromData) expect(MANIFEST_KEYS).toContain(k);
    // 源码面（去注释、排除 __tests__）必须与数据面逐键相等：多一个键说明有人绕过数据层硬写
    expect([...staticKeysFromSource].sort()).toEqual([...new Set(fromData)].sort());
  });

  it('③ 动态前缀 × 三结局后缀均在清单内', () => {
    expect([...dynamicPrefixes]).toEqual(['evt_art_ending_']); // 全库仅此一处模板
    const suffixes = Object.keys(ENDING_NARRATION);            // 与 GameScene.ts:131 的守卫同一枚举源
    expect(suffixes.sort()).toEqual(['gong', 'huo', 'jia']);
    const resolved = suffixes.map(s => `evt_art_ending_${s}`);
    for (const k of resolved) expect(MANIFEST_KEYS).toContain(k);
    // 双向：清单里的 ending_* 键也只能由这三后缀解释（防「加了图不接线」悄悄混进零引用面）
    expect(MANIFEST_KEYS.filter(k => k.startsWith('evt_art_ending_')).sort()).toEqual(resolved);
    for (const k of resolved) {
      const entry = EVENT_ART.find(a => a.key === k)!;
      expect(existsSync(join(ROOT, 'public', entry.path))).toBe(true);
    }
  });

  it('④ 三键零引用现状钉桩（coronation/feast/unification）', () => {
    const referenced = new Set<string>([
      ...staticKeysFromSource,
      ...Object.keys(ENDING_NARRATION).map(s => `evt_art_ending_${s}`),
    ]);
    const zeroRef = MANIFEST_KEYS.filter(k => !referenced.has(k)).sort();
    expect(zeroRef).toEqual(['evt_art_coronation', 'evt_art_feast', 'evt_art_unification']);
    // 有图有清单纯没消费者：退役判定要区分「资产缺失」与「资产在而引用缺」
    for (const k of zeroRef) {
      const entry = EVENT_ART.find(a => a.key === k)!;
      expect(entry.required).toBe(true);
      expect(existsSync(join(ROOT, 'public', entry.path))).toBe(true);
    }
  });

  it('⑤ 用量对账合计：10 键 = 静态 4 + 动态 3 + 零引用 3', () => {
    const staticUnion = new Set([...staticKeysFromSource]);
    const dynamicUnion = new Set(Object.keys(ENDING_NARRATION).map(s => `evt_art_ending_${s}`));
    const zeroRef = MANIFEST_KEYS.filter(k => !staticUnion.has(k) && !dynamicUnion.has(k));
    expect([staticUnion.size, dynamicUnion.size, zeroRef.length]).toEqual([4, 3, 3]);
    expect(staticUnion.size + dynamicUnion.size + zeroRef.length).toBe(MANIFEST_KEYS.length);
    expect(new Set([...staticUnion, ...dynamicUnion, ...zeroRef]).size).toBe(10); // 三面互斥且无遗漏
  });
});
