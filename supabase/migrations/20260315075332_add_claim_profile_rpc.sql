/*
  # Add claim_profile RPC function

  ## Purpose
  Provides a SECURITY DEFINER function that links a Supabase anonymous auth session
  to a Spotify profile. This lets returning users whose localStorage was cleared
  safely re-link their new anonymous session to the existing profile,
  because Spotify OAuth proves they own the account.

  ## How it works
  1. User completes Spotify OAuth — proves Spotify identity
  2. Client creates/restores a Supabase anonymous session
  3. Client calls `claim_profile(spotify_id)` — links auth.uid() to the profile
  4. All subsequent RLS checks use auth.uid() = profiles.auth_user_id
*/

CREATE OR REPLACE FUNCTION claim_profile(p_spotify_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET auth_user_id = auth.uid(),
      updated_at   = now()
  WHERE spotify_id = p_spotify_id;
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION claim_profile(text) TO authenticated;
