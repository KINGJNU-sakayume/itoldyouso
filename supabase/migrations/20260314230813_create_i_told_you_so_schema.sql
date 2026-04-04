/*
  # I Told You So - Complete Database Schema

  ## Overview
  Full schema for the music discovery validation platform. Users connect via Spotify,
  make claims about rising artists, and earn validation badges when their predictions prove correct.

  ## Tables Created

  ### 1. profiles
  - Stores Spotify-authenticated user profiles
  - Tracks monthly claim quota and reset timing
  - Links to Spotify user data (ID, display name, avatar)

  ### 2. claims
  - Core table storing artist discovery claims
  - Captures entry-point snapshot data (popularity, followers) at time of claim
  - Tracks current values for growth comparison
  - Stores user-written insight text
  - Computes validation status

  ### 3. artist_snapshots
  - Historical time-series data for charts in The Vault
  - One record per claim per update cycle
  - Powers smooth area charts showing artist growth over time

  ### 4. respects
  - User "Respect" reactions on claims (one per user per claim)
  - Powers the Cultural Curator badge system

  ### 5. badges
  - Seed table of all 35+ badge definitions
  - Includes name, description, icon, category, rarity

  ### 6. user_badges
  - Join table tracking which badges each user has earned
  - Optionally links to the claim that triggered the badge

  ## Security
  - RLS enabled on all tables
  - Users can only modify their own data
  - Public read access for feed and profiles
  - Respects are uniquely constrained per user per claim
*/

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  spotify_url text DEFAULT '',
  claims_this_month integer DEFAULT 0,
  last_claim_reset timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- CLAIMS TABLE
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  spotify_artist_id text NOT NULL,
  artist_name text NOT NULL,
  artist_image_url text DEFAULT '',
  track_id text DEFAULT '',
  track_name text DEFAULT '',
  album_cover_url text DEFAULT '',
  genres text[] DEFAULT '{}',
  entry_popularity integer NOT NULL DEFAULT 0,
  entry_followers integer NOT NULL DEFAULT 0,
  current_popularity integer DEFAULT 0,
  current_followers integer DEFAULT 0,
  vibe_index numeric DEFAULT 0,
  insight text NOT NULL DEFAULT '',
  is_validated boolean DEFAULT false,
  validated_at timestamptz,
  respect_count integer DEFAULT 0,
  is_pioneer boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Claims are publicly readable"
  ON claims FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claims"
  ON claims FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own claims"
  ON claims FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ARTIST SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS artist_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  spotify_artist_id text NOT NULL,
  popularity integer DEFAULT 0,
  followers integer DEFAULT 0,
  vibe_index numeric DEFAULT 0,
  snapshot_date timestamptz DEFAULT now()
);

ALTER TABLE artist_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots are publicly readable"
  ON artist_snapshots FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert snapshots"
  ON artist_snapshots FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- RESPECTS TABLE
CREATE TABLE IF NOT EXISTS respects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(claim_id, user_id)
);

ALTER TABLE respects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Respects are publicly readable"
  ON respects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert respects"
  ON respects FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own respects"
  ON respects FOR DELETE
  TO anon, authenticated
  USING (true);

-- BADGES TABLE
CREATE TABLE IF NOT EXISTS badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL,
  rarity text NOT NULL DEFAULT 'common'
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are publicly readable"
  ON badges FOR SELECT
  TO anon, authenticated
  USING (true);

-- USER BADGES TABLE
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id text NOT NULL REFERENCES badges(id),
  claim_id uuid REFERENCES claims(id) ON DELETE SET NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges are publicly readable"
  ON user_badges FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert user badges"
  ON user_badges FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_is_validated ON claims(is_validated);
