// n916d-22：scatterConfig 配置项 ↔ 磁盘资源对账锁定。
// 防「清单/池引用无贴图」的静默加载缺失回潮（rock_cluster 事件）。
// c1023-10（c1011-11 残余①）：清单权威入 artManifest.SCATTER_ART（PLAN#2 末条）——
// 断言①②改锚新权威（manifest 键/path），并加「ALL_SCATTER_IDS=SCATTER_ART 派生一致性」钉。
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SCATTER_IDS, SCATTER_BY_TERRAIN, SCATTER_KEY_PREFIX } from '../scatterConfig';
import { SCATTER_ART } from '../artManifest';

const SCATTER_DIR = resolve(process.cwd(), 'public/art/scatter');

function idsInPools(): Set<string> {
  const ids = new Set<string>();
  for (const terrain of Object.values(SCATTER_BY_TERRAIN)) {
    for (const slot of terrain.slots) {
      for (const id of slot.pool) ids.add(id);
    }
  }
  return ids;
}

describe('n916d-22 scatter 配置与磁盘资源对账（c1023-10 权威化同步）', () => {
  // c921-02：散布图整批转码为 .webp，BootScene 加载的已是 .webp——① 改为守卫**被加载的那个文件**；
  // 原 png 已按授权删除（f0c9754，62 件；回滚件在 D:/attic/colony-art-backup-20260920/），故下述 ①b 断言为「原件已不在盘」。
  // c1023-10：①改锚 manifest 权威——SCATTER_ART 每条 path（BootScene 现直取加载的那个文件）实存。
  it('① SCATTER_ART（manifest 权威 8 项）每条 path 都有实存的 public/art/scatter/<id>.webp', () => {
    expect(SCATTER_ART).toHaveLength(8);
    const missing = SCATTER_ART.filter(a => !existsSync(resolve(process.cwd(), 'public', a.path)));
    expect(missing).toEqual([]);
    // 键口径：key=scatter_<id>、category=scatter、全 required（实存才准 true）
    expect(SCATTER_ART.every(a => a.key.startsWith(SCATTER_KEY_PREFIX) && a.category === 'scatter' && a.required)).toBe(true);
  });

  it('①b 原 png 已按授权删除（art 只发 .webp；原件备份在 D:/attic/colony-art-backup-20260920/）', () => {
    // 2026-09-20 用户授权：c921-02 的「零删除」约束解除，62 个原 png 已删（释放 92.32 MiB）。
    // 断言随之翻转：散布图原 png 不应再在盘上；被加载的 .webp 由 ① 守卫。
    const stillPng = ALL_SCATTER_IDS.filter(id => existsSync(resolve(SCATTER_DIR, `${id}.png`)));
    expect(stillPng).toEqual([]);
  });

  it('①c 派生一致性：scatterConfig.ALL_SCATTER_IDS ≡ SCATTER_ART 键去前缀（单一事实源钉）', () => {
    expect([...ALL_SCATTER_IDS]).toEqual(SCATTER_ART.map(a => a.key.slice(SCATTER_KEY_PREFIX.length)));
  });

  it('② 各地形池引用的 id 均在 manifest 权威清单内（无游离引用）', () => {
    const known = new Set(ALL_SCATTER_IDS);
    const stray = [...idsInPools()].filter(id => !known.has(id));
    expect(stray).toEqual([]);
  });

  it('③ rock_cluster 不再被引用（缺失贴图条目已移除，池概率结构不变；B-152 现态）', () => {
    expect(ALL_SCATTER_IDS).not.toContain('rock_cluster');
    expect(SCATTER_ART.map(a => a.key)).not.toContain('scatter_rock_cluster');
    expect([...idsInPools()]).not.toContain('rock_cluster');
    // 池概率不变：hills 0.22 / mountain 0.42 仍各有 slot（rock_boulder 顶替形态）
    expect(SCATTER_BY_TERRAIN.hills?.slots[0]?.prob).toBe(0.22);
    expect(SCATTER_BY_TERRAIN.mountain?.slots[0]?.prob).toBe(0.42);
  });
});
