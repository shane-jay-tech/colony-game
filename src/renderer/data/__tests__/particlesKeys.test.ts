// c924-30：particles 三表（FLOATING_TEXTS / PARTICLES / SHAKES）的 **fx_ id 全局不撞** 守护。
// 三表条目都带 `id: 'fx_…'` 字段，而 Record 的**键**是另一套标识（`resourceGain` vs `fx_resource_gain`）
// ⇒ 两套标识之间没有任何东西在看守：加一条忘配 id、或跨表撞同一个 id，`npx vitest run` 都不会红。
//
// 🔴 本目录的字面门禁：`data/__tests__/` 下不得出现上引 state 层的说明符字面（判据见本目录
//    `dataLayerBoundary.test.ts` 头注），本件（含注释）零出现；资产面一律取**同层**的
//    `../artManifest` ＋ `../scatterConfig` ＋ `public/` 磁盘实存三轨，不跨层引 render。
//
// ⚠ 卷宗第 ③ 条前提（「textureKey 引用的资源键存在于资产面」）**实测不成立**，已按实况把该条
//    收成「已知缺口哨兵」，否证读数与三轨对账见用例 ④ 与本文件尾注。
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FLOATING_TEXTS, PARTICLES, SHAKES } from '../particles';
import { ART_MANIFEST } from '../artManifest';
import { ALL_SCATTER_IDS } from '../scatterConfig';

interface IdEntry {
  id: string;
}
interface TaggedEntry {
  table: string;
  key: string;
  id: string;
}

const TABLES: ReadonlyArray<readonly [string, Readonly<Record<string, IdEntry>>]> = [
  ['FLOATING_TEXTS', FLOATING_TEXTS],
  ['PARTICLES', PARTICLES],
  ['SHAKES', SHAKES],
];

/** 三表条目 → 打平（带表名，红名里能直接读出撞车来自哪张表）。 */
function allEntries(): TaggedEntry[] {
  const out: TaggedEntry[] = [];
  for (const [table, table_] of TABLES) {
    for (const [key, entry] of Object.entries(table_)) out.push({ table, key, id: entry.id });
  }
  return out;
}

/** 重复 id 探测器（用例 ⑤ 会用合成撞车自证它不是恒真）。 */
function duplicateIds(entries: readonly TaggedEntry[]): string[] {
  const seen = new Map<string, number>();
  for (const e of entries) seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id).sort();
}

