// c922-09：STORY_EVENTS 的 effects/removeEffects 目标键**全量**合法性钉桩。
// 背景：此前只有 v08_j3_content.test.ts:115/119 抽查 2 个 target，35 个事件 70 个选项的
//       目标键面**从未被整体扫过**——而 ModifierEffect.target 拼错正是运行时会静默 NaN 的
//       那条路（见 modifierValidator.ts:1-6 注释，Kim#6 反审的原始动机）。
// 口径纠正（重要，与任务书原文不同）：任务书写「effects+removeEffects 逐 target 过
//       isValidModifierTarget」，但 schema.ts:211-215 与 eventEngine.ts:52、decreeSystem.ts:115
//       三处一致表明 **choice.removeEffects 装的是 modifier id，不是 target 键**——
//       拿它去过 isValidModifierTarget 是范畴错误（将来加合法 id 反而会误判红）。
//       故 removeEffects 按 id 面钉：非空字符串 + 不得误填成 target 键（误用探测器）。
// 零生产码改动：本文件只 import，不改 storyEvents.ts 一个字符。
import { describe, expect, it } from 'vitest';
import type { CourtEvent } from '../schema';
import { STORY_EVENTS } from '../storyEvents';
import { EVENTS } from '../events';
import { ALL_EXPANDED_EVENTS } from '../eventsExpanded';
import { POLICIES } from '../policies';
import { DECREES } from '../decrees';
import { isValidModifierTarget, MODIFIER_TARGETS } from '../resourceRegistry';
import { validateModifierEffect } from '../modifierValidator';

/** op 白名单与 modifierValidator.ts:35 的运行时判据同值；生产码若扩 op，这里必须显式改。 */
const ALLOWED_OPS = ['add', 'mul'] as const;

type Row = { eventId: string; choiceIdx: number; kind: 'effects' | 'removeEffects'; idx: number; raw: string };

const choices = STORY_EVENTS.flatMap((e) => e.choices ?? []);
const effectRows: (Row & { target: string; op: string; value: unknown })[] = STORY_EVENTS.flatMap((e) =>
  (e.choices ?? []).flatMap((c, ci) =>
    (c.effects ?? []).map((x, i) => ({
      eventId: e.id,
      choiceIdx: ci,
      kind: 'effects' as const,
      idx: i,
      target: x.target,
      op: x.op,
      value: x.value,
      raw: `${x.target}/${x.op}/${String(x.value)}`,
    })),
  ),
);
const removeRows: Row[] = STORY_EVENTS.flatMap((e) =>
  (e.choices ?? []).flatMap((c, ci) =>
    (c.removeEffects ?? []).map((id, i) => ({
      eventId: e.id,
      choiceIdx: ci,
      kind: 'removeEffects' as const,
      idx: i,
      raw: id,
    })),
  ),
);

describe('c922-09 钉子一：覆盖面非空洞（先把规模钉死，防"全量扫"退化成扫空气）', () => {
  it('STORY_EVENTS 35 事件 / 70 选项 / 134 条 effects，逐事件皆有选项', () => {
    expect(STORY_EVENTS.length).toBe(35);
    expect(choices.length).toBe(70);
    expect(effectRows.length).toBe(134);
    for (const e of STORY_EVENTS) expect(e.choices?.length ?? 0, `${e.id} 无 choices`).toBeGreaterThan(0);
  });
  it('无任何空 effects 选项（否则 target 扫描对这些选项天然 vacuous）', () => {
    const empty = STORY_EVENTS.flatMap((e) =>
      (e.choices ?? []).map((c, i) => ({ id: e.id, i, n: (c.effects ?? []).length })),
    ).filter((r) => r.n === 0);
    expect(empty, JSON.stringify(empty)).toEqual([]);
  });
});

