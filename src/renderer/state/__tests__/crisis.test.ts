import { describe, it, expect } from 'vitest';
import {
  isDualZero,
  chooseCrisisKind,
  planUnrestEffects,
  planCessionMoraleDrop,
  planTribute,
  CRISIS_POP_FLOOR,
  CRISIS_MORALE_DROP,
  CRISIS_GRACE_DAYS,
  VASSAL_TRIBUTE_RATE,
} from '../crisis';

describe('isDualZero', () => {
  it('gold 与 grain 都 ≤0 → true（含缺失/负值）', () => {
    expect(isDualZero({ gold: 0, grain: 0 })).toBe(true);
    expect(isDualZero({})).toBe(true);
    expect(isDualZero({ gold: -5, grain: -1 })).toBe(true);
  });
  it('任一为正 → false', () => {
    expect(isDualZero({ gold: 1, grain: 0 })).toBe(false);
    expect(isDualZero({ gold: 0, grain: 10 })).toBe(false);
  });
});

describe('CRISIS_GRACE_DAYS', () => {
  it('§7 触发缩到 40 天', () => {
    expect(CRISIS_GRACE_DAYS).toBe(40);
  });
});

describe('chooseCrisisKind（按情境选）', () => {
  it('有军力远超的强敌 → 纳贡附庸', () => {
    expect(chooseCrisisKind({ hasStrongHostileNpc: true, cedableBuildingCount: 3 })).toBe('vassalage');
  });
  it('无强敌但有外城可割 → 割地', () => {
    expect(chooseCrisisKind({ hasStrongHostileNpc: false, cedableBuildingCount: 2 })).toBe('cession');
  });
  it('无强敌无外城 → 民变', () => {
    expect(chooseCrisisKind({ hasStrongHostileNpc: false, cedableBuildingCount: 0 })).toBe('unrest');
  });
});

describe('planUnrestEffects（含防刷递增）', () => {
  it('首次（crisisCount=0）：人口 ×0.7、民心 -20', () => {
    const eff = planUnrestEffects(100, 0);
    expect(eff.newPeople).toBe(70);
    expect(eff.peopleDelta).toBe(-30);
    expect(eff.moraleDelta).toBe(-CRISIS_MORALE_DROP);
  });
  it('递增：第二次（crisisCount=1）人口乘数更狠、民心跌更多', () => {
    const eff = planUnrestEffects(100, 1);
    expect(eff.newPeople).toBe(65); // 0.7-0.05=0.65
    expect(eff.moraleDelta).toBe(-(CRISIS_MORALE_DROP + 5));
  });
  it('人口乘数有下限 0.4（多次危机不无限恶化）', () => {
    const eff = planUnrestEffects(100, 99); // 远超 → clamp 0.4
    expect(eff.newPeople).toBe(40);
  });
  it('低人口触下限保护', () => {
    expect(planUnrestEffects(6, 0).newPeople).toBe(CRISIS_POP_FLOOR);
  });
});

describe('planCessionMoraleDrop / planTribute', () => {
  it('割地民心跌幅随危机数递增', () => {
    expect(planCessionMoraleDrop(0)).toBe(-10);
    expect(planCessionMoraleDrop(2)).toBe(-(10 + 10));
  });
  it('附庸抽成 = 资源 × 比例 向下取整', () => {
    expect(planTribute(100)).toBe(Math.floor(100 * VASSAL_TRIBUTE_RATE));
    expect(planTribute(0)).toBe(0);
  });
});
