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
// zone 字面量**刻意保留内联**（理由见下方 zone 处注释）：换共享 makeFakeZone 会让 setPosition/setSize 从"空转"变"记值"、
// on 从不登记变登记 handlers，属夹具语义改动而非收编，超本单范围。

function makeFakeScene() {
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(makeFakeText),
      // ⚠ 保留内联（c924-02）：共享 makeFakeZone 的 setPosition/setSize 会记值（:85-86 mockImplementation）、
      // on 会把回调登记进 handlers（:87），而本内联版三者皆空转——替换=改夹具语义，
      // 且本文件无任何断言读 x/y/width/height/handlers，改了既无收益也无人看守，故不动。
      zone: vi.fn(() => {
        const z = { x: 0, y: 0, width: 1, height: 1, setOrigin: vi.fn().mockReturnThis(), setInteractive: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setSize: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), destroy: vi.fn() };
        return z;
      }),
    },
    input: { on: vi.fn(), off: vi.fn(), keyboard: undefined },
    registry: { get: vi.fn(), set: vi.fn() },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  } as never;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
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
