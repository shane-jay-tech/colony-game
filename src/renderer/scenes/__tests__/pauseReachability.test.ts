/**
 * c927-39：UIScene 暂停时面板可达性实测取证（4686 ⑤组同型补钉，为 c927-08 裁决补行为证据）
 *
 * 卷宗口径：「用既有测试基建（jsdom/场景替身）实测：暂停态下各面板（Build/HUD 抽屉等）的打开/交互
 * 是否可达，产出『暂停可达性矩阵』……只加测试不改产品码」。
 *
 * ⚠ 磁盘实况订正一条卷宗前提：**本仓没有 jsdom**。`vitest.config.ts` 的 `test.environment` 是 `'node'`，
 *   include 只收 `src` 与 `scripts` 两棵树下 `__tests__` 目录里的 `.test.ts`；`jsdom` 既不在
 *   `package.json` 的 devDependencies 也不被任何配置引用 ⇒ 「jsdom 基建」按磁盘实况**否证**，
 *   本件改用卷宗的另一并列口径＝**场景替身**（`ui/__tests__/fakeScene.ts` 的 `makePhaserMock()`
 *   类式 FakeScene，与 `UIScene.test.ts`／`keyboardFlowFocusOrder.test.ts` 同一套），零新增依赖。
 *
 * 与 4686 ⑤组的分工（不重复也不冲突）：⑤组（`keyboardFlowFocusOrder.test.ts`）钉的是
 * **源码正则面**的层级现值（`setDepth(900)` 等字面串）。本件钉的是**运行时行为面**：
 * 真装配 UIScene（面板全部是真实类）→ 真调 open/close/toggle/HUD 私有按钮/指针闭包，
 * 读 fake 记录到的**实参**（depth 实际传入值、fillRect 实际覆盖尺寸、setVisible 实际序列）。
 *
 * 🔴 架构约束（本件实测踩到的，别回退成"每例一枚新场景"）：`sceneClassMock` 是模块级单例，
 *   全量装配一枚 UIScene（15 枚真实面板 + GameStore）的堆代价是数十 MB 级；本件初版按用例装配
 *   46 枚场景，`npx vitest run <本件>` 直接 `ERR_WORKER_OUT_OF_MEMORY`（worker JS heap 撑爆、
 *   23 例一条都没跑完），分组单跑（≤27 枚）全绿 ⇒ 与断言无关，纯累积占用。
 *   ⇒ 现口径：**共用一台惰性装配的场景**（`ready()`＋逐例归零），全件装配次数按代码路径统计＝**4 枚**
 *     （`ready()` 惰性 2 次：初装＋② 组教程例把 rig 作废后再装；另 2 枚是①/② 组各自自建的 raw create）。
 *   `makeReadyScene()` 里先触发上一枚场景的 SHUTDOWN 闭包（真实游戏也是先 shutdown 再 create）
 *   也试过，**没能避免 OOM**，故仍走共用场景；那条触发留着，是为了不静默丢弃在册闭包。
 *
 * 🔴 本件钉的是「暂停态下面板/建造/顶栏**全都可达**」这一**现状**，不是认可它——
 *   「暂停该不该锁面板」是产品裁决（c927-08），本班只补行为证据、不改产品码、不发明守卫。
 */
import { describe, expect, it, beforeAll, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { UIScene } from '../UIScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { BuildMode } from '../../state/buildMode';
import { TimeSystem, SPEED_MS_PER_DAY } from '../../state/timeSystem';
import { BUILDINGS } from '../../data/buildings';

const { registryStore, shutdownHandlers } = sceneClassMock;

/** 16×16 全平原（与 UIScene.test 同构，够 GameStore 建 accessor 与全套面板装配）。 */
function plainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: plainMap() }, { policies: [], decrees: [] });
}

