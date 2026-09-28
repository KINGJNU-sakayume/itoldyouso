import { describe, expect, it } from 'vitest';
import { claim, snap } from '../test/fixtures';
import { canonical, emptyDoc, mergeDocs, normalizeDoc, sameDoc, toCsv } from './doc';
import type { VaultDoc } from '../types';

const doc = (patch: Partial<VaultDoc>): VaultDoc => ({ ...emptyDoc(), ...patch });

describe('normalizeDoc', () => {
  it('rejects anything that is not a backup', () => {
    expect(normalizeDoc(null)).toBeNull();
    expect(normalizeDoc({ claims: [] })).toBeNull();
    expect(normalizeDoc({ app: 'something-else', claims: [] })).toBeNull();
  });

  it('drops invalid picks and cleans the rest', () => {
    const good = claim({ claimedAt: '2026-01-01', tags: ['a', 'a', ' b '], snapshots: [snap('2026-01-02', { views: 5 }), snap('2026-01-01', { views: 1.6 })] });
    const out = normalizeDoc({
      app: 'itoldyouso',
      claims: [good, { id: 'x' }, { ...good, id: 'no-snaps', snapshots: [] }, 'junk'],
      settings: { hitMultiplier: 0, monthlyLimit: -3, staleDays: 'soon' },
    })!;
    expect(out.claims).toHaveLength(1);
    expect(out.claims[0].tags).toEqual(['a', 'b']);
    expect(out.claims[0].snapshots.map(s => s.values.views)).toEqual([2, 5]);
    expect(out.settings).toEqual({ hitMultiplier: 1.1, monthlyLimit: 0, staleDays: 14 });
  });
});

describe('mergeDocs', () => {
  const a1 = claim({ id: 'a', claimedAt: '2026-01-01', updatedAt: '2026-01-01T00:00:00.000Z', note: 'old', snapshots: [snap('2026-01-01', { views: 1 })] });
  const a2 = { ...a1, note: 'new', updatedAt: '2026-02-01T00:00:00.000Z' };
  const b = claim({ id: 'b', claimedAt: '2026-01-05', snapshots: [snap('2026-01-05', { views: 1 })] });

  it('keeps the newest edit of each pick and unions the rest', () => {
    const merged = mergeDocs(doc({ claims: [a1, b] }), doc({ claims: [a2] }));
    expect(merged.claims.map(c => [c.id, c.note]).sort()).toEqual([
      ['a', 'new'],
      ['b', ''],
    ]);
  });

  it('lets a later delete win and a later edit resurrect', () => {
    const deleted = doc({ tombstones: { a: '2026-01-15T00:00:00.000Z' } });
    expect(mergeDocs(doc({ claims: [a1] }), deleted).claims).toHaveLength(0);
    expect(mergeDocs(doc({ claims: [a2] }), deleted).claims).toHaveLength(1);
  });

  it('takes the most recently changed settings and unions seen achievements', () => {
    const x = doc({ settings: { hitMultiplier: 3, monthlyLimit: 5, staleDays: 14 }, settingsUpdatedAt: '2026-03-01T00:00:00.000Z', seen: ['x2'] });
    const y = doc({ settings: { hitMultiplier: 5, monthlyLimit: 0, staleDays: 7 }, settingsUpdatedAt: '2026-02-01T00:00:00.000Z', seen: ['first_pick'] });
    const merged = mergeDocs(x, y);
    expect(merged.settings.hitMultiplier).toBe(3);
    expect(merged.seen.sort()).toEqual(['first_pick', 'x2']);
  });

  it('is commutative, so two devices converge', () => {
    const x = doc({ claims: [a1, b], tombstones: { z: '2026-01-01T00:00:00.000Z' } });
    const y = doc({ claims: [a2], seen: ['x2'] });
    expect(canonical(mergeDocs(x, y))).toBe(canonical(mergeDocs(y, x)));
    expect(sameDoc(mergeDocs(x, x), x)).toBe(true);
  });
});

describe('toCsv', () => {
  it('quotes fields that need it and starts with a BOM', () => {
    const c = claim({ claimedAt: '2026-01-01', artist: 'A, B', track: 'Say "hi"', note: 'line1\nline2', snapshots: [snap('2026-01-01', { views: 10 }), snap('2026-01-02', { views: 25 })] });
    const csv = toCsv([c]);
    expect(csv.startsWith('﻿')).toBe(true);
    const row = csv.split('\r\n')[1];
    expect(row).toContain('"A, B"');
    expect(row).toContain('"Say ""hi"""');
    expect(row).toContain('"line1\nline2"');
    expect(row).toContain(',150,');
  });
});
