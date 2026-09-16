// c-16：UI 层适配器守卫（PLAN 工作项 3 条 3）——UI 只许发命令/读选择器，不得改 store 内部。
// 双保险：①源码扫描（禁直改模式）②行为断言（getter 返回冻结只读视图）。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameStore } from '../../state/gameStore';

const UI_DIR = join(__dirname, '..');
const UI_FILES = readdirSync(UI_DIR).filter(f => f.endsWith('.ts') && f !== 'registry.ts');

describe('c16 UI adapter guard', () => {
  it('UI 层源码无 store 内部直改模式（.state.x = / push/pop/splice 到 state）', () => {
    const offenders: string[] = [];
    for (const f of UI_FILES) {
      const src = readFileSync(join(UI_DIR, f), 'utf-8');
      if (/\.state\s*[.[]?\s*\w+\s*=[^=]/.test(src) || /\.state\.(push|pop|splice|shift|unshift)\(/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('store 选择器返回冻结只读视图（运行时防改）', () => {
    const store = new GameStore({
      on: () => {}, off: () => {}, emit: () => {}, listenerCount: () => 0,
    } as never);
    expect(Object.isFrozen(store.getBuildings())).toBe(true);
    expect(Object.isFrozen(store.getActiveModifiers())).toBe(true);
  });
});
