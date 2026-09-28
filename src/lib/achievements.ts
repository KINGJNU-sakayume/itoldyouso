import type { Claim, MetricKey } from '../types';
import { DAY } from './format';
import { baseMetric, entryValue } from './metrics';

export type AchievementGroup = 'discovery' | 'growth' | 'accuracy' | 'habit' | 'collection';
export type Tier = 1 | 2 | 3 | 4;

export interface Progress {
  current: number;
  goal: number;
  kind: 'count' | 'mult' | 'percent';
}

export interface AchievementResult {
  id: string;
  group: AchievementGroup;
  tier: Tier;
  glyph: string;
  /** When the condition was first met, derived from the data itself. */
  earnedAt: string | null;
  /** The pick that earned it, when a single pick did. */
  claimId?: string;
  progress?: Progress;
}

type Check = Pick<AchievementResult, 'earnedAt' | 'claimId' | 'progress'>;

interface Ctx {
  /** Oldest pick first. */
  claims: Claim[];
  /** Hit picks, earliest hit first. */
  hits: Claim[];
}

interface Def {
  id: string;
  group: AchievementGroup;
  tier: Tier;
  glyph: string;
  check: (ctx: Ctx) => Check;
}

const time = (iso: string) => new Date(iso).getTime();
const NONE: Check = { earnedAt: null };

function earliest(cands: { at: string; claimId?: string }[]): Check {
  if (!cands.length) return NONE;
  const first = cands.reduce((a, b) => (b.at < a.at ? b : a));
  return { earnedAt: first.at, claimId: first.claimId };
}

/** The n-th item (by date) earns it. */
function nth<T>(items: T[], n: number, at: (t: T) => string): Check {
  const sorted = [...items].sort((a, b) => at(a).localeCompare(at(b)));
  return {
    earnedAt: sorted.length >= n ? at(sorted[n - 1]) : null,
    progress: { current: Math.min(sorted.length, n), goal: n, kind: 'count' },
  };
}

function picksWhere(n: number, pred: (c: Claim) => boolean) {
  return (ctx: Ctx) => {
    const found = ctx.claims.filter(pred);
    const res = nth(found, n, c => c.claimedAt);
    if (n === 1 && found[0]) return { earnedAt: found[0].claimedAt, claimId: found[0].id };
    return res;
  };
}

function entryBelow(metric: MetricKey, limit: number) {
  return picksWhere(1, c => {
    const v = entryValue(c, metric);
    return v != null && v < limit;
  });
}

const hour = (c: Claim) => new Date(c.claimedAt).getHours();

function distinctTags(n: number) {
  return (ctx: Ctx): Check => {
    const seen = new Set<string>();
    for (const c of ctx.claims) {
      c.tags.forEach(tag => seen.add(tag.trim().toLowerCase()));
      if (seen.size >= n) return { earnedAt: c.claimedAt, progress: { current: n, goal: n, kind: 'count' } };
    }
    return { earnedAt: null, progress: { current: seen.size, goal: n, kind: 'count' } };
  };
}

/** Primary metric reaches entry × k, optionally within `days` of the pick. */
function reaches(k: number, days?: number) {
  return (ctx: Ctx): Check => {
    const cands: { at: string; claimId: string }[] = [];
    let best = 0;
    for (const c of ctx.claims) {
      const m = baseMetric(c);
      const entry = m ? entryValue(c, m) : undefined;
      if (!m || !entry) continue;
      const start = time(c.claimedAt);
      for (const s of c.snapshots.slice(1)) {
        const v = s.values[m];
        if (v == null) continue;
        if (days != null && time(s.at) - start > days * DAY) continue;
        const mult = v / entry;
        best = Math.max(best, mult);
        if (mult >= k) {
          cands.push({ at: s.at, claimId: c.id });
          break;
        }
      }
    }
    return { ...earliest(cands), progress: { current: Math.min(best, k), goal: k, kind: 'mult' } };
  };
}

/** A metric that started under `from` later reached `to`. */
function crosses(metric: MetricKey, from: number, to: number) {
  return (ctx: Ctx): Check => {
    const cands: { at: string; claimId: string }[] = [];
    for (const c of ctx.claims) {
      const entry = entryValue(c, metric);
      if (entry == null || entry >= from) continue;
      const s = c.snapshots.slice(1).find(s => (s.values[metric] ?? 0) >= to);
      if (s) cands.push({ at: s.at, claimId: c.id });
    }
    return earliest(cands);
  };
}

function hitsWhere(pred: (c: Claim, days: number) => boolean) {
  return (ctx: Ctx): Check =>
    earliest(
      ctx.hits
        .filter(c => c.hitAt && pred(c, (time(c.hitAt) - time(c.claimedAt)) / DAY))
        .map(c => ({ at: c.hitAt!, claimId: c.id })),
    );
}

function nthHit(n: number) {
  return (ctx: Ctx): Check => {
    const res = nth(ctx.hits.filter(c => c.hitAt), n, c => c.hitAt!);
    if (n === 1 && ctx.hits[0]) res.claimId = ctx.hits[0].id;
    return res;
  };
}

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return d.getFullYear() * 12 + d.getMonth();
};