const toSnake = (key: string): string => `fx_${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;

/** 键↔id 派生漂移探测器；SHAKES 是登记在案的例外族（见用例 ③b），故排除在外。 */
function snakeDrift(entries: readonly TaggedEntry[]): string[] {
  return entries
    .filter((e) => e.table !== 'SHAKES' && e.id !== toSnake(e.key))
    .map((e) => `${e.table}.${e.key}→${e.id}`)
    .sort();
}

/** 运行期真在用的「可解析贴图键面」＝ manifest 键 ∪ 散布图键 ∪ 引擎现生成的内置键。 */
function runtimeTextureKeys(): Set<string> {
  const keys = new Set<string>(ART_MANIFEST.map((a) => a.key));
  for (const id of ALL_SCATTER_IDS) keys.add(`scatter_${id}`);
  // 内置生成贴图（不来自磁盘）：MapRenderer 的 `generateTexture(SMOKE_TEX_KEY…)`／
  // `generateTexture(SPARKLE_TEX_KEY…)`／雪粒 `generateTexture('__snow_flake__'…)`，
  // 键值定义在 render/buildingAnims.ts 与 render/MapRenderer.ts 内（只锚唯一文本、不写行号）。
  for (const builtin of ['__smoke__', '__sparkle__', '__snow_flake__']) keys.add(builtin);
  return keys;
}

/** 递归收 public/ 下所有文件基名（去扩展名），做磁盘轨对账。 */
function diskAssetStems(dir: string, out: Set<string> = new Set()): Set<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) diskAssetStems(p, out);
    else out.add(e.name.replace(/\.[^.]+$/, ''));
  }
  return out;
}

const PUBLIC_DIR = resolve(process.cwd(), 'public');

describe('c924-30 particles 三表 fx_ id 唯一性守护', () => {
  it('① 每表内部：Record 键数 = 条目 id 数、id 全是非空 fx_ 前缀、表内不撞（覆盖面自证 ≥7 条）', () => {
    const entries = allEntries();
    expect(entries.length).toBeGreaterThanOrEqual(7);
    for (const [table, table_] of TABLES) {
      const ids = Object.values(table_).map((e) => e.id);
      expect(ids.length, `${table} 条目数为 0 会让下面所有断言假绿`).toBeGreaterThan(0);
      expect(new Set(ids).size, `${table} 表内 id 有撞车`).toBe(ids.length);
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(id.startsWith('fx_'), `${table} 出现非 fx_ 前缀 id：${id}`).toBe(true);
      }
    }
  });

  it('② 跨表：三表 id **并集大小 = 各表 id 数之和**（现值 3+2+2=7 ⇒ 全局不撞）', () => {
    const entries = allEntries();
    const perTable = TABLES.map(([table]) => entries.filter((e) => e.table === table).length);
    const sum = perTable.reduce((a, b) => a + b, 0);
    expect(sum).toBe(7);
    expect(new Set(entries.map((e) => e.id)).size, `跨表撞车：${duplicateIds(entries).join(', ')}`).toBe(sum);
    expect(duplicateIds(entries)).toEqual([]);
  });

  it('③ 键↔id 命名同构：FLOATING_TEXTS/PARTICLES 的 id 就是 fx_+snake(Record 键)；SHAKES 是登记在案的例外族（只能钉前缀）', () => {
    const entries = allEntries();
    const inScope = entries.filter((e) => e.table !== 'SHAKES');
    expect(inScope.length).toBe(5); // 覆盖面自证：两表共 5 条，一条都没扫到就是过滤器失效
    expect(snakeDrift(entries)).toEqual([]);

    // SHAKES 的 Record 键走「场景档」语义（disasterMinor）、id 走「效果」语义（fx_shake_minor），
    // 二者本就不互相派生 ⇒ 这张表钉不住「改键不改 id」，只钉得住前缀族。例外写死在此，
    // 若将来两边统一成可派生形态，最后一条会翻红并要求把本段例外删掉。
    const shakes = Object.entries(SHAKES).map(([key, e]) => ({ key, id: e.id }));
    expect(shakes.length).toBe(2);
    for (const e of shakes) expect(e.id.startsWith('fx_shake_'), `SHAKES.${e.key} 跳出 fx_shake_ 族`).toBe(true);
    expect(shakes.some((e) => e.id === toSnake(e.key)), 'SHAKES 已可按键派生 id ⇒ 请删掉本段例外').toBe(false);
  });

  it('④ textureKey 资产面对账（卷宗前提否证后收成"已知缺口哨兵"）：PARTICLES 两个 textureKey 三轨全查无 ⇒ 接线时本例翻红要求同步更新', () => {
    const face = runtimeTextureKeys();
    const stems = diskAssetStems(PUBLIC_DIR);
    // 覆盖面自证：两轨都必须非空，否则「查无此键」是假绿（与 dataLayerBoundary 同一写法）。
    expect(face.size).toBeGreaterThan(50);
    expect(stems.size).toBeGreaterThan(50);

    const textureKeys = Object.values(PARTICLES).map((p) => p.textureKey);
    expect(textureKeys.length).toBe(2);
    const resolvable = textureKeys.filter((k) => face.has(k) || stems.has(k));
    // 🔴 现状：`particle_grain` / `particle_dust` 既不在 ART_MANIFEST／散布键面，public/ 下也没有
    //    同名文件（`find public -iname "*particle*"` 零命中），且三表在 src 里除 data/index.ts 的
    //    import/export 外**零消费者** ⇒ 卷宗「textureKey 引用的资源键存在于资产面」不成立。
    //    故本例钉「当前不可解析」这个事实；等真接线（补 manifest 或落盘素材）时它会翻红，
    //    那时应把本例改成正向对账，而不是把断言删掉。
    expect(resolvable).toEqual([]);
  });

  it('⑤ 探测器自证（防恒真）：纯合成数据喂两个探测器，撞车与漂移都必须被抓到', () => {
    // 只喂合成数据、不掺真表：掺了就会在真表出问题时让本例跟着红（红名不再唯一指向被破坏的那件事）。
    const dupIn: TaggedEntry[] = [
      { table: 'FLOATING_TEXTS', key: 'a', id: 'fx_a' },
      { table: 'PARTICLES', key: 'b', id: 'fx_a' },
    ];
    expect(duplicateIds(dupIn), '撞了 id 却没报 ⇒ 用例 ② 的「并集=之和」是恒真的').toEqual(['fx_a']);
    expect(duplicateIds([{ table: 'SHAKES', key: 'a', id: 'fx_a' }, { table: 'SHAKES', key: 'b', id: 'fx_b' }])).toEqual([]);

    const driftIn: TaggedEntry[] = [
      { table: 'FLOATING_TEXTS', key: 'resourceGain', id: 'fx_resource_gain_typo' },
      { table: 'PARTICLES', key: 'grainHarvest', id: 'fx_grain_harvest' },
      { table: 'SHAKES', key: 'disasterMinor', id: 'fx_shake_minor' }, // 例外族：不该进读数
    ];
    expect(snakeDrift(driftIn), '键改形而 id 没跟着改却不被抓 ⇒ 用例 ③ 无判别力').toEqual([
      'FLOATING_TEXTS.resourceGain→fx_resource_gain_typo',
    ]);
  });
});
