// c919-01：共享 FakeScene 脚手架——UI 三套（HUD/BuildingPopover/Legend）的 builder 族与
// ModeSelectScene/UIScene 的 phaser-mock 类式 fake 统一收口到本文件，grep 单一定义处。
// 方法集取各文件迁移前并集：多余 vi.fn 链对既有断言惰性，语义零漂移。
import { vi } from 'vitest';

/**
 * 文本 union：HUD（setFontSize/setScrollFactor/setDepth）∪ Legend（setStyle）∪ BuildingPopover 基础集
 * ∪ SaveLoadPanel（disableInteractive/on + alpha/handlers 状态位）；setText 记录文本、
 * setAlpha 记录 alpha、on 按事件名登记回调到 handlers（供测试凭 handlers[ev] 模拟点击）。
 * c922-125：本文件的 builder 族是 UI 面板测试的**唯一定义处**（原 8 个自带本地副本的测试文件已收编）。
 * c923-02（批五）：∪ ProductionGradePanels 的 setColor 记值（该文件 :106/:109 断言 `t.color === '#B71C1C'`，
 * 原为本地副本独有能力）；新增 `makeFakeTextSized` 供布局直读 displayHeight 的 EventModal/TutorialModal 用。
 */
export function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    disableInteractive: vi.fn().mockReturnThis(),
    setFontSize: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    width: 100, height: 18, displayHeight: 18, text: '', alpha: 1, color: '',
    handlers: {} as Record<string, (...args: unknown[]) => void>,
  };
  t.setText.mockImplementation((s: string) => { t.text = s; return t; });
  t.setAlpha.mockImplementation((a: number) => { t.alpha = a; return t; });
  t.setColor.mockImplementation((c: string) => { t.color = c; return t; });
  t.on.mockImplementation((ev: string, fn: (...args: unknown[]) => void) => { t.handlers[ev] = fn; return t; });
  return t;
}

/**
 * 指定 displayHeight 的文本 fake（c923-02）。
 * 存在理由：EventModal.ts:265-266 与 TutorialModal.ts:210/215 把 `displayHeight` 当**布局输入**
 * （面板高度直读它），二者原本地副本分别是 24／22，而本共享件默认 18——
 * 收编时若把它们压成默认值就是改夹具语义，故用本工厂显式声明，实现仍只有 makeFakeText 一份。
 * ⚠ 本工厂首参是**数字**，不可当 Phaser `add.text(x, y, str)` 的位置参直传
 * （`text: vi.fn(() => makeFakeTextSized(24))` 才是正确接法）。
 * c927-65（主班 2026-09-28 对 c923-13 在册裁决给的「允许扩面」口径）：**新增第二形参 `size?`（可选）**。
 *   存在理由：FactionDemandModal.ts:139-142 把 **`titleText.height` / `bodyText.height` 当活布局输入**
 *   （`panelH = 24 + titleH + 14 + bodyH + 20 + btnH + 24` → `py` → `setPosition`/`fillRect` 实参），
 *   而该文件本地 `fakeText` 是 `width: 120 / height: 20`（`FactionDemandModal.test.ts:16`），
 *   共享件默认是 `width: 100 / height: 18`（`:30`）⇒ 直接换 import 同样是改夹具语义。
 *   首参只覆盖 displayHeight，故按 c927-51 产出档 §2.2 的最小形状补 `size?`：
 *   **纯可选参**，既有两消费者（EventModal/TutorialModal）不传 ⇒ 零翻转；回滚＝删掉这个可选形参与两行赋值。
 *   ⚠ 本班只落共享件腿：`FactionDemandModal.test.ts` 本体**未改**（班令：不改别人的测试），
 *     其收编留待按本形状另笔执行（同笔提交面见 c927-65 result 的「必须同笔」清单）。
 */
export function makeFakeTextSized(
  displayHeight: number,
  size?: { width?: number; height?: number },
) {
  const t = makeFakeText();
  t.displayHeight = displayHeight;
  if (size?.width !== undefined) t.width = size.width;
  if (size?.height !== undefined) t.height = size.height;
  return t;
}

/** 图形 union：HUD 全集 ∪ Legend/BuildingPopover 子集（含 lineBetween/strokeRoundedRect）∪ SaveLoadPanel（setInteractive/on）
 * ∪ c923-02 批五五件（EventModal/TutorialModal/PolicyTreePanel/ProductionGradePanels/DiplomacyPanel 的本地副本方法表
 * 逐条实测均为本表子集；EventModal 原多出的 `input: { hitArea }` 经 `git grep -w hitArea -- src/` 证其无任何读者，属死字段未并入）。 */
