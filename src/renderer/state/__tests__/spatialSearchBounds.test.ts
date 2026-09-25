/**
 * inbox `20260925-120425-e118`（风险档 B · 工作类型 test）
 *
 * 卷宗原文：「构造拥堵、不可达、多目标和大地图寻路样例。验收：有超时或取消机制；不会阻塞主循环。」
 *
 * 🔴 前提否证（先 rg 证其在世，不造概念凑判据）：**本仓没有寻路**。实测见「证据」节 ——
 *   `pathfind` / `aStar` / `寻路` 在 `src/` 非测试源 0 命中；`MapTile.walkable` 是**只有生产者、
 *   没有消费者**的字段（mapGen 写、saveLoad 校验，运行时无人读）；设计档
 *   `docs/design/GAME_DESIGN_LIFECYCLE.md:517` 明写「**不做满地图寻路 agent 模拟**」。
 *   ⇒ 判据里的「拥堵／不可达／多目标／超时取消」在盘上只对应一件事：
 *     **格网空间查询面**（`WorldMapAccessor` 的 inBounds/getTile/isBuildable/getResourceNodesAt
 *     ＋ `placementSystem.canPlace` 的遮挡与边界判定）。本文件给这四个样例形状各钉一根桩，
 *     并把「不阻塞主循环」落成**可复算的有界工作量**（读格次数／扫描建筑数／扫描节点数精确计数），
 *     而不是墙钟阈值（并发窗下负载类读数不可归因，见纪律档 §四.2／§十九）。
 *
 * ⚠ 零生产码改动。超时/取消机制的**缺位**本文件只登记不补（工作类型 test；见「遗留问题」）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canPlace } from '../placementSystem';
import type { MapBounds } from '../placementSystem';
import { WorldMapAccessor } from '../worldMap';
import { generateMap } from '../mapGen';
import { getBuildingDef } from '../../data/buildingRegistry';
import type { BuildingDef, BuildingInstance } from '../../data/schema';
import type { ResourceCost } from '../../data/resourceRegistry';
import type { MapTile, ResourceNode, WorldMap } from '../../data/mapSchema';

const RENDERER_ROOT = resolve(__dirname, '../..'); // src/renderer

/** 大地图上限：与 `mapGen.ts` 的 MAX_DIM 同源（该常量未导出 ⇒ 现读源码取，别硬写第二份）。 */
function readMaxDim(): number {
  const src = readFileSync(join(RENDERER_ROOT, 'state', 'mapGen.ts'), 'utf8');
  const m = src.match(/^const MAX_DIM = (\d+);$/m);
  if (!m) throw new Error('mapGen.ts 里的 MAX_DIM 常量形态变了，本桩需同步');
  return Number(m[1]);
}

// ─────────────────────────────────────────────────────────────
// 工作量的确定性计数器：把 tiles / resourceNodes 换成计数 Proxy，
// 只挂 get 陷阱（数组下标读＝一次格读／一次节点扫描），不改任何行为。
// ─────────────────────────────────────────────────────────────
interface Counting {
  readonly map: WorldMap;
  tileReads(): number;
  nodeReads(): number;
  reset(): void;
}

function countingMap(base: WorldMap): Counting {
  let tiles = 0;
  let nodes = 0;
  const countNumeric = <T extends object>(target: T, onHit: () => void): T =>
    new Proxy(target, {
      get(t, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) onHit();
        return Reflect.get(t, prop) as unknown;
      },
    });
  const tilesProxy = countNumeric(base.tiles, () => { tiles++; });
  const nodesProxy = countNumeric(base.resourceNodes, () => { nodes++; });
  const map: WorldMap = {
    width: base.width,
    height: base.height,
    tiles: tilesProxy,
    resourceNodes: nodesProxy,
    seed: base.seed,
  };
  return {
    map,
    tileReads: () => tiles,
    nodeReads: () => nodes,
    reset() { tiles = 0; nodes = 0; },
  };
}

function tile(terrain: MapTile['terrain'], buildable: boolean, walkable: boolean): MapTile {
  return { terrain, buildable, walkable };
}

function plain(w: number, h: number): WorldMap {
  const tiles: MapTile[] = [];
  for (let i = 0; i < w * h; i++) tiles.push(tile('plain', true, true));
  return { width: w, height: h, tiles, resourceNodes: [], seed: 1 };
}

const RICH: ResourceCost = { wood: 9999, stone: 9999, gold: 9999 };

function farmDef(): BuildingDef {
  const def = getBuildingDef('bld_farm');
  if (!def) throw new Error('bld_farm 未注册');
  return def;
}

