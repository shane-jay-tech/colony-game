/**
 * c923-26（R1 前半）：被 render / scenes / main 层跨层消费的视觉常量下沉到本中立模块。
 *
 * 位置约定沿用 `src/shared/visualConstants.ts:3`：**src/shared/ 不得 import src/renderer/\***
 * （保持对 render 与 ui 双向中立）。本模块同样零 import。
 *
 * 为什么新开一模块而不并进 visualConstants.ts：visualConstants.ts:4 头注写明
 * 「各层专属调色板不在此处：UI 侧 palette.ts、地形侧 mapColors.ts（各自单一来源）」，
 * 整套色板塞进去会违背该既定约定；故色板单独成模块，visualConstants.ts 继续只放单值。
 *
 * 收口对象（台账 c922-16 R1 / c923-16 门禁白名单两条 TODO）：
 *   src/renderer/render/mapColors.ts   、src/renderer/render/MapRenderer.ts 曾上引 `../ui/palette`。
 * 现 `src/renderer/ui/palette.ts` 已改为再导出 shim，UI 侧引用点零改动（c922-11 dslEval 同型手法）。
 *
 * ⚠ 本模块取值与搬家前**逐字节相同**（色值 / 字号 / 几何数字一个未动），
 *   原样保留 ui/palette.ts:1-111 的注释与 `as const`。改数值属视觉/平衡裁决，不在本单授权内。
 */

// Phaser 用 0xRRGGBB 数字格式，CSS 用 '#RRGGBB' 字符串格式，两份都给。

export const COLORS = {
  // 主色（锁死 6 色）
  PAPER: 0xf5ecd7,
  WOOD: 0x3e2723,
  GOLD: 0xc9a84c,
  INK: 0x2b2118,
  ASH: 0x6d635b,
  CINNABAR: 0xb71c1c,

  // 辅助
  GOLD_DIM: 0x8a6e3e,
  WOOD_LIGHT: 0x5d4037,
  PAPER_DIM: 0xe6dcc3,
  STONE_GREEN: 0x4a7c59,

  // 系统底色（最深，仅用于 body 背景）
  BG_INK: 0x1a1410,
} as const;

export const COLORS_HEX = {
  PAPER: '#F5ECD7',
  WOOD: '#3E2723',
  GOLD: '#C9A84C',
  INK: '#2B2118',
  ASH: '#6D635B',
  CINNABAR: '#B71C1C',
  GOLD_DIM: '#8A6E3E',
  WOOD_LIGHT: '#5D4037',
  PAPER_DIM: '#E6DCC3',
  STONE_GREEN: '#4A7C59',
  BG_INK: '#1A1410',
  /** 小字对比度专用（DeepSeek 审 v0.6 必修） */
  INK_SMALL: '#4A3520',
} as const;

/**
 * 字号阶梯。v0.9 hotfix #5：整体上调 4-6px 解决高 DPI 文字糊
 * （Phaser Text 在高 DPR 下默认烘焙分辨率太低，单纯放大字号比放大画布更稳）。
 * 任何中文字号不得 < 14px。
 */
export const FONTS = {
  title: {
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
    fontSize: '26px',
    fontStyle: 'bold',
    color: COLORS_HEX.GOLD,
  },
  panelHeading: {
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
    fontSize: '22px',
    fontStyle: 'bold',
    color: COLORS_HEX.INK,
  },
  body: {
    fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
    fontSize: '16px',
    color: COLORS_HEX.INK,
  },
  number: {
    fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
    fontSize: '22px',
    fontStyle: 'bold',
    color: COLORS_HEX.INK,
  },
  small: {
    fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
    fontSize: '14px',
    color: COLORS_HEX.INK_SMALL,
  },
  smallDim: {
    fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
    fontSize: '14px',
    color: COLORS_HEX.ASH,
  },
  /** Slice H：HUD 顶栏资源用的墨笔字形——衬线、加粗、奶纸色。 */
  glyph: {
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
    fontSize: '20px',
    fontStyle: 'bold',
    color: COLORS_HEX.PAPER,
  },
} as const;

export type FontStyleKey = keyof typeof FONTS;

/** UI 几何常量（一处改全局生效） */
export const UI = {
  topbarHeight: 48,
  /** 2026-06-19：主功能工具栏（朝堂/邦交/军务/大业）行高，紧贴顶栏下方。参考钢铁雄心主菜单一排大按钮。 */
  toolbarHeight: 40,
  buildPanelWidth: 256,
  rightPanelWidth: 280,
  iconCellSize: 56,
  iconGridGap: 8,
  badgeSize: 16,
  cornerOrnamentSize: 24,
  rivetSize: 6,
  panelBorderWidth: 2,
  panelGoldLineWidth: 1,
  panelInnerWoodWidth: 1,
  pulseDurationMs: 1000,
} as const;
