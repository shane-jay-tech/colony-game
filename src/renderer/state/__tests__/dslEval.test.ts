import { describe, it, expect } from 'vitest';
import { evalPredicate, validateDslExpr, DslSyntaxError } from '../dslEval';
import type { CountryMetrics } from '../dslEval';

function makeCtx(over: Partial<CountryMetrics> = {}): CountryMetrics {
  return {
    resources: {},
    population: 0,
    morale: 50,
    wrath: 0,
    militaryPower: 0,
    year: 0,
    season: 0,
    dayOfYear: 0,
    rng: () => 0.5,
    ...over,
  };
}

describe('evalPredicate — comparison ops', () => {
  it('country_grain < 50 — true when grain=10', () => {
    expect(evalPredicate('country_grain < 50', makeCtx({ resources: { grain: 10 } }))).toBe(true);
  });
  it('country_grain < 50 — false when grain=80', () => {
    expect(evalPredicate('country_grain < 50', makeCtx({ resources: { grain: 80 } }))).toBe(false);
  });
  it('year >= 5 — true when year=5', () => {
    expect(evalPredicate('year >= 5', makeCtx({ year: 5 }))).toBe(true);
  });
  it('year >= 5 — false when year=4', () => {
    expect(evalPredicate('year >= 5', makeCtx({ year: 4 }))).toBe(false);
  });
  it('season == summer — true when season=1 (summer index)', () => {
    expect(evalPredicate('season == summer', makeCtx({ season: 1 }))).toBe(true);
  });
  it('season == winter — false when season=0', () => {
    expect(evalPredicate('season == winter', makeCtx({ season: 0 }))).toBe(false);
  });
  it('country_morale > 60 — true when morale=70', () => {
    expect(evalPredicate('country_morale > 60', makeCtx({ morale: 70 }))).toBe(true);
  });
  it('country_morale > 60 — false when morale=50', () => {
    expect(evalPredicate('country_morale > 60', makeCtx({ morale: 50 }))).toBe(false);
  });
  it('country_population != 0 — true when population=10', () => {
    expect(evalPredicate('country_population != 0', makeCtx({ population: 10 }))).toBe(true);
  });
});

describe('evalPredicate — bare identifier truthy', () => {
  it('country_grain bare → true when >0', () => {
    expect(evalPredicate('country_grain', makeCtx({ resources: { grain: 1 } }))).toBe(true);
  });
  it('country_grain bare → false when 0', () => {
    expect(evalPredicate('country_grain', makeCtx({ resources: {} }))).toBe(false);
  });
});

describe('evalPredicate — error paths', () => {
  it("'random' should not be passed to evalPredicate", () => {
    expect(() => evalPredicate('random', makeCtx())).toThrow(DslSyntaxError);
  });
  it('unknown identifier throws', () => {
    expect(() => evalPredicate('country_unknown < 5', makeCtx())).toThrow(DslSyntaxError);
  });
  it('missing rhs throws', () => {
    expect(() => evalPredicate('year >', makeCtx())).toThrow(DslSyntaxError);
  });
});

describe('validateDslExpr — startup data check', () => {
  it('valid expressions pass', () => {
    expect(() => validateDslExpr('country_grain < 50')).not.toThrow();
    expect(() => validateDslExpr('year >= 5')).not.toThrow();
    expect(() => validateDslExpr('season == summer')).not.toThrow();
    expect(() => validateDslExpr('random')).not.toThrow();
    expect(() => validateDslExpr('country_population')).not.toThrow();
  });
  it('typo identifier throws at validation time', () => {
    expect(() => validateDslExpr('country_grian < 50')).toThrow(DslSyntaxError);
  });
});
