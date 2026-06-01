import type { GameStore } from './gameStore';
import { BALANCE } from '../data/balanceConfig';

export { dayToCalendar, SEASON_NAMES } from './calendar';

/** 每游戏日对应的真实毫秒（来自 balanceConfig 单一事实源）。仅影响播放快慢，不改 game-day 平衡。 */
export const SPEED_MS_PER_DAY: Record<1 | 2 | 3, number> = BALANCE.time.msPerDay;

export class TimeSystem {
  private accumulator = 0;
  /** 单次 update 最多补多少天 + 超出即丢弃积压：防卡顿/切后台/长 stall 后 delta 暴增
   *  在一帧里补几百个含完整 pipeline 的 tickDay 把主线程拖死（死亡螺旋兜底）。
   *  设得足够高（远超任何正常单帧跨度）以不影响真实玩法，仅截断病态暴增。 */
  private static readonly MAX_TICKS_PER_UPDATE = 400;

  constructor(private readonly store: GameStore) {}

  update(realDeltaMs: number): void {
    if (this.store.isPaused()) return;
    const speed = this.store.getSpeed();
    if (speed === 0) return;

    const threshold = SPEED_MS_PER_DAY[speed];
    this.accumulator += realDeltaMs;

    let ticks = 0;
    while (this.accumulator >= threshold && ticks < TimeSystem.MAX_TICKS_PER_UPDATE) {
      this.accumulator -= threshold;
      this.store.tickDay();
      ticks++;
    }
    // 仍有大量积压（病态 delta）→ 丢弃，宁可慢一拍也不卡死
    if (this.accumulator >= threshold) this.accumulator = 0;
  }

  resetForLoad(): void {
    this.accumulator = 0;
  }
}
