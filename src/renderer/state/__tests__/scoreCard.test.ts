import { describe, it, expect } from 'vitest';
import { computeScoreCard, type ScoreInput } from '../scoreCard';

/**
 * P2 目标感 · 终局记分牌纯函数测试：多维计分、里程碑权重、结局评语。
 */

function base(): ScoreInput {
  return {
    grade: 0, gradeReached: 0, population: 0, buildingCount: 0,
    allyCount: 0, friendlyCount: 0, subjugatedCount: 0, crisisCount: 0,
    relicsDone: 0, relicsTotal: 0, megaProjectsDone: 0, megaProjectsTotal: 0,
    endgameWavesSurvived: 0, ending: null, tianxia: false, days: 0,
  };
}

describe('computeScoreCard — 多维计分', () => {
  it('空国：总分 0、草创评语', () => {
    const c = computeScoreCard(base());
    expect(c.total).toBe(0);
    expect(c.verdict).toContain('草创');
    expect(c.items.length).toBeGreaterThanOrEqual(4); // 国格/人口/城建/存续 至少四条
  });

  it('登顶天下共主：国格 1000 + 天下共主 1000 + 其余', () => {
    const c = computeScoreCard({ ...base(), grade: 5, gradeReached: 5, tianxia: true });
    expect(c.total).toBeGreaterThanOrEqual(2000);
    expect(c.verdict).toContain('九鼎');
    const tianxiaItem = c.items.find(i => i.label === '天下共主');
    expect(tianxiaItem?.points).toBe(1000);
  });

  it('里程碑权重高于存量：一盟邦 150 > 十口人 20', () => {
    const c = computeScoreCard({ ...base(), allyCount: 1, population: 10 });
    const ally = c.items.find(i => i.label === '盟邦');
    const pop = c.items.find(i => i.label === '人口');
    expect(ally?.points).toBe(150);
    expect(pop?.points).toBe(20);
  });

  it('故事三结局：公天下 500 + 专属评语', () => {
    const c = computeScoreCard({ ...base(), ending: 'gong' });
    const item = c.items.find(i => i.label.startsWith('结局'));
    expect(item?.points).toBe(500);
    expect(c.verdict).toContain('大道之行');
  });

  it('家/货结局评语各异', () => {
    expect(computeScoreCard({ ...base(), ending: 'jia' }).verdict).toContain('明君');
    expect(computeScoreCard({ ...base(), ending: 'huo' }).verdict).toContain('人心凉');
  });

  it('古迹/大业/终局风浪 按完成数计分', () => {
    const c = computeScoreCard({
      ...base(),
      relicsDone: 2, relicsTotal: 3, megaProjectsDone: 1, megaProjectsTotal: 3,
      endgameWavesSurvived: 4,
    });
    expect(c.items.find(i => i.label === '古迹探毕')?.points).toBe(240);
    expect(c.items.find(i => i.label === '大业功成')?.points).toBe(200);
    expect(c.items.find(i => i.label === '终局风浪')?.points).toBe(600);
  });
});
