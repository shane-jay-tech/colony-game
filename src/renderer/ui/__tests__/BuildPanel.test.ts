// c920-04：BuildPanel characterization（601 行零测试 → 钉滚动计算/折叠事件/出界裁剪）。
// 原手法：递归 Proxy 万能 stub 撑过 Phaser 重构造器 —— 代价是 `zone.on(...)` 与 `scene.input.on(...)`
// 登记的回调**全部被 proxy 吞掉**（get 陷阱恒返回同一 proxy、无 set 陷阱），所以"面板真的将 handler
// 接到了 Phaser 事件上"这一条在本件从未成立（c924-18 §E1 否证、本班立单收口）。
//
// c927-75（夹具批一）：🔴 **递归 Proxy 已移除**。scene 换成共享 fakeScene 版（makeBuildPanelScene），
// store 换成**真 GameStore**，buildMode 换成显式方法表的本地 stub——缺哪个方法当场 TypeError，
// 不再被 proxy 静默兜住。现有 7 例的特征化覆写（rows/rowsAreaRect/layout/store）与新夹具正交，
// 逐条同名保持绿；归因评估全文见 docs/insights/c927-75-panels.md。新增 2 例走 handlers 登记本体（真路径）。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { BuildPanel } from '../BuildPanel';
import { makeFakeGraphics, makeFakeScene, makeFakeText } from './fakeScene';

type Panel = Record<string, any>;

// ---- 夹具层（c927-75）-----------------------------------------------------

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, {});
}

/** BuildMode 在面板里的全部调用面（构造 1 个：onChange；交互 4 个）——显式表，非 Proxy。 */
function makeBuildModeStub() {
  return {
    onChange: vi.fn(() => () => {}),
    isDemolish: vi.fn(() => false),
    enterDemolish: vi.fn(),
    cancel: vi.fn(),
    select: vi.fn(),
    getSelected: vi.fn(() => null),
  };
}

/**
 * fakeScene 版 scene：BuildPanel 比共享件已覆盖的面多三项——
 * `add.image`（行缩略图）、`textures.exists/get`（缩略图与尺寸）、以及 gfx/text 的 `setMask`／
 * gfx 的 `createGeometryMask`／`setAlpha`（滚动遮罩与淡入）。**本班不动共享件**（改它＝31 枚消费件同笔），
 * 故在文件内补面；补的都是空转实现，语义与 EventModal/TutorialModal 用的共享件一致。
 */
function makeBuildPanelScene() {
  const scene = makeFakeScene({ tweens: true });
  const add = scene.add as unknown as Record<string, any>;
  add.graphics = vi.fn(() => {
    const g = makeFakeGraphics() as Record<string, any>;
    g.setMask = g.setMask ?? vi.fn().mockReturnThis();
    g.setAlpha = g.setAlpha ?? vi.fn().mockReturnThis();
    g.createGeometryMask = vi.fn(() => ({ destroy: vi.fn() }));
    return g;
  });
  add.text = vi.fn((_x: number, _y: number, init?: string) => {
    const t = makeFakeText() as unknown as Record<string, any>;
    if (typeof init === 'string') t.text = init; // Phaser Text 语义：构造第三参＝初始文本（与共享件一致）
    t.setMask = t.setMask ?? vi.fn().mockReturnThis();
    t.setScale = t.setScale ?? vi.fn().mockReturnThis();
    t.setLineSpacing = t.setLineSpacing ?? vi.fn().mockReturnThis();
    return t;
  });
  add.image = vi.fn(() => {
    const t = makeFakeText() as unknown as Record<string, any>;
    t.setDisplaySize = vi.fn().mockReturnThis();
    t.setTexture = vi.fn().mockReturnThis();
    t.setScale = vi.fn().mockReturnThis();
    t.setMask = vi.fn().mockReturnThis();
    return t;
  });
  (scene as unknown as Record<string, unknown>).textures = {
    // 缩略图走"纹理不存在"分支：立绘面缺席是**在册事实**（本仓无纹理注册表夹具），本班不假造。
    exists: vi.fn(() => false),
    get: vi.fn(() => ({ getSourceImage: () => ({ width: 32, height: 32 }), source: { width: 32, height: 32 } })),
  };
  return scene;
}

