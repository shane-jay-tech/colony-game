/**
 * c-15：render 层与 UI 层共用、且两层各自都定义过的视觉常量，收拢到此中立模块。
 * 位置约定：src/shared/ 不得 import src/renderer/*（保持对 render 与 ui 双向中立）。
 * 各层专属调色板不在此处：UI 侧 palette.ts、地形侧 mapColors.ts（各自单一来源）。
 */

/** 交互掩码/命中区填充白（Graphics mask fillStyle 与 UI rowsMask 同源）。 */
export const MASK_FILL_WHITE = 0xffffff;