/**
 * 基线归零：把开屏自弹的教程模态收掉，得到「零 holder、未暂停」的干净起点。
 *
 * ⚠ 为什么直调私有 `closeModal()` 而不是走指针：类式 fake（`fakeScene.ts` 的 `makeChainable`）
 *   的 `setVisible` 只记不调、**不写 `visible` 字段** ⇒ `TutorialModal.handleDismiss`（:149-150）
 *   的 `if (!this.container.visible) return;` 守卫在替身里恒返回，模态点不动。
 *   本函数逐字复刻 `TutorialModal.ts:153-154` 的关模态两动作（closeModal → setTutorialStepId(null)），
 *   语义不发明、共享 fake 不改（改它是越界：现役 24+ 件消费者）。
 */
function dismissTutorial(scene: UIScene, store: GameStore): void {
  const modal = (scene as unknown as { tutorialModal: { closeModal: () => void } }).tutorialModal;
  modal.closeModal();
  store.setTutorialStepId(null);
}

/**
 * 真装配 UIScene（store/buildMode 先进 registry，与 GameScene→UIScene 真实装配序同构），
 * 再把开屏自弹的教程模态收掉 ⇒ 得到「零 holder、未暂停」的干净基线。
 *
 * 为什么必须先收教程：`gameStore.ts` 初始 `tutorialStepId: 'tut_welcome'`（现值 :326），
 * 而 `TutorialModal.ts:112` 见到 welcome 步就当场 `openModal()` ⇒ `requestPause('tutorial')`。
 * 即 **UIScene.create() 之后游戏必然是暂停的**（模态口），不先归零就无法区分「面板自己停的」
 * 与「玩家口的暂停」。这条本身在 ① 组被单独钉住。
 */
function makeReadyScene(): { scene: UIScene; store: GameStore; buildMode: BuildMode } {
  // 装配前先拆掉上一枚场景（真实游戏也是 shutdown 再 create）；见文件头 🔴 架构约束——
  // 这条**不足以**避免 OOM，留着只是不静默丢弃在册 SHUTDOWN 闭包。
  for (const h of shutdownHandlers.splice(0)) h.cb.call(h.ctx);
  registryStore.clear();
  const store = makeStore();
  const buildMode = new BuildMode();
  registryStore.set(REGISTRY_KEYS.store, store);
  registryStore.set(REGISTRY_KEYS.buildMode, buildMode);
  const scene = new UIScene();
  scene.create();
  dismissTutorial(scene, store);
  return { scene, store, buildMode };
}

type Rig = { scene: UIScene; store: GameStore; buildMode: BuildMode };
let rig: Rig | null = null;

/**
 * 每枚 describe 共用一台装配好的场景，逐例把可变态归零：
 * 关所有面板 / 清玩家口暂停 / 速度回 1 档 / 退建造模式。
 * （归零走面板与 store 的公有 API，不藏状态。）
 */
function ready(): Rig {
  if (!rig) rig = makeReadyScene();
  for (const row of PANEL_ROWS) {
    const p = panelOf(row.key);
    if (p.isVisible()) p.toggle();
  }
  const { store, buildMode } = rig;
  store.setPaused(false);
  store.setSpeed(1);
  buildMode.cancel();
  return rig;
}

// ---------- fake 读数小工具（chainable fake 把每次调用的实参记在 vi.fn().mock.calls 上） ----------

type ChainFn = { mock: { calls: unknown[][] } };
type ChainObj = Record<string, ChainFn>;

function chain(target: unknown): ChainObj {
  return target as unknown as ChainObj;
}

/** 该对象最后一次 setDepth(<数字>) 的实参；从未调过则 NaN。 */
function lastDepth(o: ChainObj): number {
  const calls = o.setDepth?.mock.calls ?? [];
  const first = calls[calls.length - 1]?.[0];
  return typeof first === 'number' ? first : Number.NaN;
}

