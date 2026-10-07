/**
 * PolicyTreePanel 纯逻辑测试。Phaser scene/graphics/text/zone/container 全 mock。
 * 验证：tab 切换 / open 时停 + close 恢复 / 点节点调 adoptPolicy / 点卡片调 adoptDecree /
 * 资源不足 toast / 已激活朝令提示 / destroy 解绑。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { PolicyNode, RoyalDecree } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import { PolicyTreePanel } from '../PolicyTreePanel';
import { makeFakeContainer, makeFakeGraphics, makeFakeText, makeFakeZone } from './fakeScene';

type FakeZone = ReturnType<typeof makeFakeZone>;

// c923-02（批五）：本地 makeFakeText/makeFakeGraphics 副本收编进共享 fakeScene——
// 两者方法表逐条均为共享件子集，displayHeight 本就是默认 18，故直用共享件、无行为差。

function makeFakeScene(toast?: { show: ReturnType<typeof vi.fn> }) {
  const registryStore = new Map<string, unknown>();
  if (toast) registryStore.set('toast', toast);
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(makeFakeText),
      zone: vi.fn(makeFakeZone),
    },
    input: { on: vi.fn(), off: vi.fn() }, // 无 keyboard → 代码用 ?. 跳过
    registry: {
      get: vi.fn((k: string) => (k === 'toast' ? toast : registryStore.get(k))),
      set: vi.fn((k: string, v: unknown) => { registryStore.set(k, v); }),
    },
  } as never;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

const POL_FREE: PolicyNode = {
  id: 'pol_a', name: '甲策', branch: '农桑', x: 60, y: 80, cost: {},
  effects: [{ target: 'country_grain_output', op: 'mul', value: 1.2 }],
  prerequisites: [], tier: 1, description: '', descPlain: '增产',
};
const POL_NEEDS_PREREQ: PolicyNode = {
  id: 'pol_b', name: '乙策', branch: '农桑', x: 60, y: 200, cost: {},
  effects: [{ target: 'country_grain_output', op: 'add', value: 1 }],
  prerequisites: ['pol_a'], tier: 2, description: '', descPlain: '',
};
const POL_EXPENSIVE: PolicyNode = {
  id: 'pol_c', name: '丙策', branch: '工坊', x: 200, y: 80, cost: { gold: 9999 },
  effects: [{ target: 'country_wood_output', op: 'add', value: 1 }],
  prerequisites: [], tier: 1, description: '', descPlain: '',
};
const DECREE_FREE: RoyalDecree = {
  id: 'decree_a', name: '甲令', category: '内政', description: '', descPlain: '',
  unlockCondition: [],
  stages: [
    { order: 1, cost: {}, days: 5, effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
    { order: 2, cost: {}, days: 5, effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
  ],
};
const DECREE_EXPENSIVE: RoyalDecree = {
  id: 'decree_b', name: '乙令', category: '军事', description: '', descPlain: '',
  unlockCondition: [],
  stages: [{ order: 1, cost: { gold: 9999 }, days: 5, effects: [], removeEffects: [] }],
};

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() },
    { policies: [POL_FREE, POL_NEEDS_PREREQ, POL_EXPENSIVE], decrees: [DECREE_FREE, DECREE_EXPENSIVE] });
}

/** c1002-11②：自定义朝令集的 store（停滞态夹具用；其余与 makeStore 同构）。 */
function makeStoreWithDecrees(decrees: RoyalDecree[]): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() },
    { policies: [POL_FREE, POL_NEEDS_PREREQ, POL_EXPENSIVE], decrees });
}

// ---- c923-21：真实点击路径的取数口 ----------------------------------------
// 卷宗锚点（c922-125 遗留）：本文件此前所有「点节点/点卡片」都走 panel.clickPolicyByIndex()/
// clickDecreeByIndex() 这两条**测试后门直调**，共享 fakeScene.makeFakeZone 的 handlers 登记面
// （fakeScene.ts:76/:87）在此零消费方 ⇒「zone.on('pointerup', …) 真的挂上了、且挂在对的 def 上」
// 这一判别力从未建立。下列用例改为**触发生产代码亲手登记的那个回调**。
// ⚠ fakeScene.ts 属在册待裁决件（colony6 档 B），本班零触碰——zone 引用从面板内部字段取回。
type NodeUI = { def: { id: string; name: string }; label: { text: string }; zone: FakeZone };
type CardUI = { def: { id: string }; status: { text: string }; zone: FakeZone };

