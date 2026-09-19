// c920-05：ZoomControl characterization——三按钮回调（in/out/reset）对注入 renderer 的
// 调用与方向；renderer 缺失时静默。递归 Proxy stub 撑过 Phaser 依赖，零生产码改动。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoomControl } from '../ZoomControl';


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

/** 抓 createBtn 的 zone.on('pointerup') 回调：btnZoomIn/Out/Reset 各一条。 */
function makeZoomControl(renderer: any) {
  const captured: Record<string, () => void> = {};
  let label = '';
  const scene: AnyRec = {};
  scene.add = new Proxy({}, {
    get: (_t, p) => (..._a: unknown[]) => {
      const el: AnyRec = { add: vi.fn(), setVisible: vi.fn(), clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn(), lineStyle: vi.fn(), strokeRect: vi.fn(), setPosition: vi.fn() };
      el.setDepth = () => el;
      el.setOrigin = () => el;
      el.setInteractive = () => el;
      el.setText = (t: string) => { label = t; };
      el.on = (ev: string, fn: () => void) => {
        // zone 的 pointerup＝按钮回调；按 create 顺序标 in/out/reset
        if (ev === 'pointerup') {
          const key = captured.btnZoomIn === undefined ? 'btnZoomIn'
            : captured.btnZoomOut === undefined ? 'btnZoomOut' : 'btnReset';
          captured[key] = fn;
        }
        return el;
      };
      return el;
    },
  });
  scene.cameras = { main: { width: 1366, height: 800 } };
  scene.time = { addEvent: vi.fn() };
  const store = { on: vi.fn() };
  const getRenderer = vi.fn(() => renderer);
  new ZoomControl(scene as never, store as never, getRenderer);
  return { captured, getRenderer };
}

describe('ZoomControl characterization（c920-05）', () => {
  it('zoom in：setMapZoom(当前 × STEP)', () => {
    const renderer = { getMapZoom: () => 1.0, setMapZoom: vi.fn(), getMinZoom: () => 0.5, getMaxZoom: () => 4 };
    const { captured } = makeZoomControl(renderer);
    captured.btnZoomIn!();
    const factor = renderer.setMapZoom.mock.calls[0][0] as number;
    expect(factor).toBeGreaterThan(1);   // ×STEP（1.2）
  });

  it('zoom out：setMapZoom(当前 ÷ STEP)', () => {
    const renderer = { getMapZoom: () => 2.0, setMapZoom: vi.fn(), getMinZoom: () => 0.5, getMaxZoom: () => 4 };
    const { captured } = makeZoomControl(renderer);
    captured.btnZoomOut!();
    // 除以 STEP 后回读：与 in 的乘数互为逆（1.2 × / ÷ 互逆）
    expect(renderer.setMapZoom).toHaveBeenCalledWith(2.0 / 1.2);
  });

  it('reset：调 resetView（不碰 setMapZoom）', () => {
    const renderer = { getMapZoom: () => 2.0, setMapZoom: vi.fn(), resetView: vi.fn(), getMinZoom: () => 0.5, getMaxZoom: () => 4 };
    const { captured } = makeZoomControl(renderer);
    captured.btnReset!();
    expect(renderer.resetView).toHaveBeenCalledTimes(1);
    expect(renderer.setMapZoom).not.toHaveBeenCalled();
  });

  it('renderer 为 null：三按钮全部静默（不抛不调）', () => {
    const { captured, getRenderer } = makeZoomControl(null);
    expect(getRenderer).toBeDefined();
    expect(() => captured.btnZoomIn!()).not.toThrow();
    expect(() => captured.btnZoomOut!()).not.toThrow();
    expect(() => captured.btnReset!()).not.toThrow();
  });
});
