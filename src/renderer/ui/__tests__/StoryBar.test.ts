// c920-06：StoryBar characterization——订阅 5 事件、destroy 反注册 5 事件+幂等、
// 沙盒模式隐藏、refresh 章节名与距下章分支。递归 Proxy stub，零生产码改动。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STATE_EVENTS } from '../../state/gameStore';
import { StoryBar } from '../StoryBar';

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

const CHAPTERS = [
  { title: '序章 · 统一天下', advanceAfterDays: 3 },
  { title: '第一章 · 起势', advanceGoal: { kind: 'story_events', eventIds: ['ev1', 'ev2'] } },
  { title: '终章' },
];

vi.mock('../../data/storyChapters', () => ({
  chapterAt: (n: number) => CHAPTERS[n] ?? CHAPTERS[0],
}));

function makeBar(mode: 'story' | 'sandbox', flags: AnyRec) {
  const ons: Array<[string, () => void]> = [];
  const offs: string[] = [];
  const store: AnyRec = {
    getMode: () => mode,
    getStoryFlags: () => ({ chapter: 0, powerAxis: 0, resourceAxis: 0, ending: null, storyEventsTriggered: [], chapterStartDay: 0, ...flags }),
    getCurrentDay: () => 10,
    on: vi.fn((ev: string, fn: () => void) => ons.push([ev, fn])),
    off: vi.fn((ev: string) => offs.push(ev)),
  };
  const setTexts: string[] = [];
  const scene: AnyRec = { scale: { width: 1366 } };
  scene.add = new Proxy({}, {
    get: (_t, p) => (..._a: unknown[]) => {
      const el: AnyRec = {
        add: vi.fn(), destroy: vi.fn(), clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn(), lineStyle: vi.fn(),
        strokeRect: vi.fn(), lineBetween: vi.fn(), fillPoints: vi.fn(),
        setPosition: vi.fn(), setDepth: () => el, setOrigin: () => el, setScrollFactor: () => el,
        setText: (t: string) => { setTexts.push(t); },
        setVisible: (v: boolean) => { (el as AnyRec).__visible = v; return el; },
      };
      (el as AnyRec).__visible = true;
      Object.defineProperty(el, 'setText', {
        value: (t: string) => { setTexts.push(t); },
      });
      // container.setVisible 记录可见性
      if (!('__visible' in el)) (el as AnyRec).__visible = true;
      return el;
    },
  });
  const bar = new StoryBar(scene as never, store as never);
  // 取 container 的可见性（setVisible 捕获）
  const containerVisible = (bar as AnyRec).container?.__visible;
  return { bar, ons, offs, store, setTexts, containerVisible };
}

describe('StoryBar characterization（c920-06）', () => {
  it('构造订阅 5 个 STORY/DAY/STATE 事件', () => {
    const { ons } = makeBar('story', {});
    const evs = ons.map(([e]) => e);
    for (const ev of [STATE_EVENTS.STORY_CHAPTER_CHANGED, STATE_EVENTS.STORY_NARRATION, STATE_EVENTS.STORY_UNIFIED, STATE_EVENTS.DAY_TICK, STATE_EVENTS.STATE_REPLACED]) {
      expect(evs).toContain(ev);
    }
    expect(ons.length).toBe(5);
  });

  it('沙盒模式：getMode 非 story → container 隐藏', () => {
    const { containerVisible } = makeBar('sandbox', {});
    expect(containerVisible).toBe(false);
  });

  it('故事模式：refresh 出章节名与序章文案', () => {
    const { setTexts } = makeBar('story', { chapter: 0 });
    expect(setTexts.some(t => t.includes('序章 · 统一天下'))).toBe(true);
    expect(setTexts.some(t => t.includes('序章'))).toBe(true);
  });

  it('destroy 反注册 5 事件 + 幂等（二次 destroy 不再 off）', () => {
    const { bar, offs } = makeBar('story', { chapter: 0 });
    bar.destroy();
    expect(offs.length).toBe(5);
    bar.destroy();
    expect(offs.length).toBe(5);
  });
});
