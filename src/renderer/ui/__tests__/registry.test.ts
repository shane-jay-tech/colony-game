import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGISTRY_KEYS, REGISTRY_KEY_COUNT, registryGet, registrySet } from '../registry';

/**
 * P1-2 类型化 registry 测试：get/set 往返 + key 清单稳定 + 散落字符串守护。
 */

/** 最小 DataManager fake：仅实现 get/set 的 Map 语义。 */
function makeFakeDataManager() {
  const map = new Map<string, unknown>();
  return {
    get: (k: string) => map.get(k),
    set: (k: string, v: unknown) => { map.set(k, v); },
  } as unknown as Phaser.Data.DataManager;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe('P1-2 类型化 registry', () => {
  it('get/set 往返（假 DataManager）', () => {
    const dm = makeFakeDataManager();
    expect(registryGet(dm, REGISTRY_KEYS.introDone)).toBeUndefined();
    registrySet(dm, REGISTRY_KEYS.introDone, true);
    expect(registryGet(dm, REGISTRY_KEYS.introDone)).toBe(true);
    registrySet(dm, REGISTRY_KEYS.countryName, '大梁');
    expect(registryGet(dm, REGISTRY_KEYS.countryName)).toBe('大梁');
    // 清空：set undefined 后 get 回 undefined
    registrySet(dm, REGISTRY_KEYS.introDone, undefined);
    expect(registryGet(dm, REGISTRY_KEYS.introDone)).toBeUndefined();
  });

  it('key 清单稳定（22 个；新增/更名必须先改中央表）', () => {
    expect(REGISTRY_KEY_COUNT).toBe(22);
  });

  it('守护：源码中不再有散落的 registry.get/set 字符串调用', () => {
    // 从本测试文件定位 src/renderer 根
    const rendererRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
    const files = walk(rendererRoot).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const bad: string[] = [];
    for (const f of files) {
      const norm = f.replace(/\\/g, '/');
      if (norm.endsWith('/ui/registry.ts')) continue;        // 中央表本身
      if (norm.endsWith('/data/buildingRegistry.ts')) continue; // 那是 Map 不是 Phaser registry
      const src = readFileSync(f, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/registry\.(get|set)\(\s*['"]/.test(lines[i]!)) {
          bad.push(norm + ':' + (i + 1));
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