export function makeFakeGraphics() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const g: Record<string, unknown> = {
    handlers,
    on: vi.fn((ev: string, fn: (...args: unknown[]) => void) => { handlers[ev] = fn; return g; }),
  };
  const methods = ['clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
    'beginPath', 'moveTo', 'lineTo', 'strokePath', 'closePath', 'fillPath', 'fillRoundedRect',
    'strokeRoundedRect', 'generateTexture', 'lineBetween', 'setPosition', 'setVisible', 'setScrollFactor', 'setDepth', 'setInteractive', 'destroy'];
  for (const name of methods) g[name] = vi.fn().mockReturnThis();
  return g;
}

/** 交互区 union：BuildingPopover 携带 x/y/width/height（setPosition/setSize 记值）
 * ∪ handlers/on 登记（c922-125 批四收编 8 文件时补齐，供测试凭 handlers[ev] 模拟点击；
 * 对既有消费者为超集——vi.fn 仍保留 .mock.calls，只多加副作用）。 */
export function makeFakeZone() {
  const z = {
    x: 0, y: 0, width: 1, height: 1,
    handlers: {} as Record<string, (...args: unknown[]) => void>,
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
    setVisible: vi.fn().mockReturnThis(),
    on: vi.fn(),
    destroy: vi.fn(),
  };
  z.setPosition.mockImplementation((x: number, y: number) => { z.x = x; z.y = y; return z; });
  z.setSize.mockImplementation((w: number, h: number) => { z.width = w; z.height = h; return z; });
  z.on.mockImplementation((ev: string, fn: (...args: unknown[]) => void) => { z.handlers[ev] = fn; return z; });
  return z;
}

/** 容器 union：HUD（setAlpha/setPosition）∪ BuildingPopover（setScale）
 * ∪ EventModal/TutorialModal（setVisible 记值——isVisible() 直读 container.visible，见 EventModal.ts:364）
 * ∪ handlers/on 登记
 * ∪ c924-02 批二 DiplomacyPanel（each/removeAll/list 三项，原为该文件 :25-30 内联字面量独有）。
 *   实测生产码（`rg '\.each\(|removeAll\(|\.list\b' src` 排除测试件）零命中 ⇒ 三项在本仓是**惰性超集**，
 *   并入只为守住"builder 族唯一定义处"；实现按内联原样保留（each/removeAll 均裸 vi.fn，不另加记值语义）。 */
export function makeFakeContainer() {
  const c = {
    // 初值 false：面板构造期即 .setVisible(false)（EventModal.ts:89 / TutorialModal.ts:57），
    // 故原 undefined→false 不翻转任何分支；setVisible 必须记值，因 isVisible() 直读该字段。
    visible: false,
    handlers: {} as Record<string, (...args: unknown[]) => void>,
    list: [] as unknown[],
    each: vi.fn(),
    removeAll: vi.fn(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn(),
    setAlpha: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn(),
    setSize: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    add: vi.fn(),
    destroy: vi.fn(),
  };
  c.setVisible.mockImplementation((v: boolean) => { c.visible = v; return c; });
  c.on.mockImplementation((ev: string, fn: (...args: unknown[]) => void) => { c.handlers[ev] = fn; return c; });
  return c;
}

export interface FakeSceneOpts {
  /** Legend 读 cameras.main 尺寸。 */
  cameras?: boolean;
  /** HUD 用 tweens.add。 */
  tweens?: boolean;
  /** BuildingPopover 断言 input.keyboard.on（keyboardOn 可从 scene 取回）。 */
  keyboard?: boolean;
  /** BuildingPopover 用 time.delayedCall（捕获不立即执行）。 */
  time?: boolean;
}

/** 普通对象式 scene（UI 面板测试用）。keyboardOn 挂在 __keyboardOn 便于断言取回。 */
export interface FakeSceneLike {
  scale: { width: number; height: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry: any;
  [k: string]: unknown;
}

export function makeFakeScene(opts: FakeSceneOpts = {}): FakeSceneLike {
  const keyboardOn = vi.fn();
  // c1002-04：texts 收集面（SaveLoadPanel 收编所需）——add.text 每建一记一，消费者凭
  // scene.texts 断言「面板渲染了哪些文本」。纯超集新增：既有消费者零触碰（不读该字段）。
  const texts: ReturnType<typeof makeFakeText>[] = [];
  const scene: FakeSceneLike = {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => makeFakeContainer()),
      graphics: vi.fn(() => makeFakeGraphics()),
      text: vi.fn(() => makeFakeText()),
      zone: vi.fn(() => makeFakeZone()),
    },
    input: { on: vi.fn(), off: vi.fn(), keyboard: opts.keyboard ? { on: keyboardOn, off: vi.fn() } : undefined },
    registry: { get: vi.fn(), set: vi.fn() },
    texts,
    __keyboardOn: keyboardOn,
  } as unknown as FakeSceneLike;
  // Phaser Text 语义：构造第三参即初始文本——记入 .text 供断言（如 BuildingPopover hint 行）。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addObj = scene.add as unknown as Record<string, any>;
  const origText = addObj.text;
  addObj.text = vi.fn((x: number, y: number, init?: string) => {
    const t = origText(x, y, init) as unknown as { text: string };
    if (typeof init === 'string') t.text = init;
    texts.push(t as never);
    return t;
  });
  if (opts.cameras) scene.cameras = { main: { width: 1366, height: 800, scrollX: 0, scrollY: 0 } };
  if (opts.tweens) scene.tweens = { add: vi.fn(() => ({ stop: vi.fn(), destroy: vi.fn() })) };
  if (opts.time) scene.time = { delayedCall: vi.fn((_ms: number, fn: () => void) => { /* 捕获不立即执行 */ }) };
  return scene;
}