/** 该方法被调用时传入的全部首参（如 setVisible 的布尔序列）。 */
function firstArgs(o: ChainObj, method: string): unknown[] {
  return (o[method]?.mock.calls ?? []).map(c => c[0]);
}

/**
 * 从 fake 上抓出真实注册过的指针闭包并手动触发（= 玩家点了一下）。
 * 存在理由：类式 FakeScene 的 `add.zone()` 返回 makeChainable()，其 `on` 只记不调 ⇒
 * 面板内联写在 `on('pointerdown', () => …)` 里的闭包**取不到触发口**；本函数从
 * `on.mock.calls` 把闭包捞出来直接执行，这样「折叠抽屉／拆除工具」这类
 * **只有内联闭包、没有公有方法**的交互也能被实测，而不必退回源码正则。
 */
function firePointer(o: ChainObj, ev = 'pointerdown'): boolean {
  const hit = (o.on?.mock.calls ?? []).find(c => c[0] === ev);
  const fn = hit?.[1];
  if (typeof fn !== 'function') return false;
  (fn as (...args: unknown[]) => void)();
  return true;
}

/** 面板公有面（11 枚在册面板的公共交集：toggle + isVisible）。 */
interface TogglePanel {
  toggle(): void;
  isVisible(): boolean;
}

/** registry 里的面板行；`holdsPause`＝该面板 open 时会 requestPause 自己的 holder。 */
interface PanelRow {
  name: string;
  key: string;
  holdsPause: boolean;
}

/**
 * 矩阵成员口径：只收「UIScene.create() 里真装配、且有 toggle/isVisible 公有面」的面板。
 * 排除项与原因（如实登记，别当覆盖到了）：
 *   - `saveLoadPanel`：`toggle()` 走 `void show()` ⇒ `refresh()` 里 `getSaveMeta()` 要
 *     `window.colonyApi`（`state/saveLoad.ts:875-877`）⇒ node 环境无该注入面，要拖 IPC 替身，
 *     不属本单「同步行」口径；
 *   - `legend`/`zoomControl`/`storyBar`/`audioManager`/`jitHintManager`：无 open/toggle 语义（常驻件）；
 *   - `eventModal`/`crisisModal`/`factionDemandModal`/`tutorialModal`：无公有 `toggle()`，
 *     其开合由 store 事件驱动 ⇒ 在 ④ 组按事件/私有闭包面单独钉教程模态，余三枚列遗留。
 */
const PANEL_ROWS: PanelRow[] = [
  { name: '国策树（朝堂）', key: REGISTRY_KEYS.policyTreePanel, holdsPause: true },
  { name: '典册', key: REGISTRY_KEYS.codexPanel, holdsPause: true },
  { name: '军务', key: REGISTRY_KEYS.militaryPanel, holdsPause: true },
  { name: '大工程', key: REGISTRY_KEYS.megaProjectPanel, holdsPause: true },
  { name: '人口', key: REGISTRY_KEYS.populationPanel, holdsPause: false },
  { name: '邦交', key: REGISTRY_KEYS.diplomacyPanel, holdsPause: false },
  { name: '供需', key: REGISTRY_KEYS.productionPanel, holdsPause: false },
  { name: '升格', key: REGISTRY_KEYS.gradePanel, holdsPause: false },
  { name: '终局记分牌', key: REGISTRY_KEYS.scoreCardPanel, holdsPause: false },
  { name: '设置（音量）', key: REGISTRY_KEYS.settingsPanel, holdsPause: false },
  { name: '史官/名望', key: REGISTRY_KEYS.influencePanel, holdsPause: false },
];

function panelOf(key: string): TogglePanel {
  const p = registryStore.get(key);
  expect(p, `registry 里没有 ${key}`).toBeDefined();
  return p as unknown as TogglePanel;
}

