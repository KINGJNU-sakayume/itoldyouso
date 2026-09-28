import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Claim, ClaimDraft, Metrics, Settings, Snapshot, VaultDoc } from '../types';
import { METRIC_KEYS } from '../types';
import { emptyDoc, mergeDocs, normalizeDoc } from '../lib/doc';
import { reconcileStatus, sortSnapshots } from '../lib/metrics';
import { uid } from '../lib/id';

type VaultData = Omit<VaultDoc, 'app' | 'version'>;

interface VaultActions {
  addClaim: (draft: ClaimDraft) => Claim;
  updateClaim: (id: string, draft: ClaimDraft) => void;
  removeClaim: (id: string) => Claim | undefined;
  restoreClaim: (claim: Claim) => void;
  /** Returns whether this check-in turned the pick into a hit. */
  addSnapshot: (id: string, snap: { at: string; values: Metrics; memo?: string }) => { newlyHit: boolean };
  removeSnapshot: (id: string, snapshotId: string) => void;
  setStatus: (id: string, status: Claim['status'], note?: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  markSeen: (ids: string[]) => void;
  getDoc: () => VaultDoc;
  /** Used by sync: the merged document becomes the local state. */
  replaceDoc: (doc: VaultDoc) => void;
  importDoc: (doc: VaultDoc, mode: 'merge' | 'replace') => void;
  resetAll: () => void;
}

export type VaultState = VaultData & VaultActions;

const now = () => new Date().toISOString();

function cleanMetrics(values: Metrics): Metrics {
  const out: Metrics = {};
  for (const k of METRIC_KEYS) {
    const v = values[k];
    if (v != null && Number.isFinite(v) && v >= 0) out[k] = Math.round(v);
  }
  return out;
}

function draftFields(d: ClaimDraft) {
  return {
    artist: d.artist.trim(),
    track: d.track.trim(),
    youtubeUrl: d.youtubeUrl?.trim() || undefined,
    link: d.link?.trim() || undefined,
    imageUrl: d.imageUrl?.trim() || undefined,
    tags: [...new Set(d.tags.map(t => t.trim()).filter(Boolean))],
    note: d.note.trim(),
    primary: d.primary,
    target: d.target,
    claimedAt: d.claimedAt,
  };
}

function dataOf(s: VaultData): VaultData {
  return {
    claims: s.claims,
    tombstones: s.tombstones,
    settings: s.settings,
    settingsUpdatedAt: s.settingsUpdatedAt,
    seen: s.seen,
  };
}

const initial = dataOf(emptyDoc());

export const useVault = create<VaultState>()(
  persist(
    (set, get) => {
      const patchClaim = (id: string, fn: (c: Claim) => Claim) =>
        set(s => ({ claims: s.claims.map(c => (c.id === id ? fn(c) : c)) }));

      return {
        ...initial,

        addClaim: draft => {
          const t = now();
          const claim: Claim = {
            id: uid(),
            ...draftFields(draft),
            snapshots: [{ id: uid(), at: draft.claimedAt, values: cleanMetrics(draft.entry) }],
            status: 'watching',
            createdAt: t,
            updatedAt: t,
          };
          set(s => ({ claims: [...s.claims, claim] }));
          return claim;
        },

        updateClaim: (id, draft) =>
          patchClaim(id, c => {
            const [entry, ...rest] = c.snapshots;
            const snapshots = sortSnapshots([
              { ...entry, at: draft.claimedAt, values: cleanMetrics(draft.entry) },
              ...rest,
            ]);
            return reconcileStatus({ ...c, ...draftFields(draft), snapshots, updatedAt: now() }, get().settings);
          }),

        removeClaim: id => {
          const claim = get().claims.find(c => c.id === id);
          if (!claim) return undefined;
          set(s => ({
            claims: s.claims.filter(c => c.id !== id),
            tombstones: { ...s.tombstones, [id]: now() },
          }));
          return claim;
        },

        restoreClaim: claim =>
          set(s => {
            const tombstones = { ...s.tombstones };
            delete tombstones[claim.id];
            return {
              tombstones,
              claims: [...s.claims.filter(c => c.id !== claim.id), { ...claim, updatedAt: now() }],
            };
          }),

        addSnapshot: (id, { at, values, memo }) => {
          const before = get().claims.find(c => c.id === id);
          if (!before) return { newlyHit: false };
          const snap: Snapshot = {
            id: uid(),
            // A check-in can never predate the pick itself.
            at: at < before.claimedAt ? before.claimedAt : at,
            values: cleanMetrics(values),
            ...(memo?.trim() ? { memo: memo.trim() } : {}),
          };
          const next = reconcileStatus(
            { ...before, snapshots: sortSnapshots([...before.snapshots, snap]), updatedAt: now() },
            get().settings,
          );
          patchClaim(id, () => next);
          return { newlyHit: before.status !== 'hit' && next.status === 'hit' };
        },

        removeSnapshot: (id, snapshotId) =>
          patchClaim(id, c => {
            if (c.snapshots[0]?.id === snapshotId) return c;
            return reconcileStatus(
              { ...c, snapshots: c.snapshots.filter(s => s.id !== snapshotId), updatedAt: now() },
              get().settings,
            );
          }),

        setStatus: (id, status, note) =>
          patchClaim(id, c => {
            const base = { ...c, statusNote: note?.trim() || undefined, updatedAt: now() };
            if (status === 'hit') return { ...base, status: 'hit', hitAt: now(), hitReason: 'manual' };
            const cleared = { ...base, status, hitAt: undefined, hitReason: undefined };
            return status === 'watching' ? reconcileStatus(cleared, get().settings) : cleared;
          }),

        updateSettings: patch =>
          set(s => {
            const settings = { ...s.settings, ...patch };
            const claims =
              patch.hitMultiplier != null && patch.hitMultiplier !== s.settings.hitMultiplier
                ? s.claims.map(c => {
                    const next = reconcileStatus(c, settings);
                    return next === c ? c : { ...next, updatedAt: now() };
                  })
                : s.claims;
            return { settings, settingsUpdatedAt: now(), claims };
          }),

        markSeen: ids => set(s => ({ seen: [...new Set([...s.seen, ...ids])] })),

        getDoc: () => ({ app: 'itoldyouso', version: 2, ...dataOf(get()) }),

        replaceDoc: doc => set(dataOf(doc)),

        importDoc: (doc, mode) => {
          const current = get().getDoc();
          if (mode === 'merge') {
            set(dataOf(mergeDocs(current, doc)));
            return;
          }
          const t = now();
          const incoming = new Set(doc.claims.map(c => c.id));
          const tombstones = { ...current.tombstones, ...doc.tombstones };
          for (const c of current.claims) if (!incoming.has(c.id)) tombstones[c.id] = t;
          for (const c of doc.claims) delete tombstones[c.id];
          set({
            // Bumped so the imported copy also wins against other synced devices.
            claims: doc.claims.map(c => ({ ...c, updatedAt: t })),
            tombstones,
            settings: doc.settings,
            settingsUpdatedAt: t,
            seen: [...new Set([...current.seen, ...doc.seen])],
          });
        },

        resetAll: () =>
          set(s => {
            const t = now();
            const tombstones = { ...s.tombstones };
            for (const c of s.claims) tombstones[c.id] = t;
            return { claims: [], tombstones, seen: [] };
          }),
      };
    },
    {
      name: 'itys-vault',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: s => dataOf(s),
      // Whatever is in storage is validated before it becomes state.
      merge: (persisted, current) => {
        const doc = normalizeDoc({ app: 'itoldyouso', ...(persisted as object) });
        return doc ? { ...current, ...dataOf(doc) } : current;
      },
    },
  ),
);

// Keep several open tabs in step.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === 'itys-vault') void useVault.persist.rehydrate();
  });
}
