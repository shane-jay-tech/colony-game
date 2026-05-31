import type { GameStore } from './gameStore';
import type { BuildingDef } from '../data/schema';
import { canPlace } from './placementSystem';
import type { PlacementResult } from './placementSystem';

/**
 * BuildMode：UI 层"选中建筑 → 点击地块放置"状态机。
 *
 * 设计：
 *   - 单一状态：当前选中的 BuildingDef（null = 没在建造模式）
 *   - 不持有 hover 位置（hover 是 GameScene 的 pointer 实时计算结果，不在状态里）
 *   - 不直接操作 graphics — 暴露纯逻辑 API，订阅者（GameScene/UIScene）自己重画
 *   - 事件驱动：选中变化 / 取消都通过 EventEmitter 广播，UI 多处可订阅
 *
 * 存活范围：随 game 生命周期。GameScene reload 不丢状态（用户中途切换地图没必要清空选中）。
 */

export const BUILD_MODE_EVENTS = {
  CHANGED: 'buildMode:changed',
} as const;

export type BuildModeListener = (def: BuildingDef | null) => void;

/**
 * 试探性放置检查（不会真放置，仅用于 hover 预览的 valid/invalid）。
 *
 * 真正的轻量 wrapper：调用 store 的 zero/shallow-copy getter，无 structuredClone 开销，
 * 可以在 pointermove 60Hz 热路径上每帧安全调用。
 *
 * 返回 PlacementResult：
 *   - { ok: true } → hover 显绿框
 *   - { ok: false, reason } → hover 显红框 + tooltip 用 reason 显示原因
 */
export function checkBuildAt(
  store: GameStore,
  def: BuildingDef,
  gridX: number,
  gridY: number,
): PlacementResult {
  const map = store.getWorldMap();
  const dim = map.getDimensions();
  // canPlace 内部对 NaN/Infinity 已有 isOutOfBounds 防御
  return canPlace(
    store.getResources(),
    store.getBuildings(),
    def,
    gridX,
    gridY,
    { width: dim.width, height: dim.height },
    map,
  );
}

export class BuildMode {
  private selected: BuildingDef | null = null;
  private listeners: Set<BuildModeListener> = new Set();

  getSelected(): BuildingDef | null {
    return this.selected;
  }

  /** 选中一个 BuildingDef 进入"建造模式"。同 def 重复 select 是 no-op。 */
  select(def: BuildingDef): void {
    if (this.selected === def) return;
    this.selected = def;
    this.emit();
  }

  /** 退出建造模式（如点了取消、ESC、放置成功后自动取消）。 */
  cancel(): void {
    if (this.selected === null) return;
    this.selected = null;
    this.emit();
  }

  isActive(): boolean {
    return this.selected !== null;
  }

  /** 订阅 selected 变化。返回 unsubscribe。 */
  onChange(fn: BuildModeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    // 复制集合再迭代，防御 listener 在回调内 unsubscribe 导致迭代错乱
    for (const fn of [...this.listeners]) {
      try {
        fn(this.selected);
      } catch (err) {
        console.error('[BuildMode] listener threw:', err);
      }
    }
  }
}
