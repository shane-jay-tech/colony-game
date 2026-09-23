/**
 * c923-33：policyExclusions 纯函数直测（B-4.3 国策互斥组的结构不变量）。
 *
 * 写前实测的覆盖面现状（卷宗两条前提均成立）：
 *   - `rg -n 'getExcludedPolicyId|POLICY_EXCLUSION' src/renderer/state/__tests__/` → 0 命中（rc=1）；
 *   - 全仓 git grep 只有 gameStore.ts:94（import）／:2088（生产消费点）碰这两个符号 ⇒ 直测确实零缺位。
 *
 * 口径：本件**只钉结构与对称性**——成员 id、组形状、映射方向与幂等；
 * 对 `effects`（goldMul / grainMul / militaryMul / allResourceMul / spyRisk）与 `minGrade`
 * 的**任何数值一律不读、不比对、不抄字面量** ⇒ 不触经济平衡数值红线。
 * minGrade 只验"是 number"这一类型契约，大小属平衡域。
 *
 * ⚠ 互斥把 data 与 state 钉成同集合的断言（如 exclusivePolicies 的存档往返）
 *   不能放本目录：本目录受目录级字面门禁约束（不得出现上引 state 的说明符字面）。
 *   要钉那一面请落 state 侧。
 */

import { describe, expect, it } from 'vitest';
import {
  getExcludedPolicyId,
  POLICY_EXCLUSION_GROUPS,
  type PolicyExclusionGroup,
} from '../policyExclusions';

/** 判据全部从数组运行时导（不写死条数、不写死 id 对，防扩容时静默失真）。 */
const GROUPS: readonly PolicyExclusionGroup[] = POLICY_EXCLUSION_GROUPS;
const ALL_IDS: string[] = GROUPS.flatMap((g) => g.policies.map((p) => p.id));

function idsOf(group: PolicyExclusionGroup): [string, string] {
  return [group.policies[0].id, group.policies[1].id];
}

/** 喂类型系统之外的入参（存档/远端同步可绕过 TS 约束）。 */
function call(raw: unknown): string | undefined {
  return getExcludedPolicyId(raw as string);
}

describe('c923-33 组结构钉桩', () => {
  it('覆盖面自证：组数与成员数下界（空数组会让本文件其余断言假绿）', () => {
    expect(GROUPS.length).toBeGreaterThanOrEqual(1);
    expect(ALL_IDS.length).toBe(GROUPS.length * 2);
    expect(ALL_IDS.length).toBeGreaterThanOrEqual(2);
  });

  it('每组恰 2 名成员，且两名 id 非空字符串、互不相等', () => {
    for (const group of GROUPS) {
      expect(group.policies, `group=${group.groupId}`).toHaveLength(2);
      const [a, b] = idsOf(group);
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
      expect(a.length).toBeGreaterThan(0);
      expect(b.length).toBeGreaterThan(0);
      expect(a).not.toBe(b);
    }
  });

  it('groupId 唯一且非空（find 分支靠它定位，重复会让首个命中吃掉后面的组）', () => {
    const groupIds = GROUPS.map((g) => g.groupId);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    for (const id of groupIds) expect(id.length).toBeGreaterThan(0);
  });

  it('minGrade 是 number（只验类型契约；具体大小属经济平衡域，本件一律不比对）', () => {
    for (const group of GROUPS) {
      expect(typeof group.minGrade).toBe('number');
      expect(Number.isNaN(group.minGrade)).toBe(false);
    }
  });
});

describe('c923-33 互斥映射的对称性与三态', () => {
  it('对称性双向：选 A 排 B 且选 B 排 A（每组两个方向各一次独立 expect）', () => {
    for (const group of GROUPS) {
      const [a, b] = idsOf(group);
      expect(getExcludedPolicyId(a)).toBe(b); // 方向一
      expect(getExcludedPolicyId(b)).toBe(a); // 方向二
    }
  });

  it('成员不与自身互斥（所有成员逐个验）', () => {
    for (const id of ALL_IDS) {
      expect(getExcludedPolicyId(id)).not.toBe(id);
    }
  });

  it('返回值只落在同组两名成员之内（不跨组串台）', () => {
    for (const group of GROUPS) {
      const [a, b] = idsOf(group);
      const allowed = new Set<string>([a, b]);
      for (const id of [a, b]) {
        const excluded = getExcludedPolicyId(id);
        expect(excluded).toBeDefined();
        expect(allowed.has(excluded as string)).toBe(true);
      }
    }
  });

  it('组间无重叠成员（重叠会让"排他"语义依赖数组顺序）', () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
  });

  it('非组内入参一律 undefined：未知 id / 空串 / 大小写错位 / 前后空白 / 真实国策树 id', () => {
    const known = ALL_IDS[0] as string;
    const nonMembers: unknown[] = [
      '',
      'not_a_policy',
      known.toUpperCase(),
      ` ${known}`,
      `${known} `,
      `${known}_typo`,
      'pol_does_not_exist',
      42,
      null,
      undefined,
      {},
    ];
    for (const raw of nonMembers) {
      expect(call(raw), `raw=${String(raw)}`).toBeUndefined();
    }
  });

  it('三态之返回值形状：命中给非空 string，未命中严格 undefined（不给 null / 空串）', () => {
    for (const id of ALL_IDS) {
      const excluded = getExcludedPolicyId(id);
      expect(typeof excluded).toBe('string');
      expect((excluded as string).length).toBeGreaterThan(0);
    }
    expect(call('nope')).toBeUndefined();
  });

  it('重复调用幂等，且不改动 POLICY_EXCLUSION_GROUPS（纯函数零副作用）', () => {
    const before = JSON.stringify(GROUPS);
    for (const id of ALL_IDS) {
      const first = getExcludedPolicyId(id);
      expect(getExcludedPolicyId(id)).toBe(first);
      expect(getExcludedPolicyId(id)).toBe(first);
    }
    // 未命中支路也幂等
    expect(getExcludedPolicyId('nope')).toBe(getExcludedPolicyId('nope'));
    expect(JSON.stringify(GROUPS)).toBe(before);
  });
});