function consecutiveMonths(n: number) {
  return (ctx: Ctx): Check => {
    const firstPickOfMonth = new Map<number, string>();
    for (const c of ctx.claims) {
      const k = monthKey(c.claimedAt);
      if (!firstPickOfMonth.has(k)) firstPickOfMonth.set(k, c.claimedAt);
    }
    const months = [...firstPickOfMonth.keys()].sort((a, b) => a - b);
    let run = 0;
    let longest = 0;
    for (let i = 0; i < months.length; i++) {
      run = i > 0 && months[i] === months[i - 1] + 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
      if (run >= n) {
        return { earnedAt: firstPickOfMonth.get(months[i])!, progress: { current: n, goal: n, kind: 'count' } };
      }
    }
    return { earnedAt: null, progress: { current: longest, goal: n, kind: 'count' } };
  };
}

function checkins(n: number) {
  return (ctx: Ctx): Check => nth(ctx.claims.flatMap(c => c.snapshots.slice(1)), n, s => s.at);
}

const hotStreak = (ctx: Ctx): Check => {
  let run = 0;
  let longest = 0;
  for (let i = 0; i < ctx.claims.length; i++) {
    run = ctx.claims[i].status === 'hit' ? run + 1 : 0;
    longest = Math.max(longest, run);
    if (run >= 3) {
      const window = ctx.claims.slice(i - 2, i + 1);
      const at = window.map(c => c.hitAt ?? c.updatedAt).sort().at(-1)!;
      return { earnedAt: at, progress: { current: 3, goal: 3, kind: 'count' } };
    }
  }
  return { earnedAt: null, progress: { current: longest, goal: 3, kind: 'count' } };
};

const cleanSheet = (ctx: Ctx): Check => {
  const byMonth = new Map<number, Claim[]>();
  for (const c of ctx.claims) {
    const k = monthKey(c.claimedAt);
    byMonth.set(k, [...(byMonth.get(k) ?? []), c]);
  }
  const cands: { at: string }[] = [];
  for (const picks of byMonth.values()) {
    if (picks.length >= 3 && picks.every(c => c.status === 'hit')) {
      cands.push({ at: picks.map(c => c.hitAt ?? c.updatedAt).sort().at(-1)! });
    }
  }
  return earliest(cands);
};

/** 10+ picks and at least half of them hits, at any point in time. */
const oracle = (ctx: Ctx): Check => {
  const events = [
    ...ctx.claims.map(c => ({ at: c.claimedAt, pick: 1, hit: 0 })),
    ...ctx.hits.filter(c => c.hitAt).map(c => ({ at: c.hitAt!, pick: 0, hit: 1 })),
  ].sort((a, b) => a.at.localeCompare(b.at) || b.pick - a.pick);
  let picks = 0;
  let hits = 0;
  for (const e of events) {
    picks += e.pick;
    hits += e.hit;
    if (picks >= 10 && hits / picks >= 0.5) return { earnedAt: e.at };
  }
  if (picks < 10) return { earnedAt: null, progress: { current: picks, goal: 10, kind: 'count' } };
  return { earnedAt: null, progress: { current: Math.round((hits / picks) * 100), goal: 50, kind: 'percent' } };
};

const bullseye = (ctx: Ctx): Check => {
  const cands: { at: string; claimId: string }[] = [];
  for (const c of ctx.claims) {
    if (!c.target) continue;
    const { metric, value } = c.target;
    const s = c.snapshots.slice(1).find(s => (s.values[metric] ?? 0) >= value);
    if (s) cands.push({ at: s.at, claimId: c.id });
  }
  return earliest(cands);
};

const longWatch = (ctx: Ctx): Check => {
  const cands: { at: string; claimId: string }[] = [];
  let longest = 0;
  for (const c of ctx.claims) {
    const start = time(c.claimedAt);
    for (const s of c.snapshots.slice(1)) {
      const days = (time(s.at) - start) / DAY;
      longest = Math.max(longest, days);
      if (days >= 365) {
        cands.push({ at: s.at, claimId: c.id });
        break;
      }
    }
  }
  return { ...earliest(cands), progress: { current: Math.min(365, Math.floor(longest)), goal: 365, kind: 'count' } };
};

