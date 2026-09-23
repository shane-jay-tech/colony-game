// c923-09（承 `c922-130` 遗留问题 1 的**出口 B**，主班登记于待人工台账
// `D:/code/docs/insights/drain-20260922-pending-human.md` 第 39 条）：
// 门禁 ②「shim 同一性检查」自 `data/__tests__/dataLayerBoundary.test.ts` **整体迁入本文件**。
//
// 为什么它本就不该住在 data 族：这条门禁检查的对象是 `state/dslEval.ts`，
// 手段是「同一个符号从 data 拿一次、从 state 拿一次，断言两者是同一对象」。
// 于是**证明「data 不依赖 state」的那件门禁，自己成了 `data/__tests__` 下唯一的上引件**
// （c922-11 的在册设计，原文件 :14 注释自述「测试里允许出现反向路径字符串，否则本文件自己就会被自己拦下」）。
// 后果是判据「`data/__tests__` 内 `../state/` 命中 0」与在册设计互斥 ⇒ c922-130 只能按出口 A 收 partial→done，
// 并把出口 B 挂人工。本单即该裁决的执行：**迁完两边各得其所**——
//   ① 门禁 ② 一条断言不少地继续跑（本文件，1 例）；
//   ② `data/__tests__` 目录对 `../state/` 的字面引用**归零**（此前不可满足的那条判据现在可满足）。
//
// ⚠ 迁移而非新增：下面的用例体与断言逐条承原 ②，未加判据、未减判据；用例标题保留 `② ` 前缀，
//   使历史文档里「dataLayerBoundary 门禁 ②」式 grep 指针仍能命中本体。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDslExpr as validateFromCore, DslSyntaxError as CoreError } from '../../data/dslCore';
import { validateDslExpr as validateFromStateShim, DslSyntaxError as ShimError } from '../dslEval';

/**
 * 被检文件：`src/renderer/state/dslEval.ts`。
 * ⚠ `__dirname` 在本仓 vitest 下＝**测试自己所在的目录**（`state/__tests__`），故须上跳一级；
 *   写成 `resolve(__dirname,'dslEval.ts')` 会以 ENOENT 失败（迁移时实撞过一次，别照着原文件的
 *   `resolve(DATA_DIR,'..','state',...)` 心算——那里 DATA_DIR 已经是 data 目录本身）。
 */
const SHIM_FILE = resolve(__dirname, '..', 'dslEval.ts');

describe('c922-11 门禁②（c923-09 自 data/__tests__/dataLayerBoundary.test.ts 迁入，断言逐条不变）', () => {
  it('② state/dslEval.ts 只剩再导出，实现唯一', () => {
    const shim = readFileSync(SHIM_FILE, 'utf8');
    expect(shim).toContain("export * from '../data/dslCore'");
    // 出现任何实现体就说明搬成了两份
    expect(shim).not.toMatch(/^\s*(export )?(function|class)\s+\w/ims);
    expect(shim).not.toMatch(/^\s*(export )?const\s+\w/m);
    expect(validateFromStateShim).toBe(validateFromCore); // 同一函数对象
    expect(ShimError).toBe(CoreError); // 同一个类：既有 instanceof 判据不失效
  });
});