describe('c922-09 钉子二：effects.target 全量过 isValidModifierTarget', () => {
  it('134 条 effects 的 target 全部已注册（逐条点名未注册项）', () => {
    const bad = effectRows.filter((r) => !isValidModifierTarget(r.target));
    expect(
      bad.map((r) => `${r.eventId}[choice${r.choiceIdx}].effects[${r.idx}]=${r.target}`),
      `未注册 target ${bad.length} 条；合法集见 resourceRegistry.MODIFIER_TARGETS`,
    ).toEqual([]);
    expect(effectRows.length).toBe(134); // 双保险：过滤逻辑本身不得吞条目
  });

  it('故事事件实际用到的 target 集合逐名钉桩（新增须显式登记）', () => {
    const used = [...new Set(effectRows.map((r) => r.target))].sort();
    expect(used).toEqual([
      'country_diplomacy_weight',
      'country_gold_output',
      'country_grain_consumption',
      'country_grain_output',
      'country_military_power',
      'country_morale',
      'country_renown',
      'country_research_speed',
      'country_rite_output',
    ]);
    // 钉的是"这 9 个名字确实都在注册表里"，不是"注册表只有这 9 个"
    for (const t of used) expect(MODIFIER_TARGETS as readonly string[]).toContain(t);
  });

  // 标题措辞对齐（c924-07）：原判据并不查"有限性"——Infinity / -Infinity 可通过，
  // 只拦非 number 与 NaN。写清真实边界，防"名大于实"（见 modifierValidator.ts 同处注释）。
  it('与运行时校验器同源：validateModifierEffect 逐条不抛（value 面只拦非 number 与 NaN，无穷大不拦）', () => {
    const thrown: string[] = [];
    for (const r of effectRows) {
      try {
        validateModifierEffect(
          { target: r.target as never, op: r.op as 'add' | 'mul', value: r.value as number },
          `STORY_EVENTS.${r.eventId}.choices[${r.choiceIdx}].effects[${r.idx}]`,
        );
      } catch (e) {
        thrown.push(`${r.eventId}#${r.choiceIdx}[${r.idx}] ${(e as Error).message}`);
      }
    }
    expect(thrown, thrown.join('\n')).toEqual([]);
  });
});

describe('c922-09 钉子三：op 白名单', () => {
  it('全部 effects 的 op ∈ {add,mul}（白名单外零命中）', () => {
    const bad = effectRows.filter((r) => !(ALLOWED_OPS as readonly string[]).includes(r.op));
    expect(bad.map((r) => `${r.eventId}#${r.choiceIdx}[${r.idx}] op=${r.op}`), '非法 op').toEqual([]);
  });
  it('白名单两个分支都被真实覆盖（否则"白名单校验"只验了一半）', () => {
    const seen = new Set(effectRows.map((r) => r.op));
    expect([...seen].sort()).toEqual(['add', 'mul']);
  });
});

describe('c922-09 钉子四：removeEffects 按 modifier id 面钉（口径见文件头）', () => {
  it('每项皆为非空字符串、无首尾空白', () => {
    const bad = removeRows.filter((r) => typeof r.raw !== 'string' || r.raw.trim() === '' || r.raw !== r.raw.trim());
    expect(bad.map((r) => `${r.eventId}#${r.choiceIdx} removeEffects[${r.idx}]="${r.raw}"`)).toEqual([]);
  });
  it('无一项误填成 modifier target 键（id 与 target 两套命名空间不得串台）', () => {
    const misused = removeRows.filter((r) => isValidModifierTarget(r.raw));
    expect(misused.map((r) => `${r.eventId}#${r.choiceIdx}: "${r.raw}" 是 target 不是 id`)).toEqual([]);
  });
  it('70 选项皆带 removeEffects 数组字段（实测当前全为空数组，故本族按形状钉、不钉数量）', () => {
    expect(choices.length).toBe(70);
    for (const c of choices) expect(Array.isArray(c.removeEffects)).toBe(true);
  });
});

