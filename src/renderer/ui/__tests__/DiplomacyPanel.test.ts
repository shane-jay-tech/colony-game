// c918-17（T48 前置 P2 系列）：DiplomacyPanel 钉桩。
// 仿 PolicyTreePanel.test 模式：Phaser scene/graphics/text/zone/container 全 mock，
// store 用真实 GameStore。钉：构造不开面板 / open-close 暂停恢复 / toggle /
// destroy 解绑 RESOURCES_CHANGED+DIPLOMACY_ACTION / warinessBand ≥70 合纵档。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { warinessBand, WARINESS_COALITION_THRESHOLD } from '../../state/wariness';
import { DiplomacyPanel } from '../DiplomacyPanel';
import { makeFakeContainer, makeFakeGraphics, makeFakeText, makeFakeZone } from './fakeScene';

// c923-02（批五）：本文件的本地 makeFakeText/makeFakeGraphics 副本实为**两份死定义＋两份内联字面量**
// （原命名副本 :14/:30 从未被调用，makeFakeScene 里另有同形内联副本）——tsconfig 未开 noUnusedLocals
// 故 type-check 一直看不见它们。本次四处一并收口：死定义删除、内联改指共享件（字段与方法表逐条
// 均为共享件子集，displayHeight 本就是默认 18）。
// c924-02（批二）：container 内联字面量已并入共享 makeFakeContainer（each/removeAll/list 三项补进 union，
// 生产码零读者 ⇒ 惰性超集）。唯一行为差是共享件 setVisible **记值**（内联为空转），
// 而本面板 isVisible() 读自己的 isOpen（DiplomacyPanel.ts:244）、不读 container.visible ⇒ 对本文件断言无影响。
// zone 原也保留内联（c924-02 理由＝ setPosition/setSize 空转→记值、on 不登记→登记 handlers）；
// c1002-07：断言面已实证零依赖空转语义（无断言读 x/y/width/height；c1002-06 真路径取柄走
// on.mock.calls，共享件同样在 mock.calls 留记录）⇒ 换共享 makeFakeZone 收编（行为超集）。

function makeFakeScene() {
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(makeFakeText),
      // c1002-07：zone 内联字面量收编为共享 makeFakeZone（原 c924-02 保留理由已失效：
      // 无断言依赖空转语义；c1002-06 真路径取柄走 on.mock.calls，共享件兼容）。
      zone: vi.fn(makeFakeZone),
    },
    input: { on: vi.fn(), off: vi.fn(), keyboard: undefined },
    registry: { get: vi.fn(), set: vi.fn() },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  } as never;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
}

