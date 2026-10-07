/**
 * c1001-01（重落 c927-07）：三入口键盘支持的行为钉桩——逐入口**真触发生产回调**，
 * 不靠源码正则。三组：
 *   ① ModeSelectScene：UP/DOWN 移光标（复用 hovered 高亮）＋ENTER 确认（与点卡片同一函数）＋shutdown 1:1 解绑；
 *   ② IntroScene：input autofocus＋显式 focus＋ENTER→tryStart（守卫同源）＋shutdown 1:1 解绑；
 *   ③ EventModal：数字键 1..N 选中（不结算）＋ENTER 确认（未选中不动作）＋关闭路径统一解绑＋9 枚越界护栏。
 * phaser mock 用共享 fakeScene 的 sceneClassMock（fakeScene.ts 本班零触碰）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { ModeSelectScene } from '../ModeSelectScene';
import { IntroScene } from '../IntroScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { makeFakeContainer, makeFakeGraphics, makeFakeTextSized, makeFakeZone, sceneClassMock } from '../../ui/__tests__/fakeScene';
import { EventModal } from '../../ui/EventModal';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { CourtEvent } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';

type KbMock = ReturnType<typeof vi.fn>;

const { registryStore, sceneStart } = sceneClassMock;

/** 从类式 mock 的 input.keyboard.on/off 调用记录里取某事件名的回调（scene 收 unknown＝兼容 Phaser 真型与 mock）。 */
function kbCalls(scene: unknown, ev: string) {
  const kb = (scene as { input?: { keyboard?: unknown } }).input?.keyboard as unknown as { on: KbMock; off: KbMock };
  const on = kb.on.mock.calls.filter((c: unknown[]) => c[0] === ev).map((c: unknown[]) => c[1] as () => void);
  const off = kb.off.mock.calls.filter((c: unknown[]) => c[0] === ev).map((c: unknown[]) => c[1] as () => void);
  return { on, off };
}
function fireKb(scene: unknown, ev: string): void {
  const { on } = kbCalls(scene, ev);
  expect(on.length, `keydown 事件 ${ev} 应已绑定`).toBeGreaterThan(0);
  on[on.length - 1]!();
}

// ═══ ① ModeSelectScene ═══

describe('键盘入口①择途屏 ModeSelectScene', () => {
  let scene: ModeSelectScene;

  beforeEach(() => {
    registryStore.clear();
    sceneStart.mockClear();
    scene = new ModeSelectScene();
    scene.create();
  });

  it('create 恰挂 UP/DOWN/ENTER 三键（键盘面与指针面并存）', () => {
    expect(kbCalls(scene, 'keydown-UP').on).toHaveLength(1);
    expect(kbCalls(scene, 'keydown-DOWN').on).toHaveLength(1);
    expect(kbCalls(scene, 'keydown-ENTER').on).toHaveLength(1);
  });

  it('光标初值 null（进屏未动不默认高亮任何卡）', () => {
    expect((scene as unknown as { keyboardCursor: unknown }).keyboardCursor).toBeNull();
  });

  it('UP：光标落 sandbox 卡（hovered 高亮）', () => {
    fireKb(scene, 'keydown-UP');
    const cards = scene as unknown as { keyboardCursor: string; sandboxCard: { hovered: boolean }; storyCard: { hovered: boolean } };
    expect(cards.keyboardCursor).toBe('sandbox');
    expect(cards.sandboxCard.hovered).toBe(true);
    expect(cards.storyCard.hovered).toBe(false);
  });

  it('DOWN：光标落 story 卡且两卡互斥（sandbox 必灭）', () => {
    fireKb(scene, 'keydown-UP'); // 先 sandbox 再 story，验证互斥
    fireKb(scene, 'keydown-DOWN');
    const cards = scene as unknown as { keyboardCursor: string; sandboxCard: { hovered: boolean }; storyCard: { hovered: boolean } };
    expect(cards.keyboardCursor).toBe('story');
    expect(cards.storyCard.hovered).toBe(true);
    expect(cards.sandboxCard.hovered).toBe(false);
  });

  it('ENTER（光标 null）：落第一张＝沙盒（与点卡片同一 chooseSandbox）', () => {
    fireKb(scene, 'keydown-ENTER');
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('sandbox');
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });

  it('DOWN 后 ENTER：落故事（与点卡片同一 chooseStory）', () => {
    fireKb(scene, 'keydown-DOWN');
    fireKb(scene, 'keydown-ENTER');
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('story');
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });

  it('shutdown 三键 1:1 解绑（同函数同事件名）', () => {
    scene.shutdown();
    for (const ev of ['keydown-UP', 'keydown-DOWN', 'keydown-ENTER']) {
      const { on, off } = kbCalls(scene, ev);
      expect(off, ev).toHaveLength(1);
      expect(off[0]).toBe(on[0]);
    }
  });
});

// ═══ ② IntroScene ═══

/** EventModal 测试件同构的最小 store 装配（IntroScene 真链路需要 registry.store）。 */
function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}
function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
}

