// c922-129：courtFormat.ts 的**首份**测试（改前实测零用例：ls __tests__ 无同名件、
// grep -rln courtFormat 在全部 __tests__ 与 scripts/ 下零命中 exit=1，而生产侧 12 文件引用它）。
// 该件是朝堂/工坊/图例等面板共用的格式化 helper，**真纯函数**（零 Phaser、零 store，仅 type import），
// 桩成本为零 ⇒ 按 c922-13 排序属"最廉可钉"那一档。
// 口径：只钉字符串产出与键集形状，不判任何经济数值（成本 value 只作输入，从不比对）。
import { describe, expect, it } from 'vitest';
import { RESOURCE_LABEL, failDecreeMsg, failPolicyMsg, formatCost } from '../courtFormat';
import type { ResourceCost } from '../../data/resourceRegistry';
import { RESOURCE_IDS } from '../../data/resourceRegistry';

describe('c922-129 courtFormat 钉子一：RESOURCE_LABEL 与资源事实源对齐', () => {
  it('标签表的键集与 RESOURCE_IDS 逐一相同（新增资源漏登记标签即红）', () => {
    expect([...Object.keys(RESOURCE_LABEL)].sort()).toEqual([...RESOURCE_IDS].sort());
    expect(RESOURCE_IDS.length).toBe(11);
  });
  it('11 个标签字面钉桩（改文案是产品决定，必须显式改这里）', () => {
    expect(RESOURCE_LABEL).toEqual({
      grain: '粮', wood: '木', stone: '石', gold: '钱', people: '民',
      cloth: '布', bronze: '铜', rite: '礼', hemp: '麻', tin: '锡', influence: '名望',
    });
  });
  it('无空标签、无重复标签（两两不同的 11 个显示名）', () => {
    const vals = Object.values(RESOURCE_LABEL);
    for (const v of vals) expect(v.trim().length).toBeGreaterThan(0);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe('c922-129 courtFormat 钉子二：formatCost 正常值', () => {
  it('两项成本按插入序拼成「粮20 · 木15」', () => {
    expect(formatCost({ grain: 20, wood: 15 })).toBe('粮20 · 木15');
  });
  it('分隔符恰为「 · 」，11 资源同现时切出 11 段', () => {
    const all: ResourceCost = {
      grain: 1, wood: 1, stone: 1, gold: 1, people: 1, cloth: 1, bronze: 1, rite: 1, hemp: 1, tin: 1, influence: 1,
    };
    expect(formatCost(all).split(' · ')).toHaveLength(11);
  });
  it('单键无分隔符，且用的是标签不是键名', () => {
    expect(formatCost({ influence: 3 })).toBe('名望3');
  });
});

describe('c922-129 courtFormat 钉子三：formatCost 边界与回退', () => {
  it('空成本 / 全零成本 → 「免费」', () => {
    expect(formatCost({})).toBe('免费');
    expect(formatCost({ grain: 0, wood: 0 })).toBe('免费');
  });
  it('零值项被跳过、正数项保留（混合输入不整体降级为免费）', () => {
    expect(formatCost({ grain: 0, gold: 5 })).toBe('钱5');
  });
  it('负数与 undefined 一律不显示（v && v > 0 双条件）', () => {
    expect(formatCost({ grain: -3 } as ResourceCost)).toBe('免费');
    expect(formatCost({ grain: undefined } as ResourceCost)).toBe('免费');
    expect(formatCost({ grain: undefined, wood: 2 } as ResourceCost)).toBe('木2');
  });
  it('未知键回退显示键名本身（标签缺登记时的兜底路径，实测可达）', () => {
    expect(formatCost({ bogus_res: 4 } as unknown as ResourceCost)).toBe('bogus_res4');
  });
  it('小数原样呈现（不做取整，格式化面不归本件管）', () => {
    expect(formatCost({ grain: 0.5 })).toBe('粮0.5');
  });
  it('纯函数自证：同输入两次调用产出全等，且不受前一次调用影响', () => {
    const input: ResourceCost = { grain: 7, tin: 2 };
    expect(formatCost(input)).toBe(formatCost(input));
    expect(formatCost({})).toBe('免费');
    expect(formatCost(input)).toBe('粮7 · 锡2');
  });
});

describe('c922-129 courtFormat 钉子四：failPolicyMsg 分支全覆盖', () => {
  const CASES: [string, string][] = [
    ['insufficient_resources', '资源不足，无法采纳此策'],
    ['already_adopted', '此策已在国，无须再议'],
    ['mutually_excluded', '已采纳互斥之策，此路不可兼行'],
    ['unknown_policy', '未知国策（数据缺失）'],
  ];
  it('四条静态 reason 文案逐字钉桩', () => {
    for (const [reason, msg] of CASES) expect(failPolicyMsg({ reason })).toBe(msg);
  });
  it('prerequisites_unmet 两分支：有 missingPrereqs 报条数、无则报泛指', () => {
    expect(failPolicyMsg({ reason: 'prerequisites_unmet', missingPrereqs: ['a', 'b'] })).toBe('尚需先行 2 项前置之策');
    expect(failPolicyMsg({ reason: 'prerequisites_unmet', missingPrereqs: [] })).toBe('尚需先行其他国策');
    expect(failPolicyMsg({ reason: 'prerequisites_unmet' })).toBe('尚需先行其他国策');
  });
  it('未知 reason 落 default，不得返回 undefined 或空串', () => {
    expect(failPolicyMsg({ reason: 'made_up_reason' })).toBe('无法采纳此策');
    expect(failPolicyMsg({ reason: '' })).toBe('无法采纳此策');
  });
});

describe('c922-129 courtFormat 钉子五：failDecreeMsg 分支全覆盖', () => {
  const CASES: [string, string][] = [
    ['insufficient_resources', '资源不足，无以颁此朝令'],
    ['already_active', '此令已在颁行'],
    ['unlock_condition_unmet', '尚未满足颁令条件'],
    ['chain_locked', '前置朝令未成，此令尚锁'],
    ['unknown_decree', '未知朝令（数据缺失）'],
  ];
  it('五条静态 reason 文案逐字钉桩', () => {
    for (const [reason, msg] of CASES) expect(failDecreeMsg({ reason })).toBe(msg);
  });
  it('未知 reason 落 default', () => {
    expect(failDecreeMsg({ reason: 'nope' })).toBe('无法颁此朝令');
  });
});

describe('c922-129 courtFormat 钉子六：文案面守卫（防把内部量拼进成人话）', () => {
  it('两函数对全部已知 reason 产出非空、不含 undefined/NaN/[object 的中文文案', () => {
    const reasons = [
      'insufficient_resources', 'already_adopted', 'prerequisites_unmet', 'mutually_excluded', 'unknown_policy',
      'already_active', 'unlock_condition_unmet', 'chain_locked', 'unknown_decree', '???',
    ];
    for (const r of reasons) {
      for (const msg of [failPolicyMsg({ reason: r }), failDecreeMsg({ reason: r })]) {
        expect(msg.length, r).toBeGreaterThan(0);
        expect(msg, r).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });
});
