import type { GameStore } from './gameStore';

export { dayToCalendar, SEASON_NAMES } from './calendar';

export const SPEED_MS_PER_DAY: Record<1 | 2 | 3, number> = {
  1: 1000,
  2: 500,
  3: 333,
};

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
