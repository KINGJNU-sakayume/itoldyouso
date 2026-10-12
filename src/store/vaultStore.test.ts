import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimDraft } from '../types';
import { emptyDoc, normalizeDoc, toBackupJson } from '../lib/doc';

vi.hoisted(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => items.set(k, v),
    removeItem: (k: string) => items.delete(k),
    clear: () => items.clear(),
  });
});
import { useVault } from './vaultStore';

const draft = (patch: Partial<ClaimDraft> = {}): ClaimDraft => ({ artist: 'Artist', track: 'Track', note: 'original note', tags: ['indie'], primary: 'views', claimedAt: '2026-01-10T10:23:45.123Z', entry: {}, ...patch });
beforeEach(() => { localStorage.clear(); useVault.setState({ ...emptyDoc() }); });

describe('vault data preservation', () => {
  it('saves without metrics, reloads storage, and survives merge and replace imports', async () => {
    const c = useVault.getState().addClaim(draft());
    const backup = normalizeDoc(JSON.parse(toBackupJson(useVault.getState().getDoc())))!;
    await useVault.persist.rehydrate();
    expect(useVault.getState().claims[0]).toEqual(c);
    useVault.getState().importDoc(backup, 'replace');
    useVault.getState().importDoc(backup, 'merge');
    expect(useVault.getState().claims).toHaveLength(1);
    expect(useVault.getState().claims[0].snapshots[0].values).toEqual({});
  });

  it('preserves creation and observations through a metadata edit, including locked source history', () => {
    const d = draft({ entry: { views: 1.6 }, metricSources: { views: 'YouTube video A' } });
    const c = useVault.getState().addClaim(d);
    useVault.getState().addSnapshot(c.id, { at: '2026-04-10T10:00:00.000Z', values: { views: 4, listeners: 100 } });
    const before = useVault.getState().claims[0];
    useVault.getState().updateClaim(c.id, { ...d, note: 'new note', metricSources: { views: 'different video' } });
    const after = useVault.getState().claims[0];
    expect(after.createdAt).toBe(c.createdAt);
    expect(after.claimedAt).toBe(c.claimedAt);
    expect(after.snapshots).toEqual(before.snapshots);
    expect(after.metricSources?.views).toBe('YouTube video A');
    expect(after.target).toEqual(c.target);
  });

  it('introduces a metric later, handles delete and undo, and retains tombstones across merge', () => {
    const c = useVault.getState().addClaim(draft());
    const backup = useVault.getState().getDoc();
    useVault.getState().addSnapshot(c.id, { at: '2026-04-10T10:00:00.000Z', values: { views: 100 } });
    expect(useVault.getState().claims[0].status).toBe('watching');
    const removed = useVault.getState().removeClaim(c.id)!;
    useVault.getState().importDoc(backup, 'merge');
    expect(useVault.getState().claims).toHaveLength(0);
    useVault.getState().restoreClaim(removed);
    expect(useVault.getState().claims[0].snapshots.at(-1)?.values.views).toBe(100);
    expect(useVault.getState().tombstones[c.id]).toBeUndefined();
  });

  it('rehydrates a persisted v2 vault using the explicit migration', async () => {
    const c = useVault.getState().addClaim(draft({ entry: { views: 100 } }));
    const old = { claims: [c], tombstones: {}, settings: { monthlyLimit: 5, staleDays: 14, hitMultiplier: 2 }, settingsUpdatedAt: c.updatedAt, seen: [] };
    localStorage.setItem('itys-vault', JSON.stringify({ state: old, version: 2 }));
    await useVault.persist.rehydrate();
    expect(useVault.getState().claims[0]).toEqual(c);
    expect(useVault.getState().settings).toEqual(old.settings);
    expect(JSON.parse(localStorage.getItem('itys-vault')!).version).toBe(3);
  });
});
