// c918-26：sandbox 终局精确快照（回归闸门强化）。
// 复用 sandboxSimulation.test 的贪心 720 日 harness（本班已 export）。
// ⚠️ 快照语义：以下精确值是「有意翻桩」锚点——任何数值改动必须是有意的
// 平衡/规则变更，翻桩时须在 commit message 注明变更原因。漂移＝回归。
//
// 2026-09-20 有意翻桩（c919-51 apply，方案项 2：市集金 5→3，buildings.ts:bld_market.output）：
//   变更原因 = 饱和校准——贪心 720 日 gold 触顶 9999，方案验收口径要求 saturatedResources 收敛为 ≤1 项。
//   翻桩后实测（npx vitest run src/renderer/state/__tests__/sandboxSimulation.test.ts）：
//   人口 115→117、升格日 36→41、粮 9895→9894、gold 9999→6052（不再触顶），saturatedResources ["wood","gold"]→["wood"]。
//   同批方案项 1（伐木 8→6）实测会崩解本基线（grade 0），已判定不落盘，故 wood 仍为 9999。
import { describe, it, expect } from 'vitest';
import { runSimulation } from './sandboxSimulation.test';

describe('sandbox 终局精确快照（贪心 720 日）', () => {
  it('终局精确值：finalDay/人口/建筑/国格/关键资源快照', () => {
    const { stats } = runSimulation(720);
    expect(stats.finalDay).toBe(720);
    expect(stats.finalPopulation).toBe(117);
    expect(stats.finalBuildings).toBe(40);
    expect(stats.gradeReached).toBe(1);
    expect(stats.crisisCount).toBe(0);
    expect(stats.gradeMilestones).toEqual([{ day: 41, grade: 1 }]);
    // 关键资源精确快照（贪心终局）
    expect(stats.finalResources.wood).toBe(9999);
    // 2026-09-20 新增锚点：gold 曾被市集产出推满 9999（饱和），校准后应停在 6052 不再触顶。
    expect(stats.finalResources.gold).toBe(6052);
    expect(stats.finalResources.grain).toBe(9894);
    expect(stats.finalResources.people).toBe(117);
    expect(stats.finalResources.influence).toBe(70);
    expect(stats.finalResources.rite).toBe(4);
  }, 120000);
});
