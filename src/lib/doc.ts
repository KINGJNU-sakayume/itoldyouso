import { METRIC_KEYS } from '../types';
import type { Claim, ClaimStatus, HitReason, MetricKey, Metrics, Settings, Snapshot, VaultDoc } from '../types';
import { fmtDateTime } from './format';
import { entryValue, latestPoint, headline, sortSnapshots } from './metrics';
import { uid } from './id';

export const DEFAULT_SETTINGS: Settings = { hitMultiplier: 2, monthlyLimit: 5, staleDays: 14 };
export const EPOCH = new Date(0).toISOString();

export function emptyDoc(): VaultDoc {
  return {
    app: 'itoldyouso',
    version: 2,
    claims: [],
    tombstones: {},
    settings: { ...DEFAULT_SETTINGS },
    settingsUpdatedAt: EPOCH,
    seen: [],
  };
}

// ── Validation ────────────────────────────────────────────────────────────────
// Imported files and stored state are untrusted input: keep what is valid,
// drop what is not, never throw.

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const isoOr = (v: unknown, fallback?: string): string | undefined =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : fallback;
const isMetric = (v: unknown): v is MetricKey => METRIC_KEYS.includes(v as MetricKey);
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function metrics(v: unknown): Metrics {
  const out: Metrics = {};
  if (!isObj(v)) return out;
  for (const k of METRIC_KEYS) {
    const n = v[k];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = Math.round(n);
  }
  return out;
}

function snapshot(v: unknown): Snapshot | null {
  if (!isObj(v)) return null;
  const at = isoOr(v.at);
  const values = metrics(v.values);
  if (!at || !Object.keys(values).length) return null;
  return { id: str(v.id) ?? uid(), at, values, ...(str(v.memo) ? { memo: str(v.memo) } : {}) };
}

export function normalizeClaim(v: unknown): Claim | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const artist = str(v.artist);
  const track = str(v.track);
  const claimedAt = isoOr(v.claimedAt);
  if (!id || !artist || !track || !claimedAt) return null;

  const snapshots = sortSnapshots(
    (Array.isArray(v.snapshots) ? v.snapshots : []).map(snapshot).filter((s): s is Snapshot => !!s),
  );
  if (!snapshots.length) return null;

  const status: ClaimStatus = ['watching', 'hit', 'dropped'].includes(v.status as string)
    ? (v.status as ClaimStatus)
    : 'watching';
  const hitReason = ['growth', 'target', 'manual'].includes(v.hitReason as string)
    ? (v.hitReason as HitReason)
    : undefined;
  const target =
    isObj(v.target) && isMetric(v.target.metric) && typeof v.target.value === 'number' && v.target.value > 0
      ? { metric: v.target.metric, value: Math.round(v.target.value) }
      : undefined;
  const tags = Array.isArray(v.tags)
    ? [...new Set(v.tags.map(str).filter((t): t is string => !!t))]
    : [];

  const claim: Claim = {
    id,
    artist,
    track,
    youtubeUrl: str(v.youtubeUrl),
    link: str(v.link),
    imageUrl: str(v.imageUrl),
    tags,
    note: typeof v.note === 'string' ? v.note.trim() : '',
    primary: isMetric(v.primary) ? v.primary : 'views',
    target,
    claimedAt,
    snapshots,
    status,
    hitAt: status === 'hit' ? isoOr(v.hitAt, snapshots[snapshots.length - 1].at) : undefined,
    hitReason: status === 'hit' ? (hitReason ?? 'manual') : undefined,
    statusNote: str(v.statusNote),
    createdAt: isoOr(v.createdAt, claimedAt)!,
    updatedAt: isoOr(v.updatedAt, claimedAt)!,
  };
  // Drop undefined keys so documents compare and serialize cleanly.
  return JSON.parse(JSON.stringify(claim));
}

export function normalizeSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  return {
    hitMultiplier: clamp(s.hitMultiplier, 1.1, 1000, DEFAULT_SETTINGS.hitMultiplier),
    monthlyLimit: Math.round(clamp(s.monthlyLimit, 0, 100, DEFAULT_SETTINGS.monthlyLimit)),
    staleDays: Math.round(clamp(s.staleDays, 1, 365, DEFAULT_SETTINGS.staleDays)),
  };
}

