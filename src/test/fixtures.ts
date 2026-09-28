import type { Claim, Metrics, Snapshot } from '../types';

let seq = 0;

export function snap(at: string, values: Metrics, memo?: string): Snapshot {
  return { id: `s${++seq}`, at: new Date(at).toISOString(), values, ...(memo ? { memo } : {}) };
}

/** A pick whose first snapshot is taken at `claimedAt`. */
export function claim(partial: Partial<Claim> & { claimedAt: string; snapshots: Snapshot[] }): Claim {
  const claimedAt = new Date(partial.claimedAt).toISOString();
  return {
    id: partial.id ?? `c${++seq}`,
    artist: 'Artist',
    track: 'Track',
    tags: [],
    note: '',
    primary: 'views',
    status: 'watching',
    createdAt: claimedAt,
    updatedAt: claimedAt,
    ...partial,
    claimedAt,
  };
}