/** 只填 canPlace 真正读的字段（defId + position），其余按 schema 补齐，不用 as 断言糊过去。 */
function bld(defId: string, x: number, y: number): BuildingInstance {
  return { defId, position: { x, y }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] };
}

// ─────────────────────────────────────────────────────────────
// ① 大地图样例：40,000 格地图的读取工作量精确有界
// ─────────────────────────────────────────────────────────────
describe('e118 ① 大地图：空间查询的读格次数精确有界', () => {
  const DIM = readMaxDim();

  it(`generateMap(${DIM}×${DIM}) 出图即 tiles.length === width*height（无越界空洞）`, () => {
    const big = generateMap({ width: DIM, height: DIM, seed: 20260925 });
    expect(big.tiles.length).toBe(DIM * DIM);
    expect(big.resourceNodes.length).toBeGreaterThan(0);
    // 山格存在 ⇒ 「不可达地形」这一形状在大地图里是真的会出现（不靠手搓夹具）
    expect(big.tiles.some((t) => !t.buildable && !t.walkable)).toBe(true);
  });

  it('isBuildable 的读格次数恰等于足迹面积（3×3＝9 次），且不因地图尺寸增长', () => {
    const c = countingMap(plain(DIM, DIM));
    const acc = new WorldMapAccessor(c.map);
    c.reset();
    expect(acc.isBuildable(10, 10, 3, 3)).toBe(true);
    expect(c.tileReads()).toBe(9);
    c.reset();
    expect(acc.isBuildable(5, 5, 1, 1)).toBe(true);
    expect(c.tileReads()).toBe(1);
  });

  it('非正尺寸（0×0 / 负宽高）直接判 false，读格 0 次（零工作量出口）', () => {
    const c = countingMap(plain(DIM, DIM));
    const acc = new WorldMapAccessor(c.map);
    c.reset();
    expect(acc.isBuildable(0, 0, 0, 5)).toBe(false);
    expect(acc.isBuildable(0, 0, 3, -1)).toBe(false);
    expect(c.tileReads()).toBe(0);
  });

  it('命中第一格不可建造即**提前退出**：遮挡格在前 ⇒ 后续格一次都不读（最坏 O(面积) 的常数面收窄）', () => {
    const base = plain(DIM, DIM);
    base.tiles[10 * DIM + 10] = tile('mountain', false, false); // 3×3 足迹左上角即山
    const c = countingMap(base);
    const acc = new WorldMapAccessor(c.map);
    c.reset();
    expect(acc.isBuildable(10, 10, 3, 3)).toBe(false);
    expect(c.tileReads()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// ② 「不可达」样例：盘上没有寻路，可达性等价于 越界 / 地形不可建造
// ─────────────────────────────────────────────────────────────
describe('e118 ② 不可达：越界与地形否决都给出可归因的 reason（不静默放行）', () => {
  const DIM = readMaxDim();
  const bounds: MapBounds = { width: 64, height: 64 };

  it('越界（负坐标／触边/NaN/Infinity）一律 out_of_bounds，且在**读地形之前**短路', () => {
    const acc = new WorldMapAccessor(plain(DIM, DIM));
    const def = farmDef();
    for (const [x, y] of [[-1, 0], [0, -1], [63, 0], [0, 64], [NaN, 3], [Infinity, 3], [-Infinity, -Infinity]] as const) {
      expect(canPlace(RICH, [], def, x, y, bounds, acc), `(${x},${y})`).toEqual({
        ok: false,
        reason: 'out_of_bounds',
      });
    }
  });

  it('⚠ 实况：非整数坐标不算 out_of_bounds（isOutOfBounds 只挡非有限值），改由地形层拒建 ⇒ 仍不会静默放行', () => {
    const acc = new WorldMapAccessor(plain(DIM, DIM));
    const def = farmDef();
    // 钉的是"两道闸的接缝"：坐标 1.5 越不过 isOutOfBounds，但 getTile 的 inBounds 要求整数 ⇒
    // 出口是 unbuildable_terrain。任何人把 isOutOfBounds 改成"顺带挡小数"，本断言即红（reason 会变）。
    expect(canPlace(RICH, [], def, 1.5, 2, bounds, acc)).toEqual({
      ok: false,
      reason: 'unbuildable_terrain',
    });
    expect(canPlace(RICH, [], def, 2, 7.25, bounds, acc)).toEqual({
      ok: false,
      reason: 'unbuildable_terrain',
    });
  });

  it('河流／山 ⇒ unbuildable_terrain；同图 plain 仍可建（区分两类否决）', () => {
    const base = plain(16, 16);
    base.tiles[4 * 16 + 4] = tile('river', false, true);
    base.tiles[9 * 16 + 9] = tile('mountain', false, false);
    const acc = new WorldMapAccessor(base);
    const def = farmDef(); // 2×2
    expect(canPlace(RICH, [], def, 4, 4, { width: 16, height: 16 }, acc)).toEqual({
      ok: false,
      reason: 'unbuildable_terrain',
    });
    expect(canPlace(RICH, [], def, 9, 9, { width: 16, height: 16 }, acc)).toEqual({
      ok: false,
      reason: 'unbuildable_terrain',
    });
    expect(canPlace(RICH, [], def, 0, 0, { width: 16, height: 16 }, acc)).toEqual({ ok: true });
  });

  it('getTile 越界返回 undefined 而不是抛错（调用方热路径不会因越界崩主循环）', () => {
    const acc = new WorldMapAccessor(plain(8, 8));
    expect(acc.getTile(8, 8)).toBeUndefined();
    expect(acc.getTile(-1, -1)).toBeUndefined();
    expect(acc.getTile(7, 7)?.terrain).toBe('plain');
  });
});

// ─────────────────────────────────────────────────────────────
// ③ 「拥堵」样例：满图建筑下的遮挡判定，工作量以建筑数为界且提前退出
// ─────────────────────────────────────────────────────────────
describe('e118 ③ 拥堵：建筑密集时扫描有界（O(建筑数) 且命中即停）', () => {
  const dim = 200;
  const bounds: MapBounds = { width: dim, height: dim };

  /** 用 Proxy 计 canPlace 实际扫到第几栋建筑（for..of 读下标即计数）。 */
  function countingBuildings(list: BuildingInstance[]): { arr: BuildingInstance[]; scanned(): number } {
    let n = 0;
    const arr = new Proxy(list, {
      get(t, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) n++;
        return Reflect.get(t, prop) as unknown;
      },
    });
    return { arr, scanned: () => n };
  }

  it('600 栋排满时：与最后一栋重叠也要判出来；扫描次数恰等于该栋下标＋1（无重复扫、无漏扫）', () => {
    const buildings: BuildingInstance[] = [];
    // 2×2 农田按行铺：每行 100 栋（x 步长 2），共 6 行 ⇒ 600 栋，互不重叠
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 100; col++) buildings.push(bld('bld_farm', col * 2, row * 2));
    }
    const acc = new WorldMapAccessor(plain(dim, dim));
    const def = farmDef();
    const counted = countingBuildings(buildings);
    const last = buildings.length - 1;
    // 候选点压在最后一栋（x=198,y=10）上 ⇒ 需扫完全部 600 栋
    expect(canPlace(RICH, counted.arr, def, 198, 10, bounds, acc)).toEqual({ ok: false, reason: 'overlap' });
    expect(counted.scanned()).toBe(last + 1);

    // 候选点压在第一栋 ⇒ 只读 1 次即短路 ⇒ 「拥堵」下每帧成本上界是建筑数、不是地图面积
    const counted2 = countingBuildings(buildings);
    expect(canPlace(RICH, counted2.arr, def, 0, 0, bounds, acc)).toEqual({ ok: false, reason: 'overlap' });
    expect(counted2.scanned()).toBe(1);
  });

  it('未知 defId 在拥堵图上一律悲观拒建（overlap），不退化成 1×1 兜底放行', () => {
    const acc = new WorldMapAccessor(plain(dim, dim));
    const buildings = [bld('bld_farm', 0, 0), bld('bld_不存在的建筑', 6, 6)];
    expect(canPlace(RICH, buildings, farmDef(), 8, 8, bounds, acc)).toEqual({ ok: false, reason: 'overlap' });
  });

  it('⚠ 口径缺口登记：四面包围的地块仍判 ok —— 本仓的「拥堵」没有连通性／可达性语义', () => {
    const acc = new WorldMapAccessor(plain(dim, dim));
    const walls = [
      bld('bld_farm', 8, 6), // 上
      bld('bld_farm', 8, 10), // 下
      bld('bld_farm', 6, 8), // 左
      bld('bld_farm', 10, 8), // 右
    ];
    // 被完全围死的 (8,8) 依然可以建 —— 若将来引入寻路/通行判定，本断言即红，逼改单的人同步卷宗。
    expect(canPlace(RICH, walls, farmDef(), 8, 8, bounds, acc)).toEqual({ ok: true });
  });
});

// ─────────────────────────────────────────────────────────────
// ④ 「多目标」样例：同一格多目标点的取值顺序
// ─────────────────────────────────────────────────────────────
describe('e118 ④ 多目标：同格多节点按数组序返回，可重复且幂等', () => {
  function node(kind: ResourceNode['kind'], x: number, y: number, remaining: number): ResourceNode {
    return { kind, position: { x, y }, remaining };
  }

  it('同格 3 个节点全返回，顺序 === 数组插入序（非对象枚举序），重复调用逐位相同', () => {
    const base = plain(12, 12);
    base.resourceNodes = [
      node('forest_node', 5, 5, 10),
      node('stone_node', 5, 5, 7),
      node('river_node', 5, 5, 3),
      node('forest_node', 6, 6, 9),
    ];
    const c = countingMap(base);
    const acc = new WorldMapAccessor(c.map);
    const first = acc.getResourceNodesAt(5, 5);
    const again = acc.getResourceNodesAt(5, 5);
    expect(first.map((n) => n.kind)).toEqual(['forest_node', 'stone_node', 'river_node']);
    expect(again.map((n) => n.kind)).toEqual(first.map((n) => n.kind));
    expect(again.map((n) => n.remaining)).toEqual(first.map((n) => n.remaining));
    // 空命中是空数组而不是 undefined（调用方不必判空指针）
    expect(acc.getResourceNodesAt(0, 0)).toEqual([]);
  });

  it('契约钉桩：多目标查询是**全表扫描**（扫过每一个节点）⇒ 文档里那句「NOT per-frame」由下方静态门禁兜住', () => {
    const base = plain(12, 12);
    base.resourceNodes = Array.from({ length: 50 }, (_, i) => node('forest_node', i % 12, i % 12, 1));
    const c = countingMap(base);
    const acc = new WorldMapAccessor(c.map);
    c.reset();
    acc.getResourceNodesAt(1, 1);
    expect(c.nodeReads()).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────
// ⑤ 静态门禁：热路径没有新调用者（「不会阻塞主循环」的可复算形态）
// ─────────────────────────────────────────────────────────────
describe('e118 ⑤ 静态门禁：全表扫描 API 无人接进渲染/主循环', () => {
  function listProdSources(dir: string): string[] {
    const out: string[] = [];
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === '__tests__' || ent.name === 'node_modules') continue;
        out.push(...listProdSources(p));
      } else if (ent.name.endsWith('.ts')) {
        out.push(p);
      }
    }
    return out;
  }

  const prodFiles = listProdSources(RENDERER_ROOT).map((p) => ({
    rel: relative(RENDERER_ROOT, p).replace(/\\/g, '/'),
    src: readFileSync(p, 'utf8'),
  }));

  it('getResourceNodesAt 在非测试源里**只有定义、零调用点**（一旦被接进每帧路径 ⇒ 本用例红 ⇒ 必须先做空间索引）', () => {
    const callers = prodFiles.filter(
      (f) => f.rel !== 'state/worldMap.ts' && /getResourceNodesAt\s*\(/.test(f.src),
    );
    expect(callers.map((f) => f.rel)).toEqual([]);
  });

  it('canPlace 的调用点白名单 = {placementSystem 定义, buildMode 预览, gameStore 落子}（新增即红）', () => {
    const ALLOWED = ['state/buildMode.ts', 'state/gameStore.ts', 'state/placementSystem.ts']; // 与下方 .sort() 同序
    const callers = prodFiles
      .filter((f) => /\bcanPlace\s*\(/.test(f.src))
      .map((f) => f.rel)
      .sort();
    expect(callers).toEqual(ALLOWED);
  });

  it('MapTile.walkable 无运行时消费者（只 mapGen 写／saveLoad 校验）⇒ 寻路在本仓确未落地', () => {
    const users = prodFiles
      .filter((f) => /\bwalkable\b/.test(f.src))
      .map((f) => f.rel)
      .sort();
    expect(users).toEqual(['data/mapSchema.ts', 'state/mapGen.ts', 'state/saveLoad.ts']);
  });

  it('超时/取消机制的现状：格网查询面没有任何 abort／timeout 包装（缺位待裁决，见 result 遗留问题）', () => {
    const wrapped = prodFiles
      .filter((f) => /AbortController|abortSignal|\.abort\s*\(/.test(f.src))
      .map((f) => f.rel)
      .sort();
    expect(wrapped).toEqual([]);
  });
});
