/**
 * c923-14：`MapRenderer.panBy`（`src/renderer/render/MapRenderer.ts:284`）的 NaN 语义**现状记录桩**。
 *
 * ⚠ 本文件是**记录缺陷，不是认可缺陷**（照 c922-12 对 `dayToCalendar` NaN 的记录式处理法，
 * 见 `state/__tests__/calendar.test.ts:80` 的「⑤ NaN 现状钉桩（记录缺陷，不是认可）」）。
 * 加守卫＝改变现行为（c922-15 材料第四节缺陷 3 的两条路之一），**裁决另单**；
 * 本单按「照抄」路线钉现状，**零生产码改动**（`MapRenderer.ts` 的 `git diff --numstat` 为 0）。
 *
 * 现场复算得出的实际语义（与"NaN 入 → NaN 出"这一常见预期**不同**，故先写在这里）：
 *   panBy 先写 `cam.scrollX = (cam.scrollX || 0) - dx / z` → 该值变成 NaN；
 *   紧接着 `clampScroll()` 读的是 `(cam.scrollX as number | undefined) || 0`，
 *   而 **NaN 是 falsy** ⇒ NaN 被洗成 **0** 才进 `clampScrollFor`。
 *   ⇒ 净效果不是"相机变 NaN"，而是**已有 scroll 被连锅归零**（画面表现为瞬移到 clamp 后的位置），
 *     且**不抛错、不告警**，用户与日志都拿不到任何信号。
 * 另：`±Infinity` 是 truthy，**不走**这条归零路，而是被 clamp 顶到边界 ⇒ 两路语义不同，一并钉住。
 *
 * 夹具口径：沿用 `MapRenderer.test.ts:513 makeZoomScene` 的带状态相机形态（本仓 render 面既有写法，
 * 零改共享件；`MapRenderer.ts:1` 的顶层 `import Phaser from 'phaser'` 在本仓测试环境下无需 `vi.mock`）。
 */
import { describe, it, expect, vi } from 'vitest';
import { MapRenderer } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import type { WorldMap } from '../../data/mapSchema';

const NaN_V = Number.NaN;

function makeMap(w = 80, h = 80): WorldMap {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
}

/**
 * 本单只用相机的 scroll/zoom 三个数，GameObject 全是"让它构造得起来"的哑件，故取
 * `MapRenderer.test.ts:19 makeFakeGraphics` 与 `ui/__tests__/fakeScene.ts:173 makeChainable`
 * 两份既有方法表的并集（本仓 render/UI 面既有写法，零改共享件、不新造第三套语义）。
 */
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

/** 带状态的相机（panBy / clampScroll / refreshViewportMask 只读这三组数）＋ 缺图降级用的 textures。 */
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

/** 建一个 scroll/zoom 已知状态的 renderer（每次新建 ⇒ 用例之间零共享状态）。 */
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
  // 构造函数会自己居中/fit，故把它拉回本用例要的初始态（并复位 zoom）。
  _cam.scrollX = opts.scrollX;
  _cam.scrollY = opts.scrollY;
  _cam.zoom = opts.zoom ?? 1;
  return { renderer, cam: _cam };
}

