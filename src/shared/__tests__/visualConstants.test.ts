// c-15：共享视觉常量模块——中立性（零导入）与取值断言。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MASK_FILL_WHITE } from '../visualConstants';

describe('c15 shared visual constants', () => {
  it('MASK_FILL_WHITE = 0xffffff（render 与 ui 掩码同源）', () => {
    expect(MASK_FILL_WHITE).toBe(0xffffff);
  });

  it('中立性：模块体零 import（不得引用 renderer 任何层）', () => {
    const src = readFileSync(new URL('../visualConstants.ts', import.meta.url), 'utf-8');
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});
