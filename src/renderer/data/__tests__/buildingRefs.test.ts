// buildingRefs——建筑配置表引用完整性守护（d914-77 N4）。
// upgradeRequires / upgradesTo / upgradesFrom / adjacencyBonus[].partnerDefId
// 全是裸字符串（pol_*/bld_*/decree_* 三族），类型系统拦不住拼错——本文件钉成永久守护。
// 数据只读：BUILDINGS / POLICIES / DECREES 零改动。
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../buildings';
import { POLICIES } from '../policies';
import { DECREES } from '../decrees';

const ids = new Set(BUILDINGS.map((b) => b.id));
const policyIds = new Set(POLICIES.map((p) => p.id));
const decreeIds = new Set(DECREES.map((d) => d.id));

const PREFIX_TARGET: Record<string, Set<string>> = {
  pol_: policyIds,
  bld_: ids,
  decree_: decreeIds,
};
const PREFIXES = ['decree_', 'pol_', 'bld_']; // 长前缀优先，避免 decree_ 被截成 4 字符

function resolvePrefixTarget(req: string): Set<string> | undefined {
  const prefix = PREFIXES.find((p) => req.startsWith(p));
  return prefix ? PREFIX_TARGET[prefix] : undefined;
}

describe('buildingRefs 建筑配置表引用完整性', () => {
  it('① 建筑 id 全表唯一且数量恒定（=35，防复制粘贴撞 id）', () => {
    const list = BUILDINGS.map((b) => b.id);
    expect(new Set(list).size).toBe(list.length);
    expect(list.length).toBe(35);
  });

  it('② upgradeRequires 前缀合法且逐条可解析（悬空即列出「哪个建筑的哪一条」）', () => {
    const dangling: string[] = [];
    for (const b of BUILDINGS) {
      for (const req of b.upgradeRequires ?? []) {
        const prefix = PREFIXES.find((p) => req.startsWith(p));
        const target = prefix ? PREFIX_TARGET[prefix] : undefined;
        if (!target) {
          dangling.push(`${b.id}: ${req}（前缀必须是 pol_/bld_/decree_ 之一）`);
        } else if (!target.has(req)) {
          dangling.push(`${b.id}: ${req}（${prefix}* 不存在于对应表）`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('③ 升级链 upgradesTo / upgradesFrom 指向存在的建筑', () => {
    const dangling: string[] = [];
    for (const b of BUILDINGS) {
      for (const key of ['upgradesTo', 'upgradesFrom'] as const) {
        const ref = (b as unknown as Record<string, string | undefined>)[key];
        if (ref !== undefined && !ids.has(ref)) {
          dangling.push(`${b.id}.${key} → ${ref}（不存在）`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('④ 反向配对：X.upgradesFrom = Y ⇒ Y.upgradesTo = X（单值来源语义）', () => {
    // TODO（只记不改）：陶窑 bld_pottery_kiln.upgradesTo = bld_market 为「一目标多来源」，
    // 而 bld_market.upgradesFrom = bld_well——不对称，语义待日间确认。
    const broken: string[] = [];
    for (const b of BUILDINGS) {
      const from = (b as unknown as Record<string, string | undefined>)['upgradesFrom'];
      if (from === undefined) continue;
      const parent = BUILDINGS.find((x) => x.id === from) as unknown as Record<
        string,
        string | undefined
      >;
      if (parent?.['upgradesTo'] !== b.id) {
        broken.push(`${b.id}.upgradesFrom=${from} 但 ${from}.upgradesTo=${parent?.['upgradesTo'] ?? '（未声明）'}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('⑤ 邻接伙伴 partnerDefId 全部存在（实测 9 处）', () => {
    const dangling: string[] = [];
    let checked = 0;
    for (const b of BUILDINGS) {
      for (const adj of (b as unknown as { adjacencyBonus?: { partnerDefId: string }[] })
        .adjacencyBonus ?? []) {
        checked += 1;
        if (!ids.has(adj.partnerDefId)) {
          dangling.push(`${b.id}: partnerDefId=${adj.partnerDefId}（不存在）`);
        }
      }
    }
    expect(checked).toBe(9);
    expect(dangling).toEqual([]);
  });
});
