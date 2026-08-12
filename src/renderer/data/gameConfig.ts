/**
 * E-2 重玩性系统：开局配置选项。
 * 影响 NPC 选取、事件频率、资源倍率、蛮族行为。
 */

export type ResourceAbundance = 'rich' | 'normal' | 'scarce';
export type BarbarianIntensity = 'mild' | 'normal' | 'fierce';
export type EventFrequency = 'dense' | 'normal' | 'sparse';
export type MapSize = 'small' | 'normal' | 'large';

export interface GameStartConfig {
  mode: 'sandbox' | 'story';
  seed: number;
  resourceAbundance: ResourceAbundance;
  barbarianIntensity: BarbarianIntensity;
  eventFrequency: EventFrequency;
  mapSize: MapSize;
  playerName: string;
  countryName: string;
}

export const DEFAULT_CONFIG: GameStartConfig = {
  mode: 'sandbox',
  seed: Date.now(),
  resourceAbundance: 'normal',
  barbarianIntensity: 'normal',
  eventFrequency: 'normal',
  mapSize: 'normal',
  playerName: '',
  countryName: '',
};

export const RESOURCE_MULTIPLIER: Record<ResourceAbundance, number> = {
  rich: 1.5,
  normal: 1.0,
  scarce: 0.7,
};

export const BARBARIAN_AGGRESSION_MUL: Record<BarbarianIntensity, number> = {
  mild: 0.5,
  normal: 1.0,
  fierce: 1.8,
};

export const EVENT_INTERVAL_MUL: Record<EventFrequency, number> = {
  dense: 0.6,
  normal: 1.0,
  sparse: 1.6,
};

export const MAP_TILE_COUNT: Record<MapSize, { cols: number; rows: number }> = {
  small: { cols: 16, rows: 12 },
  normal: { cols: 20, rows: 15 },
  large: { cols: 28, rows: 20 },
};

export interface HistorianRecord {
  countryName: string;
  playerName: string;
  seed: number;
  totalDays: number;
  maxGrade: number;
  maxGradeName: string;
  ending: string | null;
  keyDecisions: string[];
  mode: 'sandbox' | 'story';
}

export function createHistorianRecord(
  config: GameStartConfig,
  totalDays: number,
  maxGrade: number,
  maxGradeName: string,
  ending: string | null,
  keyDecisions: string[],
): HistorianRecord {
  return {
    countryName: config.countryName,
    playerName: config.playerName,
    seed: config.seed,
    totalDays,
    maxGrade,
    maxGradeName,
    ending,
    keyDecisions: keyDecisions.slice(0, 5),
    mode: config.mode,
  };
}