/** 该面板容器对象的运行时 depth（容器字段名在 11 枚面板里逐字相同：`this.container`）。 */
function panelDepth(p: unknown): number {
  const container = (p as unknown as { container: unknown }).container;
  expect(container, '面板 container 缺席，本桩需同步').toBeDefined();
  return lastDepth(chain(container));
}

/** 遮罩/提示/顶栏/建造面板的私有字段触达（与 UIScene.test 的 cast 同手法）。 */
function overlayOf(scene: UIScene): ChainObj {
  return chain((scene as unknown as { pauseOverlay: unknown }).pauseOverlay);
}
function pauseTextOf(scene: UIScene): ChainObj {
  return chain((scene as unknown as { pauseText: unknown }).pauseText);
}
/** 场景里两枚常驻容器的字段表（interface 而非 Record ⇒ 属性访问不吃 noUncheckedIndexedAccess）。 */
interface SceneContainers {
  hud: { container: unknown };
  buildPanel: { container: unknown };
}
function containerOf(scene: UIScene, field: keyof SceneContainers): ChainObj {
  const host: SceneContainers = scene as unknown as SceneContainers;
  return chain(host[field].container);
}

describe('① 装配基线：UIScene 一创建就是「模态口暂停」，与玩家口是两回事', () => {
  it('create() 后未收教程时：isPaused()＝真、getUserPaused()＝假（tutorial holder）', () => {
    registryStore.clear();
    for (const h of shutdownHandlers.splice(0)) h.cb.call(h.ctx);
    const store = makeStore();
    registryStore.set(REGISTRY_KEYS.store, store);
    registryStore.set(REGISTRY_KEYS.buildMode, new BuildMode());
    const fresh = new UIScene();
    fresh.create();
    expect(store.getUserPaused()).toBe(false); // 玩家一口都没按过
    expect(store.isPaused()).toBe(true);       // 教程模态把它自己算成暂停
    // 收掉教程后两个口一起归零（证明本件的基线是真归零，不是把暂停藏起来）
    dismissTutorial(fresh, store);
    expect(store.isPaused()).toBe(false);
  });

  it('暂停双口的读法在世：isPaused＝用户口 ∨ holder；holder 不写用户口', () => {
    const { store } = ready();
    expect(store.isPaused()).toBe(false);
    store.requestPause('probe-holder');
    expect(store.isPaused()).toBe(true);
    expect(store.getUserPaused()).toBe(false); // holder 不污染玩家口
    store.releasePause('probe-holder');
    expect(store.isPaused()).toBe(false);
  });

  it('暂停遮罩的可见性由 PAUSED_CHANGED 驱动：玩家口与 holder 口都能点亮它', () => {
    const { scene, store } = ready();
    const overlay = overlayOf(scene);
    expect(firstArgs(overlay, 'setVisible').at(-1)).toBe(false); // 基线未暂停
    store.setPaused(true);
    expect(firstArgs(overlay, 'setVisible').at(-1)).toBe(true);
    store.setPaused(false);
    expect(firstArgs(overlay, 'setVisible').at(-1)).toBe(false);
    // holder 口同样点亮（＝「面板自己时停」时遮罩也会盖上来）
    store.requestPause('probe-holder');
    expect(firstArgs(overlay, 'setVisible').at(-1)).toBe(true);
    store.releasePause('probe-holder');
    expect(firstArgs(overlay, 'setVisible').at(-1)).toBe(false);
  });
});

