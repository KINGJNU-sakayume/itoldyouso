import { describe, expect, it } from 'vitest';
import { claim, snap } from '../test/fixtures';
import { ACHIEVEMENT_COUNT, evaluateAchievements } from './achievements';
import type { Claim } from '../types';

const byId = (claims: Claim[]) => Object.fromEntries(evaluateAchievements(claims).map(r => [r.id, r]));

describe('achievements', () => {
  it('has unique ids and the advertised count', () => {
    const ids = evaluateAchievements([]).map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(ACHIEVEMENT_COUNT);
  });

  it('earns nothing on an empty log', () => {
    expect(evaluateAchievements([]).filter(r => r.earnedAt)).toEqual([]);
  });

  it('dates discovery achievements to the pick', () => {
    const c = claim({ claimedAt: '2026-03-01T03:10:00', snapshots: [snap('2026-03-01T03:10:00', { views: 800, listeners: 4000 })] });
    const r = byId([c]);
    for (const id of ['first_pick', 'basement_1', 'basement_2', 'basement_3', 'small_room', 'two_am', 'opening_day']) {
      expect(r[id].earnedAt, id).toBe(c.claimedAt);
      expect(r[id].claimId, id).toBe(c.id);
    }
    expect(r.x2.earnedAt).toBeNull();
  });

  it('dates growth achievements to the check-in that crossed the line', () => {
    const c = claim({
      claimedAt: '2026-01-01',
      snapshots: [
        snap('2026-01-01', { views: 50_000 }),
        snap('2026-01-20', { views: 120_000 }),
        snap('2026-03-15', { views: 600_000 }),
        snap('2026-06-01', { views: 1_200_000 }),
      ],
    });
    const r = byId([c]);
    expect(r.x2.earnedAt).toBe(c.snapshots[1].at);
    expect(r.liftoff.earnedAt).toBe(c.snapshots[1].at);
    expect(r.viral.earnedAt).toBe(c.snapshots[2].at); // ×12 on day 73
    expect(r.x10.earnedAt).toBe(c.snapshots[2].at);
    expect(r.ten_million.earnedAt).toBeNull();
    expect(r.million.earnedAt).toBe(c.snapshots[3].at);
    expect(r.x100.progress).toEqual({ current: 24, goal: 100, kind: 'mult' });
  });

  it('counts hits, streaks and clean months', () => {
    const local = (month: number, day: number) => new Date(2026, month - 1, day, 12).toISOString();
    const hit = (month: number, day: number): Claim =>
      claim({
        claimedAt: local(month, day),
        status: 'hit',
        hitAt: local(month, day + 3),
        hitReason: 'manual',
        snapshots: [snap(local(month, day), { views: 10 })],
      });
    const picks = [hit(1, 3), hit(1, 10), hit(1, 20), claim({ claimedAt: local(2, 1), snapshots: [snap(local(2, 1), { views: 1 })] })];
    const r = byId(picks);
    expect(r.told_you_so.earnedAt).toBe(picks[0].hitAt);
    expect(r.hat_trick.earnedAt).toBe(picks[2].hitAt);
    expect(r.hot_streak.earnedAt).toBe(picks[2].hitAt);
    expect(r.clean_sheet.earnedAt).toBe(picks[2].hitAt);
    expect(r.quick_call.earnedAt).toBe(picks[0].hitAt);
    expect(r.ten_hits.progress).toMatchObject({ current: 3, goal: 10 });
    expect(r.oracle.progress).toMatchObject({ current: 4, goal: 10 });
  });

  it('needs consecutive calendar months for the habit badges', () => {
    const at = (m: number) => claim({ claimedAt: new Date(2026, m, 10).toISOString(), snapshots: [snap(new Date(2026, m, 10).toISOString(), { views: 1 })] });
    expect(byId([at(0), at(1), at(3)]).regular.earnedAt).toBeNull();
    const run = [at(0), at(2), at(3), at(4)];
    expect(byId(run).regular.earnedAt).toBe(run[3].claimedAt);
  });

  it('rewards a prediction that came true', () => {
    const c = claim({
      claimedAt: '2026-01-01',
      target: { metric: 'streams', value: 1000 },
      snapshots: [snap('2026-01-01', { streams: 100 }), snap('2026-02-01', { streams: 999 }), snap('2026-03-01', { streams: 1000 })],
    });
    expect(byId([c]).bullseye.earnedAt).toBe(c.snapshots[2].at);
  });
});