/** 全套夹具；`targetCount` 是**特征化覆写**的行数（c920-04 原样，避免断言依赖 BUILDINGS 现值）。 */
function makeRig(targetCount = 5) {
  const scene = makeBuildPanelScene();
  const store = makeStore();
  const buildMode = makeBuildModeStub();
  const panel = new BuildPanel(scene as never, store, buildMode as never) as Panel;
  // 覆写测试关注的字段：5 行、可视高 100（真实 onWheel/onPanelCollapsed 在位）
  panel.rows = Array.from({ length: targetCount }, (_, i) => ({ def: { id: `b${i}` } }));
  panel.rowsAreaRect = { x: 0, y: 0, w: 200, h: 100 };
  panel.rowsScrollY = 0;
  panel.layout = vi.fn();
  panel.store = {
    getPanelCollapsed: () => false,
    getBuildingUnlockInfo: () => ({ state: 'ok' }),
  };
  return { scene, store, buildMode, panel };
}

/** 不覆写任何字段的面板（c927-75 新增例用：构造期 buildRows/layout/refreshAffordance 全部真跑）。 */
function makeRealRig() {
  const scene = makeBuildPanelScene();
  const store = makeStore();
  const buildMode = makeBuildModeStub();
  const panel = new BuildPanel(scene as never, store, buildMode as never) as Panel;
  return { scene, store, buildMode, panel };
}

function makePanel(targetCount = 5): Panel {
  return makeRig(targetCount).panel;
}

describe('BuildPanel characterization（c920-04）', () => {
  let panel: Panel;
  const pointer = { x: 100, y: 50 };

  beforeEach(() => {
    panel = makePanel(5);
  });

  it('滚动半速：内容 240 可视 100 → maxScroll 140；dy=40 滚 20', () => {
    panel['onWheel'](pointer, [], 0, 40);
    expect(panel.rowsScrollY).toBe(20);
    expect(panel.layout).toHaveBeenCalled();
  });

  it('上界 clamp：dy 巨大 → rowsScrollY 停在 maxScroll 140', () => {
    panel['onWheel'](pointer, [], 0, 100000);
    expect(panel.rowsScrollY).toBe(140);
  });

  it('下界 clamp：已 0 再向上滚保持 0', () => {
    panel['onWheel'](pointer, [], 0, -500);
    expect(panel.rowsScrollY).toBe(0);
  });

  it('指针出界（x 超出 rowsArea）不滚动', () => {
    panel['onWheel']({ x: 999, y: 50 }, [], 0, 40);
    expect(panel.rowsScrollY).toBe(0);
  });

  it('灰显行计入滚动高度：1 行 prereq_locked → maxScroll 92', () => {
    panel.store.getBuildingUnlockInfo = (def: any) =>
      def.id === 'b0' ? { state: 'prereq_locked' } : { state: 'ok' };
    panel['onWheel'](pointer, [], 0, 100000);
    expect(panel.rowsScrollY).toBe(92);
  });

  it('折叠事件：left 侧 payload 触发 layout', () => {
    panel.onPanelCollapsed({ side: 'left', collapsed: true });
    expect(panel.layout).toHaveBeenCalled();
  });

  it('折叠事件：right 侧与 undefined payload 被忽略', () => {
    panel.onPanelCollapsed({ side: 'right', collapsed: true });
    panel.onPanelCollapsed(undefined);
    expect(panel.layout).not.toHaveBeenCalled();
  });
});

