import { describe, it, expect } from 'vitest';
import { ACT_TIMELINE, actFor, actName } from '../actTimeline';

/**
 * P2 三幕时间轴数据测试：幕边界、参数单调性（后期合纵/压境更烈，蛮夷渐退）。
 */

describe('actTimeline — 三幕边界', () => {
  it('按日取幕：0/239/240/479/480+ 边界正确', () => {
    expect(actFor(0).id).toBe('act_barbarians');
    expect(actFor(239).id).toBe('act_barbarians');
    expect(actFor(240).id).toBe('act_hegemony');
    expect(actFor(479).id).toBe('act_hegemony');
    expect(actFor(480).id).toBe('act_collapse');
    expect(actFor(99999).id).toBe('act_collapse');
    expect(actFor(-5).id).toBe('act_barbarians'); // 越早取第一幕
  });

  it('三幕：合纵倾向与压境概率递增、蛮夷犯边递减', () => {
    expect(ACT_TIMELINE.length).toBe(3);
    const [a1, a2, a3] = ACT_TIMELINE;
    expect(a1!.params.tribalRaidMul).toBeGreaterThan(a2!.params.tribalRaidMul);
    expect(a2!.params.tribalRaidMul).toBeGreaterThan(a3!.params.tribalRaidMul);
    expect(a2!.params.allianceBias).toBeGreaterThan(a1!.params.allianceBias);
    expect(a3!.params.allianceBias).toBeGreaterThan(a2!.params.allianceBias);
    expect(a3!.params.assaultMul).toBeGreaterThan(a2!.params.assaultMul);
    expect(a2!.params.assaultMul).toBeGreaterThan(a1!.params.assaultMul);
  });

  it('actName 反查', () => {
    expect(actName('act_hegemony')).toContain('诸侯会盟');
    expect(actName('未知')).toBe('未知');
  });
});
