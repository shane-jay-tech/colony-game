/**
 * c927-46：MapRenderer 字号下限 12 与贴图缺失回退的边界行为钉桩（7b6a E 组读数续）
 *
 * 锚点漂移先留痕（w40-brief §3＋卷宗"有漂移则按磁盘实况修正并留痕"）：
 *   - 卷宗写 `MapRenderer.ts:738` 的 `fontPx` ⇒ **现值 :747**（c927-46 落钉时 :745；c930-08 再 +2），
 *     表达式逐字未变：`Math.max(12, Math.floor(Math.min(isoW, ISO_TILE_H * (wT + hT)) * 0.4))`；
 *   - 卷宗写 `:691` 的 `hasSprite` ⇒ 现值 **:693**（c927-46 落钉时仍在 :691，c930-08 +2）：
 *     `!!textures && typeof textures.exists === 'function' && textures.exists(def.assetKey)`；
 *   - 锚点引用的 `:772 t.setVisible(!hasSprite)` ⇒ 现值 **:775**（落钉时 :773，c930-08 +2）。
 *
 * 🔴 两条本件实测出来的结构读数（钉桩之前没人写过）：
 *   ① **`Math.min(isoW, ISO_TILE_H*(wT+hT))` 在现役 2:1 tile 下是恒等式**：
 *      `isoW = (wT+hT) * ISO_TILE_W/2`，而 `ISO_TILE_W/2 === ISO_TILE_H === 48`（`iso.ts:20-22`）
 *      ⇒ 两侧永远相等，那个 `min` 选不出边。字号下限因此**只由 footprint 的和**决定：
 *      `fontPx = max(12, floor(19.2 * (wT+hT)))`，钳位生效区间是 `wT+hT < 0.625`。
 *   ② **在册数据摸不到下限**：现役 BUILDINGS 最小 footprint 是 1×1（`wT+hT=2`）⇒ fontPx=38，
 *      钳位是**兜底**不是常态。 ⇒ "极小尺寸"只能用**替身 def** 才摸得到，本件因此用
 *      `vi.mock('../data/buildingRegistry')` 造合成 footprint（内存替身，产品码与数据文件零改动；
 *      `MapRenderer.ts:5` 只从这个模块取 `getBuildingDef` 一个具名，mock 对未知 id 全部透传原件）。
 *
 * 完成标准口径：字号下限 12 一组边界用例（0×0／和=0.6／和=0.625 阈值点／和=0.7 越界／现役 1×1~3×3）
 * ＋ 贴图缺失回退一组边界用例（exists 返回 false／textures 缺席／exists 非函数／assetKey 空串／
 * 命中原画／同槽位缺图↔有图切换／缺图与有图交错的池解耦）。只加测试，不改产品码。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

/** 替身 def：只填 MapRenderer 实际读的字段（size/assetKey/name/tier），其余按 never 透传。 */
const SYNTH = vi.hoisted(() => ({
  defs: {
    synth_zero: { id: 'synth_zero', name: '零点', tier: 1, assetKey: 'tex_missing_zero', size: { width: 0, height: 0 } },
    synth_below: { id: 'synth_below', name: '低于阈值', tier: 1, assetKey: 'tex_missing_below', size: { width: 0.3, height: 0.3 } },
    synth_at: { id: 'synth_at', name: '阈值点', tier: 1, assetKey: 'tex_missing_at', size: { width: 0.3125, height: 0.3125 } },
    synth_above: { id: 'synth_above', name: '刚越界', tier: 1, assetKey: 'tex_missing_above', size: { width: 0.35, height: 0.35 } },
    synth_empty_key: { id: 'synth_empty_key', name: '空键', tier: 1, assetKey: '', size: { width: 1, height: 1 } },
    synth_has_art: { id: 'synth_has_art', name: '有原画', tier: 1, assetKey: 'art_ok', size: { width: 2, height: 2 } },
  } as Record<string, unknown>,
}));

vi.mock('../../data/buildingRegistry', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../data/buildingRegistry')>();
  return {
    ...mod,
    getBuildingDef: (id: string): BuildingDef | undefined =>
      (SYNTH.defs[id] as BuildingDef | undefined) ?? mod.getBuildingDef(id),
  };
});

