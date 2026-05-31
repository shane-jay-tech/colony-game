import Phaser from 'phaser';
import { COLORS, UI } from './palette';

/**
 * 中式装饰面板边框（Slice I #67）。
 *
 * 取代原本的"单条 2px 金线"硬边，让面板与地图交接处更像一扇有铜角的木门：
 *   1) 木底色 fillRect（与之前一致）
 *   2) 外层 2px 金线 + 内嵌 1px 金线（4px 内缩）—— 双线"门框"感
 *   3) 四角各画一段 24×24 的"L 形"金色铜角，点睛中式
 *   4) 朝向地图那一侧加 3-7 颗等距铜钉，构成"过渡装饰带"
 *
 * 调用前请先 g.clear()。颜色全部走 COLORS palette，只用既有 11 色板内的金/木。
 */
export function drawDecorativePanelFrame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  mapSide: 'left' | 'right',
): void {
  // 1) 木底（保持与旧 BuildPanel/CourtPanel 一致的不透明度，避免视觉跳变）
  g.fillStyle(COLORS.WOOD, 0.88);
  g.fillRect(x, y, w, h);

  // 2) 双层金线
  g.lineStyle(UI.panelBorderWidth, COLORS.GOLD_DIM, 1);
  g.strokeRect(x, y, w, h);
  g.lineStyle(UI.panelGoldLineWidth, COLORS.GOLD_DIM, 0.65);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);

  // 3) 四角铜角（L 形，2px 实金）
  const corn = UI.cornerOrnamentSize;
  const inset = 4;
  g.lineStyle(2, COLORS.GOLD, 1);
  // 左上
  g.beginPath();
  g.moveTo(x + inset, y + inset + corn);
  g.lineTo(x + inset, y + inset);
  g.lineTo(x + inset + corn, y + inset);
  g.strokePath();
  // 右上
  g.beginPath();
  g.moveTo(x + w - inset - corn, y + inset);
  g.lineTo(x + w - inset, y + inset);
  g.lineTo(x + w - inset, y + inset + corn);
  g.strokePath();
  // 左下
  g.beginPath();
  g.moveTo(x + inset, y + h - inset - corn);
  g.lineTo(x + inset, y + h - inset);
  g.lineTo(x + inset + corn, y + h - inset);
  g.strokePath();
  // 右下
  g.beginPath();
  g.moveTo(x + w - inset - corn, y + h - inset);
  g.lineTo(x + w - inset, y + h - inset);
  g.lineTo(x + w - inset, y + h - inset - corn);
  g.strokePath();

  // 4) 朝地图侧的铆钉链（rivet chain）：上下各留 60px，中间均匀 3-7 颗
  const rivetR = UI.rivetSize / 2;
  const innerOffset = 10; // 离金线 10px 内缩
  const rivetX =
    mapSide === 'right' ? x + w - inset - innerOffset : x + inset + innerOffset;
  const topPad = 60;
  const bottomPad = 60;
  const usable = Math.max(0, h - topPad - bottomPad);
  const targetSpacing = 110;
  const count = Math.max(3, Math.min(7, Math.floor(usable / targetSpacing) + 1));
  for (let i = 0; i < count; i++) {
    const ry = y + topPad + (count === 1 ? usable / 2 : (usable * i) / (count - 1));
    g.fillStyle(COLORS.GOLD, 0.95);
    g.fillCircle(rivetX, ry, rivetR);
    g.lineStyle(1, COLORS.WOOD, 1);
    g.strokeCircle(rivetX, ry, rivetR);
  }
}
