// c918-26：sandbox 终局精确快照（回归闸门强化）。
// 复用 sandboxSimulation.test 的贪心 720 日 harness（本班已 export）。
// ⚠️ 快照语义：以下精确值是「有意翻桩」锚点——任何数值改动必须是有意的
// 平衡/规则变更，翻桩时须在 commit message 注明变更原因。漂移＝回归。
import { describe, it, expect } from 'vitest';
import { runSimulation } from './sandboxSimulation.test';

describe('sandbox 终局精确快照（贪心 720 日）', () => {
  it('终局精确值：finalDay/人口/建筑/国格/关键资源快照', () => {
    const { stats } = runSimulation(720);
    expect(stats.finalDay).toBe(720);
    expect(stats.finalPopulation).toBe(115);
    expect(stats.finalBuildings).toBe(40);
    expect(stats.gradeReached).toBe(1);
    expect(stats.crisisCount).toBe(0);
    expect(stats.gradeMilestones).toEqual([{ day: 36, grade: 1 }]);
    // 关键资源精确快照（贪心终局）
    expect(stats.finalResources.wood).toBe(9999);
    expect(stats.finalResources.grain).toBe(9895);
    expect(stats.finalResources.people).toBe(115);
    expect(stats.finalResources.influence).toBe(70);
    expect(stats.finalResources.rite).toBe(4);
  }, 120000);
});
