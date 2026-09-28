import { METRIC_KEYS } from '../types';
import type { Claim, HitReason, MetricKey, Settings, Snapshot } from '../types';
import { DAY } from './format';

export function sortSnapshots(snapshots: Snapshot[]): Snapshot[] {
  return [...snapshots].sort((a, b) => a.at.localeCompare(b.at));
}

export function entryValue(c: Claim, m: MetricKey): number | undefined {
  for (const s of c.snapshots) {
    const v = s.values[m];
    if (v != null) return v;
  }
  return undefined;
}

export function latestPoint(c: Claim, m: MetricKey): { value: number; at: string } | undefined {
  for (let i = c.snapshots.length - 1; i >= 0; i--) {
    const v = c.snapshots[i].values[m];
    if (v != null) return { value: v, at: c.snapshots[i].at };
  }
  return undefined;
}

/** Metrics with at least one recorded value, in display order. */
export function trackedMetrics(c: Claim): MetricKey[] {
  return METRIC_KEYS.filter(m => c.snapshots.some(s => s.values[m] != null));
}

/** The metric growth is measured on: the chosen primary, or the first one that has data. */
export function baseMetric(c: Claim): MetricKey | undefined {
  if (entryValue(c, c.primary) != null) return c.primary;
  return trackedMetrics(c)[0];
}

export interface Growth {
  metric: MetricKey;
  entry: number;
  latest: number;
  latestAt: string;
  /** latest / entry. null until a second data point exists (or entry is 0). */
  mult: number | null;
}

export function growthOf(c: Claim, m: MetricKey): Growth | undefined {
  const entry = entryValue(c, m);
  const last = latestPoint(c, m);
  if (entry == null || !last) return undefined;
  const points = c.snapshots.reduce((n, s) => n + (s.values[m] != null ? 1 : 0), 0);
  return {
    metric: m,
    entry,
    latest: last.value,
    latestAt: last.at,
    mult: entry > 0 && points > 1 ? last.value / entry : null,
  };
}

export function headline(c: Claim): Growth | undefined {
  const m = baseMetric(c);
  return m ? growthOf(c, m) : undefined;
}

/** Highest multiplier the primary metric ever reached (not just the latest). */
export function peakMult(c: Claim): number | null {
  const m = baseMetric(c);
  const entry = m ? entryValue(c, m) : undefined;
  if (!m || !entry) return null;
  let best: number | null = null;
  for (const s of c.snapshots.slice(1)) {
    const v = s.values[m];
    if (v != null) best = Math.max(best ?? 0, v / entry);
  }
  return best;
}

export function lastUpdateAt(c: Claim): string {
  return c.snapshots[c.snapshots.length - 1]?.at ?? c.claimedAt;
}

export function isStale(c: Claim, staleDays: number, now: number = Date.now()): boolean {
  return c.status === 'watching' && now - new Date(lastUpdateAt(c)).getTime() >= staleDays * DAY;
}

/** First check-in that satisfies the hit rule, if any. The entry snapshot never counts. */
export function findHit(c: Claim, settings: Settings): { at: string; reason: HitReason } | null {
  const m = baseMetric(c);
  const entry = m ? entryValue(c, m) : undefined;
  for (const s of c.snapshots.slice(1)) {
    if (c.target) {
      const v = s.values[c.target.metric];
      if (v != null && v >= c.target.value) return { at: s.at, reason: 'target' };
    }
    if (m && entry) {
      const v = s.values[m];
      if (v != null && v / entry >= settings.hitMultiplier) return { at: s.at, reason: 'growth' };
    }
  }
  return null;
}

/**
 * Keeps an automatic hit in line with the data: set when the rule is met,
 * lifted again if the snapshot that met it was edited away. Manual hits and
 * drops are the user's call and are left alone.
 */
export function reconcileStatus(c: Claim, settings: Settings): Claim {
  if (c.status === 'dropped') return c;
  if (c.status === 'hit' && c.hitReason === 'manual') return c;
  const hit = findHit(c, settings);
  if (hit) {
    if (c.status === 'hit' && c.hitAt === hit.at && c.hitReason === hit.reason) return c;
    return { ...c, status: 'hit', hitAt: hit.at, hitReason: hit.reason };
  }
  if (c.status === 'hit') return { ...c, status: 'watching', hitAt: undefined, hitReason: undefined };
  return c;
}

export function isSameMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function picksThisMonth(claims: Claim[], now: Date = new Date()): number {
  return claims.filter(c => isSameMonth(c.claimedAt, now)).length;
}

export function checkinCount(claims: Claim[]): number {
  return claims.reduce((n, c) => n + Math.max(0, c.snapshots.length - 1), 0);
}

export interface Stats {
  total: number;
  watching: number;
  hits: number;
  dropped: number;
  /** hits / (hits + dropped + watching) */
  hitRate: number | null;
  avgDaysToHit: number | null;
  best: { claim: Claim; mult: number } | null;
  checkins: number;
}

export function computeStats(claims: Claim[]): Stats {
  const hits = claims.filter(c => c.status === 'hit');
  const toHit = hits
    .filter(c => c.hitAt)
    .map(c => (new Date(c.hitAt!).getTime() - new Date(c.claimedAt).getTime()) / DAY);
  let best: Stats['best'] = null;
  for (const c of claims) {
    const mult = peakMult(c);
    if (mult != null && (!best || mult > best.mult)) best = { claim: c, mult };
  }
  return {
    total: claims.length,
    watching: claims.filter(c => c.status === 'watching').length,
    hits: hits.length,
    dropped: claims.filter(c => c.status === 'dropped').length,
    hitRate: claims.length ? hits.length / claims.length : null,
    avgDaysToHit: toHit.length ? toHit.reduce((a, b) => a + b, 0) / toHit.length : null,
    best,
    checkins: checkinCount(claims),
  };
}