describe('② 暂停可达性矩阵：玩家暂停态下 11 枚面板的 toggle 全都可达（现状钉，非认可）', () => {
  it('矩阵成员数 ≥4（完成标准 ①）且逐枚可开可关', () => {
    expect(PANEL_ROWS.length).toBeGreaterThanOrEqual(4);
    const { store } = ready();
    store.setPaused(true);
    for (const row of PANEL_ROWS) {
      const p = panelOf(row.key);
      expect(p.isVisible(), `${row.name} 基线应关闭`).toBe(false);
      p.toggle();
      expect(p.isVisible(), `${row.name}：暂停态下打不开（与现状不符，需复核）`).toBe(true);
      p.toggle();
      expect(p.isVisible(), `${row.name}：暂停态下关不掉`).toBe(false);
    }
  });

  it('逐枚：暂停态下开合期间时间没走、玩家口没被吞、暂停态自始至终成立', () => {
    const { store } = ready();
    for (const row of PANEL_ROWS) {
      store.setPaused(true);
      const dayBefore = store.getCurrentDay();
      const p = panelOf(row.key);
      p.toggle();
      expect(store.isPaused(), row.name).toBe(true);
      expect(store.getUserPaused(), row.name).toBe(true);
      p.toggle();
      expect(store.getCurrentDay(), `${row.name}：开合面板期间时间走了`).toBe(dayBefore);
      expect(store.isPaused(), row.name).toBe(true);
    }
  });

  it('非 holder 面板（人口/邦交/供需/升格/记分牌/设置/名望）：开合完全不碰暂停口', () => {
    const { store } = ready();
    for (const row of PANEL_ROWS.filter(r => !r.holdsPause)) {
      const p = panelOf(row.key);
      p.toggle();
      expect(store.isPaused(), `${row.name} 不该自行时停`).toBe(false);
      expect(store.getUserPaused(), row.name).toBe(false);
      p.toggle();
      expect(store.isPaused(), row.name).toBe(false);
    }
  });

  it('holder 面板四枚：运行中开＝自行时停、关＝恢复；玩家口先暂停时关面板不替玩家解除暂停', () => {
    const { store } = ready();
    for (const row of PANEL_ROWS.filter(r => r.holdsPause)) {
      // A. 运行中：开→暂停，关→恢复
      store.setPaused(false);
      const pa = panelOf(row.key);
      expect(store.isPaused()).toBe(false);
      pa.toggle();
      expect(store.isPaused(), `${row.name} 打开没时停`).toBe(true);
      expect(store.getUserPaused(), `${row.name} 时停写到了玩家口`).toBe(false);
      pa.toggle();
      expect(store.isPaused(), `${row.name} 关闭没恢复`).toBe(false);

      // B. 玩家口先暂停：开（叠加 holder）→ 关 ⇒ 玩家口必须还在，且 holder 已释放干净
      store.setPaused(true);
      const pb = panelOf(row.key);
      pb.toggle();
      expect(pb.isVisible()).toBe(true);
      expect(store.isPaused()).toBe(true);
      pb.toggle();
      expect(store.isPaused(), `${row.name}：关面板后不再暂停`).toBe(true); // 仍暂停＝玩家口的功劳
      expect(store.getUserPaused(), `${row.name}：玩家口被面板吞了`).toBe(true);
      // holder 释放干净的判据：玩家自己取消暂停后必须真跑起来（有残留就还是暂停）
      store.setPaused(false);
      expect(store.isPaused(), `${row.name}：close 后 holder 残留`).toBe(false);
    }
  });

  it('教程模态（无公有 toggle，走事件口）：welcome 步自开＝holder 口；close 后口归零', () => {
    // 本例必须自建场景（教程只在 create 时自弹），先把共享 rig 声明作废，
    // 免得断言中途留一台「已被 SHUTDOWN 打死」的 rig 给后续用例（踩过：级联 11 红）。
    rig = null;
    const store = makeStore();
    registryStore.set(REGISTRY_KEYS.store, store);
    registryStore.set(REGISTRY_KEYS.buildMode, new BuildMode());
    const scene = new UIScene();
    scene.create();
    const modal = (scene as unknown as { tutorialModal: { closeModal: () => void; container: unknown } }).tutorialModal;
    expect(store.isPaused()).toBe(true);   // 自开＝holder 口，玩家没按过暂停
    expect(store.getUserPaused()).toBe(false);
    modal.closeModal();
    expect(store.isPaused()).toBe(false);
    // 关动作在替身里的可观测面：container 最后一次 setVisible 是 false
    //（⚠ 类式 fake 的 setVisible 不写 `visible` 字段 ⇒ `modal.isVisible()` 恒 undefined，别用它）
    expect(firstArgs(chain(modal.container), 'setVisible').at(-1)).toBe(false);
  });
});

