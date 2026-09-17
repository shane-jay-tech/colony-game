// n916d-23：artManifest 建筑清单 ↔ 磁盘资源对账锁定。
// 缺图建筑（bld_tin_mine/bld_hemp_field）经 BUILDING_ART_REUSE 复用同族既有贴图，
// 使「清单条项均可在资源目录解析」；正式立绘落地后删 BUILDING_ART_REUSE 即回归 1:1。
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILDING_ART, BUILDING_ART_REUSE, getBootLoadList } from '../artManifest';

const BUILDINGS_DIR = resolve(process.cwd(), 'public/art/buildings');

function resolvable(key: string): boolean {
  return existsSync(resolve(BUILDINGS_DIR, `${BUILDING_ART_REUSE[key] ?? key}.png`));
}

describe('n916d-23 artManifest 建筑条项资源解析', () => {
  it('① BUILDING_ART 全部条项经复用表后均可解析（0 缺图）', () => {
    const missing = BUILDING_ART.map(a => a.key).filter(key => !resolvable(key));
    expect(missing).toEqual([]);
    expect(BUILDING_ART.length).toBe(35);
  });

  it('② 复用表目标贴图实存（同族等价，不新增资产）', () => {
    for (const [missing, reuse] of Object.entries(BUILDING_ART_REUSE)) {
      expect(existsSync(resolve(BUILDINGS_DIR, `${missing}.png`))).toBe(false);  // 原图确实缺
      expect(existsSync(resolve(BUILDINGS_DIR, `${reuse}.png`))).toBe(true);     // 复用目标实存
    }
  });

  it('③ 派生加载列表 URL 指向实存文件', () => {
    const list = getBootLoadList('building');
    const broken = list.filter(item => !existsSync(resolve(process.cwd(), 'public', item.url)));
    expect(broken).toEqual([]);
    expect(list.find(item => item.key === 'bld_tin_mine')?.url).toBe('art/buildings/bld_quarry.png');
    expect(list.find(item => item.key === 'bld_hemp_field')?.url).toBe('art/buildings/bld_mulberry_grove.png');
  });
});
