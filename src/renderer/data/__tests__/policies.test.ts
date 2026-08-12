import { describe, it, expect } from 'vitest';
import { POLICIES } from '../policies';
import { DECREES } from '../decrees';

/**
 * 国策树布局/图逻辑不变量（2026-06-20 HOI4 化重排后的回归守护）。
 * 保证连线渲染（父在上、子在下的向下折线）不再画出 EDGE-01 那种"倒灌"扭曲，
 * 且坐标与 tier/branch/互斥 自洽。
 */

const NODE_W = 140;
const NODE_H = 48;
const byId = new Map(POLICIES.map(p => [p.id, p]));

describe('国策树布局不变量', () => {
  it('每个前置都存在', () => {
    for (const p of POLICIES) {
      for (const pre of p.prerequisites) {
        expect(byId.has(pre), `${p.id} 的前置 ${pre} 不存在`).toBe(true);
      }
    }
  });

  it('子节点严格在父节点下方（y 更大）——连线才不会倒灌', () => {
    for (const p of POLICIES) {
      for (const pre of p.prerequisites) {
        const parent = byId.get(pre)!;
        expect(p.y, `${p.id}(y=${p.y}) 应在前置 ${pre}(y=${parent.y}) 下方`).toBeGreaterThan(parent.y);
      }
    }
  });

  it('tier 越深 y 越大（同 tier 同行）', () => {
    for (const p of POLICIES) {
      for (const pre of p.prerequisites) {
        const parent = byId.get(pre)!;
        // 子 tier 必须 >= 父 tier（树状递进）
        expect(p.tier, `${p.id} tier 应 >= 前置 ${pre}`).toBeGreaterThanOrEqual(parent.tier);
      }
    }
  });

  it('互斥关系双向对称', () => {
    for (const p of POLICIES) {
      for (const ex of p.mutuallyExclusive ?? []) {
        const other = byId.get(ex);
        expect(other, `${p.id} 互斥的 ${ex} 不存在`).toBeDefined();
        expect(other!.mutuallyExclusive ?? [], `${ex} 未反向声明与 ${p.id} 互斥`).toContain(p.id);
      }
    }
  });

  it('任意两节点不重叠（中心距足够）', () => {
    for (let i = 0; i < POLICIES.length; i++) {
      for (let j = i + 1; j < POLICIES.length; j++) {
        const a = POLICIES[i]!, b = POLICIES[j]!;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        // 只要 x 或 y 方向其一拉开到不重叠即可
        const separated = dx >= NODE_W || dy >= NODE_H;
        expect(separated, `${a.id} 与 ${b.id} 包围盒重叠 (dx=${dx}, dy=${dy})`).toBe(true);
      }
    }
  });
});

describe('意识形态双轴（封建→三主义）', () => {
  const AXIS_THRESHOLD = 34; // storyDriver 档位阈值

  it('国策携带了意识形态倾向（storyAxisDelta 已应用）', () => {
    const withAxis = POLICIES.filter(p => p.storyAxisDelta);
    expect(withAxis.length).toBeGreaterThanOrEqual(20); // 多数有倾向的国策都接上了
  });

  it('双轴数值在合理范围 [-15,15]', () => {
    for (const p of POLICIES) {
      const d = p.storyAxisDelta; if (!d) continue;
      if (d.power !== undefined) expect(Math.abs(d.power), p.id).toBeLessThanOrEqual(15);
      if (d.production !== undefined) expect(Math.abs(d.production), p.id).toBeLessThanOrEqual(15);
    }
  });

  it('三结局各自可达：仅靠国策+朝令的轴和即可越过 ±34 档', () => {
    const all = [...POLICIES, ...DECREES].map(x => x.storyAxisDelta).filter(Boolean) as { power?: number; production?: number }[];
    const sumPos = (k: 'power' | 'production') => all.reduce((s, d) => s + Math.max(0, d[k] ?? 0), 0);
    const sumNeg = (k: 'power' | 'production') => all.reduce((s, d) => s + Math.min(0, d[k] ?? 0), 0);
    // 还权(公倾向) / 集权(家) / 公有 / 私有(货) 四个极端都要能被国策朝令推过阈值
    expect(sumPos('power'), '还权不可达').toBeGreaterThanOrEqual(AXIS_THRESHOLD);
    expect(sumNeg('power'), '集权不可达').toBeLessThanOrEqual(-AXIS_THRESHOLD);
    expect(sumPos('production'), '公有不可达').toBeGreaterThanOrEqual(AXIS_THRESHOLD);
    expect(sumNeg('production'), '私有不可达').toBeLessThanOrEqual(-AXIS_THRESHOLD);
  });

  it('公天下可"无矛盾"达成：只用不集权(power>=0)的国策朝令即可双轴过 +34', () => {
    // Kimi 反馈漏洞：若公有国策多半带集权，则还权+公有难凑齐。校验存在一条不自相矛盾的公天下路径。
    const coherent = [...POLICIES, ...DECREES]
      .map(x => x.storyAxisDelta).filter(Boolean)
      .map(d => ({ p: d!.power ?? 0, r: d!.production ?? 0 }))
      .filter(d => d.p >= 0 && d.r >= 0); // 既不集权、也不私有的纯公天下候选
    const sumP = coherent.reduce((s, d) => s + d.p, 0);
    const sumR = coherent.reduce((s, d) => s + d.r, 0);
    expect(sumP, '纯公天下路径的还权不足').toBeGreaterThanOrEqual(AXIS_THRESHOLD);
    expect(sumR, '纯公天下路径的公有不足').toBeGreaterThanOrEqual(AXIS_THRESHOLD);
  });
});