describe('③ 遮罩层级的运行时读数：遮罩在所有面板之下、且不吃指针（可达性的直接因）', () => {
  beforeAll(() => {
    ready();
  });

  it('遮罩 900／提示 901 是运行时真传入的 depth，HUD/建造 1000、面板 2000 全在其上', () => {
    const { scene } = ready();
    expect(lastDepth(overlayOf(scene))).toBe(900);
    expect(lastDepth(pauseTextOf(scene))).toBe(901);
    expect(lastDepth(containerOf(scene, 'hud'))).toBe(1000);
    expect(lastDepth(containerOf(scene, 'buildPanel'))).toBe(1000);
    for (const row of PANEL_ROWS) {
      expect(panelDepth(panelOf(row.key)), `${row.name} 的容器层级`).toBeGreaterThan(901);
    }
  });

  it('暂停遮罩铺满整个视口（几何上盖住面板区），但 depth 更低 ⇒ 视觉被面板压住', () => {
    const { scene, store } = ready();
    const overlay = overlayOf(scene);
    store.setPaused(true);
    const scale = (scene as unknown as { scale: { width: number; height: number } }).scale;
    const fillRect = overlay.fillRect;
    expect(fillRect?.mock.calls.length ?? 0).toBeGreaterThan(0);
    expect(fillRect!.mock.calls.at(-1)).toEqual([0, 0, scale.width, scale.height]);
    // 但它在面板之下（⑤组已钉，这里换成运行时读数，两处任一被改都会红）
    expect(lastDepth(overlay)).toBeLessThan(1000);
    store.setPaused(false);
  });

  it('遮罩与「已暂停」文字都没 setInteractive ⇒ 暂停态不拦任何点击（面板照旧可点）', () => {
    const { scene, store } = ready();
    const overlay = overlayOf(scene);
    store.setPaused(true);
    expect(overlay.setInteractive?.mock.calls.length ?? 0).toBe(0);
    expect(pauseTextOf(scene).setInteractive?.mock.calls.length ?? 0).toBe(0);
    store.setPaused(false);
  });

  it('Toast 2400 仍在遮罩之上：暂停期间弹的 toast 不会被遮罩压暗，也不因暂停而弹不出', () => {
    const { scene, store } = ready();
    store.setPaused(true);
    const toast = registryStore.get(REGISTRY_KEYS.toast) as unknown as {
      show(m: string, k: 'info' | 'error', ms: number): void;
      bg: unknown;
    };
    expect(() => toast.show('暂停期间探针', 'info', 100)).not.toThrow();
    expect(lastDepth(chain(toast.bg))).toBe(2400);
    store.setPaused(false);
  });
});

