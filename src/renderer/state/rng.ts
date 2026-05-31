export interface RngHandle {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  getSeed(): number;
}

const MULBERRY32_INCREMENT = 0x6d2b79f5;
const UINT32_SIZE = 0x100000000;

export function createRng(seed: number): RngHandle {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + MULBERRY32_INCREMENT) >>> 0;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / UINT32_SIZE;
  };

  const nextInt = (min: number, max: number): number => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error("nextInt bounds must be finite numbers");
    }

    const lower = Math.ceil(min);
    const upper = Math.floor(max);

    if (lower > upper) {
      throw new Error("nextInt min must be less than or equal to max");
    }

    return lower + Math.floor(next() * (upper - lower + 1));
  };

  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }

    const index = nextInt(0, arr.length - 1);
    return arr[index]!;
  };

  const chance = (p: number): boolean => next() < p;

  const getSeed = (): number => state;

  return {
    next,
    nextInt,
    pick,
    chance,
    getSeed,
  };
}

export function restoreRng(state: number): RngHandle {
  return createRng(state);
}