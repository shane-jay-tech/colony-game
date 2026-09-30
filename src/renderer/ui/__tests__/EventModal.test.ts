/**
 * EventModal 纯逻辑测试。Phaser scene/graphics/text/zone 全部 mock，
 * 不验证像素渲染——只验证：监听 EVENT_TRIGGERED → 弹出 → 选项调用 store.resolveEvent →
 * EVENT_RESOLVED → 关闭 + 恢复暂停 / 倒计时 / 古文白话 toggle。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { CourtEvent } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import { EventModal } from '../EventModal';
import { makeFakeContainer, makeFakeGraphics, makeFakeTextSized, makeFakeZone } from './fakeScene';

type FakeZone = ReturnType<typeof makeFakeZone>;

// ---- fake Phaser scene ---------------------------------------------------
// c923-02（批五）：本地 makeFakeText/makeFakeGraphics 副本收编进共享 fakeScene。
// 本模态把 text.displayHeight 当**布局输入**（EventModal.ts:265/266 直读），原副本是 24，
// 故经 makeFakeTextSized(24) 显式声明而非退回共享件默认 18。
// 原 graphics 副本多出的 `input: { hitArea }` 为死字段（`git grep -w hitArea -- src` 除本行外
// 只剩两处注释），未并入共享件。
// 原容器可见性 setter 的本地覆写亦删：共享 makeFakeContainer 已把该赋值记进 .visible
// （fakeScene.ts:95），本文件 isVisible() 断言走的是同一字段——覆写属重复建设（c922-125 遗留3）。

// c927-74：第二形参 `textSize` 可选且默认 24 ⇒ 既有调用（beforeEach 单参）零翻转；
// 存在理由见文末「被夹分支看守」两例——panelH 的夹值分支要换**更大的正文高度**才看得到，
// 单一常量夹具（24）永远停在被 PANEL_MIN_HEIGHT 夹住的那一段。
function makeFakeScene(scale = { width: 1366, height: 800 }, textSize = 24) {
  const containers: ReturnType<typeof makeFakeContainer>[] = [];
  const zones: FakeZone[] = [];
  const texts: ReturnType<typeof makeFakeTextSized>[] = [];
  const scene = {
    scale,
    add: {
      container: vi.fn(() => {
        const c = makeFakeContainer();
        containers.push(c); return c;
      }),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(() => {
        const t = makeFakeTextSized(textSize);
        texts.push(t); return t;
      }),
      zone: vi.fn(() => {
        const z = makeFakeZone();
        zones.push(z); return z;
      }),
    },
    registry: { get: vi.fn().mockReturnValue(undefined) },
    _containers: containers,
    _zones: zones,
    _texts: texts,
  };
  return scene as never;
}

// ---- fixtures ------------------------------------------------------------

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(events: CourtEvent[] = []): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { events });
}

const EVT_CHOICE: CourtEvent = {
  id: 'evt_test_choice',
  tags: ['抉择'],
  triggers: [],
  contexts: [{ condition: 'default', title: '邻邦遣使', desc: '齐使持璧来朝。', descPlain: '齐使来访。' }],
  choices: [
    { text: '设宴', textPlain: '答应结盟。', effects: [], removeEffects: [] },
    { text: '却之', textPlain: '婉拒。', effects: [], removeEffects: [] },
  ],
  defaultTimeoutDays: 7,
};

const EVT_NOTIFY: CourtEvent = {
  id: 'evt_locust',
  tags: ['负'],
  triggers: [],
  contexts: [{ condition: 'default', title: '飞蝗蔽天', desc: '蝗虫过境。', descPlain: '夏季蝗灾。' }],
  // 没有 choices → 单 [知道了] 按钮路径
};

// ---- c923-21：真实点击路径的取数口 ----------------------------------------
// 卷宗锚点（c922-125 遗留）：本文件此前所有「点击」用例都走 modal.clickChoice() **直调**，
// 而共享 fakeScene 的 handlers 登记面（fakeScene.ts:76/:87，zone.on 把回调记进 zone.handlers）
// 零消费方 ⇒「点一下按钮真的接到 handleChoice 上」这一判别力从未建立。
// 下面几例的差别：拿生产代码亲手 on(...) 过的那枚 zone，**触发它登记着的 handler**，
// 走 Phaser 事件回调本体，不经 clickChoice 这条测试后门。
// ⚠ fakeScene.ts 属在册待裁决件（colony6 档 B），本班零触碰——zone 引用一律从面板内部字段取回。
/** 与 EventModal.ts:28-33 的 ChoiceButton 同构（只声明本批断言要读的字段）。 */
type ModalButton = { zone: FakeZone; text: { text: string }; idx: number };

