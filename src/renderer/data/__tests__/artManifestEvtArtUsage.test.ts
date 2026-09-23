// c922-10：evt_art 插画键「用量对账」钉桩。
// 磁盘事实（本单开工前实测，2026-09-21）：
//   - artManifest EVENT_ART 10 键（artManifest.ts:71-80），public/art/events/ 10 个 .webp 逐名对应；
//   - 静态引用 5 处（events.ts:27/98/203 + storyEvents.ts:23/197），去重后 4 个键；
//   - 动态引用 1 处（GameScene.ts:139 `evt_art_ending_${ending}`，c923-08 插一行后由 :138 位移），只覆盖 ending_* 三键；
//   - 零引用面＝清单里有键、盘上有图、而三面消费者皆缺。c922-10 当时是 coronation / feast /
//     unification 三键，并把"三键零引用"钉死（当时**不擅自删键、不擅自接线**）。
//
// ── c923-08 接线后（2026-09-23，承 c922-113 §4.1）：本文件的模型从「两面」升为「四面」 ──
// 生产码只加了一行：`GameScene.ts` 的 storyUnifiedListener 里 `TransitionData.imageKey: 'evt_art_unification'`
// （序章→第一章「天下一统」跳变过场配图）。它**合法地**发生在 scenes 层，而不是数据层——
// c922-113 §一 已实证插画消费链是两条互不相通的轨：轨 A 事件粒度 `CourtEvent.illustrationKey`→EventModal，
// 轨 B 过场粒度 `TransitionData.imageKey`→TransitionScene（与 data 层无 import 关系）。
// ⚠ 因此**绝不能**把 unification 塞进 ② 的 `fromData` 期望长度：那条等式的原始目的是抓
//   「绕过数据层的硬写」，一塞就把守卫废掉了（c922-113 §五.1 的明令）。正解是把键面拆成四面各自钉：
//     事件面（EVENTS.illustrationKey，4 键）／过场面（只在 src/renderer/data **之外**出现的字面量，现 1 键）
//     ／动态后缀面（ending 模板展开，3 键）／零引用面（现 2 键：coronation、feast，退役与否仍属人工）。
//   四面求和＝清单 10，且并集大小＝10 ⇒ 任一键跨面重复出现即红（互斥性不靠定义式白拿）。
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
/**
 * c923-08：同一次扫描里**顺带记出处轨**——这个字面量出现在 data 层文件里，还是出现在 data 层之外。
 * 为什么要单独记：「事件面与过场面互斥」若用集合减法（源码面 − 数据面）来表达，那条断言会被
 * 定义本身弄成恒真（减出来的东西当然不在数据面里）。两条轨各自独立扫，互斥检查才有牙齿。
 * 判据源仍是 c922-10 的双轨降噪（去注释 ＋ 排除 __tests__ ＋ 排除定义面 artManifest.ts）。
 */
