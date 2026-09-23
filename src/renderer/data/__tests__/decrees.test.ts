// c923-28：朝令表 DECREES 的**纯结构**不变量（链 / 阶 / 键合法 / 枚举覆盖）。
//
// 动因（卷宗锚点，2026-09-23 磁盘复验后修正）：
//   - `policies.test.ts:16` 已给国策树「每个前置都存在」的先例，但 DECREES 在该文件里
//     只以 `storyAxisDelta`（:84/:96）参与双轴断言，**链/阶/键三面零结构断言**。
//   - `state/__tests__/decreeSystem.test.ts` 用**手搓 decree 夹具**，从不碰真表。
//   - 于是 chainPrev 拼错一个字母 → `decreeSystem` 的解锁判定把该政令永久锁死，
//     全量测试仍 1416 例全绿。本件补的正是这个空洞。
//
// 🔴 红线口径（比"断言里小心一点"更硬）：本文件**一律不读、不比对任何 value/cost/days 数值**。
//   - 只判**键名面**：effects[].target ∈ MODIFIER_TARGETS、cost 的键 ∈ RESOURCE_IDS。
//   - 刻意**不复用** `modifierValidator.validateRoyalDecree`：它的判据含
//     `value 有限性`（modifierValidator.ts:38-43）与 `cost 非负`（:54-58）——虽不比大小，
//     但会**读**平衡数值。启动期由 `main.ts:164` / `BootScene.ts:23` 的
//     `validateStaticData()` 兜那两层，本件不重复也不绕过。
//   - 「行集拿不到 value」被钉成用例（末块），这是结构级自证。
//   - 也**不做** c923-07 的三判据（value=0 / 同事件同 effects / storyAxisDelta 键合法），
//     避开其设计稿的口径撞车。
//
// 与在册守卫的重叠（如实登记，见 result 的「遗留问题」）：
//   `storyEffectsTargets.test.ts` 的 c922-128 泛化段**已覆盖** DECREES 的
//   effects.target 与 op 白名单（其 ④ 表 56 条 effects）。本件按**政令路径**再点一次名，
//   目的是让「朝令的结构面」有一处自成一体的看守；链（chainPrev）/阶（order）/枚举
//   三面则是本件独有。
//
// 零生产码改动：本文件只 import，不改 `decrees.ts` / `schema.ts` / `resourceRegistry.ts` 一个字符。
import { describe, expect, it } from 'vitest';
import type { DecreeCategory, RoyalDecree } from '../schema';
import { DECREES } from '../decrees';
import {
  isValidModifierTarget,
  isValidResourceId,
  MODIFIER_TARGETS,
  RESOURCE_IDS,
} from '../resourceRegistry';

/**
 * DecreeCategory 的五值清单。`satisfies` 保证此处不漏写成员，
 * 下面的 `_CategoryExhaustive` 再把「多写/改名」也钉住：schema.ts:252 的联合若扩第 6 类，
 * 本行编译期即红，逼改表人回来复核分类覆盖判据。
 */
const CATEGORY_ENUM = ['内政', '军事', '外交', '礼制', '工坊'] as const satisfies readonly DecreeCategory[];
type SameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _CategoryExhaustive: SameSet<DecreeCategory, (typeof CATEGORY_ENUM)[number]> = true;

const byId = new Map<string, RoyalDecree>(DECREES.map((d) => [d.id, d]));

/** 行结构刻意只含键名面（who/target/resource），无 value/op/days 字段——见文件头红线口径。 */
type TargetRow = { who: string; target: string };
type CostRow = { who: string; resource: string };
type RemoveRow = { who: string; raw: string };

const TARGET_ROWS: TargetRow[] = DECREES.flatMap((d) =>
  (d.stages ?? []).flatMap((s, si) =>
    (s.effects ?? []).map((x, i) => ({
      who: `DECREES.${d.id}.stages[${si}](order=${s.order}).effects[${i}]`,
      target: x.target,
    })),
  ),
);
const COST_ROWS: CostRow[] = DECREES.flatMap((d) =>
  (d.stages ?? []).flatMap((s, si) =>
    Object.keys(s.cost ?? {}).map((k) => ({
      who: `DECREES.${d.id}.stages[${si}](order=${s.order}).cost`,
      resource: k,
    })),
  ),
);
const REMOVE_ROWS: RemoveRow[] = DECREES.flatMap((d) =>
  (d.stages ?? []).flatMap((s, si) =>
    (s.removeEffects ?? []).map((id, i) => ({
      who: `DECREES.${d.id}.stages[${si}](order=${s.order}).removeEffects[${i}]`,
      raw: id,
    })),
  ),
);