describe('DiplomacyPanel', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let panel: DiplomacyPanel;

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore();
    panel = new DiplomacyPanel(scene, store);
  });

  it('构造后面板关闭（isOpen=false）', () => {
    expect(panel.isVisible()).toBe(false);
  });

  it('open/close：isOpen 翻转，且 close 幂等', () => {
    panel.open();
    expect(panel.isVisible()).toBe(true);
    panel.close();
    expect(panel.isVisible()).toBe(false);
    panel.close();
    expect(panel.isVisible()).toBe(false); // 重复 close 幂等
    panel.open();
    expect(panel.isVisible()).toBe(true);
    panel.open();
    expect(panel.isVisible()).toBe(true); // 重复 open 不抖动
  });

  it('destroy 后再 open/close 不复活（destroyed 守卫）', () => {
    panel.destroy();
    panel.open();
    expect(panel.isVisible()).toBe(false);
    panel.close();
  });

  it('warinessBand：≥70 合纵档（hostile），档位文案阶梯', () => {
    expect(warinessBand(10).key).toBe('calm');
    expect(warinessBand(40).key).toBe('watch');
    expect(warinessBand(60).key).toBe('wary');
    expect(warinessBand(WARINESS_COALITION_THRESHOLD).key).toBe('hostile');
    expect(warinessBand(100).text).toBe('同仇敌忾');
  });

  // ── c1002-06（c923-21 遗留接线第二批）：真路径用例——不经测试后门，触发生产代码亲手
  // zone.on('pointerdown', …) 登记的回调本体（DiplomacyPanel.ts:184/:194/:204）。
  // 取柄走 on.mock.calls（c924-18 MegaProjectPanel 同款手法）：c1002-07 起 zone 已换共享
  // makeFakeZone（其 on 同样在 mock.calls 留记录、另登记 handlers 表），两种形态下取到的
  // 都是面板自己闭包。
  type ZoneWithSpy = { on: { mock: { calls: Array<[string, (...a: unknown[]) => void]> } } };
  const eventStub = () => ({ stopPropagation: vi.fn() }) as never;
  function pointerDownZones(): Array<{ zone: ZoneWithSpy; invoke: () => void }> {
    const zoneFn = ((scene as unknown as { add: { zone: { mock: { results: Array<{ value: ZoneWithSpy }> } } } }).add.zone);
    return zoneFn.mock.results
      .map((r) => r.value)
      .filter((z) => z && z.on.mock.calls.some((c) => c[0] === 'pointerdown'))
      .map((zone) => ({ zone, invoke: () => (zone.on.mock.calls.find((c) => c[0] === 'pointerdown')![1] as (p: unknown, x: number, y: number, e: never) => void)(null, 0, 0, eventStub()) }));
  }

  it('c1002-06 真路径：三行动作 zone 的 pointerdown → trade/envoy/war 各自接到 store（阵容 4 国=12 卡区+遮罩/关闭）', () => {
    store.startNewGameNpcs(7);
    panel.open();
    const npcIds = store.getNpcCountries().map((s) => s.id);
    expect(npcIds.length).toBeGreaterThan(0);
    const zones = pointerDownZones();
    // 遮罩 + 关闭钮 + 每国 3 区
    expect(zones.length).toBe(2 + npcIds.length * 3);
    const tradeSpy = vi.spyOn(store, 'tradeWithNpc');
    const envoySpy = vi.spyOn(store, 'sendEnvoyTo');
    const warSpy = vi.spyOn(store, 'declareWarOn');
    for (const { invoke } of zones) invoke();
    // 每国的三区恰好各接线一次；实参=本国 id（闭包捕获 def.id）
    expect(tradeSpy.mock.calls.map((c) => c[0]).sort()).toEqual([...npcIds].sort());
    expect(envoySpy.mock.calls.map((c) => c[0]).sort()).toEqual([...npcIds].sort());
    expect(warSpy.mock.calls.map((c) => c[0]).sort()).toEqual([...npcIds].sort());
  });

  it('c1002-06 真路径：出使区 pointerdown → 真实状态变化（lastEnvoyDay/stance 落账，非仅 spy）', () => {
    store.startNewGameNpcs(7);
    const inner = store as unknown as { state: { currentDay: number; resources: Record<string, number>; npcCountries: Array<{ id: string; lastEnvoyDay: number; stance: number }> } };
    inner.state.currentDay = 10;
    inner.state.resources.gold = 500;
    inner.state.resources.cloth = 50;
    panel.open();
    const npcIds = store.getNpcCountries().map((s) => s.id);
    const zones = pointerDownZones().slice(2); // 跳过遮罩/关闭钮，余下=每国 3 区
    // 找到第一张卡的出使区：逐区 invoke 到 sendEnvoyTo 命中本国为止
    const envoySpy = vi.spyOn(store, 'sendEnvoyTo');
    let targetNpcId: string | null = null;
    for (const { invoke } of zones) {
      invoke();
      if (envoySpy.mock.calls.length > 0) {
        targetNpcId = envoySpy.mock.calls[0]![0] as string;
        break;
      }
    }
    expect(targetNpcId).toBeTruthy();
    const npcState = inner.state.npcCountries.find((s) => s.id === targetNpcId)!;
    expect(npcState.lastEnvoyDay).toBe(10); // 出使冷却日已落账＝store 真实状态变化
  });

  it('c919-05 ≥70 强档合纵两态渲染：≥70 副标题现「同仇敌忾」，<70 不出现', () => {
    const inner = store as unknown as { state: { worldWariness: number; lastWarinessReason: string | null } };
    const subText = () => ((panel as unknown as { subtitleText: { text: string } }).subtitleText.text);

    // 状态 A：20＝「列国漠然」档，无合纵文案
    inner.state.worldWariness = 20;
    panel.open();
    expect(subText()).toContain('列国漠然');
    expect(subText()).not.toContain('同仇敌忾');

    // 状态 B：≥70 触发列国合纵（视为强档威胁）——close+open 强制 refresh 走内层
    inner.state.worldWariness = WARINESS_COALITION_THRESHOLD;
    inner.state.lastWarinessReason = '扩军';
    panel.close();
    panel.open();
    expect(subText()).toContain('同仇敌忾');
    expect(subText()).toContain('侧目 70');
    expect(subText()).toContain('因：扩军');
  });
});
