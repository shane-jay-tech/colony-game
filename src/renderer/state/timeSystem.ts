import type { GameStore } from './gameStore';
import { BALANCE } from '../data/balanceConfig';

export { dayToCalendar, SEASON_NAMES } from './calendar';

/** 每游戏日对应的真实毫秒（来自 balanceConfig 单一事实源）。仅影响播放快慢，不改 game-day 平衡。 */
export const SPEED_MS_PER_DAY: Record<1 | 2 | 3, number> = BALANCE.time.msPerDay;

export class TimeSystem {
  private accumulator = 0;

  constructor(private readonly store: GameStore) {}

  update(realDeltaMs: number): void {
    if (this.store.isPaused()) return;
    const speed = this.store.getSpeed();
    if (speed === 0) return;

    const threshold = SPEED_MS_PER_DAY[speed];
    this.accumulator += realDeltaMs;

    while (this.accumulator >= threshold) {
      this.accumulator -= threshold;
      this.store.tickDay();
    }
  }

  resetForLoad(): void {
    this.accumulator = 0;
  }
}
