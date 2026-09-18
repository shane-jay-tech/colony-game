// c918-08：散布键×磁盘对账——ALL_SCATTER_IDS 每键必须有实存 png
// （防 n916d-22「rock_cluster 缺盘静默缺失」复发：缺盘即红，不再静默跳过）。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import { ALL_SCATTER_IDS, SCATTER_KEY_PREFIX } from '../scatterConfig';

const SCATTER_DIR = join(__dirname, '..', '..', '..', '..', 'public', 'art', 'scatter');

test('ALL_SCATTER_IDS 共 9 键（与磁盘 png 数一致）', () => {
  expect(ALL_SCATTER_IDS).toHaveLength(8); // c918-09：bush_dry 闲臵项已删除（png 保留在盘可随时恢复）
});

test.each(ALL_SCATTER_IDS.map(id => [id]))(
  '散布键 %s 在 public/art/scatter/ 有实存 png',
  id => {
    const png = join(SCATTER_DIR, `${id}.png`);
    expect(existsSync(png), `缺盘：${png}（n916d-22 同型静默缺失）`).toBe(true);
  },
);

test('键名规范：全部符合 SCATTER_KEY_PREFIX 语义（id 本身无前缀残留）', () => {
  for (const id of ALL_SCATTER_IDS) {
    expect(id.startsWith(SCATTER_KEY_PREFIX)).toBe(false);
  }
});