/** Returns null when the input is not an I Told You So document at all. */
export function normalizeDoc(raw: unknown): VaultDoc | null {
  if (!isObj(raw) || raw.app !== 'itoldyouso' || !Array.isArray(raw.claims)) return null;
  const claims = new Map<string, Claim>();
  for (const c of raw.claims.map(normalizeClaim)) {
    if (c && (!claims.has(c.id) || claims.get(c.id)!.updatedAt < c.updatedAt)) claims.set(c.id, c);
  }
  const tombstones: Record<string, string> = {};
  if (isObj(raw.tombstones)) {
    for (const [id, at] of Object.entries(raw.tombstones)) {
      const iso = isoOr(at);
      if (iso) tombstones[id] = iso;
    }
  }
  return {
    app: 'itoldyouso',
    version: 2,
    claims: [...claims.values()],
    tombstones,
    settings: normalizeSettings(raw.settings),
    settingsUpdatedAt: isoOr(raw.settingsUpdatedAt, EPOCH)!,
    seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [],
  };
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Merges two copies of the vault, e.g. this browser and a backup file. Each
 * pick is resolved on its own (newest edit wins), deletions win over older
 * edits, and settings take the most recently changed side. Commutative, so
 * the order of the two copies doesn't matter.
 */
export function mergeDocs(a: VaultDoc, b: VaultDoc): VaultDoc {
  const tombstones: Record<string, string> = { ...a.tombstones };
  for (const [id, at] of Object.entries(b.tombstones)) {
    if (!tombstones[id] || tombstones[id] < at) tombstones[id] = at;
  }

  const claims = new Map<string, Claim>();
  for (const c of [...a.claims, ...b.claims]) {
    const prev = claims.get(c.id);
    if (!prev || prev.updatedAt < c.updatedAt || (prev.updatedAt === c.updatedAt && JSON.stringify(c) > JSON.stringify(prev))) {
      claims.set(c.id, c);
    }
  }
  for (const [id, c] of claims) {
    if (tombstones[id] && tombstones[id] >= c.updatedAt) claims.delete(id);
  }

  const settingsFromB =
    b.settingsUpdatedAt > a.settingsUpdatedAt ||
    (b.settingsUpdatedAt === a.settingsUpdatedAt && JSON.stringify(b.settings) > JSON.stringify(a.settings));

  return {
    app: 'itoldyouso',
    version: 2,
    claims: [...claims.values()],
    tombstones,
    settings: settingsFromB ? b.settings : a.settings,
    settingsUpdatedAt: settingsFromB ? b.settingsUpdatedAt : a.settingsUpdatedAt,
    seen: [...new Set([...a.seen, ...b.seen])],
  };
}

/** Order-independent serialization, for "did anything change?" checks. */
export function canonical(doc: VaultDoc): string {
  return JSON.stringify({
    ...doc,
    claims: [...doc.claims].sort((x, y) => x.id.localeCompare(y.id)),
    tombstones: Object.fromEntries(Object.entries(doc.tombstones).sort(([x], [y]) => x.localeCompare(y))),
    seen: [...doc.seen].sort(),
  });
}

export function sameDoc(a: VaultDoc, b: VaultDoc): boolean {
  return canonical(a) === canonical(b);
}

// ── Export ────────────────────────────────────────────────────────────────────

export function toBackupJson(doc: VaultDoc): string {
  return JSON.stringify({ ...doc, exportedAt: new Date().toISOString() }, null, 2);
}

function csvCell(v: string | number | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(claims: Claim[]): string {
  const header = [
    'claimed_at', 'artist', 'track', 'status', 'hit_at', 'primary_metric', 'growth_pct',
    ...METRIC_KEYS.flatMap(m => [`entry_${m}`, `latest_${m}`]),
    'checkins', 'tags', 'note', 'youtube_url', 'link',
  ];
  const rows = [...claims]
    .sort((a, b) => a.claimedAt.localeCompare(b.claimedAt))
    .map(c => {
      const h = headline(c);
      return [
        fmtDateTime(c.claimedAt), c.artist, c.track, c.status, c.hitAt ? fmtDateTime(c.hitAt) : '',
        h?.metric, h?.mult != null ? Math.round((h.mult - 1) * 1000) / 10 : '',
        ...METRIC_KEYS.flatMap(m => [entryValue(c, m), latestPoint(c, m)?.value]),
        c.snapshots.length - 1, c.tags.join(' '), c.note, c.youtubeUrl, c.link,
      ].map(csvCell).join(',');
    });
  // BOM so Excel opens Korean text correctly.
  return '﻿' + [header.join(','), ...rows].join('\r\n');
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dateStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
