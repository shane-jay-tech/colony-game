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

  it('③ 升级链 upgradesTo / upgradesFrom 数组逐元素指向存在的建筑（c1012-01 案a 数组化）', () => {
    const dangling: string[] = [];
    for (const b of BUILDINGS) {
      for (const key of ['upgradesTo', 'upgradesFrom'] as const) {
        for (const ref of ((b as unknown as Record<string, string[] | undefined>)[key] ?? [])) {
          if (!ids.has(ref)) {
            dangling.push(`${b.id}.${key} → ${ref}（不存在）`);
          }
        }
      }
    }
    expect(dangling).toEqual([]);
  });

    it('④ 反向配对（c1012-01 案a 数组化）：from[] 每一源的 to[] 必含本建筑；:63 TODO 闭合', () => {
    // 原 TODO（不对称）：pottery.upgradesTo=market 而 market.upgradesFrom=well 单值承载不了
    // 多来源。决议#4 案 a：双字段数组化＋market.upgradesFrom=['bld_well','bld_pottery_kiln']
    // ⇒ 反向配对在数组语义下全量成立（不对称消解）。
    const broken: string[] = [];
    for (const b of BUILDINGS) {
      for (const from of b.upgradesFrom ?? []) {
        const parent = BUILDINGS.find((x) => x.id === from);
        const toList = parent?.upgradesTo ?? [];
        if (!toList.includes(b.id)) {
          broken.push(`${b.id}.upgradesFrom 含 ${from} 但 ${from}.upgradesTo 不含本建筑`);
        }
      }
      for (const to of b.upgradesTo ?? []) {
        const child = BUILDINGS.find((x) => x.id === to);
        const fromList = child?.upgradesFrom ?? [];
        if (!fromList.includes(b.id)) {
          broken.push(`${b.id}.upgradesTo 含 ${to} 但 ${to}.upgradesFrom 不含本建筑（反向缺失）`);
        }
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

it('⑥ 迁移例（c1012-01 案a）：全量 defs 升级引用均为数组形态（标量残留=0）＋市场双源钉', () => {
  for (const b of BUILDINGS) {
    if (b.upgradesTo !== undefined) expect(Array.isArray(b.upgradesTo)).toBe(true);
    if (b.upgradesFrom !== undefined) expect(Array.isArray(b.upgradesFrom)).toBe(true);
  }
  const market = BUILDINGS.find((x) => x.id === 'bld_market');
  expect(market?.upgradesFrom).toEqual(['bld_well', 'bld_pottery_kiln']);
  // 存档兼容面： BuildingDef 为静态数据不进存档——存档只持 defId/level 实例，
  // v3 往返不受 schema 形态影响（saveLoad 49 例回归为主证）。
});
