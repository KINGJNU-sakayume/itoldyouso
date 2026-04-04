import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, SpotifyUser } from '../types';
import { supabase } from '../lib/supabase';
import { getSpotifyUser, clearTokens, storeTokens, getStoredToken, refreshAccessToken } from '../lib/spotify';

interface AuthState {
  profile: Profile | null;
  spotifyUser: SpotifyUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  setProfile: (profile: Profile | null) => void;
  setAccessToken: (token: string) => void;
  initialize: () => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      spotifyUser: null,
      accessToken: null,
      isLoading: false,
      isInitialized: false,

      setProfile: (profile) => set({ profile }),

      setAccessToken: (token) => set({ accessToken: token }),

      initialize: async () => {
        set({ isLoading: true });
        try {
          const token = get().accessToken || getStoredToken();
          if (!token) {
            set({ isLoading: false, isInitialized: true });
            return;
          }

          let spotifyUser: SpotifyUser;
          try {
            spotifyUser = await getSpotifyUser(token);
          } catch {
            const refreshToken = localStorage.getItem('spotify_refresh_token');
            if (!refreshToken) {
              clearTokens();
              set({ profile: null, spotifyUser: null, accessToken: null, isLoading: false, isInitialized: true });
              return;
            }
            const result = await refreshAccessToken(refreshToken);
            storeTokens(result.access_token, refreshToken, result.expires_in);
            set({ accessToken: result.access_token });
            spotifyUser = await getSpotifyUser(result.access_token);
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('spotify_id', spotifyUser.id)
            .maybeSingle();

          set({ spotifyUser, profile, isLoading: false, isInitialized: true });
        } catch {
          clearTokens();
          set({ profile: null, spotifyUser: null, accessToken: null, isLoading: false, isInitialized: true });
        }
      },

      logout: async () => {
        clearTokens();
        await supabase.auth.signOut();
        set({ profile: null, spotifyUser: null, accessToken: null });
      },

      refreshToken: async () => {
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (!refreshToken) return null;
        try {
          const result = await refreshAccessToken(refreshToken);
          storeTokens(result.access_token, refreshToken, result.expires_in);
          set({ accessToken: result.access_token });
          return result.access_token;
        } catch {
          return null;
        }
      },
    }),
    {
      name: 'itoldyouso-auth',
      partialize: (state) => ({ accessToken: state.accessToken }),
    }
  )
);
