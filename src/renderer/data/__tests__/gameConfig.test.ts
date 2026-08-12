import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG, RESOURCE_MULTIPLIER, BARBARIAN_AGGRESSION_MUL,
  EVENT_INTERVAL_MUL, MAP_TILE_COUNT, createHistorianRecord,
} from '../gameConfig';

describe('E-2 replayability config', () => {
  it('DEFAULT_CONFIG has all fields', () => {
    expect(DEFAULT_CONFIG.mode).toBe('sandbox');
    expect(DEFAULT_CONFIG.resourceAbundance).toBe('normal');
    expect(DEFAULT_CONFIG.barbarianIntensity).toBe('normal');
    expect(DEFAULT_CONFIG.eventFrequency).toBe('normal');
    expect(DEFAULT_CONFIG.mapSize).toBe('normal');
    expect(DEFAULT_CONFIG.seed).toBeGreaterThan(0);
  });

  it('resource multipliers cover all options', () => {
    expect(RESOURCE_MULTIPLIER.rich).toBe(1.5);
    expect(RESOURCE_MULTIPLIER.normal).toBe(1.0);
    expect(RESOURCE_MULTIPLIER.scarce).toBe(0.7);
  });

  it('barbarian aggression multipliers ordered correctly', () => {
    expect(BARBARIAN_AGGRESSION_MUL.mild).toBeLessThan(BARBARIAN_AGGRESSION_MUL.normal);
    expect(BARBARIAN_AGGRESSION_MUL.normal).toBeLessThan(BARBARIAN_AGGRESSION_MUL.fierce);
  });

  it('event interval multipliers: dense < normal < sparse', () => {
    expect(EVENT_INTERVAL_MUL.dense).toBeLessThan(EVENT_INTERVAL_MUL.normal);
    expect(EVENT_INTERVAL_MUL.normal).toBeLessThan(EVENT_INTERVAL_MUL.sparse);
  });

  it('map sizes increase in tile count', () => {
    const small = MAP_TILE_COUNT.small.cols * MAP_TILE_COUNT.small.rows;
    const normal = MAP_TILE_COUNT.normal.cols * MAP_TILE_COUNT.normal.rows;
    const large = MAP_TILE_COUNT.large.cols * MAP_TILE_COUNT.large.rows;
    expect(small).toBeLessThan(normal);
    expect(normal).toBeLessThan(large);
  });
});

describe('E-2 historian record', () => {
  it('createHistorianRecord captures key info', () => {
    const record = createHistorianRecord(
      { ...DEFAULT_CONFIG, countryName: '大周', playerName: '姬旦', seed: 42 },
      500,
      5,
      '霸主',
      'gong',
      ['建市', '征晋', '铸鼎', '开朝议', '退位', '多余'],
    );
    expect(record.countryName).toBe('大周');
    expect(record.playerName).toBe('姬旦');
    expect(record.totalDays).toBe(500);
    expect(record.maxGrade).toBe(5);
    expect(record.ending).toBe('gong');
    expect(record.keyDecisions).toHaveLength(5); // capped at 5
  });

  it('historian record handles null ending for sandbox', () => {
    const record = createHistorianRecord(
      DEFAULT_CONFIG, 300, 3, '邦国', null, [],
    );
    expect(record.ending).toBeNull();
    expect(record.keyDecisions).toHaveLength(0);
  });
});
