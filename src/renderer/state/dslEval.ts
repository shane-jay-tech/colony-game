/**
 * c922-11 兼容层（PLAN.md:40）：DSL 语法核心与 validateDslExpr 纯校验契约已下沉到
 * `data/dslCore.ts`，因为 data 层（modifierValidator）不该向上依赖 state 层。
 *
 * 本文件**不含任何实现**，只做再导出，让既有消费点
 * （eventEngine / decreeSystem / gameStore 与 state/__tests__ 下的 `./dslEval`、`../dslEval`）
 * 零改动继续工作。新代码请直接 import '../data/dslCore'。
 */
export * from '../data/dslCore';
