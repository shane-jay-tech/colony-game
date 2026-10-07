// l1007-05：T8 随机 1000 点逆对测试（c1002-23 遗留接腿）。
// 前置核查：worldFromScreen 生产/桩均不存在；但 iso.ts 已有生产逆 isoToGridF——
// 最小提取＝screen→world（screen/zoom + scroll）→ 减 origin → isoToGridF → grid。
// 零生产码改动；随机种子固定可复算。
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MapRenderer } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import { isoToGridF } from '../iso';

function makeMap() {
  const tiles = [];
  for (let i = 0; i < 32 * 32; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 32, height: 32, tiles, resourceNodes: [], seed: 0 };
}

function makeRenderer(camW = 1366, camH = 800) {
  const cam = {
    width: camW, height: camH, zoom: 1, scrollX: 0, scrollY: 0,
    setZoom: function (z: number) { this.zoom = z; return this; },
    setOrigin: function (x: number, y: number) { return this; },
    setBackgroundColor: () => {},
  };
  const graphics = new Proxy({}, { get: () => () => graphics });
  const scene = {
    cameras: { main: cam },
    textures: { exists: () => false, get: () => null },
    add: { graphics: () => graphics, image: () => graphics, tileSprite: () => graphics, container: () => ({ setScrollFactor: () => scene, setDepth: () => scene }) },
    tweens: { add: () => ({ stop: () => {} }) },
    time: { delayedCall: () => {}, addEvent: () => ({ remove: () => {} }) },
    make: { geometryMask: () => ({ destroy: () => {} }) },
    load: { texture: () => {} },
    cache: { json: { get: () => null }, audio: { exists: () => false } },
    sound: { add: () => ({ play: () => {} }), play: () => {}, stop: () => {} },
    events: { once: () => {}, on: () => {}, off: () => {} },
  };
  const renderer = new MapRenderer(scene as never, new WorldMapAccessor(makeMap()));
  return { renderer, cam };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('T8 随机 1000 点逆对（screen→world(grid)→screen，isoToGridF 生产逆）', () => {
  it('1000 点 × 3 相机态往返一致（grid 误差 <1e-6，screen 误差 <1e-6）', () => {
    const rnd = mulberry32(20261007);
    const states = [
      { zoom: 1, scrollX: 0, scrollY: 0 },
      { zoom: 2, scrollX: 137.5, scrollY: 64.25 },
      { zoom: 0.75, scrollX: -210.5, scrollY: 88 },
    ];
    for (const camState of states) {
      const { renderer, cam } = makeRenderer();
      cam.zoom = camState.zoom; cam.scrollX = camState.scrollX; cam.scrollY = camState.scrollY;
      // 现状桩口径：读真实 origin（构造期 computeOrigin 所设），inverse 必须与 forward 同源
      const originX = (renderer as unknown as { originX: number }).originX;
      const isoOffsetX = (renderer as unknown as { isoOffsetX: number }).isoOffsetX;
      const originY = (renderer as unknown as { originY: number }).originY;
      let worstGrid = 0, worstScreen = 0;
      for (let i = 0; i < 1000; i++) {
        const gx = rnd() * 32, gy = rnd() * 32;
        const s1 = renderer.gridToScreenPixel(gx, gy);
        const wx = s1.x / cam.zoom + cam.scrollX;
        const wy = s1.y / cam.zoom + cam.scrollY;
        // isoCenter 含 isoOffsetX（=(height-1)*ISO_HW）——逆变换须同扣，否则 gx/gy 各偏 ~16
        // gridCenterToIso = 顶点投影(gx+0.5, gy+0.5) ⇒ isoToGridF 结果须减 0.5 还原格中心
        const gf = isoToGridF(wx - originX - isoOffsetX, wy - originY);
        const g = { gx: gf.gx - 0.5, gy: gf.gy - 0.5 };
        worstGrid = Math.max(worstGrid, Math.abs(g.gx - gx), Math.abs(g.gy - gy));
        const s2 = renderer.gridToScreenPixel(g.gx, g.gy);
        worstScreen = Math.max(worstScreen, Math.abs(s2.x - s1.x), Math.abs(s2.y - s1.y));
      }
      const dbgO = renderer as unknown as { originX: number; originY: number; isoOffsetX: number };
      fs.writeFileSync('tmp/l1007_05_dbg.json', JSON.stringify({ camState, originX: dbgO.originX, isoOffsetX: dbgO.isoOffsetX, worstGrid }));
      expect(worstGrid).toBeLessThan(1e-6);
      expect(worstScreen).toBeLessThan(1e-6);
    }
  });
});

// l1007-37 生产提取：worldFromScreen（MapRenderer 公开方法）与桩组合逐位等价对平。
describe('l1007-37 worldFromScreen 生产提取（与桩组合等价）', () => {
  it('1000 点 × 3 相机态：worldFromScreen 输出与桩组合（手动链）逐位相等，且与 gridToScreenPixel 往返 <1e-6', () => {
    const rnd = mulberry32(20261007);
    const states = [
      { zoom: 1, scrollX: 0, scrollY: 0 },
      { zoom: 2, scrollX: 137.5, scrollY: 64.25 },
      { zoom: 0.75, scrollX: -210.5, scrollY: 88 },
    ];
    for (const camState of states) {
      const { renderer, cam } = makeRenderer();
      cam.zoom = camState.zoom; cam.scrollX = camState.scrollX; cam.scrollY = camState.scrollY;
      const originX = (renderer as unknown as { originX: number }).originX;
      const isoOffsetX = (renderer as unknown as { isoOffsetX: number }).isoOffsetX;
      const originY = (renderer as unknown as { originY: number }).originY;
      let worst = 0;
      for (let i = 0; i < 1000; i++) {
        const gx = rnd() * 32, gy = rnd() * 32;
        const s1 = renderer.gridToScreenPixel(gx, gy);
        const wx = s1.x / cam.zoom + cam.scrollX;
        const wy = s1.y / cam.zoom + cam.scrollY;
        // 桩组合（原手动链）
        const gf = isoToGridF(wx - originX - isoOffsetX, wy - originY);
        const stub = { gx: gf.gx - 0.5, gy: gf.gy - 0.5 };
        // 生产方法
        const prod = renderer.worldFromScreen(s1.x, s1.y);
        worst = Math.max(worst, Math.abs(prod.gx - stub.gx), Math.abs(prod.gy - stub.gy));
        const s2 = renderer.gridToScreenPixel(prod.gx, prod.gy);
        worst = Math.max(worst, Math.abs(s2.x - s1.x), Math.abs(s2.y - s1.y));
      }
      expect(worst).toBeLessThan(1e-6);
    }
  });
});