import { MapRenderer } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import type { WorldMap } from '../../data/mapSchema';
import type { BuildingDef, BuildingInstance } from '../../data/schema';
import { BUILDINGS } from '../../data/buildings';
import { ISO_TILE_H, ISO_TILE_W } from '../iso';
import { getBuildingDef } from '../../data/buildingRegistry';

// ---------------- 替身场景（本件自带，不动别人的 harness） ----------------

interface RecordedText {
  style: Record<string, unknown>;
  fontSize: number | null;
  visible: boolean;
  alpha: number;
  color: string;
  text: string;
  setVisible: Mock;
  setFontSize: Mock;
  setColor: Mock;
  setAlpha: Mock;
  setText: Mock;
  setPosition: Mock;
  setDepth: Mock;
  setOrigin: Mock;
  setMask: Mock;
  setStyle: Mock;
  clearMask: Mock;
  destroy: Mock;
}

function makeFakeGraphics() {
  const g: Record<string, Mock> = {};
  for (const m of ['clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
    'fillPoints', 'strokePoints', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'strokePath', 'fillPath',
    'fillRoundedRect', 'strokeRoundedRect', 'lineBetween', 'generateTexture', 'setPosition', 'setVisible',
    'setScrollFactor', 'setDepth', 'setAlpha', 'setInteractive', 'setMask', 'clearMask', 'setBlendMode']) {
    g[m] = vi.fn(() => g);
  }
  g.createGeometryMask = vi.fn(() => ({ destroy: vi.fn() }));
  g.destroy = vi.fn();
  return g;
}

function makeFakeText(x: number, y: number, content: string, style: Record<string, unknown>): RecordedText {
  const t: RecordedText = {
    style, fontSize: null, visible: true, alpha: 1, color: '', text: '',
    setOrigin: vi.fn(() => t),
    setPosition: vi.fn(() => t),
    setVisible: vi.fn((v: boolean) => { t.visible = v; return t; }),
    setText: vi.fn((s: string) => { t.text = s; return t; }),
    setAlpha: vi.fn((a: number) => { t.alpha = a; return t; }),
    setStyle: vi.fn((s: Record<string, unknown>) => { Object.assign(t.style, s); return t; }),
    setFontSize: vi.fn((n: number) => { t.fontSize = n; return t; }),
    setColor: vi.fn((c: string) => { t.color = c; return t; }),
    setDepth: vi.fn(() => t),
    setMask: vi.fn(() => t),
    clearMask: vi.fn(() => t),
    destroy: vi.fn(),
  };
  t.text = content;
  void x; void y;
  return t;
}

function makeFakeImage(key: string) {
  const im: Record<string, unknown> = {
    key, width: 256, height: 256, visible: true, alpha: 1,
    setOrigin: vi.fn(() => im), setPosition: vi.fn(() => im), setVisible: vi.fn((v: boolean) => { im.visible = v; return im; }),
    setAlpha: vi.fn((a: number) => { im.alpha = a; return im; }), setScale: vi.fn(() => im),
    setDepth: vi.fn(() => im), setTexture: vi.fn((k: string) => { im.key = k; return im; }),
    setMask: vi.fn(() => im), clearMask: vi.fn(() => im), setFlipX: vi.fn(() => im),
    setDisplaySize: vi.fn(() => im), setTint: vi.fn(() => im), setDestroy: vi.fn(), destroy: vi.fn(),
  };
  return im;
}

function makeFakeEmitter(): Record<string, unknown> {
  const em: Record<string, unknown> = { destroy: vi.fn(), start: vi.fn(), stop: vi.fn() };
  for (const m of ['setDepth', 'setPosition', 'setVisible', 'setScrollFactor', 'setAlpha', 'setFrequency']) {
    em[m] = vi.fn(() => em);
  }
  return em;
}

function makeFakeTileSprite(): Record<string, unknown> {
  const sp: Record<string, unknown> = { key: '', width: 256, height: 256, destroy: vi.fn() };
  for (const m of ['setOrigin', 'setMask', 'setDepth', 'setPosition', 'setAlpha', 'setScrollFactor', 'setVisible', 'setScale']) {
    sp[m] = vi.fn(() => sp);
  }
  return sp;
}

