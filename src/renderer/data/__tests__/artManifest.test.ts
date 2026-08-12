import { describe, it, expect } from 'vitest';
import {
  ART_MANIFEST, BUILDING_ART, GENERAL_ART, EVENT_ART, UI_ART, TERRAIN_ART,
  getArtByCategory, isArtAvailable,
} from '../artManifest';
import { BUILDINGS } from '../buildings';

describe('Phase D art manifest', () => {
  it('building art entries = 33 (matches BUILDINGS)', () => {
    expect(BUILDING_ART).toHaveLength(33);
    expect(BUILDING_ART).toHaveLength(BUILDINGS.length);
  });

  it('general portraits = 5', () => {
    expect(GENERAL_ART).toHaveLength(5);
  });

  it('event illustrations = 10', () => {
    expect(EVENT_ART).toHaveLength(10);
  });

  it('UI elements = 6', () => {
    expect(UI_ART).toHaveLength(6);
  });

  it('terrain types = 3', () => {
    expect(TERRAIN_ART).toHaveLength(3);
  });

  it('total manifest = 56 assets', () => {
    expect(ART_MANIFEST).toHaveLength(33 + 5 + 10 + 6 + 3);
  });

  it('all keys are unique', () => {
    const keys = ART_MANIFEST.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all paths use .webp extension', () => {
    for (const a of ART_MANIFEST) {
      expect(a.path.endsWith('.webp')).toBe(true);
    }
  });

  it('getArtByCategory filters correctly', () => {
    expect(getArtByCategory('building')).toHaveLength(33);
    expect(getArtByCategory('terrain')).toHaveLength(3);
  });

  it('isArtAvailable checks loaded set', () => {
    const loaded = new Set(['bld_farm', 'bld_house']);
    expect(isArtAvailable('bld_farm', loaded)).toBe(true);
    expect(isArtAvailable('bld_palace', loaded)).toBe(false);
  });

  it('no required assets (all optional until art is created)', () => {
    const required = ART_MANIFEST.filter(a => a.required);
    expect(required).toHaveLength(0);
  });
});
