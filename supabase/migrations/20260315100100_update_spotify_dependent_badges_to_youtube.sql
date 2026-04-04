/*
  # Update Spotify-dependent badges to YouTube-based criteria

  ## Summary
  Several badges relied on Spotify-specific metrics (followers, popularity, Spotify Global Top 50).
  Since the platform now requires YouTube for all claims, these badges are updated to use
  YouTube growth metrics instead.

  ## Badge Changes

  ### rocket_fuel
  - OLD: "Artist gained 10k followers within 30 days of your claim"
  - NEW: "YouTube views doubled within 30 days of your claim" (100%+ growth in 30 days)

  ### viral_catalyst
  - OLD: "Artist gained 100k followers within 90 days of your claim"
  - NEW: "YouTube views grew 5x within 90 days of your claim" (500%+ growth in 90 days)

  ### trendsetter_legacy
  - OLD: "An artist you claimed reached the Spotify Global Top 50"
  - NEW: "A claim reached a Vibe Index of 1,000% or more" (YouTube view growth)

  ### underground_oxygen (description sync)
  - OLD: "Claimed an artist with a popularity score below 10"
  - NEW: "Claimed a track with fewer than 100K YouTube views at time of claim"

  ### deep_diver (description sync)
  - OLD: "Claimed an artist with fewer than 1,000 followers"
  - NEW: "Claimed a track with fewer than 1,000 YouTube likes at time of claim"
*/

UPDATE badges SET
  description = 'YouTube views doubled within 30 days of your claim (100%+ view growth)'
WHERE id = 'rocket_fuel';

UPDATE badges SET
  description = 'YouTube views grew 5x within 90 days of your claim (500%+ view growth)'
WHERE id = 'viral_catalyst';

UPDATE badges SET
  description = 'A claim reached a Vibe Index of 1,000% or more — true viral discovery'
WHERE id = 'trendsetter_legacy';

UPDATE badges SET
  description = 'Claimed a track with fewer than 100K YouTube views at time of claim'
WHERE id = 'underground_oxygen';

UPDATE badges SET
  description = 'Claimed a track with fewer than 1,000 YouTube likes at time of claim'
WHERE id = 'deep_diver';
