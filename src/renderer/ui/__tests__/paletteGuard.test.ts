import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS_HEX } from '../palette';

/**
 * P2-4 可读性铁律守护：UI 层任何 hex 字面量必须来自 11 色板 + INK_SMALL。
 * 防未来 UI 悄悄引入第 12+ 色相（Kimi 调研 A.7 + DeepSeek 审 v0.6 铁律的可执行化）。
 */

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

describe('P2-4 色板铁律守护（UI 层）', () => {
  it('所有 hex 字面量 ∈ 11 色板 + INK_SMALL', () => {
    const allowed = new Set(Object.values(COLORS_HEX).map(c => c.toUpperCase()));
    const uiRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
    const scenesRoot = join(uiRoot, '..', 'scenes');
    const files = [...walk(uiRoot), ...walk(scenesRoot)].filter(f => f.endsWith('.ts'));
    const bad: string[] = [];
    for (const f of files) {
      const norm = f.replace(/\\/g, '/');
      if (norm.endsWith('/palette.ts')) continue; // 色板定义本身
      const src = readFileSync(f, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const hexes = lines[i]!.match(/#[0-9A-Fa-f]{6}/g);
        if (!hexes) continue;
        for (const h of hexes) {
          if (!allowed.has(h.toUpperCase())) {
            bad.push(norm + ':' + (i + 1) + ' ' + h);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