describe('④ 恢复口可达性：顶栏速度钮与空格在两种暂停口下的分野', () => {
  interface HudHandlers {
    onSpeedButton(speed: 0 | 1 | 2 | 3): void;
  }

  it('玩家口暂停：顶栏按 2＝当场恢复并定档（暂停不锁顶栏）', () => {
    const { scene, store } = ready();
    store.setPaused(true);
    (scene as unknown as { hud: HudHandlers }).hud.onSpeedButton(2);
    expect(store.isPaused()).toBe(false);
    expect(store.getSpeed()).toBe(2);
    store.setSpeed(1);
  });

  it('玩家口暂停：顶栏按 0＝切暂停两态（与空格同式），暂停态本身可达', () => {
    const { scene, store } = ready();
    const hud = (scene as unknown as { hud: HudHandlers }).hud;
    hud.onSpeedButton(0);
    expect(store.isPaused()).toBe(true);
    hud.onSpeedButton(0);
    expect(store.isPaused()).toBe(false);
  });

  it('🔴 holder 口暂停：顶栏按 1/2/3 全都恢复不了（isPaused 仍真）＝玩家口解不开模态口', () => {
    const { scene, store } = ready();
    const codex = panelOf(REGISTRY_KEYS.codexPanel);
    codex.toggle(); // requestPause('codex')
    expect(store.isPaused()).toBe(true);
    const hud = (scene as unknown as { hud: HudHandlers }).hud;
    for (const speed of [1, 2, 3] as const) {
      hud.onSpeedButton(speed);
      expect(store.isPaused(), `按 ${speed} 竟解开了模态口`).toBe(true);
    }
    // 空格同式（`GameScene.ts:155` 的 `store.setPaused(!store.isPaused())`）：同样解不开
    store.setPaused(!store.isPaused());
    expect(store.isPaused()).toBe(true);
    expect(store.getUserPaused()).toBe(false);
    codex.toggle();
  });

  it('双口叠加的时序陷阱已封（c930-04）：模态持有期间顶栏整钮不响应 ⇒ 玩家口不被清、关面板后不自己开跑', () => {
    const { scene, store } = ready();
    store.setPaused(true); // 玩家口
    const codex = panelOf(REGISTRY_KEYS.codexPanel);
    codex.toggle();        // 叠加 holder 口
    const dayBefore = store.getCurrentDay();
    const speedBefore = store.getSpeed();
    (scene as unknown as { hud: HudHandlers }).hud.onSpeedButton(3); // c930-04 前：setPaused(false)＋setSpeed(3)
    // 钉桩翻转留痕：c927-46 原钉「玩家口被顶栏清掉 ⇒ 关面板的瞬间按新档自己跑（玩家没点过继续）」。
    // c930-04 在 HUD.ts:513 补了 `if (this.store.hasPauseHolders()) return;` ⇒ 模态持有期间整钮不响应，
    // 原缺陷点（清玩家口／静默改档）双双消失。本钉随之由「钉陷阱」翻为「钉陷阱已封」。
    expect(store.getUserPaused()).toBe(true);      // 玩家口未被清（原缺陷点）
    expect(store.isPaused()).toBe(true);
    expect(store.getSpeed()).toBe(speedBefore);    // 档位也没被静默改掉（原缺陷点）
    expect(store.getCurrentDay()).toBe(dayBefore); // 暂停期间时间没走
    codex.toggle();                                // 关面板 ⇒ 只释放 holder
    expect(store.isPaused()).toBe(true);           // 玩家口仍在 ⇒ 游戏不会自己开跑（陷阱已封）
    expect(store.getUserPaused()).toBe(true);
    store.setPaused(false);                        // 收尾：显式撤销玩家口
  });

  it('时间面同证：暂停（任一口）下 TimeSystem.update 再大的 delta 也是 0 tick；恢复才走', () => {
    const { store } = ready();
    const ts = new TimeSystem(store);
    const day0 = store.getCurrentDay();
    store.setPaused(true);
    ts.update(SPEED_MS_PER_DAY[1] * 50);
    expect(store.getCurrentDay()).toBe(day0);
    store.setPaused(false);
    store.requestPause('probe-holder'); // holder 口也照样冻
    ts.update(SPEED_MS_PER_DAY[1] * 3);
    expect(store.getCurrentDay()).toBe(day0);
    store.releasePause('probe-holder');
    ts.update(SPEED_MS_PER_DAY[1] * 3);
    expect(store.getCurrentDay()).toBe(day0 + 3);
  });
});