/** textures 面的四种形态（缺图回退的入口条件就是这三重守卫）。 */
type TexturesShape = { exists: (key: string) => boolean } | { exists: unknown } | undefined;

type GfxFake = ReturnType<typeof makeFakeGraphics>;
type ImgFake = ReturnType<typeof makeFakeImage>;

/** 本件自带的替身场景形状（`new MapRenderer()` 处按 never 传入，避免为 fake 复刻 Phaser.Scene 全表）。 */
interface FakeScene {
  cameras: { main: { width: number; height: number; scrollX: number; scrollY: number; zoom: number } };
  textures: TexturesShape;
  make: { graphics: Mock };
  add: { graphics: Mock; text: Mock; image: Mock; particles: Mock };
  tweens: { add: Mock };
  events: { on: Mock; off: Mock; once: Mock };
  _graphics: GfxFake[];
  _texts: RecordedText[];
  _images: ImgFake[];
}

function makeFakeScene(textures: TexturesShape | null = { exists: () => false }) {
  const graphics: ReturnType<typeof makeFakeGraphics>[] = [];
  const texts: RecordedText[] = [];
  const images: ReturnType<typeof makeFakeImage>[] = [];
  const scene = {
    cameras: { main: { width: 1366, height: 800, scrollX: 0, scrollY: 0, zoom: 1 } },
    textures,
    make: { graphics: vi.fn(() => makeFakeGraphics()) },
    add: {
      graphics: vi.fn(() => { const g = makeFakeGraphics(); graphics.push(g); return g; }),
      text: vi.fn((_x: number, _y: number, content: string, style: Record<string, unknown>) => {
        const t = makeFakeText(0, 0, content, style ?? {});
        texts.push(t);
        return t;
      }),
      image: vi.fn((_x: number, _y: number, key: string) => {
        const im = makeFakeImage(key);
        images.push(im);
        return im;
      }),
      particles: vi.fn(() => makeFakeEmitter()),
      tileSprite: vi.fn(() => makeFakeTileSprite()),
    },
    tweens: { add: vi.fn(() => ({ stop: vi.fn(), destroy: vi.fn() })) },
    events: { on: vi.fn(), off: vi.fn(), once: vi.fn() },
    _graphics: graphics,
    _texts: texts,
    _images: images,
  };
  if (textures === null) delete (scene as Record<string, unknown>).textures; // 真·缺席（传 undefined 会被默认参数吞掉，踩过）
  return scene as unknown as FakeScene;
}

/** 唯一需要"骗过 Phaser 类型"的构造点：fake 场景按 never 传入，取值仍走 FakeScene 形状。 */
function newRenderer(scene: FakeScene): MapRenderer {
  return new MapRenderer(scene as never, new WorldMapAccessor(makeMap()));
}

function makeMap(w = 8, h = 8): WorldMap {
  const tiles = Array.from({ length: w * h }, () => ({ terrain: 'plain' as const, buildable: true, walkable: true }));
  return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
}

/** buildingsGfx＝第 3 枚 graphics（terrain/nodes/buildings/hover/viewportMask 序，与现役 harness 同）。 */
function buildingsGfx(scene: FakeScene): ReturnType<typeof makeFakeGraphics> {
  return scene._graphics[2]!;
}

function instance(defId: string, x = 0, y = 0, status: BuildingInstance['status'] = 'working'): BuildingInstance {
  return {
    defId, position: { x, y }, status, tier: 1, constructionProgress: status === 'working' ? 100 : 10,
    modifiers: [],
  } as BuildingInstance;
}

function renderOne(scene: FakeScene, defId: string, x = 0): void {
  newRenderer(scene).rerenderBuildings([instance(defId, x, 0)]);
}

// ============================== A 组：字号下限 12 的边界 ==============================

/** 在册算式的独立复写（只用 iso 常量与 footprint 和），用来把 A 组各档的期望值算死。 */
function expectedFontPx(wT: number, hT: number): number {
  const isoW = (wT + hT) * (ISO_TILE_W / 2);
  return Math.max(12, Math.floor(Math.min(isoW, ISO_TILE_H * (wT + hT)) * 0.4));
}

