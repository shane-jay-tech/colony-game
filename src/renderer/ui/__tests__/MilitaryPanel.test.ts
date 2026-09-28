// c918-18（T48 前置 P2 系列）：MilitaryPanel 远征配粮展示钉桩。
// store 以 mock 对象注入（面板消费面：getDeployableSoldiers/getAvailableUnitTypesForUi/
// getGenerals/computeCurrentMilitaryPower/launchExpedition/getResources 等），scene 全 fake。
//
// c927-75（夹具批一）：🔴 本件此前 **4 例全是 store／纯函数的数据层测试，一个面板实例都没建过**
// （c924-18 §E2 否证：`grep -cE 'new [A-Z][A-Za-z]*Panel'` 旧值 0 ⇒ "面板 handlers 真路径"无宿主可挂）。
// 本班立**首次实例化**的夹具（共享 fakeScene 版 scene，见 makePanelScene），并补 2 例冒烟：
// 一条检构造面与 handlers 登记面，一条走 zone handler 本体验证开／关／还时停。原 4 例一字未动。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { EXPEDITION_DAYS, UNIT_DEFS } from '../../data/military';
import { computeGrainCost } from '../../state/militarySystem';
import { MilitaryPanel } from '../MilitaryPanel';
import { makeFakeGraphics, makeFakeScene, makeFakeText } from './fakeScene';

// ---- 夹具层（c927-75）-----------------------------------------------------

/**
 * fakeScene 版 scene：MilitaryPanel 比共享件覆盖的面多两项——`add.image`（将领立绘）与
 * `textures.exists/get`（立绘尺寸）。**本班不动共享件**（动它＝31 枚消费件同笔），故在文件内补面。
 * 立绘默认走 `exists → false` 的兜底分支（本仓无纹理注册表夹具，属在册事实，不假造）。
 */
