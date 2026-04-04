/*
  # Recalculate vibe_index using YouTube view growth

  ## Summary
  Previously vibe_index was calculated from Spotify popularity score changes.
  Now that claims require a YouTube video, we recalculate vibe_index as:
    (current_youtube_views - entry_youtube_views) / entry_youtube_views * 100

  For claims without YouTube data (legacy), the old Spotify-based formula is kept.

  ## Changes
  - Updates vibe_index for all claims that have entry_youtube_view_count > 0
    using youtube_view_count growth percentage
  - Claims without YouTube data are left unchanged
*/

UPDATE claims
SET vibe_index = ROUND(
  ((youtube_view_count::numeric - entry_youtube_view_count::numeric)
    / NULLIF(entry_youtube_view_count::numeric, 0)) * 100
)
WHERE
  entry_youtube_view_count IS NOT NULL
  AND entry_youtube_view_count > 0
  AND youtube_view_count IS NOT NULL;