/** 沿 chainPrev 走出的链根（无前置的政令）。 */
const CHAIN_ROOTS = DECREES.filter((d) => d.chainPrev === undefined);
/** 有前置的政令数（链上的"子"）。 */
const CHAINED = DECREES.filter((d) => typeof d.chainPrev === 'string');

describe('c923-28 钉子一：规模非空洞（先钉死行集规模，防"全量扫"退化成扫空气）', () => {
  it('12 政令 / 24 阶段 / 56 条 effects / 64 组 cost 键（2026-09-23 磁盘实跑值，条数一变本件即红）', () => {
    expect(DECREES.length).toBe(12);
    expect(DECREES.reduce((n, d) => n + (d.stages ?? []).length, 0)).toBe(24);
    expect(TARGET_ROWS.length).toBe(56);
    expect(COST_ROWS.length).toBe(64); // 24 阶、每阶 1~4 键；键名面见钉子五
    // 三张行表的过滤/映射逻辑不得吞条目
    expect(DECREES.flatMap((d) => d.stages ?? []).length).toBe(24);
    expect(REMOVE_ROWS.length).toBe(0); // 现状：removeEffects 全为空数组（钉子六按形状钉）
  });

  it('id 唯一、非空串、无首尾空白', () => {
    const ids = DECREES.map((d) => d.id);
    expect(new Set(ids).size, `重复 id：${ids.filter((v, i) => ids.indexOf(v) !== i).join(', ')}`).toBe(ids.length);
    const blank = ids.filter((v) => typeof v !== 'string' || v.trim() === '' || v !== v.trim());
    expect(blank, `非法 id ${JSON.stringify(blank)}`).toEqual([]);
    expect(byId.size).toBe(DECREES.length);
  });
});

describe('c923-28 钉子二：chainPrev 引用合法且无环（本件独有的空洞面）', () => {
  it('每个 chainPrev 都指向表内真实 id，且不自环、非空串', () => {
    const dangling: string[] = [];
    for (const d of DECREES) {
      const prev = d.chainPrev;
      if (prev === undefined) continue;
      if (typeof prev !== 'string' || prev.trim() === '') {
        dangling.push(`${d.id}.chainPrev=${JSON.stringify(prev)}（空/非串）`);
        continue;
      }
      if (prev === d.id) dangling.push(`${d.id}.chainPrev 指向自己`);
      if (!byId.has(prev)) dangling.push(`${d.id}.chainPrev=${prev} 不在 DECREES 内`);
    }
    expect(dangling, `链前置悬空/自环 ${dangling.length} 处：\n${dangling.join('\n')}`).toEqual([]);
  });

  it('链无环：从每条政令沿 chainPrev 回溯，重复访问即红', () => {
    const loops: string[] = [];
    for (const start of DECREES) {
      const seen = new Set<string>([start.id]);
      let cursor = start.chainPrev;
      let hops = 0;
      while (cursor !== undefined) {
        hops += 1;
        if (seen.has(cursor)) {
          loops.push(`${start.id} 回溯第 ${hops} 跳重回 ${cursor}`);
          break;
        }
        seen.add(cursor);
        cursor = byId.get(cursor)?.chainPrev;
        if (hops > DECREES.length) {
          loops.push(`${start.id} 回溯跳数超过表长（环的另一种形态）`);
          break;
        }
      }
    }
    expect(loops, `检测到环：\n${loops.join('\n')}`).toEqual([]);
  });

  it('链形状指纹：6 根 / 6 有前置，链长多重集 [1,2,2,2,2,3]（对应文件头五大族递进图）', () => {
    expect(CHAIN_ROOTS.length).toBe(6);
    expect(CHAINED.length).toBe(6);
    expect(CHAIN_ROOTS.length + CHAINED.length).toBe(DECREES.length);
    // 自根向下量每条链的长度
    const childrenOf = new Map<string, string[]>();
    for (const d of CHAINED) {
      const prev = d.chainPrev;
      if (prev === undefined) continue;
      const list = childrenOf.get(prev);
      if (list) list.push(d.id);
      else childrenOf.set(prev, [d.id]);
    }
    const depths: number[] = [];
    const walk = (id: string, depth: number): void => {
      const kids = childrenOf.get(id);
      if (kids === undefined || kids.length === 0) {
        depths.push(depth);
        return;
      }
      for (const k of kids) walk(k, depth + 1);
    };
    for (const root of CHAIN_ROOTS) walk(root.id, 1);
    expect(depths.sort((a, b) => a - b)).toEqual([1, 2, 2, 2, 2, 3]);
    // 一个父不得挂多个子（递进链而非分叉树；分叉要改判据须显式登记）
    for (const [parent, kids] of childrenOf) expect(kids.length, `${parent} 挂出 ${kids.length} 个子`).toBe(1);
  });

  it('同链必同 category（族内递进；跨族串链属手误，须回此处显式改判据）', () => {
    const crossed: string[] = [];
    for (const d of DECREES) {
      const prev = d.chainPrev;
      if (prev === undefined) continue;
      const parent = byId.get(prev);
      if (parent === undefined) continue; // 悬空由钉子二点名，此处不重复报
      if (parent.category !== d.category) crossed.push(`${d.id}(${d.category}) ← ${prev}(${parent.category})`);
    }
    expect(crossed, `跨族串链：\n${crossed.join('\n')}`).toEqual([]);
  });
});