describe('c923-14 MapRenderer.panBy NaN 语义现状记录桩（记录缺陷，裁决另单）', () => {
  it('① 主桩：NaN 入 → **不是** NaN 出，而是"已有 scroll 被归零后 clamp"（记录缺陷）', () => {
    // 初始态 scrollX=100 / scrollY=80（非零，才看得出"归零"这件事）。
    const a = makeAt({ scrollX: 100, scrollY: 80 });
    a.renderer.panBy(NaN_V, NaN_V);
    expect(Number.isNaN(a.cam.scrollX)).toBe(false);   // ← 否证"NaN 出"
    expect(Number.isNaN(a.cam.scrollY)).toBe(false);
    expect(Number.isFinite(a.cam.scrollX)).toBe(true);

    // 等价面：与"先把 scroll 清 0、再零位移 panBy"逐位相同 ⇒ NaN 在 clamp 之前就被 `|| 0` 洗掉了。
    const b = makeAt({ scrollX: 0, scrollY: 0 });
    b.renderer.panBy(0, 0);
    expect({ x: a.cam.scrollX, y: a.cam.scrollY }).toEqual({ x: b.cam.scrollX, y: b.cam.scrollY });

    // 反面对照：NaN **不是**"保持原位"——正常零位移会从 100/80 出发。
    const c = makeAt({ scrollX: 100, scrollY: 80 });
    c.renderer.panBy(0, 0);
    expect(c.cam.scrollX).toBe(100);                   // 证明 clamp 区间容得下 100（⇒ ① 的跳变来自归零，不是 clamp 挤压）
    expect(c.cam.scrollY).toBe(80);
    expect(a.cam.scrollX).not.toBe(c.cam.scrollX);
    expect(a.cam.scrollY).not.toBe(c.cam.scrollY);
  });

  it('② 单轴 NaN 只污染该轴，另一轴照常按位移走（记录缺陷）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80 });
    a.renderer.panBy(NaN_V, 30);                       // dx=NaN，dy=30（zoom=1 ⇒ 期望 scrollY 位移 -30）
    const b = makeAt({ scrollX: 0, scrollY: 80 });
    b.renderer.panBy(0, 30);                           // x 轴"已被归零"后零位移；y 轴同起点同位移
    expect(a.cam.scrollX).toBe(b.cam.scrollX);         // x：NaN 路 == 归零路
    expect(a.cam.scrollY).toBe(b.cam.scrollY);         // y：不受 x 轴 NaN 影响
    expect(a.cam.scrollY).toBe(50);                    // 50 = 80 - 30，clamp 区间内不改写
    expect(Number.isNaN(a.cam.scrollX)).toBe(false);
  });

  it('③ NaN zoom 被 `(cam.zoom as …) || 1` 洗成 1（panBy 内的第二个 NaN 入口）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80, zoom: NaN_V });
    a.renderer.panBy(40, 20);                          // 位移按 z=1 算：100-40=60 / 80-20=60
    expect(a.cam.scrollX).toBe(60);
    expect(a.cam.scrollY).toBe(60);
    const b = makeAt({ scrollX: 100, scrollY: 80, zoom: 2 });
    b.renderer.panBy(40, 20);                          // 真 zoom=2 ⇒ 除 2：100-20=80 / 80-10=70
    expect(b.cam.scrollX).toBe(80);
    expect(b.cam.scrollY).toBe(70);
    expect(a.cam.zoom).toBe(NaN_V);                    // 相机上的 NaN zoom **原样留在盘上**（panBy 不回写 zoom）
  });

  it('④ ±Infinity 与 NaN 不同路：truthy 不被 `|| 0` 洗，由 clamp 顶到边界（记录缺陷的不对称面）', () => {
    const inf = makeAt({ scrollX: 100, scrollY: 80 });
    inf.renderer.panBy(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    const nan = makeAt({ scrollX: 100, scrollY: 80 });
    nan.renderer.panBy(NaN_V, NaN_V);
    expect(Number.isFinite(inf.cam.scrollX)).toBe(true);   // 也不是 NaN——被 clamp 收到边界
    expect(Number.isFinite(inf.cam.scrollY)).toBe(true);
    expect(inf.cam.scrollX).not.toBe(nan.cam.scrollX);    // ⇒ 两条脏值路径落点不同：守卫若用 isFinite 一并拦，会改变其中之一
    expect(inf.cam.scrollY).not.toBe(nan.cam.scrollY);
  });

  it('⑤ destroyed 短路面在位：destroy() 后喂 NaN，相机三个字段一字不变（现状钉，非缺陷）', () => {
    const a = makeAt({ scrollX: 100, scrollY: 80 });
    a.renderer.destroy();
    expect(() => a.renderer.panBy(NaN_V, NaN_V)).not.toThrow();
    expect({ x: a.cam.scrollX, y: a.cam.scrollY, z: a.cam.zoom }).toEqual({ x: 100, y: 80, z: 1 });
  });
});
