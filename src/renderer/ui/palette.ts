/**
 * v0.7 视觉系统的唯一色板与字号源。
 *
 * 锁定：6 主色 + 4 辅助色 + 1 强调（共 11 色），
 * 任何 UI 不得引入第 12 色相（Kimi 调研 A.7 + DeepSeek 审 v0.6 必修）。
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

/** 边框三层嵌套 + 投影：所有 panel 通用规格（CSS 字符串） */
export const PANEL_BOX_SHADOW =
  'inset 0 0 0 1px #8A6E3E, inset 0 0 0 3px #5D4037, 0 4px 12px rgba(0,0,0,0.5)';

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

/** Phaser TextStyle 工厂——把 FONTS 转 Phaser.Types.GameObjects.Text.TextStyle */
export function toPhaserStyle(
  key: FontStyleKey,
  override: Record<string, unknown> = {},
): Record<string, unknown> {
  // Phaser 文本属性命名与 CSS 一致，但 fontStyle 用 'bold' / 'italic'
  const base = FONTS[key];
  return {
    fontFamily: base.fontFamily,
    fontSize: base.fontSize,
    color: base.color,
    fontStyle: 'fontStyle' in base ? base.fontStyle : 'normal',
    ...override,
  };
}