describe('键盘入口②立国屏 IntroScene', () => {
  beforeEach(() => {
    registryStore.clear();
    sceneClassMock.sceneStart.mockClear();
  });

  it('input HTML 含 autofocus（DOM 面声明）', () => {
    const scene = new IntroScene();
    scene.create();
    // createFromHTML 的实参＝inputHTML 字符串：从 add.dom 工厂的 mock.results 取回
    const domFn = (scene.add as unknown as { dom: KbMock }).dom;
    const domObj = domFn.mock.results[0]!.value as unknown as { createFromHTML: KbMock };
    const html = domObj.createFromHTML.mock.calls[0]![0] as string;
    expect(html).toContain('autofocus');
  });

  it('node 带 focus 时 create 显式调用（autofocus 对运行中注入节点不生效的真落点）', () => {
    const scene = new IntroScene();
    const focusFn = vi.fn();
    // 类式 mock 的 add.dom 每次新建内部 vi.fn：create 前换成本厂（node 带 focus）
    (scene.add as unknown as { dom: unknown }).dom = vi.fn(() => ({
      setOrigin: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      createFromHTML: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        node: { value: '', addEventListener: vi.fn(), removeEventListener: vi.fn(), focus: focusFn },
      })),
    }));
    scene.create();
    expect(focusFn).toHaveBeenCalledTimes(1);
  });

  it('ENTER：真链路 tryStart（合法邦名＋已选身份 → registry 双写 → GameScene）', () => {
    const store = makeStore();
    registryStore.set(REGISTRY_KEYS.store, store);
    registryStore.set(REGISTRY_KEYS.gameMode, 'story');
    const scene = new IntroScene();
    scene.create();
    const inner = scene as unknown as {
      countryInputDom: { node: { value: string } };
      selectIdentity: (id: string) => void;
    };
    inner.countryInputDom.node.value = '大夏';
    inner.selectIdentity('lord_minor');

    fireKb(scene, 'keydown-ENTER');

    expect(registryStore.get(REGISTRY_KEYS.countryName)).toBe('大夏');
    expect(registryStore.get(REGISTRY_KEYS.identity)).toBe('lord_minor');
    expect(registryStore.get(REGISTRY_KEYS.introDone)).toBe(true);
    expect(sceneClassMock.sceneStart).toHaveBeenCalledWith('GameScene');
  });

  it('ENTER 守卫同源：未选身份时按 ENTER 不推进', () => {
    const store = makeStore();
    registryStore.set(REGISTRY_KEYS.store, store);
    const scene = new IntroScene();
    scene.create();
    (scene as unknown as { countryInputDom: { node: { value: string } } }).countryInputDom.node.value = '大夏';
    fireKb(scene, 'keydown-ENTER');
    expect(registryStore.get(REGISTRY_KEYS.introDone)).toBeUndefined();
    expect(sceneClassMock.sceneStart).not.toHaveBeenCalled();
  });

  it('shutdown ENTER 1:1 解绑（同函数同事件名）', () => {
    const scene = new IntroScene();
    scene.create();
    scene.shutdown();
    const { on, off } = kbCalls(scene, 'keydown-ENTER');
    expect(off).toHaveLength(1);
    expect(off[0]).toBe(on[0]);
  });
});

// ═══ ③ EventModal ═══

/**
 * 本地键盘记录型 fake scene＝EventModal.test.ts 的 makeFakeScene 共享 builder 组
 * （makeFakeContainer/graphics/zone/text 记值语义同源）＋ `input.keyboard` 记录面扩挂。
 * fakeScene.ts 共享件本体零触碰（在册待裁决件），本件只 import 其工厂。
 */
function makeKbScene() {
  const scene = {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => makeFakeContainer()),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(() => makeFakeTextSized(24)), // displayHeight 24 是 EventModal 布局输入（同 EventModal.test.ts 夹具口径）
      zone: vi.fn(makeFakeZone),
    },
    registry: { get: vi.fn().mockReturnValue(undefined) },
    input: { keyboard: { on: vi.fn(), off: vi.fn() } },
  };
  return scene as never as {
    scale: { width: number; height: number };
    add: Record<string, KbMock>;
    registry: { get: KbMock };
    input: { keyboard: { on: KbMock; off: KbMock } };
  };
}

const EVT_TWO: CourtEvent = {
  id: 'evt_kb_two',
  tags: ['抉择'],
  triggers: [],
  contexts: [{ condition: 'default', title: '邻邦遣使', desc: '齐使持璧来朝。', descPlain: '齐使来访。' }],
  choices: [
    { text: '设宴', textPlain: '答应结盟。', effects: [], removeEffects: [] },
    { text: '却之', textPlain: '婉拒。', effects: [], removeEffects: [] },
  ],
  defaultTimeoutDays: 7,
};

function kbEvent(n: number): CourtEvent {
  return { ...EVT_TWO, id: `evt_kb_${n}`, choices: Array.from({ length: n }, (_, i) => ({ text: `选${i + 1}`, textPlain: `选${i + 1}`, effects: [], removeEffects: [] })) };
}

