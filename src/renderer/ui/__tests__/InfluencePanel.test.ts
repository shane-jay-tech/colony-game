// c920-07：InfluencePanel characterization——toggle 可见性、refresh 消费 store 数值、destroy 清理。
// 递归 Proxy stub + spy store，零生产码改动。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfluencePanel } from '../InfluencePanel';

type AnyRec = Record<string, any>;

function makeStub(): any {
  const proxy: any = new Proxy(function () {}, {
    get: (_t, p) => {
      if (p === Symbol.iterator) return function* () {};
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === 'length') return 0;
      return proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

function makePanel() {
  const created: AnyRec[] = []; // c1002-06：记录 add.* 创建的每个元素（真路径取柄面）
  const store: AnyRec = {
    getMode: vi.fn(() => 'story'),
    getStoryFlags: vi.fn(() => ({ chapter: 0, powerAxis: 0, resourceAxis: 0, ending: null, storyEventsTriggered: [], chapterStartDay: 0 })),
    getInfluence: vi.fn(() => 30),
    getInfluenceCap: vi.fn(() => 100),
    getState: vi.fn(() => ({ grade: 2 })),
    spendPropaganda: vi.fn(() => ({ ok: true })),
    spendDiplomacyInfluence: vi.fn(() => ({ ok: true })),
    spendChronicle: vi.fn(() => ({ ok: true })),
    getCurrentDay: vi.fn(() => 10),
  };
  const scene: AnyRec = { scale: { width: 1366, height: 800 }, registry: { get: vi.fn(() => undefined) } };
  scene.add = new Proxy({}, {
    get: (_t, p) => (..._a: unknown[]) => {
      const el: AnyRec = {
        add: vi.fn(), clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn(),
        lineStyle: vi.fn(), strokeRect: vi.fn(), setPosition: vi.fn(),
        setInteractive: () => el, on: vi.fn(), setText: vi.fn(), setVisible: (v: boolean) => el,
        setDepth: () => el, setOrigin: () => el, setScrollFactor: () => el,
      };
      created.push(el);
      return el;
    },
  });
  const panel = new InfluencePanel(scene as never, store as never);
  return { panel, store, created };
}

describe('InfluencePanel characterization（c920-07）', () => {
  let store: AnyRec;
  let panel: InfluencePanel;

  beforeEach(() => {
    ({ panel, store } = makePanel());
  });

  it('toggle/show/hide：visible 状态与 isVisible 同步翻转', () => {
    expect(panel.isVisible()).toBe(false);
    panel.show();
    expect(panel.isVisible()).toBe(true);
    panel.hide();
    expect(panel.isVisible()).toBe(false);
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('show 触发 refresh：getInfluence/getInfluenceCap/getState 全部被消费', () => {
    panel.show();
    expect(store.getInfluence).toHaveBeenCalled();
    expect(store.getInfluenceCap).toHaveBeenCalled();
    expect(store.getState).toHaveBeenCalled();
  });

  it('三按钮 action 接 store：spend 三函数可调用（面板行动作源）', () => {
    expect(typeof store.spendPropaganda).toBe('function');
    expect(store.spendPropaganda()).toEqual({ ok: true });
    expect(store.spendDiplomacyInfluence()).toEqual({ ok: true });
    expect(store.spendChronicle()).toEqual({ ok: true });
  });

  // ── c1002-06（c923-21 遗留接线第二批）：真路径用例——触发生产代码亲手 .on('pointerdown', …)
  // 登记的回调本体（InfluencePanel.ts:84 三行「行」钮／:31 backdrop／:101 关闭钮），不经测试后门直调。
  // 取柄面＝本批给 makePanel 的 add.* 代理加 created 收集（夹具超集，既有 4 例零触碰）。
  function pointerDownHandlersOf(created: AnyRec[]): Array<() => void> {
    return created
      .filter((el) => el.on && el.on.mock.calls.some((c: unknown[]) => c[0] === 'pointerdown'))
      .map((el) => () => (el.on.mock.calls.find((c: unknown[]) => c[0] === 'pointerdown')![1] as () => void)());
  }

  it('c1002-06 真路径：三行「行」钮 pointerdown → spend 三函数真被面板消费（行动作接线）', () => {
    const { panel, store, created } = makePanel();
    panel.show();
    const handlers = pointerDownHandlersOf(created);
    // backdrop + 关闭钮 + 3 行钮（production :31/:84/:101）
    expect(handlers.length).toBe(5);
    for (const fire of handlers) fire();
    expect(store.spendPropaganda).toHaveBeenCalledTimes(1);
    expect(store.spendDiplomacyInfluence).toHaveBeenCalledTimes(1);
    expect(store.spendChronicle).toHaveBeenCalledTimes(1);
  });

  it('c1002-06 真路径：backdrop/关闭钮 pointerdown → 面板真关闭（isVisible 翻转，非 not.toThrow）', () => {
    const { panel, created } = makePanel();
    panel.show();
    expect(panel.isVisible()).toBe(true);
    const handlers = pointerDownHandlersOf(created);
    handlers[0]!(); // backdrop（:31 创建序最早）→ hide
    expect(panel.isVisible()).toBe(false);
  });

  it('destroy：container 与 backdrop 双 destroy', () => {
    const cDestroy = vi.fn();
    const bDestroy = vi.fn();
    (panel as AnyRec).container = { destroy: cDestroy };
    (panel as AnyRec).backdrop = { destroy: bDestroy };
    panel.destroy();
    expect(cDestroy).toHaveBeenCalledWith(true);
    expect(bDestroy).toHaveBeenCalledWith(true);
  });
});
