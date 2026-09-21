/**
 * gen-save-v9-fixture.mts — c922-122：生成 `src/renderer/state/__tests__/__fixtures__/save-v9.json`
 *
 * 用途：把「当前 SAVE_SCHEMA_VERSION 版存档」的真实 serialize 输出固化成夹具，
 *      为**下次 bump**（v9→v10）备料（colony-v10-guard-spec-20260915.md §二.1 点名的前置件）。
 *      本脚本**不改版本号**——SAVE_SCHEMA_VERSION 仍为 9。
 *
 * 一键复跑（仓根 D:/code/colony-game 下）：
 *      npx tsx scripts/gen-save-v9-fixture.mts
 *
 * 确定性契约（改动前请先复跑两次比 sha256）：
 *   - rngSeed 与地图 seed 固定 20260813（同 sandboxSimulation.test.ts:41 makeStore 的种子）
 *   - 起始资源取 BALANCE.startingResources
 *   - 只跑 store.tickDay()，**不调 setLastSeenNow()**（gameStore.ts:2817 写 Date.now()，
 *     会破坏字节确定性）；lastSeenTimestamp 保持构造初值 0（gameStore.ts:328）
 *   - 不引入 Date.now / Math.random 的新调用点
 *
 * 若将来 serialize 面新增字段，本脚本重跑即自动带上；夹具腐烂由
 * saveV9Fixture.test.ts 的「字段面一致」用例兜住。
 */
import { EventEmitter } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GameStore } from '../src/renderer/state/gameStore';
import type { IEventEmitter } from '../src/renderer/state/gameStore';
import { serialize } from '../src/renderer/state/saveLoad';
import { generateMap } from '../src/renderer/state/mapGen';
import { POLICIES } from '../src/renderer/data/policies';
import { EVENTS } from '../src/renderer/data/events';
import { DECREES } from '../src/renderer/data/decrees';
import { BUILDINGS } from '../src/renderer/data';
import { BALANCE } from '../src/renderer/data/balanceConfig';

const DAYS = 30;
const SEED = 20260813;
/**
 * 夹具用 16×16 地图，而非游戏默认的 DEFAULT_MAP_SIZE=80（gameStore.ts:311）。
 * 原因：worldMap 是 serialize 面上唯一的体量主导项——80² = 6400 格实测占 352 KB／51 键，
 * 直接固化会把一个 schema 夹具撑成 ~700 KB。16² = 256 格保留**完全相同的字段面**
 * （tiles 元素结构、resourceNodes、width/height/seed 一字不差），只缩行数。
 * 16 ≥ mapGen MIN_DIM=8（mapGen.ts:23），且够 30 日模拟落建筑。
 * 下次 bump 若字段面变了，重跑本脚本即自动带上。
 */
const MAP_SIDE = 16;

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../src/renderer/state/__tests__/__fixtures__/save-v9.json');

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(
    ee,
    {
      rngSeed: SEED,
      resources: { ...BALANCE.startingResources },
      worldMap: generateMap({ width: MAP_SIDE, height: MAP_SIDE, seed: SEED }),
    },
    { policies: POLICIES, events: EVENTS, decrees: DECREES },
  );
}

const store = makeStore();

/**
 * 光 tick 不建造 ⇒ `buildings: []`，夹具就白盖了 saveLoad.ts:707 起的
 * 「Slice G hardening：deserialize 时校验 buildings 数组每条 shape」那条面。
 * 这里逐日按 BUILDINGS 声明序扫格尝试落子，买不起/放不下由 placeBuilding 自己的
 * 谓词拒掉（返回 not ok 即跳过）——**判据全在既有实现里，本脚本不加任何规则**，
 * 故仍字节确定。产物：buildings 非空，Slice-G 校验面被真覆盖。
 */
const bounds = { width: MAP_SIDE, height: MAP_SIDE };
let placed = 0;
for (let day = 0; day < DAYS; day++) {
  for (const def of BUILDINGS) {
    let done = false;
    for (let i = 0; i < MAP_SIDE * MAP_SIDE && !done; i++) {
      const r = store.placeBuilding(def, i % MAP_SIDE, Math.floor(i / MAP_SIDE), bounds);
      if (r.ok) { placed++; done = true; }
    }
  }
  store.tickDay();
}

const blob = serialize(store.getState());
/**
 * serialize 在 saveLoad.ts:310 无条件写 `savedAt: Date.now()`——**生产码，本单不许改**。
 * 因此复跑必然逐次变。这里把它钉成固定常量，使夹具字节确定（实测：钉前两次跑
 * 只有 savedAt 一条路径不同、其余 51 键全等；钉后两次跑 sha256 逐位相同）。
 * 守护用例侧对 savedAt 的处理见 saveV9Fixture.test.ts 头注。
 */
const FIXED_SAVED_AT = 1790000000000;
blob.savedAt = FIXED_SAVED_AT;

const json = JSON.stringify(blob, null, 2) + '\n';

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json, 'utf8');

console.log(`[gen-save-v9-fixture] schemaVersion=${String(blob.schemaVersion)} days=${String(store.getCurrentDay())} placedBuildings=${String(placed)} -> ${outPath}`);
console.log(`[gen-save-v9-fixture] bytes=${String(Buffer.byteLength(json, 'utf8'))} stateKeys=${String(Object.keys(blob.state).length)}`);
