import type { Claim, Metrics } from '../types';
import { normalizeClaim } from './doc';
import { youtubeWatchUrl } from './youtube';

/**
 * Converts rows of the old multi-user `claims` table (Spotify/Last.fm era)
 * into picks. Rows without any usable number are skipped.
 */
export function mapLegacyClaims(rows: unknown[]): { claims: Claim[]; skipped: number } {
  const claims: Claim[] = [];
  let skipped = 0;

  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => {
      const n = typeof v === 'string' ? Number(v) : v;
      return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const createdAt = typeof r.created_at === 'string' ? r.created_at : undefined;
    const updatedAt = typeof r.updated_at === 'string' ? r.updated_at : createdAt;

    const entry: Metrics = {
      views: num(r.entry_youtube_view_count),
      listeners: num(r.entry_listeners),
    };
    const latest: Metrics = {
      views: num(r.youtube_view_count),
      listeners: num(r.current_listeners),
    };
    const changed = latest.views !== entry.views || latest.listeners !== entry.listeners;

    const snapshots = [{ id: `${r.id}-entry`, at: createdAt, values: entry }];
    if (changed && updatedAt && createdAt && updatedAt > createdAt) {
      snapshots.push({ id: `${r.id}-latest`, at: updatedAt, values: latest });
    }

    const videoId = typeof r.youtube_video_id === 'string' ? r.youtube_video_id : undefined;
    const validated = r.is_validated === true;

    const claim = normalizeClaim({
      id: r.id,
      artist: r.artist_name,
      track: r.track_name || r.youtube_video_title || '—',
      youtubeUrl: videoId ? youtubeWatchUrl(videoId) : undefined,
      imageUrl: r.album_cover_url || r.artist_image_url || undefined,
      tags: Array.isArray(r.genres) ? r.genres.slice(0, 5) : [],
      note: r.insight ?? '',
      primary: entry.views != null ? 'views' : 'listeners',
      claimedAt: createdAt,
      snapshots,
      status: validated ? 'hit' : 'watching',
      hitAt: validated ? (r.validated_at ?? updatedAt) : undefined,
      hitReason: validated ? 'manual' : undefined,
      createdAt,
      updatedAt,
    });

    if (claim) claims.push(claim);
    else skipped++;
  }

  return { claims, skipped };
}
