import { test, expect } from 'vitest';
// c918-04：TERRAIN_ART 5 型与实存 png 对账（防幽灵路径回归）。
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TERRAIN_ART } from '../../data/artManifest';
import { TERRAIN_KINDS } from '../../data/mapSchema';

const PUBLIC = join(__dirname, '..', '..', '..', '..', 'public');

test('TERRAIN_ART 共 5 型', () => {
  expect(TERRAIN_ART).toHaveLength(5);
});

test.each(TERRAIN_ART.map(a => [a.key, a.path]))(
  '%s 指向实存 webp（public 下 exists；c921-02 转码翻桩）',
  (_key, path) => {
    // c921-02 翻桩：地形纹理整批转码为 .webp（原 png 已按授权删除，回滚件在 tmp/assets-backup-20260920/）
    expect(path.endsWith('.webp')).toBe(true);
    expect(path.startsWith('art/terrain/')).toBe(true);
    expect(existsSync(join(PUBLIC, path))).toBe(true);
  },
);

// ================= c922-101：把「三方」从两两钉成三方互等 =================
// 依据 docs/insights/colony-terrain-naming-inventory-20260921.md §四.4 预留项：
//   A = artManifest.TERRAIN_ART（清单）／B = mapSchema.TERRAIN_KINDS（类型与生成侧）／C = public/art/terrain 磁盘实存。
// 上列两例只钉 A×C，B 侧此前无守护：任一侧增删地形型都不会红（改 TERRAIN_KINDS 或改清单都可静默漂移）。
// 本段只补断言，不改上面既有例的任何字。

const TERRAIN_KEY_PREFIX = 'terrain_';
const TERRAIN_DIR = join(PUBLIC, 'art', 'terrain');
/** 清单键 → 地形型名（去 `terrain_` 前缀） */
const kindOfArtKey = (key: string) => key.slice(TERRAIN_KEY_PREFIX.length);
/** 磁盘文件名 → 地形型名（去 `.webp` 后缀） */
const kindOfDiskFile = (f: string) => f.slice(0, -'.webp'.length);
const sorted = (xs: readonly string[]) => [...xs].sort();

test('A×B 集合相等：TERRAIN_ART 键去前缀排序后 === TERRAIN_KINDS 排序后（deepEqual，非仅长度）', () => {
  expect(sorted(TERRAIN_ART.map((a) => kindOfArtKey(a.key)))).toStrictEqual(sorted(TERRAIN_KINDS));
});

test.each([...TERRAIN_KINDS])(
  'A×B 逐项拼接命中：terrain_%s 在清单中唯一存在且 path 由该型名派生',
  (kind) => {
    const hits = TERRAIN_ART.filter((a) => a.key === `${TERRAIN_KEY_PREFIX}${kind}`);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe(`art/terrain/${kind}.webp`);
  },
);

test('A×B 集合大小：两侧各自无重复，且长度互等（size 相等是 deepEqual 之外的独立哨兵）', () => {
  const keys = TERRAIN_ART.map((a) => a.key);
  expect(new Set(keys).size).toBe(keys.length);
  expect(new Set(TERRAIN_KINDS).size).toBe(TERRAIN_KINDS.length);
  expect(keys.length).toBe(TERRAIN_KINDS.length);
});

test('三方互等：A×B×C 同一集合（磁盘 .webp 文件名干 === TERRAIN_KINDS === 清单键去前缀）', () => {
  const disk = sorted(readdirSync(TERRAIN_DIR).filter((f) => f.endsWith('.webp')).map(kindOfDiskFile));
  expect(disk).toStrictEqual(sorted(TERRAIN_KINDS));
  expect(disk).toStrictEqual(sorted(TERRAIN_ART.map((a) => kindOfArtKey(a.key))));
});
