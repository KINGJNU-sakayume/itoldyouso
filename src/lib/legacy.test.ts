import { describe, expect, it } from 'vitest';
import { mapLegacyClaims } from './legacy';

describe('mapLegacyClaims', () => {
  it('turns old claims rows into picks', () => {
    const { claims, skipped } = mapLegacyClaims([
      {
        id: '11111111-1111-1111-1111-111111111111',
        artist_name: 'Nova',
        track_name: 'Afterglow',
        genres: ['indie', 'dream pop'],
        insight: 'The bridge.',
        entry_listeners: 900,
        current_listeners: 1500,
        entry_youtube_view_count: 1000,
        youtube_view_count: 1000,
        youtube_video_id: 'dQw4w9WgXcQ',
        is_validated: true,
        validated_at: '2026-03-20T00:00:00Z',
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-20T00:00:00Z',
      },
      { id: '2', artist_name: 'Empty', created_at: '2026-03-14T00:00:00Z', entry_listeners: 0 },
    ]);
    expect(skipped).toBe(1);
    expect(claims).toHaveLength(1);
    const c = claims[0];
    expect(c).toMatchObject({ artist: 'Nova', track: 'Afterglow', primary: 'views', status: 'hit', hitReason: 'manual', note: 'The bridge.' });
    expect(c.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(c.snapshots.map(s => s.values)).toEqual([
      { views: 1000, listeners: 900 },
      { views: 1000, listeners: 1500 },
    ]);
  });
});