function makePanelScene() {
  const scene = makeFakeScene({ tweens: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const add = scene.add as unknown as Record<string, any>;
  add.graphics = vi.fn(() => {
    const g = makeFakeGraphics() as Record<string, unknown>;
    g.setAlpha = g.setAlpha ?? vi.fn().mockReturnThis();
    return g;
  });
  add.text = vi.fn((x: number, y: number, init?: string) => {
    const t = makeFakeText() as unknown as Record<string, unknown>;
    if (typeof init === 'string') t.text = init; // Phaser Text 语义：第三参＝初始文本
    t.setScale = t.setScale ?? vi.fn().mockReturnThis();
    t.setLineSpacing = t.setLineSpacing ?? vi.fn().mockReturnThis();
    void x; void y;
    return t;
  });
  add.image = vi.fn(() => {
    const t = makeFakeText() as unknown as Record<string, unknown>;
    t.setDisplaySize = vi.fn().mockReturnThis();
    t.setTexture = vi.fn().mockReturnThis();
    t.setScale = vi.fn().mockReturnThis();
    return t;
  });
  (scene as unknown as Record<string, unknown>).textures = {
    exists: vi.fn(() => false),
    get: vi.fn(() => ({ getSourceImage: () => ({ width: 32, height: 32 }), source: { width: 32, height: 32 } })),
  };
  return scene;
}

function makeRig() {
  const scene = makePanelScene();
  const store = makeStore();
  const panel = new MilitaryPanel(scene as never, store);
  const internals = panel as unknown as Record<string, any>;
  return { scene, store, panel, internals };
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

describe('MilitaryPanel 配粮与军力展示（数据层口径）', () => {
  let store: GameStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('EXPEDITION_DAYS 四目标齐备且 max ≥ min（intercept 允许 0 日即返）', () => {
    const targets = Object.entries(EXPEDITION_DAYS);
    expect(targets.length).toBeGreaterThanOrEqual(4);
    for (const [name, span] of targets) {
      expect(span.max).toBeGreaterThanOrEqual(span.min);
      void name;
    }
  });

  it('computeGrainCost：出兵越多耗粮越多（线性正比）', () => {
    const units10 = { militia: 10 };
    const units50 = { militia: 50 };
    const c10 = computeGrainCost(units10, EXPEDITION_DAYS.raid.max);
    const c50 = computeGrainCost(units50, EXPEDITION_DAYS.raid.max);
    expect(c50).toBeGreaterThan(c10);
    expect(c10).toBeGreaterThan(0);
  });

  it('初始编制：无可遣之兵（未建兵营未转兵）→ 面板给出「先转农为兵」引导而非报错', () => {
    expect(store.getDeployableSoldiers()).toBe(0);
  });

  it('初始军力：computeCurrentMilitaryPower 确定性（两次调用同值、非负）', () => {
    const p1 = store.computeCurrentMilitaryPower();
    const p2 = store.computeCurrentMilitaryPower();
    expect(p1).toBe(p2);
    expect(p1).toBeGreaterThanOrEqual(0);
    void UNIT_DEFS;
  });
});

// ---- c927-75 夹具批一：首次实例化之后的构造面与真路径开关 ----
// 上面 4 例是 c918-18 的**数据层**账（describe 标题自述"数据层口径"），本班一字未动。
// 面板实例在这件里此前不存在 ⇒ 以下两例是本仓 MilitaryPanel 的**第一批**面板级断言。
describe('MilitaryPanel 夹具批一（c927-75）：真构造与真路径开关', () => {
  it('冒烟：首次实例化不抛、初始隐藏，overlay 与 close 两枚 zone 的 pointerup 真登记，六路 store 监听真接上', () => {
    const { store, panel, internals } = makeRig();
    // 构造面：初始隐藏（container 的 visible 由共享 makeFakeContainer 记值，isVisible() 直读该字段）
    expect(panel.isVisible()).toBe(false);
    expect(internals.container.visible).toBe(false);
    expect(internals.title.text).toBe('军务');
    // 交互面：两枚 zone 上的 pointerup 是**生产代码**写进 fakeScene handlers 表的闭包
    expect(typeof internals.overlayZone.handlers.pointerup).toBe('function');
    expect(typeof internals.closeZone.handlers.pointerup).toBe('function');
    // 订阅面：六路事件各一条（destroy 时逐路 off）
    for (const evt of [STATE_EVENTS.MILITARY_CHANGED, STATE_EVENTS.GENERALS_CHANGED,
      STATE_EVENTS.EXPEDITION_RESOLVED, STATE_EVENTS.DEFENSE_ALERT,
      STATE_EVENTS.RESOURCES_CHANGED, STATE_EVENTS.DAY_TICK]) {
      expect(store.listenerCount(evt)).toBe(1);
    }

    // open()：layout ＋ refresh **真跑**（fake scene 撑得住才到这一步），并起时停
    panel.open();
    expect(panel.isVisible()).toBe(true);
    expect(internals.container.visible).toBe(true);
    expect(store.isPaused()).toBe(true);
    expect(String(internals.body.text).length).toBeGreaterThan(0); // refresh 写进正文＝展示链真跑通
    expect(internals.closeZone.setSize).toHaveBeenLastCalledWith(32, 32); // layout 的 ✕ 命中区常量
  });

  it('真路径：点 ✕ zone 的 pointerup → 面板关闭并释放时停；关闭态重放不复活也不多还；遮罩 zone 同效', () => {
    const { store, panel, internals } = makeRig();

    // 反向对照放最前：未开就点 ✕ ⇒ close() 早退，既不开面板也不动时停（判据非恒绿）
    internals.closeZone.handlers.pointerup();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);

    panel.open();
    expect(store.isPaused()).toBe(true);

    internals.closeZone.handlers.pointerup(); // ← 真 handler，不经 panel.close() 后门
    expect(panel.isVisible()).toBe(false);
    expect(internals.container.visible).toBe(false);
    expect(store.isPaused()).toBe(false);

    // 重放：还时停不能被还得第二次（holder 已释放 ⇒ isPaused 保持 false），也不能将面板弄开
    internals.closeZone.handlers.pointerup();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);

    // 遮罩那条腿（MilitaryPanel.ts:61）：同一段 close 语义，另一次真登记
    panel.open();
    expect(panel.isVisible()).toBe(true);
    internals.overlayZone.handlers.pointerup();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
  });
});
