import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearTokens, storeTokens, getStoredToken, refreshAccessToken } from '../lib/spotify';

interface AuthState {
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  setAccessToken: (token: string) => void;
  initialize: () => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      isLoading: false,
      isInitialized: false,

      setAccessToken: (token) => set({ accessToken: token }),

      initialize: async () => {
        const token = get().accessToken || getStoredToken();
        if (token) {
          set({ accessToken: token, isInitialized: true });
        } else {
          set({ isInitialized: true });
        }
      },

      logout: () => {
        clearTokens();
        set({ accessToken: null });
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