/** 读第一枚沙印 text 的构造期 fontSize（"12px" 形态 ⇒ 数字）。 */
function firstSigilFontPx(scene: FakeScene): number {
  const t = scene._texts[0];
  expect(t, '沙印 text 一个都没建出来，本桩需同步').toBeDefined();
  const raw = (t as RecordedText).style.fontSize;
  expect(typeof raw, '沙印构造期没传 fontSize').toBe('string');
  return Number.parseInt(String(raw), 10);
}

describe('A 组 字号下限 12（MapRenderer.ts:745，卷宗写的 :738 已漂 7 行）', () => {
  it('A-0 前置恒等式：isoW 与 ISO_TILE_H×(wT+hT) 在 2:1 tile 下恒相等 ⇒ min 选不出边', () => {
    expect(ISO_TILE_W / 2).toBe(ISO_TILE_H); // 96/2 === 48
    for (const [wT, hT] of [[0, 0], [0.3, 0.3], [1, 1], [2, 2], [3, 3], [1, 2]] as const) {
      const isoW = (wT + hT) * (ISO_TILE_W / 2);
      expect(Math.min(isoW, ISO_TILE_H * (wT + hT))).toBe(isoW);
    }
  });

  it('A-1 极小尺寸：0×0（退化 footprint）⇒ 原始值 0 被钳到恰 12', () => {
    const scene = makeFakeScene();
    renderOne(scene, 'synth_zero');
    expect(expectedFontPx(0, 0)).toBe(12);
    expect(firstSigilFontPx(scene)).toBe(12);
  });

  it('A-2 阈值下沿：和=0.6（0.3+0.3）⇒ 原始 floor 11 ⇒ 钳位生效到 12', () => {
    const scene = makeFakeScene();
    renderOne(scene, 'synth_below');
    const isoW = 0.6 * (ISO_TILE_W / 2);
    expect(Math.floor(isoW * 0.4)).toBe(11); // 原始值确实是 11（不然钳位没被 exercising）
    expect(firstSigilFontPx(scene)).toBe(12);
  });

  it('A-3 阈值点：和=0.625 ⇒ 原始值恰 12 ⇒ 钳位与原始值相等（下限开始不起作用的那一格）', () => {
    const scene = makeFakeScene();
    renderOne(scene, 'synth_at');
    expect(expectedFontPx(0.3125, 0.3125)).toBe(12);
    expect(firstSigilFontPx(scene)).toBe(12);
  });

  it('A-4 阈值上沿：和=0.7 ⇒ 原始 13 ⇒ 字号脱离下限', () => {
    const scene = makeFakeScene();
    renderOne(scene, 'synth_above');
    expect(expectedFontPx(0.35, 0.35)).toBe(13);
    expect(firstSigilFontPx(scene)).toBe(13);
    expect(firstSigilFontPx(scene)).toBeGreaterThan(12);
  });

  it('A-5 现役数据摸不到下限：每枚在册建筑的 fontPx 都 > 12，且逐枚等于算式值', () => {
    const scene = makeFakeScene();
    const renderer = newRenderer(scene);
    renderer.rerenderBuildings(BUILDINGS.map(d => instance(d.id)));
    expect(scene._texts.length).toBe(BUILDINGS.length);
    const seen: number[] = [];
    BUILDINGS.forEach((d, i) => {
      const raw = scene._texts[i]!.style.fontSize;
      const got = Number.parseInt(String(raw), 10);
      expect(got, `${d.id} 字号`).toBe(expectedFontPx(d.size.width, d.size.height));
      expect(got).toBeGreaterThan(12);
      seen.push(got);
    });
    // 读数表用：现役 footprint 和的范围是 4..8 ⇒ 字号 76..153，**离下限 12 最少还有 64px 余量**
    // ⇒ 钳位在全部现役在册数据上永不生效（这就是"下限 12 是兜底、不是常态"的实测口径）。
    expect(Math.min(...seen)).toBe(76);
    expect(Math.max(...seen)).toBe(153);
    expect(Math.min(...seen) - 12).toBe(64);
  });

  it('A-6 复用槽位才走 setFontSize：同 footprint 重画不触发改字号，变 footprint 才改', () => {
    const scene = makeFakeScene();
    const renderer = newRenderer(scene);
    renderer.rerenderBuildings([instance('synth_below', 0)]); // 和=0.6 ⇒ 12
    const t = scene._texts[0]!;
    expect(t.fontSize).toBeNull(); // 构造期带 style，不该调 setFontSize
    renderer.rerenderBuildings([instance('synth_below', 0)]); // 同值 ⇒ 不调
    expect(t.setFontSize).not.toHaveBeenCalled();
    renderer.rerenderBuildings([instance('synth_above', 0)]); // 和=0.7 ⇒ 13 ⇒ 调一次
    expect(t.setFontSize).toHaveBeenCalledTimes(1);
    expect(t.fontSize).toBe(13);
    renderer.rerenderBuildings([instance('synth_zero', 0)]); // 掉回 0×0 ⇒ 钳到 12
    expect(t.setFontSize).toHaveBeenCalledTimes(2);
    expect(t.fontSize).toBe(12); // 下限钳位在复用路径上同样生效
  });
});

