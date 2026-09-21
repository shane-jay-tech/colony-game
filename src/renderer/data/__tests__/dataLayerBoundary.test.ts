// c922-11（PLAN.md:40）：data 层不得向上依赖 state 层——把「一条 grep」变成门禁。
// 背景：原 data/modifierValidator.ts:21 `import { validateDslExpr } from '../state/dslEval'`
// 是全库唯一一处 data→state 反向 import（实测 grep 命中 1），现契约已下沉 data/dslCore.ts，
// state/dslEval.ts 退化为再导出兼容层。本文件钉三件事：① 反向 import 恒为 0（且扫到东西才算数）；
// ② 兼容层与真实现在同一模块图里是**同一个函数/同一个类**（防「搬完留下两份实现」）；
// ③ 契约行为不因搬家而变（'random' 跳过 / 合法式通过 / 未知标识符抛 DslSyntaxError）。
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDslExpr as validateFromCore, DslSyntaxError as CoreError } from '../dslCore';
import { validateDslExpr as validateFromStateShim, DslSyntaxError as ShimError } from '../../state/dslEval';

const DATA_DIR = resolve(__dirname, '..');

/** 只扫真实源文件，排除 __tests__（测试里允许出现反向路径字符串，否则本文件自己就会被自己拦下）。 */
function collectTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...collectTs(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const REVERSE_RE = /from\s+['"][^'"]*\/state\/[^'"]*['"]/g;

describe('c922-11 data 层边界（PLAN.md:40）', () => {
  it('① src/renderer/data/** 无任何 ../state/ import（命中数恒 0）', () => {
    const files = collectTs(DATA_DIR);
    expect(files.length).toBeGreaterThan(20); // 覆盖面自证：扫到空目录集会让断言假绿
    const hits: string[] = [];
    for (const f of files) {
      const code = readFileSync(f, 'utf8');
      for (const m of code.matchAll(REVERSE_RE)) hits.push(`${f.replace(DATA_DIR, 'data')}: ${m[0]}`);
    }
    expect(hits).toEqual([]);
  });

  it('② state/dslEval.ts 只剩再导出，实现唯一', () => {
    const shim = readFileSync(resolve(DATA_DIR, '..', 'state', 'dslEval.ts'), 'utf8');
    expect(shim).toContain("export * from '../data/dslCore'");
    // 出现任何实现体就说明搬成了两份
    expect(shim).not.toMatch(/^\s*(export )?(function|class)\s+\w/ims);
    expect(shim).not.toMatch(/^\s*(export )?const\s+\w/m);
    expect(validateFromStateShim).toBe(validateFromCore);      // 同一函数对象
    expect(ShimError).toBe(CoreError);                          // 同一个类：既有 instanceof 判据不失效
  });

  it('③ 搬家后契约行为不变', () => {
    expect(() => validateFromCore('random')).not.toThrow();            // 'random' 由 trigger 采样器单独消费
    expect(() => validateFromCore('country_grain < 50')).not.toThrow(); // country_<resource>
    expect(() => validateFromCore('season == summer')).not.toThrow();   // 字符串侧
    expect(() => validateFromCore('story_power_axis >= 0')).not.toThrow();
    expect(() => validateFromCore('country_grann < 50')).toThrow(CoreError);
    expect(() => validateFromCore('year <')).toThrow(CoreError);        // 缺操作数
    expect(() => validateFromCore('country_grain ~ 50')).toThrow(CoreError); // 不支持的运算符 → 落到 identifier 校验
  });
});
