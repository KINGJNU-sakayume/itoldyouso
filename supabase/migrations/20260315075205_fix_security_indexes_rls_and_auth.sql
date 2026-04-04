/*
  # Security Fixes: Indexes, RLS Policies, and Auth Integration

  ## Changes Made

  ### 1. Missing Foreign Key Indexes
  - Added index on `respects.user_id` (was missing, causing slow JOIN on FK)
  - Added index on `user_badges.badge_id` (was missing)
  - Added index on `user_badges.claim_id` (was missing)

  ### 2. Redundant Index Removal
  - Dropped `idx_respects_claim_id` — already covered by the UNIQUE(claim_id, user_id)
    multi-column index (which starts with claim_id)
  - Dropped `idx_user_badges_user_id` — already covered by the UNIQUE(user_id, badge_id)
    multi-column index (which starts with user_id)

  ### 3. Auth User ID on Profiles
  - Added `auth_user_id` column (uuid, references auth.users) so Supabase anonymous
    sessions can be linked to Spotify profiles, enabling proper auth.uid() checks in RLS.

  ### 4. Respect Count Trigger
  - Added a SECURITY DEFINER trigger function that auto-increments / decrements
    `claims.respect_count` whenever a row is inserted or deleted in `respects`.
  - This removes the need for client-side UPDATE on claims when toggling a Respect,
    which in turn allows the claims UPDATE policy to be strictly owner-only.

  ### 5. RLS Policy Overhaul
  - Dropped all "always true" policies.
  - Replaced with auth.uid()-scoped policies requiring an active Supabase session.
  - `profiles`: insert/update only by the matching anonymous auth session.
  - `claims`: insert/update only by the profile owner.
  - `artist_snapshots`: insert only by the owner of the parent claim.
  - `respects`: insert only by the matching profile, delete only by the matching profile.
  - `user_badges`: insert only by the matching profile.

  ### Security Notes
  - All SELECT policies remain open (public discovery platform by design).
  - Write operations now require an authenticated Supabase session (anon or full).
  - The respect_count trigger runs as SECURITY DEFINER so it can bypass RLS
    on claims to increment the counter when a respect is added by another user.
*/

-- ────────────────────────────────────────────────────────────
-- 1. Auth user ID column on profiles
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);

-- ────────────────────────────────────────────────────────────
-- 2. Add missing FK indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_respects_user_id      ON respects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id  ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_claim_id  ON user_badges(claim_id);

-- ────────────────────────────────────────────────────────────
-- 3. Drop redundant indexes (covered by UNIQUE constraints)
-- ────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_respects_claim_id;
DROP INDEX IF EXISTS idx_user_badges_user_id;

-- ────────────────────────────────────────────────────────────
-- 4. Respect count trigger (SECURITY DEFINER so it can update
--    claims.respect_count regardless of the caller's RLS)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_respect_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE claims
    SET respect_count = respect_count + 1,
        updated_at    = now()
    WHERE id = NEW.claim_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE claims
    SET respect_count = GREATEST(0, respect_count - 1),
        updated_at    = now()
    WHERE id = OLD.claim_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_respect_count ON respects;
CREATE TRIGGER trg_sync_respect_count
  AFTER INSERT OR DELETE ON respects
  FOR EACH ROW EXECUTE FUNCTION fn_sync_respect_count();

-- ────────────────────────────────────────────────────────────
-- 5. Drop all always-true write policies
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own profile"            ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"            ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert claims"   ON claims;
DROP POLICY IF EXISTS "Users can update own claims"             ON claims;
DROP POLICY IF EXISTS "Anyone can insert snapshots"             ON artist_snapshots;
DROP POLICY IF EXISTS "Anyone can insert respects"              ON respects;
DROP POLICY IF EXISTS "Users can delete own respects"           ON respects;
DROP POLICY IF EXISTS "Anyone can insert user badges"           ON user_badges;

-- ────────────────────────────────────────────────────────────
-- 6. Replacement RLS policies scoped to auth.uid()
-- ────────────────────────────────────────────────────────────

-- profiles
CREATE POLICY "Owner can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Owner can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING     (auth.uid() = auth_user_id)
  WITH CHECK(auth.uid() = auth_user_id);

-- claims: owner is the profile whose auth_user_id matches the session
CREATE POLICY "Owner can insert claim"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id           = claims.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update own claim"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id           = claims.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id           = claims.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

-- artist_snapshots: only the claim owner may insert a snapshot
CREATE POLICY "Claim owner can insert snapshot"
  ON artist_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   claims c
      JOIN   profiles p ON p.id = c.user_id
      WHERE  c.id              = artist_snapshots.claim_id
        AND  p.auth_user_id    = auth.uid()
    )
  );

-- respects: any authenticated user may add/remove their own respect
CREATE POLICY "Authenticated user can add respect"
  ON respects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id           = respects.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated user can remove own respect"
  ON respects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id           = respects.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

-- user_badges: only the profile owner may insert their own badges
CREATE POLICY "Owner can insert own badge"
  ON user_badges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id           = user_badges.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );
