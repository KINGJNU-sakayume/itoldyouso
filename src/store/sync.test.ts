import { describe, expect, it, vi } from 'vitest';
import type { VaultDoc } from '../types';

// In-memory stand-in for the Supabase table, with the same optimistic-lock rule.
const remote = vi.hoisted(() => ({
  row: null as { doc: unknown; rev: number } | null,
  pushes: 0,
  /** Simulates another device writing between our fetch and our push. */
  beforePush: null as null | (() => void),
}));

vi.mock('../lib/supabase', () => ({
  cloudEnabled: true,
  getSession: async () => null,
  onAuthChange: async () => () => {},
  signIn: async () => ({ user: { id: 'me', email: 'me@example.com' } }),
  signOut: async () => {},
  fetchLegacyClaims: async () => [],
  fetchRemote: async () => (remote.row ? structuredClone(remote.row) : null),
  pushRemote: async (doc: VaultDoc, baseRev: number | null) => {
    remote.beforePush?.();
    remote.beforePush = null;
    if ((remote.row?.rev ?? null) !== baseRev) return false;
    remote.row = { doc: structuredClone(doc), rev: (baseRev ?? 0) + 1 };
    remote.pushes++;
    return remote.row.rev;
  },
}));

const { useSync } = await import('./authStore');
const { useVault } = await import('./vaultStore');

const draft = (track: string) => ({
  artist: 'A',
  track,
  tags: [],
  note: '',
  primary: 'views' as const,
  claimedAt: new Date().toISOString(),
  entry: { views: 100 },
});

async function settled() {
  // Let debounced schedules fire and the engine go idle.
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 50));
    if (useSync.getState().status !== 'syncing') {
      await new Promise(r => setTimeout(r, 50));
      if (useSync.getState().status !== 'syncing') return;
    }
  }
  throw new Error('sync never settled');
}

const remoteTracks = () => ((remote.row?.doc as VaultDoc).claims ?? []).map(c => c.track).sort();
const localTracks = () => useVault.getState().claims.map(c => c.track).sort();

describe('cloud sync', () => {
  it('uploads local picks on first sign-in', async () => {
    useSync.getState().start();
    await settled();
    expect(useSync.getState().status).toBe('signed-out');
    useVault.getState().addClaim(draft('local-1'));
    await useSync.getState().signIn('me@example.com', 'pw');
    await settled();
    expect(useSync.getState().status).toBe('synced');
    expect(remoteTracks()).toEqual(['local-1']);
  });

  it('pulls a pick made on another device without pushing back', async () => {
    const other = structuredClone(remote.row!.doc) as VaultDoc;
    other.claims.push({ ...useVault.getState().claims[0], id: 'from-phone', track: 'phone-1' });
    remote.row = { doc: other, rev: remote.row!.rev + 1 };
    const pushes = remote.pushes;

    useSync.getState().syncNow();
    await settled();
    expect(localTracks()).toEqual(['local-1', 'phone-1']);
    expect(remote.pushes).toBe(pushes);
  });

  it('pushes local edits and deletions after a short debounce', async () => {
    const id = useVault.getState().claims.find(c => c.track === 'local-1')!.id;
    useVault.getState().removeClaim(id);
    await new Promise(r => setTimeout(r, 1700));
    await settled();
    expect(remoteTracks()).toEqual(['phone-1']);
    expect((remote.row!.doc as VaultDoc).tombstones[id]).toBeTruthy();
  });

  it('re-merges instead of overwriting when another device wrote first', async () => {
    remote.beforePush = () => {
      const other = structuredClone(remote.row!.doc) as VaultDoc;
      other.claims.push({ ...other.claims[0], id: 'laptop', track: 'laptop-1', updatedAt: new Date().toISOString() });
      remote.row = { doc: other, rev: remote.row!.rev + 1 };
    };
    useVault.getState().addClaim(draft('local-2'));
    await new Promise(r => setTimeout(r, 1700));
    await settled();
    expect(remoteTracks()).toEqual(['laptop-1', 'local-2', 'phone-1']);
    expect(localTracks()).toEqual(['laptop-1', 'local-2', 'phone-1']);
  });
});