// ══════════════════════════ c922-128：判据参数化泛化到全域四表 ══════════════════════════
// 上方 c922-09 只钉了 STORY_EVENTS，并在结果件里点名「同一判据对其余表的 effects 同样没有
// 全量扫」——本段把同一判据**参数化**推广到四张全域数据表（2026-09-22 磁盘实跑规模）：
//   ① STORY_EVENTS              35 事件 / 70 选项 / 134 条 effects（9 个 target）
//   ② 沙盒事件池 BASE＋EXPANDED  48 事件 / 84 选项 / 152 条 effects（13 个 target）
//   ③ POLICIES                  39 国策节点 / 69 条 effects（13 个 target）
//   ④ DECREES                   12 政令 / 24 阶段 / 56 条 effects（18 个 target）
// 合计 411 条 effects；四表并集 22 个 target 键（注册表 MODIFIER_TARGETS 共 27 个）。
//
// ⚠ 本段**条数 canary** 说明：以下所有 toBe(N) 的 N 均为当班实跑值。条数一变钉子就红，
//   这不是 bug——它要求改数据的人**连同本文件的 target/op 面一起复核**（条数变了而键名面
//   没跟着看＝半截守卫，正是 c922-09 要消灭的那种"扫空气"）。改钉子前先确认新条数是有意扩容。
//
// 红线口径（比 c922-09 更窄，按派单要求）：本段只校验 **effects 的键名与 op 合法性**，
//   **一律不读、不比对 value**——经济平衡数值是只读域。为此本段刻意**不复用**
//   validateModifierEffect（它的判据会读 value：非 number 与 NaN 两关，虽不比大小但仍读值）；
//   上方 c922-09 那条 validator 用例本段不复用，两种口径并存可查——其标题的 value 面措辞已由
//   c924-07 对齐为"只拦非 number 与 NaN，无穷大不拦"，判据与断言本身零改动。
//   「泛化段的行集根本不带 value 字段」被钉成用例（钉子五），这是结构级自证，
//   比"断言里小心一点"更硬：value 想被比对也拿不到。
//
// BASE_EVENTS 取数口径：events.ts:8 的 BASE_EVENTS 是模块私有 const、**未 export**，
//   故沙盒池按「EVENTS 去掉 STORY_EVENTS 的 id」反推，组成等式在钉子一里被钉死，反推不吞事件。
// 零生产码改动：本文件只 import，不改 storyEvents/events/eventsExpanded/policies/decrees 一个字符。

/** 泛化段的行结构：刻意只含键名面（table/who/target/op），无 value 字段——见上方红线口径。 */
type EffectRow = { table: string; who: string; target: string; op: string };
type RemoveRow = { table: string; who: string; raw: string };

const storyIdSet = new Set(STORY_EVENTS.map((e) => e.id));
const expandedIdSet = new Set(ALL_EXPANDED_EVENTS.map((e) => e.id));
/** 沙盒事件池 = EVENTS ＼ STORY_EVENTS（实测 48 ＝ BASE 8 ＋ ALL_EXPANDED 40）。 */
const SANDBOX_EVENTS: CourtEvent[] = EVENTS.filter((e) => !storyIdSet.has(e.id));
/** BASE_EVENTS 未 export，按 id 集合二次反推，仅用于钉组成等式。 */
const BASE_POOL: CourtEvent[] = EVENTS.filter((e) => !storyIdSet.has(e.id) && !expandedIdSet.has(e.id));

const eventRowsOf = (table: string, events: readonly CourtEvent[]): EffectRow[] =>
  events.flatMap((e) =>
    (e.choices ?? []).flatMap((c, ci) =>
      (c.effects ?? []).map((x, i) => ({
        table,
        who: `${table}.${e.id}.choices[${ci}].effects[${i}]`,
        target: x.target,
        op: x.op,
      })),
    ),
  );
const eventRemoveRowsOf = (table: string, events: readonly CourtEvent[]): RemoveRow[] =>
  events.flatMap((e) =>
    (e.choices ?? []).flatMap((c, ci) =>
      (c.removeEffects ?? []).map((id, i) => ({ table, who: `${table}.${e.id}.choices[${ci}].removeEffects[${i}]`, raw: id })),
    ),
  );
const POLICY_ROWS: EffectRow[] = POLICIES.flatMap((p) =>
  (p.effects ?? []).map((x, i) => ({ table: 'POLICIES', who: `POLICIES.${p.id}.effects[${i}]`, target: x.target, op: x.op })),
);
const DECREE_ROWS: EffectRow[] = DECREES.flatMap((d) =>
  (d.stages ?? []).flatMap((s, si) =>
    (s.effects ?? []).map((x, i) => ({ table: 'DECREES', who: `DECREES.${d.id}.stages[${si}].effects[${i}]`, target: x.target, op: x.op })),
  ),
);
const DECREE_REMOVE_ROWS: RemoveRow[] = DECREES.flatMap((d) =>
  (d.stages ?? []).flatMap((s, si) =>
    (s.removeEffects ?? []).map((id, i) => ({ table: 'DECREES', who: `DECREES.${d.id}.stages[${si}].removeEffects[${i}]`, raw: id })),
  ),
);

