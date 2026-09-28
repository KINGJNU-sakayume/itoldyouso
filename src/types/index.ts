export type Lang = 'ko' | 'en';

/** Numbers the user types in by hand. All optional; a pick tracks whichever ones were filled. */
export const METRIC_KEYS = ['views', 'streams', 'listeners'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type Metrics = Partial<Record<MetricKey, number>>;

export interface Snapshot {
  id: string;
  /** ISO datetime */
  at: string;
  values: Metrics;
  memo?: string;
}

export type ClaimStatus = 'watching' | 'hit' | 'dropped';
export type HitReason = 'growth' | 'target' | 'manual';

export interface Target {
  metric: MetricKey;
  value: number;
}

export interface Claim {
  id: string;
  artist: string;
  track: string;
  youtubeUrl?: string;
  /** Any other link: Spotify, Melon, SoundCloud, Bandcamp… */
  link?: string;
  /** Overrides the YouTube thumbnail as cover art. */
  imageUrl?: string;
  tags: string[];
  /** Why this song — written at pick time. */
  note: string;
  /** Metric the growth rate and the hit rule are measured on. */
  primary: MetricKey;
  target?: Target;
  /** ISO datetime of the pick. snapshots[0] is taken at this moment. */
  claimedAt: string;
  /** Sorted by `at`, oldest first. snapshots[0] is the entry point. */
  snapshots: Snapshot[];
  status: ClaimStatus;
  hitAt?: string;
  hitReason?: HitReason;
  /** Free text for a manual hit ("won a rookie award") or a drop. */
  statusNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  /** A pick counts as a hit once its primary metric reaches entry × this. */
  hitMultiplier: number;
  /** New picks allowed per calendar month. 0 = unlimited. */
  monthlyLimit: number;
  /** A watching pick is due for a check-in after this many days. */
  staleDays: number;
}

/** Everything that is stored and exported. */
export interface VaultDoc {
  app: 'itoldyouso';
  version: 2;
  claims: Claim[];
  /** Deleted claim id → deletion time, so deletes survive merges. */
  tombstones: Record<string, string>;
  settings: Settings;
  settingsUpdatedAt: string;
  /** Achievement ids the user has already been notified about. */
  seen: string[];
}

/** What the pick form produces. */
export interface ClaimDraft {
  artist: string;
  track: string;
  youtubeUrl?: string;
  link?: string;
  imageUrl?: string;
  tags: string[];
  note: string;
  primary: MetricKey;
  target?: Target;
  claimedAt: string;
  entry: Metrics;
}
