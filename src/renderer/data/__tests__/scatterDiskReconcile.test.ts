// c918-08：散布键×磁盘对账——ALL_SCATTER_IDS 每键必须有实存 png
// （防 n916d-22「rock_cluster 缺盘静默缺失」复发：缺盘即红，不再静默跳过）。
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import { ALL_SCATTER_IDS, SCATTER_KEY_PREFIX } from '../scatterConfig';

const SCATTER_DIR = join(__dirname, '..', '..', '..', '..', 'public', 'art', 'scatter');

test('ALL_SCATTER_IDS 共 8 键（键数不绑定磁盘文件数：盘上多 1 个孤儿，由末条反向用例守）', () => {
  expect(ALL_SCATTER_IDS).toHaveLength(8); // c918-09：bush_dry 闲臵项已删除（原 png 已随 f0c9754 授权删除，回滚件在 tmp/assets-backup-20260920/art/scatter/bush_dry.png 可随时恢复）
});

// c921-02：散布图整批转码为 .webp，BootScene 加载的是 .webp——对账对象改为被加载的文件。
test.each(ALL_SCATTER_IDS.map(id => [id]))(
  '散布键 %s 在 public/art/scatter/ 有实存 webp',
  id => {
    const webp = join(SCATTER_DIR, `${id}.webp`);
    expect(existsSync(webp), `缺盘：${webp}（n916d-22 同型静默缺失）`).toBe(true);
  },
);

test('键名规范：全部符合 SCATTER_KEY_PREFIX 语义（id 本身无前缀残留）', () => {
  for (const id of ALL_SCATTER_IDS) {
    expect(id.startsWith(SCATTER_KEY_PREFIX)).toBe(false);
  }
});

// c922-107 反向对账（此前本族只有『键→盘』单向，见 scatterAssets.test.ts ①②③ 与本文件 test.each）：
// 盘上被生成器产出、却不被 ALL_SCATTER_IDS 引用的 .webp ＝ 孤儿，必须恰等于下方白名单，多一个即红。
// 白名单成员 bush_dry.webp 来历：c918-09 删掉该键（原 png 随 f0c9754 授权删除），
// 但 c921-02 的「整批 png→webp 转码」仍把 bush_dry.webp 留在盘上 ⇒ 零引用无人报，就是本用例要抓的形态。
// ⚠️ 去留**不在本单裁决**：删件（public/art/scatter/bush_dry.webp）与改生成器
//    （scripts/gen_scatter_art.py 不再产该图）两条出口都属待人工授权项，故此处显式白名单化而非清盘。
const KNOWN_SCATTER_ORPHANS: readonly string[] = ['bush_dry.webp'];

test('反向：public/art/scatter/ 上零引用的 .webp 恰等于白名单（新增孤儿即红）', () => {
  const onDisk = readdirSync(SCATTER_DIR).filter((f) => f.endsWith('.webp')).sort();
  const referenced = new Set(ALL_SCATTER_IDS.map((id) => `${id}.webp`));
  const orphans = onDisk.filter((f) => !referenced.has(f));
  expect(orphans).toEqual([...KNOWN_SCATTER_ORPHANS].sort());
});