const STORY_ROWS = eventRowsOf('STORY_EVENTS', STORY_EVENTS);
const SANDBOX_ROWS = eventRowsOf('SANDBOX_EVENTS', SANDBOX_EVENTS);

/** 四表登记表：canary 数字集中一处，改数据时只看这一眼就知道动了哪张表。 */
const TABLES: { name: string; rows: EffectRow[]; rowCount: number; hosts: number; hostUnit: string }[] = [
  { name: 'STORY_EVENTS', rows: STORY_ROWS, rowCount: 134, hosts: 35, hostUnit: '事件' },
  { name: 'SANDBOX_EVENTS', rows: SANDBOX_ROWS, rowCount: 152, hosts: 48, hostUnit: '事件' },
  { name: 'POLICIES', rows: POLICY_ROWS, rowCount: 69, hosts: 39, hostUnit: '国策节点' },
  { name: 'DECREES', rows: DECREE_ROWS, rowCount: 56, hosts: 12, hostUnit: '政令' },
];

describe('c922-128 钉子一：四表规模与沙盒池组成等式（canary，条数变化须连同复核）', () => {
  it('四表 effects 条数逐表钉死：134 / 152 / 69 / 56，合计 411', () => {
    for (const t of TABLES) expect(t.rows.length, `${t.name} effects 条数`).toBe(t.rowCount);
    expect(TABLES.reduce((n, t) => n + t.rows.length, 0)).toBe(411);
  });
  it('四表顶层条数：故事 35 事件 / 沙盒 48 事件 / 国策 39 节点 / 朝令 12 政令（24 阶段）', () => {
    expect(STORY_EVENTS.length).toBe(35);
    expect(SANDBOX_EVENTS.length).toBe(48);
    expect(POLICIES.length).toBe(39);
    expect(DECREES.length).toBe(12);
    expect(DECREES.reduce((n, d) => n + (d.stages ?? []).length, 0)).toBe(24);
  });
  it('沙盒 48 的来历钉死：BASE 8 ＋ ALL_EXPANDED 40 ＋ STORY 35 ＝ EVENTS 83（BASE_EVENTS 未 export，靠等式防反推吞事件）', () => {
    expect(EVENTS.length).toBe(83);
    expect(ALL_EXPANDED_EVENTS.length).toBe(40);
    expect(BASE_POOL.length).toBe(8);
    expect(BASE_POOL.length + ALL_EXPANDED_EVENTS.length + STORY_EVENTS.length).toBe(EVENTS.length);
    // 三池 id 互不相交，等式不是靠重复计数凑出来的
    const all = [...BASE_POOL, ...ALL_EXPANDED_EVENTS, ...STORY_EVENTS].map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
  });
  it('沙盒池 11 个「无 choices」事件逐名钉桩（泛化扫在这些事件上天然 vacuous，须显式登记）', () => {
    const noChoices = SANDBOX_EVENTS.filter((e) => (e.choices ?? []).length === 0).map((e) => e.id).sort();
    expect(noChoices).toEqual([
      'evt_c_auspicious_cloud', 'evt_c_baby_boom', 'evt_c_folk_song', 'evt_c_good_weather', 'evt_c_heavy_snow',
      'evt_c_minor_quake', 'evt_c_shooting_star', 'evt_c_well_dried', 'evt_c_wild_bloom', 'evt_c_wolf_sighting', 'evt_locust',
    ]);
  });
});