// ============================== B 组：贴图缺失回退（:691 守卫三重形态） ==============================

describe('B 组 贴图缺失回退（MapRenderer.ts:693 三重守卫 ＋ :775 setVisible(!hasSprite)）', () => {
  it('B-1 exists 返回 false ⇒ 画菱形 footprint、建沙印且不建 image', () => {
    const exists = vi.fn(() => false);
    const scene = makeFakeScene({ exists });
    newRenderer(scene).rerenderBuildings([instance('synth_has_art', 0)]);
    expect(exists).toHaveBeenCalledWith('art_ok'); // 传的是 def.assetKey 原值
    expect(buildingsGfx(scene).fillPoints).toHaveBeenCalled(); // 缺图才画地基菱形
    expect(scene._images).toHaveLength(0);
    expect(scene._texts[0]!.visible).toBe(true);
  });

  it('B-2 textures 整体缺席：构造期不再抛（c930-05 补守卫）⇒ :693 的 `!!textures` 分支已是活口', () => {
    const scene = makeFakeScene(null);
    // 钉桩翻转留痕：c927-46 原钉「构造链 :465 → ensureAnimTextures :471 裸调 textures.exists ⇒
    // 未走到 rerenderBuildings 就炸，:691 第一重守卫（`!!textures`）结构性不可达」。
    // c930-05（3d61583）已在 :471 补同源守卫 ⇒ 原炸点消失、第一重守卫在真实路径上真的轮得到。
    // 本钉由「钉不可达」翻为「钉守卫在岗」：不再接受"构造期抛"，改判守卫拦下后走缺图回退。
    // 构造本身即第一个断言：原钉点「构造期抛」已由 c930-05 守卫消除（抛了这行就红）。
    // 只构造一次——buildingsGfx 取的是 _graphics[2]，重复构造会把桩指到上一枚 renderer 的图层。
    const renderer = newRenderer(scene);
    expect(() => renderer.rerenderBuildings([instance('synth_has_art', 0)])).not.toThrow();
    expect(scene._images).toHaveLength(0);                      // 第一重 !textures ⇒ hasSprite=false
    expect(buildingsGfx(scene).fillPoints).toHaveBeenCalled();   // 缺图才画地基菱形（回退活口）
  });

  it('B-3 exists 不是函数（形状错）：构造期不再抛（同一 c930-05 守卫）⇒ :693 的 typeof 分支已是活口', () => {
    const scene = makeFakeScene({ exists: 'not-a-function' });
    // 与 B-2 同源翻转（c930-05）。第二重 `typeof textures.exists === 'function'` 现在真的参与判定：
    // 形状错时整体短路为 false ⇒ 走缺图回退，而不是在构造期炸掉。
    // 与 B-2 同款：单次构造（buildingsGfx 依赖 _graphics[2] 的构造序）。
    const renderer = newRenderer(scene);
    expect(() => renderer.rerenderBuildings([instance('synth_has_art', 0)])).not.toThrow();
    expect(scene._images).toHaveLength(0);
    expect(buildingsGfx(scene).fillPoints).toHaveBeenCalled();
  });

  it('B-3b 活口对照：exists 存在且可调用时，缺图回退确实走通（B-1/B-5/B-9 的口径基线）', () => {
    const scene = makeFakeScene({ exists: () => false });
    const renderer = newRenderer(scene);
    expect(() => renderer.rerenderBuildings([instance('synth_has_art', 0)])).not.toThrow();
    const pool = renderer as unknown as { buildingImages: unknown[]; sigilTexts: unknown[] };
    expect(pool.buildingImages).toHaveLength(0);
    expect(pool.sigilTexts).toHaveLength(1);
    expect(scene._texts[0]!.visible).toBe(true);
  });

  it('B-4 exists 返回 true ⇒ 建 image、沙印隐藏，且**不画** footprint 菱形', () => {
    const exists = vi.fn(() => true);
    const scene = makeFakeScene({ exists });
    const renderer = newRenderer(scene);
    renderer.rerenderBuildings([instance('synth_has_art', 0)]);
    // 🔴 用**在役池**判定，不用 add.image 的累计记录：exists 恒真时散布层（emitScatter）也走 add.image，
    //   累计记录里有 9 条（1 建筑 ＋ 8 散布），按累计判就是假红。
    const pool = renderer as unknown as { buildingImages: { key?: string }[] };
    expect(pool.buildingImages).toHaveLength(1);
    expect(pool.buildingImages[0]!.key).toBe('art_ok');
    expect(scene._texts[0]!.visible).toBe(false); // :773 setVisible(!hasSprite)
    expect(buildingsGfx(scene).fillPoints).not.toHaveBeenCalled();
    // 沙印仍然建、字号仍然算（只是隐藏）：2×2 ⇒ 76
    expect(firstSigilFontPx(scene)).toBe(76);
  });

  it('B-5 空 assetKey 不做特判：原串照样交给 exists（回不退由贴图注册表决定）', () => {
    const exists = vi.fn((key: string) => key !== '');
    const scene = makeFakeScene({ exists });
    const renderer = newRenderer(scene);
    renderer.rerenderBuildings([instance('synth_empty_key', 0)]);
    expect(exists).toHaveBeenCalledWith(''); // 没有 `if (assetKey)` 之类的前置短路
    const pool = renderer as unknown as { buildingImages: unknown[] };
    expect(pool.buildingImages).toHaveLength(0);
    expect(scene._texts[0]!.visible).toBe(true);
  });

  it('B-6 同槽位缺图↔有图切换：沙印不重建只改可见性，image 走 setTexture 复用', () => {
    let has = false;
    const exists = vi.fn(() => has);
    const scene = makeFakeScene({ exists });
    const renderer = newRenderer(scene);
    const pool = renderer as unknown as { sigilTexts: unknown[]; buildingImages: { key?: string }[] };
    renderer.rerenderBuildings([instance('synth_zero', 0)]);        // 缺图
    expect(pool.sigilTexts).toHaveLength(1);
    expect(scene._texts[0]!.visible).toBe(true);
    has = true;
    renderer.rerenderBuildings([instance('synth_has_art', 0)]);     // 变有图
    expect(pool.sigilTexts).toHaveLength(1);                         // 沙印池没长（只改可见性）
    expect(scene._texts[0]!.visible).toBe(false);
    expect(pool.buildingImages).toHaveLength(1);
    expect(scene._images[0]!.key).toBe('art_ok');
    has = false;
    renderer.rerenderBuildings([instance('synth_zero', 0)]);        // 再变缺图
    expect(pool.buildingImages).toHaveLength(0);                     // 空槽被截断（:782 池只增不减的补丁）
    expect(pool.sigilTexts).toHaveLength(1);
    expect(scene._texts[0]!.visible).toBe(true);
    expect(buildingsGfx(scene).fillPoints).toHaveBeenCalledTimes(2); // 第 1、3 次重画各画一次菱形
  });

  it('B-7 池解耦边界：缺图与有图交错时，沙印槽逐栋占位、image 槽只在有图时占位（:670 注释的口径）', () => {
    const exists = vi.fn((key: string) => key === 'art_ok');
    const scene = makeFakeScene({ exists });
    const renderer7 = newRenderer(scene);
    renderer7.rerenderBuildings([
      instance('synth_has_art', 0),   // 有图
      instance('synth_zero', 1),      // 缺图
      instance('synth_has_art', 2),   // 有图
      instance('synth_below', 3),      // 缺图
    ]);
    const pool7 = renderer7 as unknown as { sigilTexts: unknown[]; buildingImages: unknown[] };
    expect(pool7.sigilTexts).toHaveLength(4);                    // 沙印槽＝全部栋数
    expect(pool7.buildingImages).toHaveLength(2);                // image 槽＝仅有图
    expect(scene._texts.map(t => t.visible)).toEqual([false, true, false, true]);
    // 交错后各自字号仍按自己的 footprint 算（不错位）
    expect(scene._texts[1]!.style.fontSize).toBe('12px'); // 0×0 ⇒ 钳到 12
    expect(scene._texts[3]!.style.fontSize).toBe('12px'); // 0.3+0.3 ⇒ 钳到 12
    expect(scene._texts[0]!.style.fontSize).toBe('76px'); // 2×2
  });

  it('B-8 缺图 ＋ constructing 状态：沙印仍显、alpha 降到 0.7、菱形用浅色（缺图占位的第二形态）', () => {
    const scene = makeFakeScene({ exists: () => false });
    newRenderer(scene).rerenderBuildings([instance('synth_zero', 0, 0, 'constructing')]);
    const t = scene._texts[0]!;
    expect(t.visible).toBe(true);
    expect(t.alpha).toBe(0.7);
    expect(buildingsGfx(scene).fillStyle).toHaveBeenCalled();
    expect(buildingsGfx(scene).fillPoints).toHaveBeenCalledTimes(1);
  });

  it('B-9 未知 defId 被跳过：既不建沙印也不画菱形（回退路径的前置门槛）', () => {
    const exists = vi.fn(() => false);
    const scene = makeFakeScene({ exists });
    newRenderer(scene).rerenderBuildings([instance('bld_definitely_not_in_registry', 0)]);
    expect(scene._texts).toHaveLength(0);
    expect(scene._images).toHaveLength(0);
    expect(buildingsGfx(scene).fillPoints).not.toHaveBeenCalled();
    // 🔴 读数订正一条直觉：`textures.exists` 不是建筑路径独占——散布层（:541/:604）与粒子层（:1134）
    //   也调它 ⇒ 任何"exists 调用次数"类判据必须先按 key 过滤，否则会被 scatter 的 20+ 次调用打假。
    const buildingKeyCalls = exists.mock.calls.filter((c: unknown[]) => String(c[0]) === 'art_ok');
    expect(buildingKeyCalls, '取不到 def 却去查了该建筑的 assetKey').toHaveLength(0);
  });
});