function makeChainable() {
  const o: Record<string, unknown> = {};
  for (const m of ['add', 'on', 'once', 'clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'strokePath', 'fillCircle', 'strokeCircle', 'fillRoundedRect', 'strokeRoundedRect', 'lineBetween', 'generateTexture', 'setOrigin', 'setDepth', 'setVisible', 'setScrollFactor', 'setInteractive', 'setPosition', 'setScale', 'setSize', 'setText', 'setColor', 'setStyle', 'setAlpha', 'setFontSize', 'setMask', 'clearMask', 'setBlendMode', 'setAlign', 'setWordWrapWidth', 'setPadding', 'setShadow', 'setLineSpacing', 'setDisplaySize', 'setTexture', 'setName', 'disableInteractive', 'removeAll', 'off']) {
    o[m] = vi.fn().mockReturnThis();
  }
  o.destroy = vi.fn();
  // BuildPanel 滚动遮罩：createGeometryMask 返回 mask 对象（非 this）。
  o.createGeometryMask = vi.fn(() => ({ destroy: vi.fn() }));
  return o;
}

export interface SceneClassMock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FakeScene: any;
  registryStore: Map<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sceneStart: any;
  shutdownHandlers: Array<{ evt: string; cb: (...args: unknown[]) => void; ctx?: unknown }>;
}

