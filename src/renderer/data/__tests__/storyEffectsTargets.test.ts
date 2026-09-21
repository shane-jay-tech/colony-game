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
import { STORY_EVENTS } from '../storyEvents';
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

  it('与运行时校验器同源：validateModifierEffect 逐条不抛（含 value 有限性）', () => {
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