describe('⑤ 建造侧（Build/HUD 抽屉）交互在暂停态同样可达', () => {
  interface ButtonRow {
    def: { name: string };
    zone: unknown;
  }
  interface BuildPanelInternals {
    rows: ButtonRow[];
    collapseZone: unknown;
    demolishZone: unknown;
  }

  function internals(scene: UIScene): BuildPanelInternals {
    return (scene as unknown as { buildPanel: BuildPanelInternals }).buildPanel;
  }

  it('暂停态下点建造行＝照样进建造模式（BuildMode.select 无暂停守卫）', () => {
    const { scene, store, buildMode } = ready();
    store.setPaused(true);
    const first = internals(scene).rows[0];
    expect(first, '建造列表空表，本桩需同步').toBeDefined();
    expect(firePointer(chain(first!.zone)), '行闭包没注册到 pointerdown，本桩需同步').toBe(true);
    expect(buildMode.getSelected()).toBe(first!.def);
    firePointer(chain(first!.zone)); // 再点同一行＝取消（同样可达）
    expect(buildMode.getSelected()).toBeNull();
    store.setPaused(false);
  });

  it('暂停态下「拆除工具」可进可退（内联闭包实测，不是正则）', () => {
    const { scene, store, buildMode } = ready();
    store.setPaused(true);
    const zone = chain(internals(scene).demolishZone);
    expect(firePointer(zone)).toBe(true);
    expect(buildMode.isDemolish()).toBe(true);
    expect(firePointer(zone)).toBe(true);
    expect(buildMode.isDemolish()).toBe(false);
    store.setPaused(false);
  });

  it('暂停态下 HUD 抽屉折叠可切换（store.setPanelCollapsed 无暂停守卫）', () => {
    const { scene, store } = ready();
    store.setPaused(true);
    const before = store.getPanelCollapsed('left');
    expect(firePointer(chain(internals(scene).collapseZone))).toBe(true);
    expect(store.getPanelCollapsed('left')).toBe(!before);
    store.setPaused(false);
  });

  it('暂停态下国策树 ESC 闭包仍能关面板（键盘口不被暂停拦）', () => {
    const { store } = ready();
    const tree = panelOf(REGISTRY_KEYS.policyTreePanel);
    tree.toggle();
    store.setPaused(true);
    expect(tree.isVisible()).toBe(true);
    const handler = (tree as unknown as { onEsc: unknown }).onEsc;
    expect(typeof handler).toBe('function');
    (handler as () => void)();
    expect(tree.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(true); // 关面板后玩家口还在，没被顺手解除
    store.setPaused(false);
  });
});

describe('⑥ 反向对照：可达 ≠ 时间在走（面板自停确实生效，UI 仍在读）', () => {
  it('非 holder 面板（人口）打开时照常走日；开合本身不掐刷新链', () => {
    const { store } = ready();
    const panel = panelOf(REGISTRY_KEYS.populationPanel);
    panel.toggle();
    const ts = new TimeSystem(store);
    const day0 = store.getCurrentDay();
    ts.update(SPEED_MS_PER_DAY[1] * 3);
    expect(store.getCurrentDay()).toBe(day0 + 3); // 无 holder ⇒ 正常运行
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('holder 面板（军务）打开期间 0 日；关面板后同一段 delta 立刻补上', () => {
    const { store } = ready();
    const panel = panelOf(REGISTRY_KEYS.militaryPanel);
    panel.toggle();
    const ts = new TimeSystem(store);
    const day0 = store.getCurrentDay();
    ts.update(SPEED_MS_PER_DAY[1] * 3);
    expect(store.getCurrentDay()).toBe(day0); // 时停
    panel.toggle();
    ts.update(SPEED_MS_PER_DAY[1] * 3);
    expect(store.getCurrentDay()).toBe(day0 + 3);
  });

  it('装配真实性读数：建造清单行数＝BUILDINGS 全表（矩阵不是空壳）', () => {
    const { scene } = ready();
    const rows = (scene as unknown as { buildPanel: { rows: unknown[] } }).buildPanel.rows;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(BUILDINGS.length);
  });
});
