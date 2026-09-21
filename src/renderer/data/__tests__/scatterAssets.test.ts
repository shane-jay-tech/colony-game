// n916d-22：scatterConfig 配置项 ↔ 磁盘资源对账锁定。
// 防「清单/池引用无贴图」的静默加载缺失回潮（rock_cluster 事件）。
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SCATTER_IDS, SCATTER_BY_TERRAIN } from '../scatterConfig';

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

describe('n916d-22 scatter 配置与磁盘资源对账', () => {
  // c921-02：散布图整批转码为 .webp，BootScene 加载的已是 .webp——① 改为守卫**被加载的那个文件**；
  // 原 png 已按授权删除（f0c9754，62 件；回滚件在 tmp/assets-backup-20260920/），故下述 ①b 断言为「原件已不在盘」。
  it('① ALL_SCATTER_IDS 每一项都有被加载的 public/art/scatter/<id>.webp', () => {
    const missing = ALL_SCATTER_IDS.filter(id => !existsSync(resolve(SCATTER_DIR, `${id}.webp`)));
    expect(missing).toEqual([]);
  });

  it('①b 原 png 已按授权删除（art 只发 .webp；原件备份在 tmp/assets-backup-20260920/）', () => {
    // 2026-09-20 用户授权：c921-02 的「零删除」约束解除，62 个原 png 已删（释放 92.32 MiB）。
    // 断言随之翻转：散布图原 png 不应再在盘上；被加载的 .webp 由 ① 守卫。
    const stillPng = ALL_SCATTER_IDS.filter(id => existsSync(resolve(SCATTER_DIR, `${id}.png`)));
    expect(stillPng).toEqual([]);
  });

  it('② 各地形池引用的 id 均在 ALL_SCATTER_IDS 内（无游离引用）', () => {
    const known = new Set(ALL_SCATTER_IDS);
    const stray = [...idsInPools()].filter(id => !known.has(id));
    expect(stray).toEqual([]);
  });

  it('③ rock_cluster 不再被引用（缺失贴图条目已移除，池概率结构不变）', () => {
    expect(ALL_SCATTER_IDS).not.toContain('rock_cluster');
    expect([...idsInPools()]).not.toContain('rock_cluster');
    // 池概率不变：hills 0.22 / mountain 0.42 仍各有 slot
    expect(SCATTER_BY_TERRAIN.hills?.slots[0]?.prob).toBe(0.22);
    expect(SCATTER_BY_TERRAIN.mountain?.slots[0]?.prob).toBe(0.42);
  });
});