const buttonsOf = (m: EventModal): ModalButton[] =>
  (m as unknown as { buttons: ModalButton[] }).buttons;
const toggleZoneOf = (m: EventModal): FakeZone =>
  (m as unknown as { toggleZone: FakeZone }).toggleZone;
const bodyTextOf = (m: EventModal): { text: string } =>
  (m as unknown as { bodyText: { text: string } }).bodyText;
const toggleLabelOf = (m: EventModal): { text: string } =>
  (m as unknown as { toggleText: { text: string } }).toggleText;
/** c927-74：面板背景是 panelH 唯一的落笔处（EventModal.ts:292 fillRect / :296 内框 strokeRect）。
 *  只声明本批断言要读的两枚 vi.fn，避免 Record<string, unknown> 在 expect 上失型。 */
type FakePanelGfx = { fillRect: ReturnType<typeof vi.fn>; strokeRect: ReturnType<typeof vi.fn> };
const panelBgOf = (m: EventModal): FakePanelGfx =>
  (m as unknown as { panelBg: FakePanelGfx }).panelBg;
const eventHistoryOf = (s: GameStore): string[] =>
  (s as unknown as { state: { eventHistory: string[] } }).state.eventHistory;

/** 让事件进入 pending 并发 EVENT_TRIGGERED（与上方既有用例同一入口）；顺带确认模态确实起了。 */
function triggerEvent(s: GameStore, m: EventModal, eventId: string): void {
  const st = (s as unknown as {
    state: { pendingEventId: string | null; pendingEventDayStart: number | null };
  }).state;
  st.pendingEventId = eventId;
  st.pendingEventDayStart = 0;
  s['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId });
  expect(m.isVisible()).toBe(true);
}

// ---- tests ---------------------------------------------------------------

describe('EventModal', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let modal: EventModal;

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore([EVT_CHOICE, EVT_NOTIFY]);
    modal = new EventModal(scene, store);
  });

  it('initially hidden when no pending event', () => {
    expect(modal.isVisible()).toBe(false);
    expect(modal.getCurrentEventId()).toBeNull();
  });

  it('shows when EVENT_TRIGGERED is emitted', () => {
    // 直接通过 store 设置 pending：模拟 tickDay 路径
    // store.runEventTick 是 private — 用 'as any' 取一下，或者直接 emit + 设状态
    // 这里用 emit 模拟（store 端 pendingEventId 必须先设上，否则 getPendingEvent 拿 null）
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 5;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(modal.isVisible()).toBe(true);
    expect(modal.getCurrentEventId()).toBe(EVT_CHOICE.id);
    expect(modal.getButtonCount()).toBe(2);
  });

  it('clicking choice calls store.resolveEvent and hides modal', () => {
    const resolveSpy = vi.spyOn(store, 'resolveEvent');
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(modal.isVisible()).toBe(true);

    modal.clickChoice(0);
    expect(resolveSpy).toHaveBeenCalledWith(0);
    // resolveEvent 内部会 emit EVENT_RESOLVED → handleResolved → hide
    expect(modal.isVisible()).toBe(false);
    expect(modal.getCurrentEventId()).toBeNull();
  });

  it('non-choice event shows single [知道了] button', () => {
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_NOTIFY.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_NOTIFY.id });
    expect(modal.getButtonCount()).toBe(1);
  });

  it('opening pauses the store; closing restores prev paused state', () => {
    expect(store.isPaused()).toBe(false);
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(store.isPaused()).toBe(true);
    modal.clickChoice(0);
    // resolveEvent 路径关闭 modal 并 setPaused(prevPaused=false)
    expect(store.isPaused()).toBe(false);
  });

  it('paused state is preserved if user was already paused', () => {
    store.setPaused(true);
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(store.isPaused()).toBe(true);
    modal.clickChoice(0);
    // prevPaused 是 true → 关闭后保持 paused
    expect(store.isPaused()).toBe(true);
  });

  it('STATE_REPLACED with no pending event closes modal but does NOT touch paused', () => {
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(modal.isVisible()).toBe(true);
    // 模拟加载新存档：清掉 pendingEventId 后 emit STATE_REPLACED
    (store as unknown as { state: { pendingEventId: string | null } }).state.pendingEventId = null;
    store.setPaused(false); // 假装 deserialize 把 paused 重置了
    store['emitter'].emit(STATE_EVENTS.STATE_REPLACED, undefined);
    expect(modal.isVisible()).toBe(false);
    // 应该不被强制改回 prevPaused（true）
    expect(store.isPaused()).toBe(false);
  });

  it('destroy unsubscribes from store events', () => {
    const before = store.listenerCount(STATE_EVENTS.EVENT_TRIGGERED);
    modal.destroy();
    const after = store.listenerCount(STATE_EVENTS.EVENT_TRIGGERED);
    expect(after).toBe(before - 1);
  });

  // Slice G hardening DeepSeek critical #2：destroy 时若仍持 pause hold 必须释放，
  // 否则 hot reload 会留一个永远软暂停的幽灵 holder。
  it('destroy releases pause hold if still open', () => {
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(store.isPaused()).toBe(true);
    modal.destroy();
    // 没有 resolveEvent 路径，但 destroy 必须释放 pause hold
    expect(store.isPaused()).toBe(false);
  });

  // ---- c923-21：真实点击路径（触发 zone 上登记的 handler，断具体状态字段变化）----

  it('真实路径：点第二枚选项 zone 的 pointerdown → 事件落进 history、模态自毁按钮并释放时停', () => {
    triggerEvent(store, modal, EVT_CHOICE.id);
    const btns = buttonsOf(modal);
    // 覆盖面自证：登记面确实挂着生产代码注册的 handler；并**按标签**锁定这就是 idx 1，不靠数组下标猜。
    expect(btns).toHaveLength(2);
    expect(typeof btns[1]!.zone.handlers.pointerdown).toBe('function');
    expect(btns[1]!.text.text).toBe('婉拒。');
    // 动手前的状态读数
    expect(store.getPendingEventId()).toBe(EVT_CHOICE.id);
    expect(eventHistoryOf(store)).toEqual([]);
    expect(store.isPaused()).toBe(true);

    btns[1]!.zone.handlers.pointerdown!(); // ← 真实 handler，不经 clickChoice

    // 状态字段逐项翻转
    expect(store.getPendingEventId()).toBeNull();
    expect(eventHistoryOf(store)).toEqual([EVT_CHOICE.id]);
    expect(modal.isVisible()).toBe(false);
    expect(modal.getButtonCount()).toBe(0);
    expect(store.isPaused()).toBe(false);
    expect(btns[1]!.zone.destroy).toHaveBeenCalledOnce();

    // 反向自证：按钮已随 clearButtons 销毁，重放同一枚旧 handler 不得再结一次（判据非恒绿）
    btns[1]!.zone.handlers.pointerdown!();
    expect(eventHistoryOf(store)).toEqual([EVT_CHOICE.id]);
  });

  it('真实路径：点「古文/白话」toggle zone 的 pointerdown → 正文与两枚选项标签整套翻面且不误结算', () => {
    triggerEvent(store, modal, EVT_CHOICE.id);
    const tz = toggleZoneOf(modal);
    expect(typeof tz.handlers.pointerdown).toBe('function');
    const body = bodyTextOf(modal);
    const label = toggleLabelOf(modal);
    const btns = buttonsOf(modal);
    // 默认白话态基线。⚠ label 不检初值：本件 local add.text 的 vi.fn 丢弃构造位置参（:38-41），
    // '古文' 只在 toggleLanguage 调过 setText 后可读 ⇒ 故改检**两次点击的方向**，比检一个静态串更有判别力。
    expect(body.text).toBe('齐使来访。');
    expect(btns.map((b) => b.text.text)).toEqual(['答应结盟。', '婉拒。']);

    tz.handlers.pointerdown!();

    // 古文态：正文换源、toggle 自证文案换向、选项标签跟着重渲染
    expect(body.text).toBe('齐使持璧来朝。');
    expect(label.text).toBe('白话');
    expect(btns.map((b) => b.text.text)).toEqual(['设宴', '却之']);
    // 而模态本身没被这一下点掉，事件也没被结清
    expect(store.getPendingEventId()).toBe(EVT_CHOICE.id);
    expect(eventHistoryOf(store)).toEqual([]);
    expect(modal.isVisible()).toBe(true);

    // 再点一次 → 整套回到白话（证明点的是真开关，不是单向副作用）
    tz.handlers.pointerdown!();
    expect(body.text).toBe('齐使来访。');
    expect(label.text).toBe('古文');
    expect(btns.map((b) => b.text.text)).toEqual(['答应结盟。', '婉拒。']);
  });

  it('真实路径：无 choices 事件的那枚 [知道了] zone → 一次点击即清 pending 并落 history', () => {
    triggerEvent(store, modal, EVT_NOTIFY.id);
    const btns = buttonsOf(modal);
    // 单按钮路径的 idx 由 makeChoiceButton(0,'知道了') 定（EventModal.ts:179）；
    // 文字不经 setText 落地（无 choices ⇒ refreshTexts 的重渲染循环空转），故检 idx 而非 label。
    expect(btns).toHaveLength(1);
    expect(btns[0]!.idx).toBe(0);
    expect(typeof btns[0]!.zone.handlers.pointerdown).toBe('function');

    btns[0]!.zone.handlers.pointerdown!();

    expect(store.getPendingEventId()).toBeNull();
    expect(eventHistoryOf(store)).toEqual([EVT_NOTIFY.id]);
    expect(modal.getButtonCount()).toBe(0);
    expect(store.isPaused()).toBe(false);
  });

  // ---- c924-03：displayHeight 布局输入的哨兵（补 c923-02 登记的失明面，判据按磁盘实况收窄）----
  // 上游建议「layout 后的 container y／面板高度随 displayHeight 变化」**两处都不可用**：
  //   panelH 未夹值 = 20+24+16+24+16+88+20+24 = 232 < PANEL_MIN_HEIGHT 280 ⇒ 被 :277 夹回 280，
  //   panelY 恒 260、container 也不位移（子件走绝对坐标）——displayHeight 的影响被夹掉了。
  // 未被夹的下游量只有 :315/:319 两行（正文 y 累加 titleH、倒计时 y 再累加 bodyH；:311 标题 y 只当基线用），
  // 故哨兵钉这三处＋一条 toggle 反向对照。
  // 判别力自证见 result：把 :39 的 makeFakeTextSized(24) 改 18 ⇒ 后两条期望值各减 6/12，断言当场红。
  it('布局哨兵：title/body/倒计时的 y 逐层累加 displayHeight（夹具 24→其它值即红）', () => {
    triggerEvent(store, modal, EVT_CHOICE.id); // EVENT_TRIGGERED → handleTriggered → layout()（EventModal.ts:153）
    const t = modal as unknown as {
      titleText: ReturnType<typeof makeFakeTextSized>;
      bodyText: ReturnType<typeof makeFakeTextSized>;
      countdownText: ReturnType<typeof makeFakeTextSized>;
      toggleText: ReturnType<typeof makeFakeTextSized>;
    };
    // panelX=443=floor((1366-480)/2)、panelY=260=floor((800-280)/2)、padding=20、sectionGap=16、imgBlock=0
    // 反向对照放**最前**：vitest 在本例首个失败处即中止，排在前面才能在变异态下被执行到，
    // 从而实测"不含 displayHeight 的坐标不动"（toggle 走右上角常量：443+480-64+28=887、260+12+11=283）。
    expect(t.toggleText.setPosition).toHaveBeenLastCalledWith(887, 283);
    expect(t.titleText.setPosition).toHaveBeenLastCalledWith(463, 280);
    expect(t.bodyText.setPosition).toHaveBeenLastCalledWith(463, 320); // 280 + titleH(24) + 16
    expect(t.countdownText.setPosition).toHaveBeenLastCalledWith(463, 348); // 320 + bodyH(24) + 4
  });

  // ---- c927-74：PANEL_MIN/MAX 被夹分支看守（收 c924-03 遗留1，生产码零改动）----
  // c924-03 只收了「未被夹的下游累加」，因为它那枚 24 正文夹具下 panelH_raw=232 恒被 :277 夹回
  // PANEL_MIN_HEIGHT(280) ⇒ panelY 恒 260、面板几何对 displayHeight 完全失明 ⇒
  // 上游原判据「面板高度随 displayHeight 变」当时不可断。此处按遗留建议**加第二/第三枚夹具**（大正文）
  // 把 panelH_raw 推到 280 之上，让 :277 的两侧夹值各成一条可断分支：
  //   下限之上（raw ∈ (280,520]）⇒ panelH/panelY **随** displayHeight 变；
  //   上限（raw > 520）⇒ panelH **封顶 520**、面板几何对 displayHeight 再次失明（子件不受夹，见例2 注）。
  // 现行为公式（无插画 ⇒ imgBlock=0；EVT_CHOICE 两枚选项 ⇒ buttonsH=2*40+8=88）：
  //   panelH_raw = 20 + 0 + N + 16 + N + 16 + 88 + 20 + 24 = 2N + 184   （EventModal.ts:276）
  //   panelY = floor((800 - panelH)/2)、panelX = floor((1366-480)/2) = 443      （:279-280）

  /** 另起一套 scene/store/modal 并触发事件（describe 级 beforeEach 那套恒为 24 正文，见 :26 工厂注释）。 */
  function modalWithTextSize(textSize: number) {
    const sc = makeFakeScene({ width: 1366, height: 800 }, textSize);
    const st = makeStore([EVT_CHOICE, EVT_NOTIFY]);
    const mo = new EventModal(sc, st);
    triggerEvent(st, mo, EVT_CHOICE.id);
    return {
      mo,
      gfx: panelBgOf(mo),
      t: mo as unknown as {
        titleText: ReturnType<typeof makeFakeTextSized>;
        bodyText: ReturnType<typeof makeFakeTextSized>;
        countdownText: ReturnType<typeof makeFakeTextSized>;
        toggleText: ReturnType<typeof makeFakeTextSized>;
      },
      btns: buttonsOf(mo),
    };
  }

  it('被夹分支看守（下限之上）：正文加高使 panelH_raw 越过 280 后面板几何随 displayHeight 变（N=100／150 两夹具，24 夹具同例作反向对照）', () => {
    triggerEvent(store, modal, EVT_CHOICE.id); // describe 级 24 夹具：raw=232 ⇒ 被下限夹回 280
    const a = modalWithTextSize(100); // raw=384 ∈ (280,520] ⇒ 未被夹 ⇒ panelH=384、panelY=208
    const b = modalWithTextSize(150); // raw=484 ⇒ panelH=484、panelY=158

    // 反向对照置前：两枚大夹具之间高度差 **恰等于** 正文差 2*(150-100)=100（displayHeight 进 panelH 两次）
    expect(a.gfx.fillRect).toHaveBeenLastCalledWith(443, 208, 480, 384);
    expect(b.gfx.fillRect).toHaveBeenLastCalledWith(443, 158, 480, 484);
    // 而被夹段（24 夹具）恒 280／panelY 恒 260 ⇒ 同一段代码的两侧分支不可能互换
    expect(panelBgOf(modal).fillRect).toHaveBeenLastCalledWith(443, 260, 480, 280);

    // panelY 参与的子件坐标逐层钉住（变异自证见 result：动 :276 的 countdown 预留 ⇒ 只本例红）
    expect(a.t.titleText.setPosition).toHaveBeenLastCalledWith(463, 228); // 208 + padding(20)
    expect(a.t.bodyText.setPosition).toHaveBeenLastCalledWith(463, 344); // 228 + titleH(100) + gap(16)
    expect(a.t.countdownText.setPosition).toHaveBeenLastCalledWith(463, 448); // 344 + bodyH(100) + 4
    expect(a.t.toggleText.setPosition).toHaveBeenLastCalledWith(887, 231); // 右上角：443+480-64+28、208+12+11
    expect(a.btns[0]!.zone.setPosition).toHaveBeenLastCalledWith(463, 484); // 208+384-20-88（底部按钮区随 panelH）
    expect(b.t.titleText.setPosition).toHaveBeenLastCalledWith(463, 178); // 158 + 20
    expect(b.btns[0]!.zone.setPosition).toHaveBeenLastCalledWith(463, 534); // 158+484-20-88
  });

  it('被夹分支看守（上限封顶）：raw>520 时面板几何对 displayHeight 失明（N=200／300 面板矩形全等）——c930-14 起子件跟夹：countdown 落在面板内（bodyH 按剩余预算收口）', () => {
    const c = modalWithTextSize(200); // raw=584 ⇒ min(520,·) ⇒ panelH=520、panelY=140
    const d = modalWithTextSize(300); // raw=784 ⇒ 同样封顶 520、panelY=140

    // 夹住的是**面板**：两枚相差 100 正文高度的夹具，面板矩形与内框逐字全等 ⇒ 上限分支对 displayHeight 失明
    expect(c.gfx.fillRect).toHaveBeenLastCalledWith(443, 140, 480, 520);
    expect(d.gfx.fillRect).toHaveBeenLastCalledWith(443, 140, 480, 520);
    expect(c.gfx.strokeRect).toHaveBeenLastCalledWith(447, 144, 472, 512); // 内框 :296（最后一次 strokeRect）
    expect(d.gfx.strokeRect).toHaveBeenLastCalledWith(447, 144, 472, 512);
    // c930-14 案①（子件跟着夹）：bodyH 按夹后剩余预算收口 ⇒ countdown 不再越面板底（旧钉 580/780 均越 660）
    //   预算＝520−(20+titleH+16+16+88+20+24)：N=200 ⇒ bodyHEff=136、N=300 ⇒ 36；bodyText 只随 titleH（不夹）原位
    expect(c.t.bodyText.setPosition).toHaveBeenLastCalledWith(463, 376); // 140+20 + 200 + 16（titleH 未夹，原位）
    expect(c.t.countdownText.setPosition).toHaveBeenLastCalledWith(463, 516); // 376 + bodyHEff(136) + 4
    expect(d.t.bodyText.setPosition).toHaveBeenLastCalledWith(463, 476); // 160 + 300 + 16
    expect(d.t.countdownText.setPosition).toHaveBeenLastCalledWith(463, 516); // 476 + bodyHEff(36) + 4
  });
});
