import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import * as cloud from '../lib/supabase';
import { canonical, mergeDocs, normalizeDoc } from '../lib/doc';
import { useVault } from './vaultStore';

/**
 * Cloud sync session + engine. Local storage is always the source the UI
 * reads from; when signed in, every change is merged with the remote copy
 * and pushed back with optimistic locking.
 */
export type SyncStatus = 'off' | 'loading' | 'signed-out' | 'syncing' | 'synced' | 'error';

interface SyncState {
  status: SyncStatus;
  email: string | null;
  lastSyncedAt: string | null;
  /** True once the first pull after sign-in has finished. */
  ready: boolean;
  error: string | null;
  start: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => void;
}

let started = false;
let owner: string | null = null;
let lastSynced: string | null = null;
let running = false;
let queued = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function run() {
  if (!owner) return;
  if (running) {
    queued = true;
    return;
  }
  running = true;
  useSync.setState({ status: 'syncing', error: null });
  try {
    for (let attempt = 0; ; attempt++) {
      if (attempt >= 4) throw new Error('Too many concurrent writes, try again');
      const remote = await cloud.fetchRemote();
      const remoteDoc = remote ? normalizeDoc(remote.doc) : null;
      // Read local only after the await so edits made meanwhile are included.
      const local = useVault.getState().getDoc();
      const merged = remoteDoc ? mergeDocs(local, remoteDoc) : local;
      const key = canonical(merged);
      if (key !== canonical(local)) useVault.getState().replaceDoc(merged);
      if (remoteDoc && key === canonical(remoteDoc)) {
        lastSynced = key;
        break;
      }
      const rev = await cloud.pushRemote(merged, remote ? remote.rev : null, owner);
      if (rev !== false) {
        lastSynced = key;
        break;
      }
    }
    useSync.setState({ status: 'synced', ready: true, lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    useSync.setState({ status: 'error', ready: true, error: message(e) });
  } finally {
    running = false;
    if (queued) {
      queued = false;
      schedule(0, true);
    }
  }
}

function schedule(delay: number, force = false) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!owner) return;
    if (!force && lastSynced === canonical(useVault.getState().getDoc())) return;
    void run();
  }, delay);
}

function applySession(session: Session | null) {
  const user = session?.user ?? null;
  if (user) {
    if (owner === user.id) return;
    owner = user.id;
    lastSynced = null;
    useSync.setState({ email: user.email ?? null, status: 'syncing', ready: false });
    schedule(0, true);
  } else {
    owner = null;
    lastSynced = null;
    useSync.setState({ email: null, status: 'signed-out', ready: true });
  }
}

export const useSync = create<SyncState>(() => ({
  status: cloud.cloudEnabled ? 'loading' : 'off',
  email: null,
  lastSyncedAt: null,
  ready: !cloud.cloudEnabled,
  error: null,

  start: () => {
    if (started || !cloud.cloudEnabled) return;
    started = true;
    cloud
      .getSession()
      .then(applySession)
      .catch(e => useSync.setState({ status: 'error', ready: true, error: message(e) }));
    void cloud.onAuthChange(applySession);
    // Every local change is pushed shortly after it happens.
    useVault.subscribe(() => owner && schedule(1500));
    // Coming back online or to the tab picks up what other devices did meanwhile.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => owner && schedule(0, true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && owner) schedule(0, true);
      });
    }
  },

  signIn: async (email, password) => {
    applySession(await cloud.signIn(email, password));
  },

  signOut: async () => {
    await cloud.signOut();
    applySession(null);
  },

  syncNow: () => schedule(0, true),
}));