describe('c923-28 钉子三：stages[].order 从 1 严格递增连续', () => {
  it('每条政令皆非空阶段表，且 order 序列恰为 1..N（缺阶/重号/跳号/乱序皆红）', () => {
    const bad: string[] = [];
    for (const d of DECREES) {
      const stages = d.stages ?? [];
      if (stages.length === 0) {
        bad.push(`${d.id} 无任何阶段`);
        continue;
      }
      const orders = stages.map((s) => s.order);
      const expected = Array.from({ length: stages.length }, (_, i) => i + 1);
      if (JSON.stringify(orders) !== JSON.stringify(expected)) {
        bad.push(`${d.id} order=${JSON.stringify(orders)} 应为 ${JSON.stringify(expected)}`);
      }
    }
    expect(bad, `阶序不连续：\n${bad.join('\n')}`).toEqual([]);
  });

  it('同表内 (decree id, order) 组合唯一（链上取模 id 不撞车）', () => {
    const keys = DECREES.flatMap((d) => (d.stages ?? []).map((s) => `${d.id}#${s.order}`));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('c923-28 钉子四：category 枚举覆盖（无越界值、无死类）', () => {
  it('逐条 category ∈ 五值枚举，且五类各有成员——成员名单逐名钉桩', () => {
    const outOfEnum = DECREES.filter((d) => !(CATEGORY_ENUM as readonly string[]).includes(d.category));
    expect(outOfEnum.map((d) => `${d.id}=${d.category}`), '枚举外 category').toEqual([]);

    const byCategory: Record<string, string[]> = {};
    for (const d of DECREES) {
      const list = byCategory[d.category];
      if (list) list.push(d.id);
      else byCategory[d.category] = [d.id];
    }
    for (const v of Object.values(byCategory)) v.sort();
    // 五个键都在 ⇒ 无死类；没有第六个键 ⇒ 无枚举外分类
    expect(byCategory).toEqual({
      内政: ['decree_promote_agri', 'decree_tuntian'],
      军事: ['decree_conscript', 'decree_hegemony', 'decree_train_levy'],
      外交: ['decree_alliance_oath', 'decree_envoy_mission'],
      工坊: ['decree_hundred_crafts', 'decree_workshop_levy'],
      礼制: ['decree_cast_ding', 'decree_compile_rites', 'decree_stele_market'],
    });
  });

  it('name / description / descPlain 皆非空串（分类聚合到 CourtPanel 时不得出现空文案）', () => {
    const empty: string[] = [];
    for (const d of DECREES) {
      for (const field of ['name', 'description', 'descPlain'] as const) {
        const v = d[field];
        if (typeof v !== 'string' || v.trim() === '') empty.push(`${d.id}.${field}=${JSON.stringify(v)}`);
      }
    }
    expect(empty, `空文案：\n${empty.join('\n')}`).toEqual([]);
  });
});

describe('c923-28 钉子五：effects.target 与 cost 键名全量注册（只判键名，不碰数值）', () => {
  it('56 条 effects 的 target 全部已注册，逐条点名未注册项', () => {
    const bad = TARGET_ROWS.filter((r) => !isValidModifierTarget(r.target));
    expect(
      bad.map((r) => `${r.who}=${r.target}`),
      `未注册 target ${bad.length} 条；合法集见 resourceRegistry.MODIFIER_TARGETS（现 ${MODIFIER_TARGETS.length} 键）`,
    ).toEqual([]);
    expect(TARGET_ROWS.length).toBe(56); // 双保险：过滤逻辑不得吞条目
    const blank = TARGET_ROWS.filter((r) => typeof r.target !== 'string' || r.target.trim() === '');
    expect(blank.map((r) => r.who)).toEqual([]);
  });

  it('24 阶 cost 的键全部 ∈ RESOURCE_IDS，且每阶至少一键（空前缀即"零成本政令"，须显式复核）', () => {
    const bad = COST_ROWS.filter((r) => !isValidResourceId(r.resource));
    expect(
      bad.map((r) => `${r.who}=${r.resource}`),
      `未注册资源键 ${bad.length} 条；合法集见 resourceRegistry.RESOURCE_IDS（现 ${RESOURCE_IDS.length} 键）`,
    ).toEqual([]);
    const emptyCost = DECREES.flatMap((d) =>
      (d.stages ?? []).filter((s) => Object.keys(s.cost ?? {}).length === 0).map((s) => `${d.id}.order=${s.order}`),
    );
    expect(emptyCost, `cost 为空对象的阶段：${emptyCost.join(', ')}`).toEqual([]);
  });

  it('cost 实际消费的 8 个资源键逐名钉桩，并点名注册表内朝令未用的 3 键（防死注册悄悄长）', () => {
    const registry: readonly string[] = RESOURCE_IDS;
    const used = [...new Set(COST_ROWS.map((r) => r.resource))].sort();
    expect(used).toEqual(['bronze', 'cloth', 'gold', 'grain', 'people', 'rite', 'stone', 'wood']);
    const unconsumed = registry.filter((k) => !used.includes(k)).sort();
    expect(unconsumed).toEqual(['hemp', 'influence', 'tin']); // B3 中间品 + B2 名望：确不用于朝令成本
    for (const k of used) expect(registry).toContain(k);
  });
});

describe('c923-28 钉子六：removeEffects 按 **modifier id** 面钉（卷宗前提经核实后收窄）', () => {
  // 卷宗原文：「effects[].target ∈ MODIFIER_TARGETS、**removeEffects 同判**」。
  // 磁盘否证：schema.ts:246「/** Modifier id 列表；激活 stage 时移除这些 */」与
  //   decreeSystem.ts:115「removeEffects: 旧阶要从 activeModifiers 中移除的 modifier id 列表」、
  //   运行期 id 由 decreeSystem.ts:225 `decree_modifier_${decree.id}_stage${stage.order}` 生成
  //   ——装的是 **modifier id**，不是 target 键。拿它去过 isValidModifierTarget 是范畴错误
  //   （`storyEffectsTargets.test.ts:6-11` 对同一处口径写过同样的纠正）。
  //   故此处按 id 面钉：形状 + 两套命名空间不得串台。
  it('24 阶皆带 removeEffects 数组字段（现状 0 项 ⇒ 本族按形状钉，加项须回来改判 id 面）', () => {
    const stages = DECREES.flatMap((d) => d.stages ?? []);
    expect(stages.length).toBe(24);
    for (const s of stages) expect(Array.isArray(s.removeEffects)).toBe(true);
    expect(REMOVE_ROWS.length).toBe(0);
  });

  it('若将来加项：须为非空字符串、无首尾空白，且无一把 target 键误填成 id', () => {
    const bad = REMOVE_ROWS.filter(
      (r) => typeof r.raw !== 'string' || r.raw.trim() === '' || r.raw !== r.raw.trim(),
    );
    expect(bad.map((r) => `${r.who}=${JSON.stringify(r.raw)}`), '非法 modifier id').toEqual([]);
    const misused = REMOVE_ROWS.filter((r) => isValidModifierTarget(r.raw));
    expect(misused.map((r) => `${r.who}: "${r.raw}" 是 target 不是 id`)).toEqual([]);
  });
});

describe('c923-28 钉子七：红线结构自证——本件的行集根本拿不到 value', () => {
  it('三张行表的字段集恰为 {who,target} / {who,resource} / {who,raw}，不含 value/op/days', () => {
    const keysOf = <T extends object>(rows: T[]): string[] => [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();
    expect(keysOf(TARGET_ROWS)).toEqual(['target', 'who']);
    expect(keysOf(COST_ROWS)).toEqual(['resource', 'who']);
    expect(keysOf(REMOVE_ROWS)).toEqual([]); // 现值空集，形状由钉子六的数组断言守
    // 断言里出现的数字只有规模/序号类结构常量：12/24/56/64/6/1..3/8/3 皆为条数或阶序，
    // 无任何一条来自 decrees.ts 的 value / cost 值 / days 值。
  });
});
