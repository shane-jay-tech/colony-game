/**
 * c1002-08（c923-14 遗留第二批）：`centerOnTile` / `setMapZoom` 的 NaN 语义**现状记录桩**（一单一函数）。
 *
 * ⚠ 记录缺陷，不是认可缺陷（照 c923-14 panby 同族处理法）；NaN 语义裁决在 c922-15 材料档
 * 缺陷 3 的人工闸后，本单**零生产码改动**。夹具与 panby 同族同形（带状态相机＋哑件 GO，
 * 用例间零共享态）；期望值全部来自当次实测（复现命令见 result），不从实现公式反算。
 */
import { describe, it, expect, vi } from 'vitest';
import { MapRenderer } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import type { WorldMap } from '../../data/mapSchema';

const NaN_V = Number.NaN;

function makeMap(w = 80, h = 80): WorldMap {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
}

/** 与 MapRenderer.panby-nan.test.ts 同一族方法表（render 面既有写法，零改共享件）。 */
function makeChainGO() {
  const chainable = vi.fn().mockReturnThis();
  const go: Record<string, unknown> = {
    x: 0, y: 0, width: 16, height: 16, displayWidth: 16, displayHeight: 16,
    visible: true, alpha: 1, text: '',
    destroy: vi.fn(),
    createGeometryMask: vi.fn(() => ({ destroy: vi.fn() })),
  };
  for (const m of [
    'clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
    'fillPoints', 'strokePoints', 'fillTriangle', 'strokeTriangle', 'beginPath', 'moveTo', 'lineTo',
    'closePath', 'strokePath', 'fillPath', 'fillRoundedRect', 'strokeRoundedRect', 'lineBetween',
    'generateTexture', 'setOrigin', 'setDepth', 'setVisible', 'setScrollFactor', 'setInteractive',
    'disableInteractive', 'setPosition', 'setScale', 'setSize', 'setDisplaySize', 'setRotation',
    'setAlpha', 'setTint', 'setFlipX', 'setFrame', 'setTexture', 'setName', 'setText', 'setColor',
    'setStyle', 'setFontSize', 'setLineSpacing', 'setWordWrapWidth', 'setPadding', 'setShadow',
    'setBlendMode', 'setMask', 'clearMask', 'setResolution', 'play', 'stop',
  ]) go[m] = chainable;
  return go;
}

function makeScene(camW: number, camH: number) {
  const cam = {
    width: camW, height: camH, zoom: 1, scrollX: 0, scrollY: 0,
    setZoom: vi.fn(function (this: { zoom: number }, z: number) { this.zoom = z; return this; }),
    setBackgroundColor: vi.fn(),
  };
  return {
    scene: {
      cameras: { main: cam },
      textures: { exists: vi.fn(() => false), get: vi.fn() },
      add: {
        graphics: vi.fn(makeChainGO), text: vi.fn(makeChainGO),
        image: vi.fn(makeChainGO), tileSprite: vi.fn(makeChainGO),
      },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
      time: { delayedCall: vi.fn(), addEvent: vi.fn(() => ({ remove: vi.fn() })) },
      make: { geometryMask: vi.fn(() => ({ destroy: vi.fn() })) },
      load: { texture: vi.fn() },
      cache: { json: { get: vi.fn() }, audio: { exists: vi.fn(() => false) } },
      sound: { add: vi.fn(), play: vi.fn(), stop: vi.fn() },
      events: { once: vi.fn(), on: vi.fn(), off: vi.fn() },
      _cam: cam,
    },
    _cam: cam,
  } as never;
}

function makeAt(opts: { scrollX: number; scrollY: number; zoom?: number }): {
  renderer: MapRenderer; cam: { scrollX: number; scrollY: number; zoom: number };
} {
  const { scene, _cam } = makeScene(1366, 800) as unknown as {
    scene: never; _cam: { scrollX: number; scrollY: number; zoom: number };
  };
  _cam.scrollX = opts.scrollX;
  _cam.scrollY = opts.scrollY;
  _cam.zoom = opts.zoom ?? 1;
  const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap()));
  _cam.scrollX = opts.scrollX;
  _cam.scrollY = opts.scrollY;
  _cam.zoom = opts.zoom ?? 1;
  return { renderer, cam: _cam };
}

