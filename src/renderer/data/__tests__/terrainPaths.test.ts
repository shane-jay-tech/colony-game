import { test, expect } from 'vitest';
// c918-04：TERRAIN_ART 5 型与实存 png 对账（防幽灵路径回归）。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TERRAIN_ART } from '../../data/artManifest';

const PUBLIC = join(__dirname, '..', '..', '..', '..', 'public');

test('TERRAIN_ART 共 5 型', () => {
  expect(TERRAIN_ART).toHaveLength(5);
});

test.each(TERRAIN_ART.map(a => [a.key, a.path]))(
  '%s 指向实存 png（public 下 exists）',
  (_key, path) => {
    expect(path.endsWith('.png')).toBe(true);
    expect(path.startsWith('art/terrain/')).toBe(true);
    expect(existsSync(join(PUBLIC, path))).toBe(true);
  },
);
