/**
 * c923-26 兼容层（台账 c922-16 R1 前半）：整套色板 / 字号 / UI 几何常量已下沉到
 * `src/shared/palette.ts`，因为 render 层与 scenes/main 层不该向上依赖 ui 层。
 *
 * 本文件**不含任何实现**，只做再导出，让既有消费点
 * （ui/ 目录内的面板与 ui/__tests__ 下的 `./palette`、`../palette` 引用，
 *   含 paletteGuard.test.ts 从 `../palette` 取 COLORS_HEX 当铁律白名单）
 * 零改动继续工作。新代码请直接 import '../../shared/palette'。
 *
 * 手法照 c922-11 `state/dslEval.ts` → `data/dslCore.ts` 同型。
 * 收口后可删的白名单条目见 `render/__tests__/renderUiBoundary.test.ts` 的 ALLOWED。
 */
export * from '../../shared/palette';
