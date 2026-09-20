# colony render/UI 共用视觉常量抽离（c-15，2026-09-13）

## 改动

- 新增中立共享模块 `src/shared/visualConstants.ts`（位置约定：不得 import renderer 任何层，保持对 render/ui 双向中立；注释已写明）；
- 首批收拢常量：`MASK_FILL_WHITE = 0xffffff`（render/MapRenderer 3 处 + ui/BuildPanel 1 处的双层重复色）；
- 接线：MapRenderer.ts（3 处 fillStyle）、BuildPanel.ts（1 处 rowsMask）；import 各 1 行；
- 层专属调色板不收拢：ui/palette.ts 与 render/mapColors.ts 各自已是单一来源（重复交集仅 0xffffff，实测两层 hex 交集扫描）。

## 断言与全量

- `src/shared/__tests__/visualConstants.test.ts` 2 用例：取值断言 + **中立性断言**（模块体零 import，防未来反向依赖）；
- 全量 `npm test`：**86 文件 / 1108 passed, 0 failed**（1106+2）。
