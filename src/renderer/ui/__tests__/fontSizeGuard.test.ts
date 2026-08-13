import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * P2-4 可读性铁律守护（字号半边）：UI 层任何 fontSize 字面量不得 < 14px。
 * 与 paletteGuard（色板半边）配套，构成「字号 ≥14 / 色板 11 色」两条铁律的可执行化。
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

describe('P2-4 字号铁律守护（UI 层）', () => {
  it('所有 fontSize 字面量 ≥ 14px', () => {
    const uiRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
    const scenesRoot = join(uiRoot, '..', 'scenes');
    const files = [...walk(uiRoot), ...walk(scenesRoot)].filter(f => f.endsWith('.ts'));
    const bad: string[] = [];
    for (const f of files) {
      const norm = f.replace(/\\/g, '/');
      const src = readFileSync(f, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const mm = lines[i]!.match(/fontSize:\s*'(\d+)px'/);
        if (mm && parseInt(mm[1]!, 10) < 14) {
          bad.push(norm + ':' + (i + 1) + ' ' + mm[1] + 'px');
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