const IS_DATA_LAYER_FILE = /[\\/]renderer[\\/]data[\\/]/;
const dataLayerKeys = new Set<string>();
const nonDataLayerKeys = new Set<string>();
for (const file of PROD_FILES) {
  const code = stripComments(readFileSync(file, 'utf8'));
  const inData = IS_DATA_LAYER_FILE.test(file);
  for (const m of code.matchAll(/'evt_art_[a-z][a-z0-9_]*'|`evt_art_[a-z0-9_]*_\$\{/g)) {
    if (m[0].startsWith('`')) {
      dynamicPrefixes.add(m[0].slice(1, -2)); // 去掉反引号与尾部 `${
      continue;
    }
    const key = m[0].slice(1, -1);
    staticKeysFromSource.add(key);
    (inData ? dataLayerKeys : nonDataLayerKeys).add(key);
  }
}
/** 过场面：只在 data 层**之外**被字面量引用的键（轨 B，scenes 层的合法接线处）。 */
const SCENE_FACE = [...nonDataLayerKeys].sort();
/** 事件面：数据表里挂的 illustrationKey（轨 A），去重。 */
const EVENT_FACE = [...new Set(EVENTS.map(e => e.illustrationKey).filter((k): k is string => typeof k === 'string' && k.length > 0))].sort();
/** 动态后缀面：ending 模板展开出的键。 */
const DYNAMIC_FACE = Object.keys(ENDING_NARRATION).map(s => `evt_art_ending_${s}`).sort();

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

  it('② 静态引用键 ⊆ EVENT_ART 清单（数据面 + 源码面同源；c923-08 起再加过场面三面）', () => {
    const fromData = EVENTS
      .map(e => e.illustrationKey)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
    expect(fromData).toHaveLength(5);            // 钉死 5 处，防「全量扫」退化成扫空气
    expect(new Set(fromData).size).toBe(4);      // 去重 4 键（flood 被基础事件与故事事件各引一次）
    for (const k of fromData) expect(MANIFEST_KEYS).toContain(k);
    // 数据轨等式原样保留：data 层里的 'evt_art_*' 字面量 == 数据表挂出的键。
    // 多一个＝有人绕过数据层硬写；少一个＝扫描轨空转（路径写错/降噪过头把真引用也滤了）。
    expect([...dataLayerKeys].sort()).toEqual([...new Set(fromData)].sort());
    // c923-08 新增两条轨，接的是 c922-113 §五.1 点名的口径边界：
    // 场景侧接线（GameScene 的 TransitionData.imageKey）**合法**，但它不在数据面上——
    // 若把它并进上面那条等式，就等于把「抓硬写」这条守卫废掉。正解是**单独登记**。
    const unknown = [...staticKeysFromSource].filter(k => !MANIFEST_KEYS.includes(k)).sort();
    expect(unknown, `清单外 'evt_art_*' 字面量（拼错或未注册）: ${unknown.join(', ')}`).toEqual([]);
    // 过场面逐名钉桩：新增一个 data 层之外的硬写即红，须显式登记理由。
    expect(SCENE_FACE).toEqual(['evt_art_unification']);
    // 两面互斥（独立轨推导，非减法）：同一张图既挂事件又在场景硬写＝语义被两个粒度抢。
    expect(SCENE_FACE.filter(k => EVENT_FACE.includes(k))).toEqual([]);
  });

  it('③ 动态前缀 × 三结局后缀均在清单内', () => {
    expect([...dynamicPrefixes]).toEqual(['evt_art_ending_']); // 全库仅此一处模板
    const suffixes = Object.keys(ENDING_NARRATION);            // 与 GameScene.ts:132 的守卫同一枚举源（c923-08 在其上方插一行配图，:131→:132）
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

  it('④ 零引用面逐名钉桩（c922-10 钉三键；c923-08 接线 unification 后收缩为两键）', () => {
    const referenced = new Set<string>([
      ...staticKeysFromSource,
      ...Object.keys(ENDING_NARRATION).map(s => `evt_art_ending_${s}`),
    ]);
    const zeroRef = MANIFEST_KEYS.filter(k => !referenced.has(k)).sort();
    // unification 已接进 GameScene 的过场面 ⇒ 本清单**只准收缩不准长大**：
    // 谁往清单里加一张不接线的图，它就漂进这一面并当场变红（比 c922-10 的三键版更强）。
    expect(zeroRef).toEqual(['evt_art_coronation', 'evt_art_feast']);
    // 有图有清单纯没消费者：退役判定要区分「资产缺失」与「资产在而引用缺」
    for (const k of zeroRef) {
      const entry = EVENT_ART.find(a => a.key === k)!;
      expect(entry.required).toBe(true);
      expect(existsSync(join(ROOT, 'public', entry.path))).toBe(true);
    }
    // 接线进度自证：三面并集 ＋ 零引用面 == 清单，缺一即上面的和式失真
    expect(new Set([...EVENT_FACE, ...SCENE_FACE, ...DYNAMIC_FACE, ...zeroRef]).size).toBe(10);
  });

  it('⑤ 用量对账合计：10 键 = 事件面 4 + 过场面 1 + 动态后缀面 3 + 零引用 2（四面互斥无遗漏）', () => {
    const eventUnion = new Set(EVENT_FACE);
    const sceneUnion = new Set(SCENE_FACE);
    const dynamicUnion = new Set(DYNAMIC_FACE);
    const zeroRef = MANIFEST_KEYS.filter(
      k => !eventUnion.has(k) && !sceneUnion.has(k) && !dynamicUnion.has(k),
    );
    // c922-10 的三面 [4,3,3] 在此升为四面；unification 从"零引用"搬到"过场面"，总数恒为 10。
    expect([eventUnion.size, sceneUnion.size, dynamicUnion.size, zeroRef.length]).toEqual([4, 1, 3, 2]);
    expect(eventUnion.size + sceneUnion.size + dynamicUnion.size + zeroRef.length).toBe(MANIFEST_KEYS.length);
    // 并集大小 == 各面之和 ⇒ 任一键跨面重复即漂红（互斥性不靠减法白拿）
    expect(new Set([...eventUnion, ...sceneUnion, ...dynamicUnion, ...zeroRef]).size).toBe(10);
    // 过场面不得混进动态轨：ending 模板展开出的键不许再被硬写一次
    expect([...sceneUnion].filter(k => dynamicUnion.has(k))).toEqual([]);
  });
});