describe('C 组 锚点自证（漂移留痕用，逐字钉住两处表达式的形状）', () => {
  it('C-1 卷宗引用的两条读数原文仍在盘上（表达式级别，不靠行号）', () => {
    const src = readFileSync(resolve(__dirname, '..', 'MapRenderer.ts'), 'utf8');
    expect(src).toContain('const fontPx = Math.max(12, Math.floor(Math.min(isoW, ISO_TILE_H * (wT + hT)) * 0.4));');
    expect(src).toContain("const hasSprite = !!textures && typeof textures.exists === 'function' && textures.exists(def.assetKey);");
    expect(src).toContain('t.setVisible(!hasSprite);');
    // 漂移留痕：卷宗写 :738/:772；c927-46 落钉时磁盘为 :745/:691/:773；c930-08（b5cbfe2）在
    // 漂移链：c930-08 前置插入 +2 ⇒ :747/:693/:775；c1007-03（646fa63）H 段接线头部 import +1、体内净 +3 ⇒ 现值 :751/:697/:779。
    const lines = src.split('\n');
    const fontLine = lines.findIndex(l => l.includes('const fontPx = Math.max(12')) + 1;
    const spriteLine = lines.findIndex(l => l.includes('const hasSprite =')) + 1;
    const visibleLine = lines.findIndex(l => l.includes('t.setVisible(!hasSprite);')) + 1;
    expect(fontLine).toBe(751);
    expect(spriteLine).toBe(697);
    expect(visibleLine).toBe(779);
  });

  it('C-2 getBuildingDef 替身只覆盖合成 id，在册 id 全部透传（本件的 mock 不外溢）', () => {
    expect(getBuildingDef('synth_zero')).toBeDefined();
    const real = getBuildingDef('bld_farm');
    expect(real).toBeDefined();
    expect(real!.id).toBe('bld_farm');
    expect(real!.size.width).toBeGreaterThan(0);
  });
});
