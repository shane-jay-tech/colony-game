import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter } from '../gameStore';
import { POLICIES, EVENTS, DECREES, BUILDINGS } from '../../data';
import { BALANCE } from '../../data/balanceConfig';
import { STORY_EVENTS } from '../../data/storyEvents';
import type { WorldMap } from '../../data/mapSchema';
import type { ResourceId } from '../../data/resourceRegistry';
import type { CourtEvent } from '../../data/schema';

/**
 * P2 验收实证：故事模式全流程无头试玩——序章统一 → 七章剧情事件逐章解锁 → 三结局兑现。
 * 对应最终验收「朋友可完整玩通故事七卷三结局」的机械兜底（真人试玩的代理证据）。
 *
 * 策略：
 *   - 开局即统一（两个弱 NPC 已被打服，文/武途任一满足）。
 *   - 贪心经营保经济：解锁链国策 + 农田/民居/水井优先（与沙盒模拟同款思路）。
 *   - 剧情事件全部选「最还权+最公有」的选项（公天下路径）→ 断言结局 = gong。
 */

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 40 * 40; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 40, height: 40, tiles, resourceNodes: [], seed: 0 };
}

function npc(id: string, mp: number, stance: number) {
  return {
    id, stance, militaryPower: mp, renown: 40, tradeRoute: false, tradeCooldown: 0,
    warStatus: 'peace' as const, lastEnvoyDay: -1, lastWarDay: -1,
    allyIds: [] as string[], aggression: 40, lastActionDay: -1,
  };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, {
    worldMap: allPlainMap(),
    resources: {
      grain: 800, wood: 400, stone: 300, gold: 300, people: 40,
      cloth: 40, bronze: 40, rite: 10,
    },
    npcCountries: [npc('npc_qi', 10, -30), npc('npc_jin', 12, -40)],
  }, {
    policies: POLICIES,
    events: EVENTS,
    decrees: DECREES,
  });
}

const affordable = (
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  cost: Partial<Record<ResourceId, number>>,
): boolean => Object.entries(cost).every(
  ([rid, v]) => (resources[rid as ResourceId] ?? 0) >= (v as number),
);

/** 公天下路径：选 power+production 之和最大的选项；无 storyAxisDelta 的朝议选第一项。 */
function pickGongChoice(ev: CourtEvent): number {
  if (!ev.choices || ev.choices.length === 0) return 0;
  let best = 0;
  let bestSum = -Infinity;
  ev.choices.forEach((c, i) => {
    const sum = (c.storyAxisDelta?.power ?? 0) + (c.storyAxisDelta?.production ?? 0);
    if (sum > bestSum) { bestSum = sum; best = i; }
  });
  return best;
}

describe('P2 验收实证：故事模式全流程无头试玩', () => {
  it('序章统一 → 七章逐章推进 → 公天下结局兑现（STORY_ENDING）', () => {
    const store = makeStore();
    const ended: string[] = [];
    const chapters: number[] = [];
    let endingDay = -1;
    store.on(STATE_EVENTS.STORY_ENDING, (p: unknown) => {
      ended.push((p as { ending: string }).ending);
      endingDay = store.getCurrentDay();
    });
    store.on(STATE_EVENTS.STORY_CHAPTER_CHANGED, (p: unknown) => chapters.push((p as { chapter: number }).chapter));
    store.startStoryMode();

    const unlockPolicies = new Set(BUILDINGS.flatMap((b) => b.upgradeRequires));
    const HORIZON = 2000;
    let scanIdx = 0;

    for (let day = 0; day < HORIZON; day++) {
      // 剧情事件：公天下路径
      if (store.getPendingEventId() !== null) {
        const ev = store.getPendingEvent();
        store.resolveEvent(ev ? pickGongChoice(ev) : 0);
      }
      if (store.getFactionState().activeDemand) store.resolveFactionDemand(true);

      // 经济：解锁链国策（每天 1 条）+ 农田/民居/水井（每天 1 栋，农田优先，上限各 8/6/3）
      const adopted = store.getAdoptedPolicyIds();
      const res = store.getResources();
      const policyCandidates = store.getPolicies()
        .filter((p) => !adopted.has(p.id) && store.isPolicyUnlocked(p)
          && (unlockPolicies.has(p.id) || day > 60) && affordable(res, p.cost))
        .sort((a, b) => a.tier - b.tier);
      for (const p of policyCandidates) {
        if (store.adoptPolicy(p.id).ok) break;
      }
      const counts = new Map<string, number>();
      for (const b of store.getBuildings()) counts.set(b.defId, (counts.get(b.defId) ?? 0) + 1);
      const capOf = (id: string): number => {
        if (id === 'bld_farm') return 8;
        if (id === 'bld_house') return 6;
        if (id === 'bld_well') return 3;
        return 1;
      };
      const priority = new Set(['bld_farm', 'bld_house', 'bld_well', 'bld_mulberry_grove', 'bld_ancestor_shrine', 'bld_market']);
      const candidates = BUILDINGS
        .filter((b) => store.isBuildingUnlocked(b) && affordable(res, b.cost))
        .filter((b) => (counts.get(b.id) ?? 0) < capOf(b.id))
        .sort((a, b) => {
          const pa = priority.has(a.id) ? 0 : 1;
          const pb = priority.has(b.id) ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return a.tier - b.tier;
        });
      for (const def of candidates) {
        let hit = false;
        for (let k = 0; k < 60 && !hit; k++) {
          const idx = (scanIdx + k) % (40 * 40);
          const r = store.placeBuilding(def, idx % 40, Math.floor(idx / 40), { width: 40, height: 40 });
          if (r.ok) { hit = true; scanIdx = (idx + 1) % (40 * 40); }
          else if (r.reason === 'insufficient_resources' || r.reason === 'insufficient_labor') break;
        }
        if (hit) break;
      }

      store.tickDay();
      // 无头模拟 GameScene 的建朝过场：统一后由场景调 advanceStoryChapter(1)
      const sfNow = store.getStoryFlags();
      if (sfNow && sfNow.unified && sfNow.chapter === 0) {
        store.advanceStoryChapter(1);
      }
      if (ended.length > 0) break;
    }

    // 结局兑现
    expect(ended).toEqual(['gong']);
    const sf = store.getStoryFlags()!;
    expect(sf.ending).toBe('gong');
    expect(sf.chapter).toBe(7);
    // 七章全部走过（序章不算在 chapter 事件里）
    expect(chapters).toContain(1);
    expect(chapters).toContain(7);
    // 全部 35 条剧情事件都已触发并解决
    const storyIds = new Set(STORY_EVENTS.map(e => e.id));
    for (const id of storyIds) {
      expect(sf.storyEventsTriggered, `未触发 ${id}`).toContain(id);
    }
    // 节奏护栏：七卷 + 35 事件在 100~600 天内走完（8 日防连击底线 → 每章有呼吸，又不被沙盒节拍拖垮）
    expect(endingDay).toBeGreaterThan(100);
    expect(endingDay).toBeLessThan(600);
  }, 300000);
});