// ---- c927-75 夹具批一：fakeScene 版 scene 下的构造面与 handlers 登记面 ----
// 上面 7 例是 c920-04 的**特征化**账（覆写 rows/rowsAreaRect/layout/store 后直调私有方法），
// 它们在递归 Proxy 夹具下就已成立、换夹具后逐条同名仍成立 ⇒ 归因评估见 docs/insights/c927-75-panels.md。
// 🔴 但 Proxy 夹具**永远断不了下面这两条**：`get` 陷阱恒返回同一 proxy ⇒ `zone.on('pointerdown', fn)`
// 与 `scene.input.on('wheel', fn, this)` 传出去的回调不留痕、无处取回（c924-18 §E1 的否证点）。
// 本班新增两例正是把这条登记面接回真路径：判据取的是**生产代码亲手写进 on() 的那枚闭包**。
describe('BuildPanel 夹具批一（c927-75）：真构造与真登记', () => {
  /** 从 scene.input.on 的调用记录里取回面板登记 wheel 时传的那个回调（同 c924-18 §E3 手法）。 */
  const wheelHandlerOf = (scene: unknown): ((...args: unknown[]) => void) | undefined => {
    const on = (scene as { input: { on: ReturnType<typeof vi.fn> } }).input.on;
    const call = on.mock.calls.find((c) => c[0] === 'wheel');
    return call?.[1] as ((...args: unknown[]) => void) | undefined;
  };

  it('冒烟：不覆写任何字段也能真构造（行真建、遮罩真挂、两枚 zone 与 wheel 的回调真登记、store 六路监听真接上）', () => {
    const { scene, store, panel } = makeRealRig();
    // 构造期 buildRows/layout/refreshAffordance 全部真跑 ⇒ 面板有行、标题落在展开态文案
    expect((panel.rows as unknown[]).length).toBeGreaterThan(0);
    expect(panel.titleText.text).toBe('建造');
    // 滚动遮罩：createGeometryMask 的产物必须真挂上（Proxy 夹具下这里是 proxy，无从判别）
    expect(panel.rowsMask).toBeTruthy();
    // 交互层：两枚 zone 的 pointerdown 由**生产代码**写入 fakeScene 的 handlers 表
    expect(typeof panel.collapseZone.handlers.pointerdown).toBe('function');
    expect(typeof panel.demolishZone.handlers.pointerdown).toBe('function');
    // 输入层：wheel 回调真登记在 scene.input 上
    expect(typeof wheelHandlerOf(scene)).toBe('function');
    // store 侧：面板确实订阅了折叠事件（第 6 路监听，destroy 时逐路 off）
    expect(store.listenerCount(STATE_EVENTS.PANEL_COLLAPSED_CHANGED)).toBe(1);
  });

  it('真路径：点折叠 zone 的 pointerdown → 真 store 折叠位翻转且面板进折叠态（标题竖排／标签 ▶／滚动区撤销）；再点一次整套还原', () => {
    const { store, panel } = makeRealRig();
    expect(store.getPanelCollapsed('left')).toBe(false);
    expect(panel.rowsAreaRect).not.toBeNull();

    // 不经任何后门：触发面板自己写在 collapseZone 上的那个回调
    panel.collapseZone.handlers.pointerdown();

    // 状态字段逐项翻转（store 是真 GameStore，setPanelCollapsed 会 emit ⇒ 面板 onPanelCollapsed ⇒ 真 layout 产物）
    expect(store.getPanelCollapsed('left')).toBe(true);
    expect(panel.titleText.text).toBe('建\n造');
    expect(panel.collapseLabel.text).toBe('▶');
    expect(panel.rowsAreaRect).toBeNull(); // 折叠 ⇒ 可视区撤销（onWheel 的出界裁剪口径以此为根）
    // ⚠ 共享 makeFakeZone 的 setVisible 只 mockReturnThis、**不记值**（fakeScene.ts:95），
    //   故这里检 spy 实参而非 .visible 字段（同 c924-03 §证据 5 的同一形制约束）。
    expect(panel.demolishZone.setVisible).toHaveBeenLastCalledWith(false);

    // 反向自证：再点一次是**还原**而不是叠加（判据非单向副作用）
    panel.collapseZone.handlers.pointerdown();
    expect(store.getPanelCollapsed('left')).toBe(false);
    expect(panel.titleText.text).toBe('建造');
    expect(panel.collapseLabel.text).toBe('◀');
    expect(panel.rowsAreaRect).not.toBeNull();
    expect(panel.demolishZone.setVisible).toHaveBeenLastCalledWith(true);
  });
});

// ---- c930-16 立绘面收口（本地可控 textures，共享件零改动）----
describe('c930-16 立绘面收口（本地可控 textures）', () => {
  it('行缩略图分支：textures.exists 翻真后 buildRows 产出非 null thumb（原恒缺席时恒 null）', () => {
    const scene = makeBuildPanelScene();
    const store = makeStore();
    const buildMode = makeBuildModeStub();
    const panel = new BuildPanel(scene as never, store, buildMode as never) as Panel;
    const rowsOf = () => (panel as unknown as { rows: Array<{ thumb: unknown }> }).rows;
    expect(rowsOf().length).toBeGreaterThan(0);
    expect(rowsOf().every((r) => r.thumb === null)).toBe(true); // 现状：立绘面缺席 ⇒ thumb 恒 null
    (scene as unknown as Record<string, unknown>).textures = {
      exists: vi.fn(() => true),
      get: vi.fn(() => ({ getSourceImage: () => ({ width: 32, height: 32 }) })),
    };
    (panel as unknown as { buildRows(): void }).buildRows(); // 翻真后重建行 ⇒ 走 :251 缩略图分支
    expect(rowsOf().some((r) => r.thumb !== null)).toBe(true);
  });
});

