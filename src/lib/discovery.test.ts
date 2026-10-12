import { describe, expect, it } from 'vitest';
import { claim, snap } from '../test/fixtures';
import { baselinePoint, entryValue, findHit, growthOf, headline, peakMult, reconcileStatus } from './metrics';
import { emptyDoc, normalizeDoc, toBackupJson, toCsv } from './doc';
import { evaluateAchievements } from './achievements';

const discovered = '2026-01-10T10:23:45.123Z';
const later = '2026-04-10T10:00:00.000Z';
const latest = '2026-06-10T10:00:00.000Z';

describe('discovery baselines and compatibility', () => {
  it('archives empty observations without inventing zeros through backup and CSV', () => {
    const c = claim({ claimedAt: discovered, snapshots: [snap(discovered, {})] });
    const doc = { ...emptyDoc(), claims: [c] };
    const out = normalizeDoc(JSON.parse(toBackupJson(doc)))!;
    expect(out.claims).toEqual([c]);
    expect(headline(c)).toBeUndefined();
    expect(findHit(c, doc.settings)).toBeNull();
    expect(toCsv(out.claims)).toContain('Artist,Track,watching');
    expect(toCsv(out.claims)).not.toContain(',-1,');
    expect(evaluateAchievements([c])).toHaveLength(37);
    expect(evaluateAchievements([c]).find(a => a.id === 'basement_3')?.earnedAt).toBeNull();
  });

  it('uses later measurements as baselines, never discovery-time values', () => {
    const c = claim({ claimedAt: discovered, snapshots: [snap(discovered, { views: 3000 }), snap(later, { listeners: 15000 }), snap(latest, { listeners: 30000 })], primary: 'listeners' });
    expect(entryValue(c, 'listeners')).toBeUndefined();
    expect(entryValue(c, 'views')).toBe(3000);
    expect(baselinePoint(c, 'listeners')).toEqual({ value: 15000, at: later });
    expect(growthOf(c, 'listeners')).toMatchObject({ entry: 15000, latest: 30000, mult: 2, baselineAt: later, atDiscovery: false });
    expect(peakMult(c)).toBe(2);
    expect(findHit(c, emptyDoc().settings)).toEqual({ at: latest, reason: 'growth' });
    const csv = toCsv([c]).split('\r\n');
    const row = Object.fromEntries(csv[0].replace(/^\uFEFF/, '').split(',').map((k, i) => [k, csv[1].split(',')[i]]));
    expect(row.entry_listeners).toBe('');
    expect(row.baseline_listeners_at).toBe(later);
  });

  it('requires a later positive-baseline comparison, while explicit predictions can be reached on the first later measurement', () => {
    const c = claim({ claimedAt: discovered, snapshots: [snap(discovered, {}), snap(later, { views: 100 })] });
    expect(growthOf(c, 'views')?.mult).toBeNull();
    expect(findHit(c, emptyDoc().settings)).toBeNull();
    expect(findHit({ ...c, target: { metric: 'views', value: 100 } }, emptyDoc().settings)?.reason).toBe('target');
    for (const baseline of [0, 100]) {
      const sameTime = { ...c, snapshots: [snap(later, { views: baseline }), snap(later, { views: 500 })] };
      expect(growthOf(sameTime, 'views')?.mult).toBeNull();
      expect(findHit(sameTime, emptyDoc().settings)).toBeNull();
    }
  });

  it('migrates v2 without changing history, settings, predictions or manual statuses', () => {
    const c = claim({ claimedAt: discovered, snapshots: [snap(discovered, { views: 1.6 }), snap(later, { views: 4 })], status: 'hit', hitReason: 'manual', hitAt: latest, note: 'original note', tags: ['indie'], target: { metric: 'views', value: 8 }, createdAt: later, updatedAt: latest });
    const old = { ...emptyDoc(), version: 2, settings: { hitMultiplier: 2, monthlyLimit: 5, staleDays: 14 }, claims: [c], tombstones: { deleted: later } };
    const migrated = normalizeDoc(old)!;
    expect(migrated.version).toBe(3);
    expect(migrated.claims[0]).toEqual(c);
    expect(migrated.settings).toEqual(old.settings);
    expect(migrated.tombstones).toEqual(old.tombstones);
    expect(migrated.claims[0].metricSources).toBeUndefined();
    const missing = normalizeDoc({ ...old, claims: [{ ...c, createdAt: undefined, hitAt: undefined }] })!.claims[0];
    expect(missing.createdAt).toBeUndefined();
    expect(missing.hitAt).toBeUndefined();
    expect(reconcileStatus(migrated.claims[0], migrated.settings)).toBe(migrated.claims[0]);
    expect(normalizeDoc({ ...old, version: 999 })).toBeNull();
  });

  it('does not award discovery obscurity for a low metric first measured later', () => {
    const c = claim({ claimedAt: discovered, snapshots: [snap(discovered, {}), snap(later, { views: 10 }), snap(latest, { views: 100 })] });
    const achievements = evaluateAchievements([c]);
    expect(achievements.find(a => a.id === 'basement_3')?.earnedAt).toBeNull();
    expect(achievements.find(a => a.id === 'x10')?.earnedAt).toBe(latest);
  });
});