describe('c922-128 钉子二：四表 effects.target 键名全量注册（只判键名）', () => {
  it('四表 411 条 effects 的 target 全部已注册，逐表点名未注册项', () => {
    for (const t of TABLES) {
      const bad = t.rows.filter((r) => !isValidModifierTarget(r.target));
      expect(bad.map((r) => `${r.who}=${r.target}`), `${t.name} 未注册 target ${bad.length} 条`).toEqual([]);
      expect(t.rows.length, `${t.name} 过滤逻辑不得吞条目`).toBe(t.rowCount);
    }
  });
  it('target 不得为空串/纯空白（键名面最低形状要求）', () => {
    const blank = TABLES.flatMap((t) => t.rows).filter((r) => typeof r.target !== 'string' || r.target.trim() === '');
    expect(blank.map((r) => r.who)).toEqual([]);
  });
  it('四表并集 22 个 target 逐名钉桩，并点名注册表内四表未消费的 5 个键（防重复建设/死注册悄悄长）', () => {
    const registry: readonly string[] = MODIFIER_TARGETS;
    const union = [...new Set(TABLES.flatMap((t) => t.rows.map((r) => r.target)))].sort();
    expect(union).toEqual([
      'building_construction_speed', 'building_output_area', 'country_bronze_output', 'country_cloth_output',
      'country_diplomacy_weight', 'country_gold_output', 'country_grain_consumption', 'country_grain_output',
      'country_military_power', 'country_morale', 'country_population_cap', 'country_population_growth',
      'country_renown', 'country_research_speed', 'country_rite_output', 'country_stone_output', 'country_wood_output',
      'country_wrath', 'event_positive_probability', 'population_class_growth_nong', 'population_class_growth_shi',
      'population_happiness',
    ]);
    const unconsumed = registry.filter((t) => !union.includes(t)).sort();
    // c1001-02：五个无读取口键（曾列此 5 行）经主班拍板退役，注册表删行后四表并集与注册表全等
    expect(unconsumed).toEqual([]);
    // 钉的是"22 个都在注册表里"，不是"注册表只有这 22 个"
    for (const t of union) expect(registry).toContain(t);
  });
});

describe('c922-128 钉子三：四表 op 合法性（白名单与运行时同值，不碰 value）', () => {
  it('四表全部 effects 的 op ∈ {add,mul}，白名单外零命中', () => {
    for (const t of TABLES) {
      const bad = t.rows.filter((r) => r.op !== 'add' && r.op !== 'mul');
      expect(bad.map((r) => `${r.who} op=${r.op}`), `${t.name} 非法 op`).toEqual([]);
    }
  });
  it('四表各自的 op 集合恰为 {add,mul}（任一表只用到一支即视为白名单校验半瞎，须显式复核）', () => {
    for (const t of TABLES) {
      expect([...new Set(t.rows.map((r) => r.op))].sort(), `${t.name} op 集合`).toEqual(['add', 'mul']);
    }
  });
});

describe('c922-128 钉子四：removeEffects 按 modifier id 面钉（口径承 c922-09：id 不是 target）', () => {
  it('事件两表与朝令表的 removeEffects 现值皆 0 项 ⇒ 本族只钉形状，加项须回来改判 id 面', () => {
    expect(eventRemoveRowsOf('STORY_EVENTS', STORY_EVENTS).length).toBe(0);
    expect(eventRemoveRowsOf('SANDBOX_EVENTS', SANDBOX_EVENTS).length).toBe(0);
    expect(DECREE_REMOVE_ROWS.length).toBe(0);
    for (const c of SANDBOX_EVENTS.flatMap((e) => e.choices ?? [])) expect(Array.isArray(c.removeEffects)).toBe(true);
    for (const s of DECREES.flatMap((d) => d.stages ?? [])) expect(Array.isArray(s.removeEffects)).toBe(true);
  });
  it('现有 removeEffects 项无一把 target 键误填成 id（id 与 target 两套命名空间不得串台）', () => {
    const rows = [
      ...eventRemoveRowsOf('STORY_EVENTS', STORY_EVENTS),
      ...eventRemoveRowsOf('SANDBOX_EVENTS', SANDBOX_EVENTS),
      ...DECREE_REMOVE_ROWS,
    ];
    const misused = rows.filter((r) => isValidModifierTarget(r.raw));
    expect(misused.map((r) => `${r.who}: "${r.raw}" 是 target 不是 id`)).toEqual([]);
  });
  it('POLICIES 无 removeEffects 字段（schema.ts:172-198 PolicyNode 未声明），此面不属泛化判据', () => {
    expect(POLICIES.filter((p) => (p as { removeEffects?: unknown }).removeEffects !== undefined).length).toBe(0);
  });
});

describe('c922-128 钉子五：红线结构自证——泛化段拿不到 value', () => {
  it('全 411 行的字段集恰为 {table,who,target,op}，不含 value（经济平衡数值零读取）', () => {
    const all = TABLES.flatMap((t) => t.rows);
    expect(all.length).toBe(411);
    const keys = [...new Set(all.flatMap((r) => Object.keys(r)))].sort();
    expect(keys).toEqual(['op', 'table', 'target', 'who']);
  });
});