// ---- c930-17 真路径五面接线 ----
describe('c930-17 真路径五面接线', () => {
  function makeReal(): { scene: Record<string, any>; store: GameStore; buildMode: ReturnType<typeof makeBuildModeStub>; panel: any } {
    const scene = makeBuildPanelScene() as Record<string, any>;
    const store = makeStore();
    const buildMode = makeBuildModeStub();
    const panel = new BuildPanel(scene as never, store, buildMode as never) as any;
    return { scene, store, buildMode, panel };
  }

  it('面1 拆除区 pointerdown：首点 enterDemolish、isDemolish 翻真后同区再点 cancel', () => {
    const { scene, buildMode, panel } = makeReal();
    const zone = (panel as unknown as { demolishZone: { handlers: Record<string, () => void> } }).demolishZone;
    buildMode.isDemolish.mockReturnValue(false);
    zone.handlers['pointerdown']();
    expect(buildMode.enterDemolish).toHaveBeenCalledTimes(1);
    buildMode.isDemolish.mockReturnValue(true);
    zone.handlers['pointerdown']();
    expect(buildMode.cancel).toHaveBeenCalledTimes(1);
    void scene;
  });

  it('面2 行 zone 点击与 hover：pointerdown 选中、pointerover 记 hoveredDef/tooltip 文、pointerout 清 hovered', () => {
    const { panel } = makeReal();
    const rows = (panel as unknown as { rows: Array<{ def: any; zone: { handlers: Record<string, () => void> } }> }).rows;
    const row = rows[0]!;
    row.zone.handlers['pointerdown']();
    expect((panel as unknown as { buildMode: { select: ReturnType<typeof vi.fn> } }).buildMode.select).toHaveBeenCalledWith(row.def);
    row.zone.handlers['pointerover']();
    expect((panel as unknown as { hoveredDef: unknown }).hoveredDef).toBe(row.def);
    expect((panel as unknown as { tooltipNameText: { setText: ReturnType<typeof vi.fn> } }).tooltipNameText.setText).toHaveBeenCalled();
    row.zone.handlers['pointerout']();
    expect((panel as unknown as { hoveredDef: unknown }).hoveredDef).toBeNull();
  });

  it('面3 beginExpandFade：行 alpha 先拉 0，tween 链 180ms Cubic.easeOut 收 alpha→1', () => {
    const { scene, panel } = makeReal();
    const rows = (panel as unknown as { rows: Array<{ bg: { setAlpha: ReturnType<typeof vi.fn> }; nameLabel: { setAlpha: ReturnType<typeof vi.fn> }; costLabel: { setAlpha: ReturnType<typeof vi.fn> } }> }).rows;
    (panel as unknown as { beginExpandFade(): void }).beginExpandFade();
    expect(rows[0]!.bg.setAlpha).toHaveBeenLastCalledWith(0);
    expect(rows[0]!.nameLabel.setAlpha).toHaveBeenLastCalledWith(0);
    const tweensAdd = (scene.tweens as unknown as { add: ReturnType<typeof vi.fn> }).add;
    expect(tweensAdd).toHaveBeenCalledTimes(1);
    const cfg = tweensAdd.mock.calls[0]![0] as { alpha: number; duration: number; ease: string };
    expect(cfg.alpha).toBe(1);
    expect(cfg.duration).toBe(180);
    expect(cfg.ease).toBe('Cubic.easeOut');
  });

  it('面4 destroy：store 六路 off＋scene input wheel off 逐路计数', () => {
    const { scene, store, panel } = makeReal();
    const offSpy = vi.spyOn(store, 'off');
    const inputOffSpy = vi.spyOn((scene as unknown as { input: { off: ReturnType<typeof vi.fn> } }).input, 'off');
    panel.destroy();
    const events = offSpy.mock.calls.map((c) => c[0]);
    expect(events).toEqual([
      'state:resourcesChanged', 'state:buildingCompleted', 'state:policyAdopted', 'state:buildingRemoved', 'state:replaced', 'state:panelCollapsedChanged',
    ]);
    expect(inputOffSpy).toHaveBeenCalledWith('wheel', expect.any(Function), panel);
  });

  it('面5 refreshAffordance：grade_locked 灰显（ASH 填充＋灰字）、ok 口径走可建着色', () => {
    const { panel } = makeReal();
    const rows = (panel as unknown as { rows: Array<{ def: any; bg: { clear: ReturnType<typeof vi.fn>; fillStyle: ReturnType<typeof vi.fn> }; nameLabel: { setColor: ReturnType<typeof vi.fn> } }> }).rows;
    const unlock = vi.spyOn(panel.store, 'getBuildingUnlockInfo').mockReturnValue({ state: 'grade_locked', needGrade: 2 } as never);
    (panel as unknown as { refreshAffordance(): void }).refreshAffordance();
    expect(rows[0]!.bg.fillStyle).toHaveBeenCalledWith(expect.anything(), 0.4);
    expect(rows[0]!.nameLabel.setColor).toHaveBeenCalledWith('#6D635B');
    rows.forEach((r) => r.nameLabel.setColor.mockClear());
    unlock.mockReturnValue({ state: 'ok' } as never);
    (panel as unknown as { refreshAffordance(): void }).refreshAffordance();
    expect(rows[0]!.nameLabel.setColor).not.toHaveBeenCalledWith('#6D635B');
  });
});
