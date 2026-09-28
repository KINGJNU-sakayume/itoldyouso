import { describe, expect, it } from 'vitest';
import { claim, snap } from '../test/fixtures';
import { DEFAULT_SETTINGS } from './doc';
import { baseMetric, computeStats, findHit, growthOf, headline, isStale, peakMult, reconcileStatus } from './metrics';

const settings = { ...DEFAULT_SETTINGS, hitMultiplier: 2 };

describe('growth', () => {
  const c = claim({
    claimedAt: '2026-01-01T10:00:00Z',
    snapshots: [
      snap('2026-01-01T10:00:00Z', { views: 10_000, listeners: 500 }),
      snap('2026-01-20T10:00:00Z', { views: 15_000 }),
      snap('2026-02-10T10:00:00Z', { views: 32_000, listeners: 400 }),
    ],
  });

  it('measures entry → latest per metric', () => {
    expect(growthOf(c, 'views')).toMatchObject({ entry: 10_000, latest: 32_000, mult: 3.2 });
    expect(growthOf(c, 'listeners')?.mult).toBeCloseTo(0.8);
    expect(growthOf(c, 'streams')).toBeUndefined();
  });

  it('has no multiplier until there is a second data point', () => {
    const fresh = claim({ claimedAt: '2026-01-01', snapshots: [snap('2026-01-01', { views: 100 })] });
    expect(headline(fresh)).toMatchObject({ entry: 100, latest: 100, mult: null });
  });

  it('falls back to a metric with data when the primary has none', () => {
    const c2 = claim({ claimedAt: '2026-01-01', primary: 'streams', snapshots: [snap('2026-01-01', { listeners: 5 })] });
    expect(baseMetric(c2)).toBe('listeners');
  });

  it('tracks the peak, not just the latest value', () => {
    const c3 = claim({
      claimedAt: '2026-01-01',
      primary: 'listeners',
      snapshots: [snap('2026-01-01', { listeners: 100 }), snap('2026-02-01', { listeners: 450 }), snap('2026-03-01', { listeners: 300 })],
    });
    expect(peakMult(c3)).toBe(4.5);
  });
});

describe('hit rule', () => {
  it('finds the first check-in that reaches the multiplier', () => {
    const c = claim({
      claimedAt: '2026-01-01',
      snapshots: [snap('2026-01-01', { views: 100 }), snap('2026-01-10', { views: 150 }), snap('2026-01-20', { views: 200 }), snap('2026-02-01', { views: 900 })],
    });
    expect(findHit(c, settings)).toEqual({ at: new Date('2026-01-20').toISOString(), reason: 'growth' });
    expect(findHit(c, { ...settings, hitMultiplier: 10 })).toBeNull();
  });

  it('counts a reached prediction as a hit even below the multiplier', () => {
    const c = claim({
      claimedAt: '2026-01-01',
      target: { metric: 'listeners', value: 1000 },
      snapshots: [snap('2026-01-01', { views: 100, listeners: 800 }), snap('2026-01-05', { views: 110, listeners: 1001 })],
    });
    expect(findHit(c, settings)?.reason).toBe('target');
  });

  it('never counts the entry snapshot', () => {
    const c = claim({ claimedAt: '2026-01-01', target: { metric: 'views', value: 50 }, snapshots: [snap('2026-01-01', { views: 100 })] });
    expect(findHit(c, settings)).toBeNull();
  });

  it('sets and lifts automatic hits but leaves manual calls and drops alone', () => {
    const base = claim({ claimedAt: '2026-01-01', snapshots: [snap('2026-01-01', { views: 100 }), snap('2026-01-05', { views: 250 })] });
    const hit = reconcileStatus(base, settings);
    expect(hit).toMatchObject({ status: 'hit', hitReason: 'growth' });

    const edited = reconcileStatus({ ...hit, snapshots: hit.snapshots.slice(0, 1) }, settings);
    expect(edited).toMatchObject({ status: 'watching' });
    expect(edited.hitAt).toBeUndefined();

    const manual = { ...base, snapshots: base.snapshots.slice(0, 1), status: 'hit' as const, hitReason: 'manual' as const, hitAt: '2026-01-02T00:00:00.000Z' };
    expect(reconcileStatus(manual, settings)).toBe(manual);
    const dropped = { ...base, status: 'dropped' as const };
    expect(reconcileStatus(dropped, settings)).toBe(dropped);
  });
});

describe('staleness and stats', () => {
  it('flags watching picks not updated within the interval', () => {
    const c = claim({ claimedAt: '2026-01-01', snapshots: [snap('2026-01-01', { views: 1 })] });
    expect(isStale(c, 14, Date.parse('2026-01-10'))).toBe(false);
    expect(isStale(c, 14, Date.parse('2026-01-16'))).toBe(true);
    expect(isStale({ ...c, status: 'hit' }, 14, Date.parse('2026-06-01'))).toBe(false);
  });

  it('summarises the log', () => {
    const a = claim({ claimedAt: '2026-01-01', status: 'hit', hitAt: '2026-01-11T00:00:00Z', snapshots: [snap('2026-01-01', { views: 10 }), snap('2026-01-11', { views: 30 })] });
    const b = claim({ claimedAt: '2026-02-01', snapshots: [snap('2026-02-01', { views: 10 })] });
    const s = computeStats([a, b]);
    expect(s).toMatchObject({ total: 2, hits: 1, watching: 1, hitRate: 0.5, checkins: 1 });
    expect(s.best?.mult).toBe(3);
    expect(s.avgDaysToHit).toBeCloseTo(10, 0);
  });
});