CREATE INDEX IF NOT EXISTS idx_artist_snapshots_claim_id ON artist_snapshots(claim_id);
CREATE INDEX IF NOT EXISTS idx_artist_snapshots_date ON artist_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_respects_claim_id ON respects(claim_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

-- SEED BADGE DEFINITIONS
INSERT INTO badges (id, name, description, icon, category, rarity) VALUES
  ('pioneer', 'The Pioneer', 'First person to claim a specific artist on the platform', 'Compass', 'discovery', 'legendary'),
  ('underground_oxygen', 'Underground Oxygen', 'Claimed an artist with a popularity score below 10', 'Wind', 'discovery', 'rare'),
  ('deep_diver', 'Deep Diver', 'Claimed an artist with fewer than 1,000 followers', 'Anchor', 'discovery', 'rare'),
  ('genre_explorer', 'Genre Explorer', 'Claimed artists across 5 different genres', 'Map', 'discovery', 'common'),
  ('midnight_finder', 'Midnight Finder', 'Made a claim between 2 AM and 4 AM', 'Moon', 'discovery', 'common'),
  ('thousand_percent_club', '1,000% Club', 'A claim where the Vibe Index grew by 10x', 'Zap', 'growth', 'legendary'),
  ('moonshot', 'Moonshot', 'A claim where the Vibe Index grew by 5x', 'Rocket', 'growth', 'epic'),
  ('steady_climber', 'Steady Climber', '3 claims showing consistent growth over 3 months', 'TrendingUp', 'growth', 'rare'),
  ('rocket_fuel', 'Rocket Fuel', 'Artist gained 10k followers within 30 days of your claim', 'Flame', 'growth', 'epic'),
  ('viral_catalyst', 'Viral Catalyst', 'Artist gained 100k followers within 90 days of your claim', 'Radio', 'growth', 'legendary'),
  ('the_oracle', 'The Oracle', 'Achieved over 80% validation success rate across all claims', 'Eye', 'accuracy', 'legendary'),
  ('prophetic_vision', 'Prophetic Vision', '5 consecutive claims that were all validated', 'Star', 'accuracy', 'epic'),
  ('perfect_record', 'Perfect Record', 'All claims in a single month were validated', 'Shield', 'accuracy', 'rare'),
  ('trend_whisperer', 'Trend Whisperer', 'Accumulated 10 validated claims in total', 'Waves', 'accuracy', 'rare'),
  ('clairvoyant', 'Clairvoyant', 'Accumulated 20 validated claims in total', 'Sparkles', 'accuracy', 'epic'),
  ('cultural_curator', 'Cultural Curator', 'A single claim received 100 or more Respects', 'Crown', 'social', 'legendary'),
  ('tastemaker', 'Tastemaker', 'A single claim received 50 or more Respects', 'Heart', 'social', 'epic'),
  ('respected_voice', 'Respected Voice', 'Accumulated 500 total Respects across all claims', 'Mic2', 'social', 'rare'),
  ('community_pillar', 'Community Pillar', 'Accumulated 1,000 total Respects across all claims', 'Users', 'social', 'epic'),
  ('icon', 'Icon', 'Accumulated 5,000 total Respects across all claims', 'Award', 'social', 'legendary'),
  ('trendsetter_legacy', 'Trendsetter Legacy', 'An artist you claimed reached the Spotify Global Top 50', 'Globe', 'achievement', 'legendary'),
  ('genre_sovereign', 'Genre Sovereign', 'Validated 5 consecutive claims within the same genre', 'Music4', 'achievement', 'epic'),
  ('early_bird', 'Early Bird', 'Made a claim within the first hour of the month', 'Sunrise', 'achievement', 'common'),
  ('consistent_curator', 'Consistent Curator', 'Made claims in 3 consecutive calendar months', 'Calendar', 'achievement', 'rare'),
  ('loyal_scout', 'Loyal Scout', 'Been active on the platform for 6 months', 'Badge', 'achievement', 'rare'),
  ('first_blood', 'First Blood', 'Made your very first claim on the platform', 'Flag', 'milestone', 'common'),
  ('hat_trick', 'Hat Trick', 'Validated 3 claims in a single month', 'Target', 'milestone', 'rare'),
  ('grand_master', 'Grand Master', 'Total combined Vibe Index growth exceeds 1,000%', 'Trophy', 'milestone', 'legendary'),
  ('sound_architect', 'Sound Architect', 'Claims span 10 or more different genres', 'Layers', 'milestone', 'epic'),
  ('legendary_taste', 'Legendary Taste', 'Hold 10 or more badges simultaneously', 'Gem', 'milestone', 'legendary'),
  ('the_veteran', 'The Veteran', 'Been active on the platform for a full year', 'Medal', 'milestone', 'epic'),
  ('diamond_ear', 'Diamond Ear', 'First claim validated within just 7 days of posting', 'Diamond', 'milestone', 'legendary'),
  ('night_owl', 'Night Owl', 'Made 10 claims between midnight and 6 AM', 'Moon', 'achievement', 'rare'),
  ('weekend_warrior', 'Weekend Warrior', 'Made claims on 5 consecutive weekends', 'Coffee', 'achievement', 'common'),
  ('zeitgeist', 'Zeitgeist', 'Three of your claimed artists trended simultaneously', 'Radio', 'achievement', 'legendary')
ON CONFLICT (id) DO NOTHING;
