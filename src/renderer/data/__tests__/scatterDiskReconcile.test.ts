// c918-08：散布键×磁盘对账——ALL_SCATTER_IDS 每键必须有实存 png
// （防 n916d-22「rock_cluster 缺盘静默缺失」复发：缺盘即红，不再静默跳过）。
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import { ALL_SCATTER_IDS, SCATTER_KEY_PREFIX } from '../scatterConfig';

const SCATTER_DIR = join(__dirname, '..', '..', '..', '..', 'public', 'art', 'scatter');

test('ALL_SCATTER_IDS 共 8 键（键数与盘上 webp 数现相等，但**不**绑定文件数：孤儿面由末条反向用例独立守）', () => {
  expect(ALL_SCATTER_IDS).toHaveLength(8); // c918-09 删 bush_dry 键；c923-18 把该图的生成器条目与孤儿 webp 一并收口（原 png 回滚件在 D:/attic/colony-art-backup-20260920/art/scatter/bush_dry.png）
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
// c923-18 收口：白名单原成员 bush_dry.webp（c918-09 删键、c921-02 转码时留下的孤儿）已按人工授权走
//   A+B 组合出口＝删 public/art/scatter/bush_dry.webp ＋ scripts/gen_scatter_art.py 停产该图 ⇒ 白名单清空。
// 本表**保持为空才是常态**：挂新条目＝登记一笔新孤儿债，须同批写明来历与出口（不留无主条目）。
const KNOWN_SCATTER_ORPHANS: readonly string[] = [];

test('反向：public/art/scatter/ 上零引用的 .webp 恰等于白名单（新增孤儿即红）', () => {
  const onDisk = readdirSync(SCATTER_DIR).filter((f) => f.endsWith('.webp')).sort();
  // c923-18 白名单清空后，本用例的期望集变成 []：光比较会让「盘扫不到东西」也判绿。
  // 故补覆盖面自证——扫描结果必须至少容得下全部键（等号成立时即键数==盘数，但不作为断言绑定）。
  expect(onDisk.length).toBeGreaterThanOrEqual(ALL_SCATTER_IDS.length);
  const referenced = new Set(ALL_SCATTER_IDS.map((id) => `${id}.webp`));
  const orphans = onDisk.filter((f) => !referenced.has(f));
  expect(orphans).toEqual([...KNOWN_SCATTER_ORPHANS].sort());
});
