// c920-04：BuildPanel characterization（601 行零测试 → 钉滚动计算/折叠事件/出界裁剪）。
// 手法：递归 Proxy 万能 stub 撑过 Phaser 重构造器，得到真实实例（箭头函数字段在位），
// 再覆写 rows/rowsAreaRect/layout 驱动 onWheel / onPanelCollapsed 纯逻辑。零生产码改动。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildPanel } from '../BuildPanel';

type Panel = Record<string, any>;

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

function makePanel(targetCount = 5): Panel {
  const scene = makeStub();
  const store = makeStub();
  const buildMode = makeStub();
  const panel = new BuildPanel(scene, store, buildMode) as Panel;
  // 覆写测试关注的字段：5 行、可视高 100（真实 onWheel/onPanelCollapsed 在位）
  panel.rows = Array.from({ length: targetCount }, (_, i) => ({ def: { id: `b${i}` } }));
  panel.rowsAreaRect = { x: 0, y: 0, w: 200, h: 100 };
  panel.rowsScrollY = 0;
  panel.layout = vi.fn();
  panel.store = {
    getPanelCollapsed: () => false,
    getBuildingUnlockInfo: () => ({ state: 'ok' }),
  };
  return panel;
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
