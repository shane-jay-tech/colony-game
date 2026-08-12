/**
 * 七卷剧情内容不变量（2026-06-07 扩充后锁定）。
 * 守护手写内容的两类硬错：章节目标引用了不存在的事件 id（悬空引用）、
 * 以及三结局是否仍可通过一致的双轴选择达成（防内容改动悄悄堵死某个结局）。
 */
import { describe, it, expect } from 'vitest';
import { STORY_CHAPTERS } from '../storyChapters';
import { STORY_EVENTS } from '../storyEvents';
import { clampAxis, checkEnding } from '../../state/storyDriver';

const STORY_EVENT_IDS = new Set(STORY_EVENTS.map(e => e.id));
const chapterEvents = STORY_EVENTS.filter(e => e.id.startsWith('evt_s_ch'));

describe('七卷剧情内容不变量', () => {
  it('每个章节目标引用的事件 id 都真实存在（无悬空引用）', () => {
    const dangling: string[] = [];
    for (const ch of STORY_CHAPTERS) {
      if (ch.advanceGoal?.kind !== 'story_events') continue;
      for (const id of ch.advanceGoal.eventIds ?? []) {
        if (!STORY_EVENT_IDS.has(id)) dangling.push(`${ch.id} → ${id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('每卷至少 3 个剧情事件（扩充后更饱满），且全部 tag 含"故事"', () => {
    for (let n = 1; n <= 7; n++) {
      const inChapter = chapterEvents.filter(e =>
        e.triggers.some(t => t.condition === `story_chapter == ${n}`),
      );
      expect(inChapter.length, `第 ${n} 章事件数`).toBeGreaterThanOrEqual(3);
      for (const e of inChapter) {
        expect(e.tags, `${e.id} 应带"故事"标签`).toContain('故事');
      }
    }
  });

  it('每个剧情事件都是双选抉择，选项含 effects 与隐性双轴', () => {
    for (const e of chapterEvents) {
      expect(e.choices?.length, `${e.id} 应有 2 个选项`).toBe(2);
      for (const c of e.choices ?? []) {
        expect(Array.isArray(c.effects), `${e.id} 选项 effects`).toBe(true);
        // 至少一个选项方向推双轴（故事性选择不应零信息）
      }
      const pushesAxis = (e.choices ?? []).some(
        c => (c.storyAxisDelta?.power ?? 0) !== 0 || (c.storyAxisDelta?.production ?? 0) !== 0,
      );
      expect(pushesAxis, `${e.id} 至少一个选项应推动双轴`).toBe(true);
    }
  });

  it('三结局均可达：一致选择能落到 公/家/货 三档', () => {
    // 公天下：每个事件都选"最还权+最公有"的选项 → 应落 gong
    let p = 0, r = 0;
    for (const e of chapterEvents) {
      const best = (e.choices ?? []).reduce((a, b) => {
        const sa = (a.storyAxisDelta?.power ?? 0) + (a.storyAxisDelta?.production ?? 0);
        const sb = (b.storyAxisDelta?.power ?? 0) + (b.storyAxisDelta?.production ?? 0);
        return sb > sa ? b : a;
      });
      p += best.storyAxisDelta?.power ?? 0;
      r += best.storyAxisDelta?.production ?? 0;
    }
    expect(checkEnding(clampAxis(p), clampAxis(r))).toBe('gong');

    // 家天下：每个事件都选"最集权"的选项 → 权轴落 centralize → jia（不论资料轴）
    let pc = 0, rc = 0;
    for (const e of chapterEvents) {
      const worst = (e.choices ?? []).reduce((a, b) =>
        (b.storyAxisDelta?.power ?? 0) < (a.storyAxisDelta?.power ?? 0) ? b : a,
      );
      pc += worst.storyAxisDelta?.power ?? 0;
      rc += worst.storyAxisDelta?.production ?? 0;
    }
    expect(checkEnding(clampAxis(pc), clampAxis(rc))).toBe('jia');

    // 货天下：还权但守私有（power 取最高、production 取最低）→ devolve + private → huo
    let ph = 0, rh = 0;
    for (const e of chapterEvents) {
      const maxP = Math.max(...(e.choices ?? []).map(c => c.storyAxisDelta?.power ?? 0));
      const minR = Math.min(...(e.choices ?? []).map(c => c.storyAxisDelta?.production ?? 0));
      ph += maxP;
      rh += minR;
    }
    expect(checkEnding(clampAxis(ph), clampAxis(rh))).toBe('huo');
  });
});