describe('c1002-08 centerOnTile NaN 语义现状记录桩（第二批·一单一函数）', () => {
  it('① NaN 入：scroll 双轴被 `|| 0` 洗零后 clamp（与 panBy 同族归零路；实测落点）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80 });
    a.renderer.centerOnTile(NaN_V, NaN_V);
    // 实测（复现命令见 result）：非 NaN 出、双轴同落 clamp 边界
    expect(Number.isNaN(a.cam.scrollX)).toBe(false);
    expect(Number.isNaN(a.cam.scrollY)).toBe(false);
    expect([a.cam.scrollX, a.cam.scrollY]).toEqual([0, 0]); // 实测值：clamp 后 0/0
  });

  it('② 单轴 NaN：双轴一起遭殃（scrollX 公式吃 gy 的 NaN 同样产出 NaN → 归零路）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80 });
    a.renderer.centerOnTile(NaN_V, 40);
    expect(Number.isNaN(a.cam.scrollX)).toBe(false);
    expect(Number.isNaN(a.cam.scrollY)).toBe(false);
    expect([a.cam.scrollX, a.cam.scrollY]).toEqual([0, 0]); // 实测值
  });

  it('③ ±Infinity 入：truthy 不被 `|| 0` 洗，由 clamp 顶到边界（与 NaN 不同路）', () => {
    const inf = makeAt({ scrollX: 100, scrollY: 80 });
    inf.renderer.centerOnTile(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
    expect(Number.isFinite(inf.cam.scrollX)).toBe(true);
    expect(Number.isFinite(inf.cam.scrollY)).toBe(true);
    const nan = makeAt({ scrollX: 100, scrollY: 80 });
    nan.renderer.centerOnTile(NaN_V, NaN_V);
    expect([inf.cam.scrollX, inf.cam.scrollY]).not.toEqual([nan.cam.scrollX, nan.cam.scrollY]);
  });

  it('④b NaN zoom 入 centerOnTile：`(cam.zoom) || 1` 洗成 1（panby ③ 同型第二入口；变异守卫例）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80, zoom: NaN_V });
    a.renderer.centerOnTile(40, 40);
    // 实测：除的是 z=1（NaN 被 || 1 洗掉）；相机盘上 zoom 原样留 NaN（centerOnTile 不回写）
    expect(Number.isNaN(a.cam.scrollX)).toBe(false);
    expect(Number.isFinite(a.cam.scrollX)).toBe(true);
    expect(a.cam.zoom).toBe(NaN_V);
    const b = makeAt({ scrollX: 100, scrollY: 80, zoom: 2 });
    b.renderer.centerOnTile(40, 40);
    expect(b.cam.scrollX).not.toBe(a.cam.scrollX); // 真 zoom=2 除 2，落点不同 ⇒ ④b 真测到了 z 的取值
  });

  it('④ 正常入对照：clamp 区间内照常落 isoCenter（桩的判别力自证）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80 });
    a.renderer.centerOnTile(40, 40);
    expect(a.cam.scrollX).not.toBe(0);
    expect(Number.isFinite(a.cam.scrollX)).toBe(true);
  });
});

describe('c1002-08 setMapZoom NaN 语义现状记录桩（第二批·一单一函数）', () => {
  it('⑤ NaN zoom 入：clampZoom 的 isFinite 守卫接住 → 返回 1；oldZoom=1 时早退不触碰 scroll（守卫在位面）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80 }); // zoom=1
    const ret = a.renderer.setMapZoom(NaN_V);
    expect(ret).toBe(1); // 实测：oldZoom=1 ⇒ |1-1|<1e-4 早退返回 oldZoom
    expect(a.cam.zoom).toBe(1);
    expect([a.cam.scrollX, a.cam.scrollY]).toEqual([100, 80]); // 早退路零触碰
  });

  it('⑥ 非零 oldZoom 下 NaN 入：clampZoom 回 1 与 oldZoom 差超阈 → 走 anchor 面；NaN 锚点回退视口中心（DeepSeek 复审守卫）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80, zoom: 2 });
    const ret = a.renderer.setMapZoom(NaN_V, NaN_V, NaN_V); // zoom 与锚点双 NaN
    expect(ret).toBe(1); // 实测：clampZoom(NaN)→1
    expect(a.cam.zoom).toBe(1); // setZoom 真被回写
    expect(Number.isFinite(a.cam.scrollX)).toBe(true);
    expect(Number.isFinite(a.cam.scrollY)).toBe(true);
  });

  it('⑦ 正常入对照：clamp 区间内 zoom 照常生效（桩的判别力自证）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80 });
    const ret = a.renderer.setMapZoom(1.5);
    expect(ret).toBeGreaterThan(1);
    expect(a.cam.zoom).toBe(ret);
  });
});