describe('键盘入口③朝议模态 EventModal', () => {
  let scene: ReturnType<typeof makeKbScene>;
  let store: GameStore;
  let modal: EventModal;

  beforeEach(() => {
    scene = makeKbScene();
    const ee = new EventEmitter() as unknown as IEventEmitter;
    store = new GameStore(ee, { worldMap: allPlainMap() }, { events: [EVT_TWO] });
    modal = new EventModal(scene as never, store);
  });

  function trigger(eventId: string): void {
    const st = (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } }).state;
    st.pendingEventId = eventId;
    st.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId });
    expect(modal.isVisible()).toBe(true);
  }
  function boundEvents(): string[] {
    return (scene.input.keyboard.on as KbMock).mock.calls.map((c: unknown[]) => c[0] as string);
  }

  it('两选项事件：绑定全集恰 {ONE,TWO,ENTER}（N＝实有按钮数，不预绑 9 枚）', () => {
    trigger('evt_kb_two');
    const evs = new Set(boundEvents());
    expect([...evs].sort()).toEqual(['keydown-ENTER', 'keydown-ONE', 'keydown-TWO']);
  });

  it('数字键选中：改光标并 GOLD 高亮，但不结算（两步式防误触）', () => {
    trigger('evt_kb_two');
    const kb = scene.input.keyboard as unknown as { on: KbMock };
    const one = kb.on.mock.calls.find((c: unknown[]) => c[0] === 'keydown-ONE')![1] as () => void;
    one();
    expect((modal as unknown as { keyboardChoiceIdx: number | null }).keyboardChoiceIdx).toBe(0);
    expect(store.getPendingEventId()).toBe('evt_kb_two'); // 未结算
    expect(modal.isVisible()).toBe(true);
  });

  it('ENTER 未按过数字键：什么都不做（不默认结掉第 0 格）', () => {
    trigger('evt_kb_two');
    const kb = scene.input.keyboard as unknown as { on: KbMock };
    (kb.on.mock.calls.find((c: unknown[]) => c[0] === 'keydown-ENTER')![1] as () => void)();
    expect(store.getPendingEventId()).toBe('evt_kb_two');
    expect(modal.isVisible()).toBe(true);
  });

  it('数字键后 ENTER：结该枚（resolveEvent(0)）且模态关闭', () => {
    trigger('evt_kb_two');
    const kb = scene.input.keyboard as unknown as { on: KbMock };
    (kb.on.mock.calls.find((c: unknown[]) => c[0] === 'keydown-ONE')![1] as () => void)();
    (kb.on.mock.calls.find((c: unknown[]) => c[0] === 'keydown-ENTER')![1] as () => void)();
    expect(store.getPendingEventId()).toBeNull();
    expect(modal.isVisible()).toBe(false);
  });

  it('resolve 关闭路径：数字键与 ENTER 全部 1:1 解绑（off 走运行值）', () => {
    trigger('evt_kb_two');
    const kb = scene.input.keyboard as unknown as { on: KbMock };
    (kb.on.mock.calls.find((c: unknown[]) => c[0] === 'keydown-ONE')![1] as () => void)();
    (kb.on.mock.calls.find((c: unknown[]) => c[0] === 'keydown-ENTER')![1] as () => void)();
    // resolveEvent 已在上一动作链内关掉模态
    const off = (scene.input.keyboard.off as KbMock).mock.calls.map((c: unknown[]) => c[0] as string);
    expect(off).toContain('keydown-ONE');
    expect(off).toContain('keydown-ENTER');
  });

  it('换档关闭路径（STATE_REPLACED）：键盘口同样全量解绑、重开后按新按钮数重绑', () => {
    trigger('evt_kb_two');
    const st = (store as unknown as { state: { pendingEventId: string | null } }).state;
    st.pendingEventId = null;
    store['emitter'].emit(STATE_EVENTS.STATE_REPLACED, undefined);
    expect(modal.isVisible()).toBe(false);
    const off = (scene.input.keyboard.off as KbMock).mock.calls.map((c: unknown[]) => c[0] as string);
    for (const ev of ['keydown-ONE', 'keydown-TWO', 'keydown-ENTER']) expect(off).toContain(ev);
  });

  it('越界护栏：10 选项事件只绑前 9 枚数字键＋ENTER，多出的格子保持只有鼠标口、不抛错', () => {
    const store10 = new GameStore(
      new EventEmitter() as unknown as IEventEmitter,
      { worldMap: allPlainMap() },
      { events: [kbEvent(10)] },
    );
    const modal10 = new EventModal(scene as never, store10);
    const st = (store10 as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } }).state;
    st.pendingEventId = kbEvent(10).id;
    st.pendingEventDayStart = 0;
    store10['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: kbEvent(10).id });
    expect(modal10.isVisible()).toBe(true);
    expect(modal10.getButtonCount()).toBe(10);
    const evs = boundEvents();
    for (const ev of ['keydown-ONE', 'keydown-TWO', 'keydown-THREE', 'keydown-FOUR', 'keydown-FIVE', 'keydown-SIX', 'keydown-SEVEN', 'keydown-EIGHT', 'keydown-NINE']) {
      expect(evs.filter(e => e === ev), ev).toHaveLength(1);
    }
    expect(evs.filter(ev => ev === 'keydown-ENTER')).toHaveLength(1);
  });
});