const DEFS: Def[] = [
  // Collection
  { id: 'first_pick', group: 'collection', tier: 1, glyph: '1', check: picksWhere(1, () => true) },
  { id: 'picks_10', group: 'collection', tier: 1, glyph: '10', check: ctx => nth(ctx.claims, 10, c => c.claimedAt) },
  { id: 'picks_50', group: 'collection', tier: 2, glyph: '50', check: ctx => nth(ctx.claims, 50, c => c.claimedAt) },
  { id: 'picks_100', group: 'collection', tier: 3, glyph: '100', check: ctx => nth(ctx.claims, 100, c => c.claimedAt) },

  // Discovery — how early you were
  { id: 'basement_1', group: 'discovery', tier: 1, glyph: 'B1', check: entryBelow('views', 100_000) },
  { id: 'basement_2', group: 'discovery', tier: 2, glyph: 'B2', check: entryBelow('views', 10_000) },
  { id: 'basement_3', group: 'discovery', tier: 3, glyph: 'B3', check: entryBelow('views', 1_000) },
  { id: 'small_room', group: 'discovery', tier: 2, glyph: '10K', check: entryBelow('listeners', 10_000) },
  { id: 'omnivore', group: 'discovery', tier: 1, glyph: '#5', check: distinctTags(5) },
  { id: 'cartographer', group: 'discovery', tier: 2, glyph: '#12', check: distinctTags(12) },
  { id: 'two_am', group: 'discovery', tier: 1, glyph: '2AM', check: picksWhere(1, c => hour(c) >= 2 && hour(c) < 4) },
  { id: 'night_owl', group: 'discovery', tier: 2, glyph: '0-6', check: picksWhere(10, c => hour(c) < 6) },
  { id: 'opening_day', group: 'discovery', tier: 1, glyph: '01', check: picksWhere(1, c => new Date(c.claimedAt).getDate() === 1) },

  // Growth — how far they went
  { id: 'x2', group: 'growth', tier: 1, glyph: '×2', check: reaches(2) },
  { id: 'x10', group: 'growth', tier: 3, glyph: '×10', check: reaches(10) },
  { id: 'x100', group: 'growth', tier: 4, glyph: '×100', check: reaches(100) },
  { id: 'liftoff', group: 'growth', tier: 2, glyph: '30D', check: reaches(2, 30) },
  { id: 'viral', group: 'growth', tier: 3, glyph: '90D', check: reaches(5, 90) },
  { id: 'million', group: 'growth', tier: 3, glyph: '1M', check: crosses('views', 100_000, 1_000_000) },
  { id: 'ten_million', group: 'growth', tier: 4, glyph: '10M', check: crosses('views', 1_000_000, 10_000_000) },
  { id: 'crossover', group: 'growth', tier: 3, glyph: '↗', check: crosses('listeners', 100_000, 1_000_000) },
  { id: 'slow_burn', group: 'growth', tier: 2, glyph: '180D', check: hitsWhere((_, days) => days >= 180) },

  // Accuracy — how often you were right
  { id: 'told_you_so', group: 'accuracy', tier: 1, glyph: '!', check: nthHit(1) },
  { id: 'hat_trick', group: 'accuracy', tier: 2, glyph: '!3', check: nthHit(3) },
  { id: 'ten_hits', group: 'accuracy', tier: 3, glyph: '!10', check: nthHit(10) },
  { id: 'quick_call', group: 'accuracy', tier: 2, glyph: '7D', check: hitsWhere((_, days) => days <= 7) },
  { id: 'bullseye', group: 'accuracy', tier: 2, glyph: '◎', check: bullseye },
  { id: 'hot_streak', group: 'accuracy', tier: 3, glyph: '!!!', check: hotStreak },
  { id: 'clean_sheet', group: 'accuracy', tier: 3, glyph: '3/3', check: cleanSheet },
  { id: 'oracle', group: 'accuracy', tier: 4, glyph: '50%', check: oracle },

  // Habit — keeping the log alive
  { id: 'regular', group: 'habit', tier: 1, glyph: '3mo', check: consecutiveMonths(3) },
  { id: 'every_month', group: 'habit', tier: 3, glyph: '12mo', check: consecutiveMonths(12) },
  { id: 'watcher', group: 'habit', tier: 1, glyph: '+25', check: checkins(25) },
  { id: 'archivist', group: 'habit', tier: 2, glyph: '+100', check: checkins(100) },
  { id: 'long_watch', group: 'habit', tier: 3, glyph: '365', check: longWatch },
  { id: 'liner_notes', group: 'habit', tier: 2, glyph: '¶', check: picksWhere(10, c => c.note.trim().length >= 100) },
];

const COMPLETIONIST_GOAL = 20;

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = ['discovery', 'growth', 'accuracy', 'habit', 'collection'];
export const ACHIEVEMENT_COUNT = DEFS.length + 1;

export function evaluateAchievements(claims: Claim[]): AchievementResult[] {
  const sorted = [...claims].sort((a, b) => a.claimedAt.localeCompare(b.claimedAt));
  const ctx: Ctx = {
    claims: sorted,
    hits: sorted
      .filter(c => c.status === 'hit')
      .sort((a, b) => (a.hitAt ?? a.updatedAt).localeCompare(b.hitAt ?? b.updatedAt)),
  };

  const results: AchievementResult[] = DEFS.map(def => {
    const { check, ...meta } = def;
    return { ...meta, ...check(ctx) };
  });

  const earnedDates = results.flatMap(r => (r.earnedAt ? [r.earnedAt] : [])).sort();
  results.push({
    id: 'completionist',
    group: 'collection',
    tier: 4,
    glyph: '★',
    earnedAt: earnedDates.length >= COMPLETIONIST_GOAL ? earnedDates[COMPLETIONIST_GOAL - 1] : null,
    progress: { current: Math.min(earnedDates.length, COMPLETIONIST_GOAL), goal: COMPLETIONIST_GOAL, kind: 'count' },
  });

  return results;
}