const nodesOf = (p: PolicyTreePanel): NodeUI[] =>
  (p as unknown as { policyNodes: NodeUI[] }).policyNodes;
const cardsOf = (p: PolicyTreePanel): CardUI[] =>
  (p as unknown as { decreeCards: CardUI[] }).decreeCards;
const tabZoneOf = (p: PolicyTreePanel, which: 'tabPolicyZone' | 'tabDecreeZone'): FakeZone =>
  (p as unknown as Record<'tabPolicyZone' | 'tabDecreeZone', FakeZone>)[which];
const closeZoneOf = (p: PolicyTreePanel): FakeZone =>
  (p as unknown as { closeZone: FakeZone }).closeZone;
/** 取面板 registry 影子表里 treePanelOpen 的当前值（GameScene 据它跳过地图滚轮缩放）。 */
function treePanelOpenFlag(s: unknown): unknown {
  return (s as { registry: { get: (k: string) => unknown } }).registry.get('treePanelOpen');
}

describe('PolicyTreePanel', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let panel: PolicyTreePanel;
  let toast: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { show: vi.fn() };
    scene = makeFakeScene(toast);
    store = makeStore();
    panel = new PolicyTreePanel(scene, store);
  });

  it('默认在国策 tab，构建了全部节点/卡片', () => {
    expect(panel.getCurrentTab()).toBe('policy');
    expect(panel.policyCount()).toBe(3);
    expect(panel.decreeCount()).toBe(2);
  });

  it('switchTo("decree") 切换 tab', () => {
    panel.switchTo('decree');
    expect(panel.getCurrentTab()).toBe('decree');
  });

  it('open() 让游戏时停，close() 恢复', () => {
    const wasPaused = store.isPaused();
    panel.open();
    expect(store.isPaused()).toBe(true);
    expect(panel.isVisible()).toBe(true);
    panel.close();
    expect(store.isPaused()).toBe(wasPaused);
    expect(panel.isVisible()).toBe(false);
  });

  it('toggle 在开/关之间切换', () => {
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('点免费无前置国策 → 调 adoptPolicy', () => {
    const spy = vi.spyOn(store, 'adoptPolicy');
    panel.clickPolicyByIndex(0);
    expect(spy).toHaveBeenCalledWith('pol_a');
  });

  it('点前置未满足的国策 → adoptPolicy 被拒，toast 提示前置', () => {
    panel.clickPolicyByIndex(1);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('前置');
  });

  it('点资源不足的国策 → toast 资源不足', () => {
    panel.clickPolicyByIndex(2);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('资源不足');
  });

  it('点免费朝令 → 调 adoptDecree', () => {
    const spy = vi.spyOn(store, 'adoptDecree');
    panel.clickDecreeByIndex(0);
    expect(spy).toHaveBeenCalledWith('decree_a');
  });

  it('点资源不足朝令 → toast 资源不足', () => {
    panel.clickDecreeByIndex(1);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('资源不足');
  });

  it('点已激活朝令 → toast 已在推进', () => {
    expect(store.adoptDecree('decree_a').ok).toBe(true);
    toast.show.mockClear();
    panel.clickDecreeByIndex(0);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('已在推进');
  });

  it('open() 后 layout/refresh 不抛错（节点着色 + 连线 + 朝令进度跑通）', () => {
    expect(() => { panel.open(); panel.switchTo('decree'); panel.switchTo('policy'); }).not.toThrow();
  });

  it('destroy 解绑监听 + 释放时停', () => {
    panel.open();
    expect(store.isPaused()).toBe(true);
    const before = store.listenerCount(STATE_EVENTS.RESOURCES_CHANGED);
    panel.destroy();
    expect(store.listenerCount(STATE_EVENTS.RESOURCES_CHANGED)).toBe(before - 1);
    expect(store.isPaused()).toBe(false); // 释放了 pause holder
  });

  // ---- c923-21：真实点击路径（触发 zone 上登记的 handler，断具体状态字段变化）----

  it('真实路径：点国策节点的 pointerup → 政策真落账、面板标签自己翻成已采纳，重复点只弹提示不落账', () => {
    panel.open();
    const nodes = nodesOf(panel);
    // 覆盖面自证：登记面确实挂着生产代码登记的 handler，且按 def.id 锁定枚数，不靠下标猜
    expect(nodes).toHaveLength(3);
    const node = nodes[0]!;
    expect(node.def.id).toBe('pol_a');
    expect(typeof node.zone.handlers.pointerup).toBe('function');
    // 动手前读数：open→layout→refreshPolicies 已把裸名字写进标签
    expect(store.getAdoptedPolicyIds().has('pol_a')).toBe(false);
    expect(node.label.text).toBe('甲策');

    node.zone.handlers.pointerup!(); // ← 真实 handler，不经 clickPolicyByIndex

    expect(store.getAdoptedPolicyIds().has('pol_a')).toBe(true);
    expect(node.label.text).toBe('✓ 甲策');
    expect(toast.show).not.toHaveBeenCalled();

    // 反向自证：同枚再点一次 → adoptPolicy 拒已采纳、弹提示且**不产生第二次落账**（判据非恒绿）
    node.zone.handlers.pointerup!();
    expect(store.getAdoptedPolicyIds().size).toBe(1);
    expect(String(toast.show.mock.calls.at(-1)?.[0])).toContain('此策已在国');
    expect(node.label.text).toBe('✓ 甲策');
  });

  it('真实路径：点「朝令」tab 的 pointerup → currentTab 与卡片状态文案同步刷新，点回原 tab 则整体不动', () => {
    panel.open();
    const decreeTab = tabZoneOf(panel, 'tabDecreeZone');
    const policyTab = tabZoneOf(panel, 'tabPolicyZone');
    expect(typeof decreeTab.handlers.pointerup).toBe('function');
    expect(panel.getCurrentTab()).toBe('policy');
    // 朝令卡片此刻还没被 refreshDecrees 写过（policy tab 下它不跑）
    expect(cardsOf(panel)).toHaveLength(2);
    expect(cardsOf(panel)[0]!.status.text).toBe('');

    policyTab.handlers.pointerup!(); // 点的就是当前所在 tab → setTab 同值早退
    expect(panel.getCurrentTab()).toBe('policy');
    expect(cardsOf(panel)[0]!.status.text).toBe('');

    decreeTab.handlers.pointerup!(); // ← 真实 handler，不经 switchTo
    expect(panel.getCurrentTab()).toBe('decree');
    expect(cardsOf(panel)[0]!.status.text).toContain('首阶');

    policyTab.handlers.pointerup!();
    expect(panel.getCurrentTab()).toBe('policy');
  });

  it('真实路径：点 × 的 pointerup → isOpen／时停／treePanelOpen 三处状态一起复位', () => {
    panel.open();
    expect(panel.isVisible()).toBe(true);
    expect(store.isPaused()).toBe(true);
    expect(treePanelOpenFlag(scene)).toBe(true);
    const close = closeZoneOf(panel);
    expect(typeof close.handlers.pointerup).toBe('function');

    close.handlers.pointerup!(); // ← 真实 handler，不经 close() 直调

    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
    expect(treePanelOpenFlag(scene)).toBe(false);
  });

  it('真实路径：点朝令卡片的 pointerup → status.text 随 DECREE_ADOPTED 从「首阶」翻成进度态，重复点不二落账', () => {
    panel.open();
    // 先走真实 tab 入口（layout→refresh→refreshDecrees 写过基线），否则 policy tab 下卡片状态文案根本不被刷新
    tabZoneOf(panel, 'tabDecreeZone').handlers.pointerup!();
    expect(panel.getCurrentTab()).toBe('decree');

    const cards = cardsOf(panel);
    expect(cards).toHaveLength(2);
    const card = cards[0]!;
    const other = cards[1]!;
    // 覆盖面自证：handler 确由生产代码登记在**这张卡**的 zone 上（PolicyTreePanel.ts buildDecreeCards 的
    // zone.on('pointerup', () => this.handleDecreeClick(def))），且按 def.id 锁定枚数，不靠下标猜
    expect(card.def.id).toBe('decree_a');
    expect(typeof card.zone.handlers.pointerup).toBe('function');
    // 动手前基线读数：未颁行 → 首阶文案（DECREE_FREE 的 stage0.cost 为空 ⇒ formatCost 出「免费」）
    expect(store.getActiveDecrees()).toHaveLength(0);
    expect(card.status.text).toBe('首阶 免费 · 5日');
    expect(other.def.id).toBe('decree_b');
    expect(other.status.text).toContain('首阶');

    const adoptSpy = vi.spyOn(store, 'adoptDecree');
    card.zone.handlers.pointerup!(); // ← 真实 handler，不经 clickDecreeByIndex

    // adoptDecree → DECREE_ADOPTED → onDecreeChanged → refresh → refreshDecrees 自己把该卡翻成进度态
    expect(adoptSpy).toHaveBeenCalledTimes(1);
    expect(store.getActiveDecrees()).toHaveLength(1);
    expect(card.status.text).toBe('第1阶 · 0/5日 (0%)');
    expect(card.status.text).not.toContain('首阶');
    expect(other.status.text).toContain('首阶'); // 闭包按 def 取卡：只翻被点的那张，邻卡不受牵连
    expect(toast.show).not.toHaveBeenCalled();

    // 反向自证：同枚再点一次 → 面板先用 getActiveDecrees 挡住 ⇒ adoptDecree 不被调第二次、文案不再漂
    card.zone.handlers.pointerup!();
    expect(adoptSpy).toHaveBeenCalledTimes(1);
    expect(store.getActiveDecrees()).toHaveLength(1);
    expect(store.getActiveDecrees()[0]!.id).toBe('decree_a');
    expect(store.getActiveDecrees()[0]!.currentStage).toBe(0);
    expect(store.getActiveDecrees()[0]!.daysElapsed).toBe(0);
    expect(card.status.text).toBe('第1阶 · 0/5日 (0%)');
    expect(String(toast.show.mock.calls.at(-1)?.[0])).toContain('已在推进');
  });

  // ---- c1002-11（c924-19 遗留三类形态补齐）----------------------------------

  it('c1002-11① 现状守卫钉：dragMoved=true（拖拽平移后松手）下点国策/朝令 zone → 不落账（:449/:442 早退在位）', () => {
    panel.open();
    const inner = panel as unknown as { dragMoved: boolean };
    // 国策侧：dragMoved 置位后点 pol_a 的 zone → adoptPolicy 零调用
    inner.dragMoved = true;
    const adoptPolicySpy = vi.spyOn(store, 'adoptPolicy');
    nodesOf(panel)[0]!.zone.handlers.pointerup!();
    expect(adoptPolicySpy).not.toHaveBeenCalled();
    expect(store.getAdoptedPolicyIds().size).toBe(0);
    // 朝令侧：同一形态（:442 早退）
    tabZoneOf(panel, 'tabDecreeZone').handlers.pointerup!(); // 先切到 decree tab（真入口）
    inner.dragMoved = true;
    const adoptDecreeSpy = vi.spyOn(store, 'adoptDecree');
    cardsOf(panel)[0]!.zone.handlers.pointerup!();
    expect(adoptDecreeSpy).not.toHaveBeenCalled();
    expect(store.getActiveDecrees()).toHaveLength(0);
    // 反向自证：dragMoved 复位后同一点击正常落账 ⇒ 上面的零调用来自早退分支而非夹具失效
    inner.dragMoved = false;
    cardsOf(panel)[0]!.zone.handlers.pointerup!();
    expect(adoptDecreeSpy).toHaveBeenCalledTimes(1);
    expect(store.getActiveDecrees()).toHaveLength(1);
  });

  it('c1002-11② 真路径翻转：颁行完成态「✓ 已颁行 永久生效」与资源不足停滞态两文案（:719/:727 现值）', () => {
    // 完成态：DECREE_FREE 两阶各 5 日免费 → adopt 后 tickDay×10 走完 → completedSet 收编
    panel.open();
    tabZoneOf(panel, 'tabDecreeZone').handlers.pointerup!();
    cardsOf(panel)[0]!.zone.handlers.pointerup!(); // 真路径落账 decree_a
    expect(store.getActiveDecrees()).toHaveLength(1);
    for (let i = 0; i < 10; i++) store.tickDay();
    expect(store.getCompletedDecreeIds()).toContain('decree_a');
    expect(store.getActiveDecrees()).toHaveLength(0);
    const freeCard = cardsOf(panel)[0]!;
    expect(freeCard.status.text).toBe('✓ 已颁行 永久生效'); // :727 完成态文案（磁盘现值）

    // 停滞态：stalled 只发生在**多阶**朝令的「下阶 cost 付不起」（一阶朝令到期即完成，无停滞面）
    // ⇒ 自建两阶夹具（首阶免费落账、第二阶 cost 9999 金到期付不起），零碰生产码与现有夹具。
    const DECREE_STALL: RoyalDecree = {
      id: 'decree_stall', name: '停滞令', category: '内政', description: '', descPlain: '',
      unlockCondition: [],
      stages: [
        { order: 1, cost: {}, days: 2, effects: [], removeEffects: [] },
        { order: 2, cost: { gold: 9999 }, days: 3, effects: [], removeEffects: [] },
      ],
    };
    const store2 = makeStoreWithDecrees([DECREE_STALL]);
    const panel2 = new PolicyTreePanel(scene, store2);
    panel2.open();
    tabZoneOf(panel2, 'tabDecreeZone').handlers.pointerup!();
    const s2 = store2 as unknown as { state: { resources: Record<string, number> } };
    s2.state.resources.gold = 0; // 本就无金，显式钉基线
    cardsOf(panel2)[0]!.zone.handlers.pointerup!(); // 真路径落账 decree_stall（首阶免费）
    expect(store2.getActiveDecrees().some(a => a.id === 'decree_stall')).toBe(true);
    for (let i = 0; i < 5; i++) store2.tickDay(); // 首阶到期日扣下阶 cost 9999 付不起 → 卡在当前阶、daysElapsed 推 sentinel（>2 ⇒ stalled）
    // 实测语义：stall 不推进 currentStage（付不起的正是**进入下阶**的门）⇒ 文案停在「第1阶」
    expect(cardsOf(panel2)[0]!.status.text).toBe('第1阶 · 资源不足停滞'); // :719 停滞态文案（磁盘现值）
  });

  it('c1002-11③ 现状钉桩（记录缺陷，修复另批）：policy tab 下点朝令卡 → store 真落账但卡片文案不刷新', () => {
    panel.open();
    expect(panel.getCurrentTab()).toBe('policy'); // 不切 tab，留在 policy
    const card = cardsOf(panel)[0]!;
    const before = card.status.text; // policy tab 下 refreshDecrees 不跑 ⇒ 基线（''）
    card.zone.handlers.pointerup!();
    // store 面：真落账了（事件发出、activeDecrees 进账）——「事件发了」半面成立
    expect(store.getActiveDecrees()).toHaveLength(1);
    expect(store.getActiveDecrees()[0]!.id).toBe('decree_a');
    // 面板面：卡片文案一字未动（「看不见更新」形态）——switchTo('decree') 前用户无从得知
    expect(card.status.text).toBe(before);
    // 反向自证：真入口切到 decree tab 后 refreshDecrees 跑 ⇒ 文案此刻才翻（证明卡没坏、是刷新时机问题）
    tabZoneOf(panel, 'tabDecreeZone').handlers.pointerup!();
    expect(cardsOf(panel)[0]!.status.text).not.toBe(before);
    expect(cardsOf(panel)[0]!.status.text).toContain('第1阶');
  });
});