/** 类式 fake scene（vi.mock('phaser') 用）：ModeSelectScene/UIScene 共享。 */
export function makeSceneClassMock(): SceneClassMock {
  const registryStore = new Map<string, unknown>();
  const sceneStart = vi.fn();
  const shutdownHandlers: Array<{ evt: string; cb: (...args: unknown[]) => void; ctx?: unknown }> = [];
  class FakeScene {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sys: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    add: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scale: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tweens: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    time: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cameras: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textures: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sound: any;
    // c924-13：BootScene 加载面（见构造器注释的共享件约束）。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    load: any;
    constructor(cfg?: { key?: string }) {
      this.sys = { config: cfg ?? {}, settings: cfg ?? {} };
      this.scene = { start: sceneStart };
      this.registry = {
        set: vi.fn((k: string, v: unknown) => { registryStore.set(k, v); }),
        get: vi.fn((k: string) => registryStore.get(k)),
      };
      this.add = {
        graphics: vi.fn(() => makeChainable()),
        text: vi.fn(() => makeChainable()),
        zone: vi.fn(() => makeChainable()),
        container: vi.fn(() => makeChainable()),
        image: vi.fn(() => makeChainable()),
        dom: vi.fn(() => ({
          createFromHTML: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            // node 环境无 DOM：input 元素用纯对象顶（value/addEventListener 足够 IntroScene 用）。
            node: { value: '', addEventListener: vi.fn(), removeEventListener: vi.fn() },
          })),
          setOrigin: vi.fn().mockReturnThis(),
        })),
      };
      // BuildPanel 建筑缩略图贴图守卫：exists=false 走缺图降级（行只显文字）。
      this.textures = { exists: vi.fn(() => false), get: vi.fn() };
      // AudioManager 资产在位检查：cache.audio.exists=false → 静音降级（缺资产不报错）。
      this.cache = { audio: { exists: vi.fn(() => false) }, json: { get: vi.fn() } };
      // AudioManager BGM 动态装载：sound.add 返回可 play/stop 的假音频对象。
      this.sound = {
        add: vi.fn(() => ({ play: vi.fn(), stop: vi.fn(), destroy: vi.fn() })),
        play: vi.fn(),
        stop: vi.fn(),
      };
      // c924-13（c923-13 设计稿 §5 档 B 前置 1）：**load facet**——BootScene.preload 的唯一可桩点。
      // 存在理由：本类字段表原为 add/textures/cache/sound/events/scale/input/tweens/time/cameras/
      //   registry/scene/sys，**唯独没有 load** ⇒ `new BootScene().preload()` 必在 BootScene.ts:34
      //   `this.load.on('loaderror', ...)` 抛 TypeError（设计稿 A6 实测否证「套现有 mock 就能测」）。
      // 语义：image/audio 记值到 imageCalls/audioCalls（供「校验抢先抛 ⇒ 加载项一个都不排」的行为断言）；
      //   on 按事件名登记回调到 handlers，测试凭 `scene.load.handlers['loaderror']?.(file)` **手动触发**
      //   （= 卷宗点名的「loaderror 触发面」）；once 另置一表，不与 on 混登，以免「注册恰 1 处」类计数断言失真。
      // ⚠ 共享件约束：本件是 c919-01 立、c922-125/c923-02 两次收编的 builder 族**唯一定义处**，
      //   现 24 件测试消费（`grep -rl fakeScene src --include=*.test.ts` 现值）。本次为**纯新增字段**，
      //   既有方法表/返回值零改动 ⇒ 24 件消费者通过数须与改前逐文件一致（跳变表见 c924-13 result）。
      const loadHandlers: Record<string, (...args: unknown[]) => void> = {};
      const loadOnceHandlers: Record<string, (...args: unknown[]) => void> = {};
      const loadImageCalls: Array<{ key: string; url: string | string[] }> = [];
      const loadAudioCalls: Array<{ key: string; url: string | string[] }> = [];
      const load = {
        handlers: loadHandlers,
        onceHandlers: loadOnceHandlers,
        imageCalls: loadImageCalls,
        audioCalls: loadAudioCalls,
        on: vi.fn(),
        once: vi.fn(),
        image: vi.fn(),
        audio: vi.fn(),
        reset: vi.fn(),
        start: vi.fn(),
      };
      load.on.mockImplementation((ev: string, cb: (...args: unknown[]) => void) => {
        loadHandlers[ev] = cb;
        return load;
      });
      load.once.mockImplementation((ev: string, cb: (...args: unknown[]) => void) => {
        loadOnceHandlers[ev] = cb;
        return load;
      });
      load.image.mockImplementation((key: string, url: string | string[]) => {
        loadImageCalls.push({ key, url });
        return load;
      });
      load.audio.mockImplementation((key: string, url: string | string[]) => {
        loadAudioCalls.push({ key, url });
        return load;
      });
      // reset/start 只给「可链式调用」的裸形状，**不发明语义**：Phaser 的 loader.reset() 会清队列，
      // 但 BootScene.preload 自身既不调 start 也不调 reset（start 由 SceneManager.bootScene 代发），
      // 故本桩对二者不断言计数——见 c924-13 result 完成标准 ① 的判别力说明。
      load.reset.mockImplementation(() => load);
      load.start.mockImplementation(() => load);
      this.load = load;
      this.events = {
        once: vi.fn((evt: string, cb: (...args: unknown[]) => void, ctx?: unknown) => {
          shutdownHandlers.push({ evt, cb, ctx });
        }),
        on: vi.fn(),
        off: vi.fn(),
      };
      this.scale = { width: 1366, height: 800, on: vi.fn(), off: vi.fn() };
      this.input = { on: vi.fn(), off: vi.fn(), keyboard: { on: vi.fn(), off: vi.fn() } };
      this.tweens = { add: vi.fn(() => ({ stop: vi.fn(), destroy: vi.fn() })) };
      this.time = { delayedCall: vi.fn(), addEvent: vi.fn(() => ({ remove: vi.fn() })) };
      this.cameras = { main: { width: 1366, height: 800, scrollX: 0, scrollY: 0 }, resize: vi.fn() };
    }
  }
  return { FakeScene, registryStore, sceneStart, shutdownHandlers };
}

/** 单例：vi.mock 工厂（不可引用外部变量）经 await import 取用，与测试文件断言共用同一份 deps。 */
export const sceneClassMock = makeSceneClassMock();

/** 统一 phaser 模块 mock：Scene 基类＋SHUTDOWN/RESIZE 常量＋Geom.Rectangle（UIScene 暂停遮罩 hitArea new＋Contains）。 */
export function makePhaserMock() {
  class Rectangle {
    static Contains(): boolean { return false; }
  }
  const PhaserMock = {
    Scene: sceneClassMock.FakeScene,
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { RESIZE: 'RESIZE' },
    Geom: { Rectangle },
    Math: { Between: (min: number, _max: number) => min, FloatBetween: (min: number, _max: number) => min },
  };
  (PhaserMock as Record<string, unknown> & { default?: unknown }).default = PhaserMock;
  return PhaserMock;
}
