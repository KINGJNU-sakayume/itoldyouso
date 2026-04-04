/*
  # Migrate Spotify growth metrics to Last.fm equivalents

  ## Summary
  Spotify deprecated artist.popularity and artist.followers in February 2026.
  This migration replaces these columns with Last.fm listener and playcount data.

  ## Changes to `claims` table
  - RENAME entry_popularity  → entry_listeners  (Last.fm global monthly unique listeners)
  - RENAME entry_followers   → entry_playcount  (Last.fm cumulative total play count)
  - RENAME current_popularity → current_listeners
  - RENAME current_followers  → current_playcount

  ## Changes to `artist_snapshots` table
  - RENAME popularity → listeners
  - RENAME followers  → playcount

  ## Updates to DB functions
  - calculate_vibe_index() fallback path updated to use entry_listeners/current_listeners
*/

-- Rename columns in claims table
ALTER TABLE claims RENAME COLUMN entry_popularity   TO entry_listeners;
ALTER TABLE claims RENAME COLUMN entry_followers    TO entry_playcount;
ALTER TABLE claims RENAME COLUMN current_popularity TO current_listeners;
ALTER TABLE claims RENAME COLUMN current_followers  TO current_playcount;

-- Change type to bigint to accommodate large listener counts
ALTER TABLE claims ALTER COLUMN entry_listeners   TYPE bigint;
ALTER TABLE claims ALTER COLUMN entry_playcount   TYPE bigint;
ALTER TABLE claims ALTER COLUMN current_listeners TYPE bigint;
ALTER TABLE claims ALTER COLUMN current_playcount TYPE bigint;

-- Rename columns in artist_snapshots table
ALTER TABLE artist_snapshots RENAME COLUMN popularity TO listeners;
ALTER TABLE artist_snapshots RENAME COLUMN followers  TO playcount;

ALTER TABLE artist_snapshots ALTER COLUMN listeners TYPE bigint;
ALTER TABLE artist_snapshots ALTER COLUMN playcount TYPE bigint;

-- Update calculate_vibe_index() to reference renamed columns
-- Primary metric remains YouTube view growth; Last.fm listeners growth is the new fallback
CREATE OR REPLACE FUNCTION calculate_vibe_index(p_claim_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_claim claims%ROWTYPE;
  v_view_growth  numeric;
  v_like_growth  numeric;
  v_listen_growth numeric;
  v_result       numeric;
BEGIN
  SELECT * INTO v_claim FROM claims WHERE id = p_claim_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Primary: YouTube view growth (60%) + like growth (40%)
  IF v_claim.entry_youtube_view_count IS NOT NULL
     AND v_claim.entry_youtube_view_count > 0
     AND v_claim.youtube_view_count IS NOT NULL
  THEN
    v_view_growth := (v_claim.youtube_view_count::numeric - v_claim.entry_youtube_view_count::numeric)
                     / v_claim.entry_youtube_view_count::numeric * 100;
  END IF;

  IF v_claim.entry_youtube_like_count IS NOT NULL
     AND v_claim.entry_youtube_like_count > 0
     AND v_claim.youtube_like_count IS NOT NULL
  THEN
    v_like_growth := (v_claim.youtube_like_count::numeric - v_claim.entry_youtube_like_count::numeric)
                     / v_claim.entry_youtube_like_count::numeric * 100;
  END IF;

  IF v_view_growth IS NOT NULL AND v_like_growth IS NOT NULL THEN
    v_result := v_view_growth * 0.6 + v_like_growth * 0.4;
  ELSIF v_view_growth IS NOT NULL THEN
    v_result := v_view_growth;
  ELSIF v_like_growth IS NOT NULL THEN
    v_result := v_like_growth;
  ELSE
    -- Fallback: Last.fm listener growth (formerly Spotify followers)
    IF v_claim.entry_listeners > 0 THEN
      v_listen_growth := (v_claim.current_listeners::numeric - v_claim.entry_listeners::numeric)
                         / v_claim.entry_listeners::numeric * 100;
      v_result := v_listen_growth;
    ELSE
      v_result := 0;
    END IF;
  END IF;

  RETURN ROUND(v_result, 1);
END;
$$;

-- Re-run recalculation with updated function
SELECT recalculate_all_vibe_indexes();
